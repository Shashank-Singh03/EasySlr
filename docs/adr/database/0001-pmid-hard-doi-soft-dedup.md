# ADR-0001: PMID is the only hard dedup key; DOI/title collisions are flagged, not deleted

- **Status:** Accepted
- **Date:** 2026-06-04
- **Area:** database

## Context / forces

Imports must handle duplicates. The provided `sample_article_import.xlsx` is effectively a test
harness, and it contains two distinct duplicate scenarios that pull in opposite directions:

- **Rows 16 & 17** share PMID `38910016` with *different* DOIs. This is the same PubMed record
  imported twice — a true duplicate that should be skipped.
- **Row 5** shares its DOI with **row 1**, but has a *different* PMID (`38910005` vs `38910001`) and
  a different title. In real bibliographic data, two different PMIDs with the same DOI is a *data
  quality signal* — a preprint vs. version-of-record, a corrigendum, or a data-entry error — **not a
  confirmed duplicate.**

A naive "dedup on any matching identifier" rule would silently delete row 5, destroying a distinct
article the researcher may need. For a systematic review, silently losing records is a
credibility-ending failure.

## Decision

- **PMID exact match is the only key we auto-skip on.** PMID uniquely identifies a PubMed record, so
  an exact match (within the file, then against the project) is high-confidence "same record" →
  skip. Enforced at the DB by `@@unique([projectId, pmid])` and at write time by
  `createMany({ skipDuplicates: true })` (`INSERT ... ON CONFLICT DO NOTHING`).
- **DOI collisions are imported and flagged** (`Article.possibleDupDoi = true`), surfaced as a badge
  in the table, for a human to resolve. They are **never** a DB constraint and never auto-deleted.
- **Postgres NULL-distinctness gives us partial-unique behaviour for free.** Postgres treats `NULL`
  as distinct in unique indexes, so `@@unique([projectId, pmid])` blocks duplicate *non-null* PMIDs
  while allowing many rows with no PMID (e.g. row 21, identified only by DOI). No raw partial-index
  migration is needed.

## Alternatives considered

- **Dedup on DOI as a hard key too.** Rejected: deletes row 5 — a different article — and would
  require a `@@unique([projectId, doi])` constraint that rejects the row at the DB layer,
  contradicting "import and flag." This was in an earlier draft and was the single worst decision in it.
- **Fuzzy title-similarity auto-merge** (e.g. trigram match → merge). Rejected for this timebox:
  false positives merge genuinely different papers; correct behaviour is to *suggest* to a human, not
  auto-act. Exact-title flagging is a cheap future add; fuzzy is deferred.
- **No dedup at all.** Rejected: re-importing the same export (a common user action) would double
  every article. Idempotent re-import is a core trust property.

## Tradeoffs introduced

- DOI/title collisions accumulate as flags the user must triage; we trade automation for safety.
- Rows with **no PMID** cannot be hard-deduped; two no-PMID rows sharing a DOI both import (both
  flagged). See BUGS (BUG-007). This is the correct conservative behaviour but means the dedup
  guarantee is "no duplicate non-null PMIDs," not "no duplicate articles."

## Risks that remain

- A user who ignores the `possibleDupDoi` badge keeps a real duplicate. Mitigation: badge is
  prominent and filterable.
- Title-collision detection is exact-only in v1; near-duplicate titles are not flagged.

## What would change this decision

If the upstream data source *guaranteed* DOI uniqueness per article, we could promote DOI to a second
hard key. It does not, so we don't.
