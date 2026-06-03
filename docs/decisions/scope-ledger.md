# Scope Ledger — what we built, deferred, and deliberately did NOT build

Scope control is part of the assessment. This is the honest accounting.

## In scope (P0 — the graded core)

- Organizations → Projects → Articles → Reviews domain model with server-side authorization.
- Excel import: header mapping, parse-failure taxonomy, validation, PMID-hard / DOI-soft dedup,
  `dryRun` preview + commit with a real summary, provenance (`ImportBatch`).
- Review table: server-side search/sort/filter/paginate, data-quality flag badges, loading/empty/
  no-results/error states.
- Review updates with optimistic-concurrency conflict handling.
- Focused tests: validation buckets against the real sample, parse failures, project access,
  import idempotency, review conflict.

## In scope (P1 — cheap, high-trust; add if core is green)

- Pre-commit preview UI (just `dryRun: true`), exclusion reasons, import undo (guarded),
  download rejected rows, bulk actions on selected rows, CSV export, URL table state.

## Deliberately deferred (and why)

| Deferred | Why not now | When we'd build it |
|----------|-------------|--------------------|
| Dual independent (PRISMA) screening | Single decision proves the workflow; modeled for the upgrade | Real multi-reviewer use |
| Decision-history audit log | Adds a table + write path; not required to demo the loop | Reproducibility/compliance need (BUG-002) |
| Author normalization | Author blob covers the common case | When author-level filtering matters (BUG-001) |
| Keyset pagination / approximate counts | Offset is fine at this scale | 10k+ articles per project (BUG-005) |
| Background import (SQS/S3/worker threads) | 25-row synchronous parse is correct and simplest | 10k+ row files |
| Postgres Row-Level Security | App-layer authz ladder is sufficient and explainable | Multi-service access or higher assurance |
| AWS/SST deployment | Strong signal but trades feature depth; documented instead | If time remains after P0/P1 |
| Saved named views (vs URL state) | URL state already gives shareable views | If users want named, persisted views |

## The discipline

Once the core workflow is working end-to-end, the right move is to **stop and document** rather than
add another large feature. A smaller, working, well-explained submission beats a big unfinished one.
