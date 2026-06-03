# ADR-0002: One pure import pipeline, exposed via a `dryRun` flag

- **Status:** Accepted
- **Date:** 2026-06-04
- **Area:** backend

## Context / forces

The import needs a **preview** ("show me what will happen before you touch my project" — a listed
enhancement and a real trust feature) and a **commit**. The obvious two-phase design — preview parses
and returns rows, the client sends those rows back to commit — has two problems:

1. **Tamper / integrity.** If commit trusts client-resubmitted rows, the client can rewrite article
   content, labels, or even the `projectId` between preview and commit. Never trust client-supplied
   data on a write path.
2. **Drift & idempotency.** A server-stored DRAFT payload adds a lifecycle (DRAFT → COMMITTED), a JSON
   payload column, and idempotency-by-draft-id — machinery that only exists to work around problem 1.

## Decision

A single pure pipeline — `mapHeaders → parse → normalize → validate → classify → dedupe` — lives in
`src/server/services/import/` and is exposed through **one** tRPC procedure:

```
import.process({ projectId, file, dryRun })
  dryRun = true  → run pipeline, return buckets, write NOTHING   (this is "preview")
  dryRun = false → run the SAME pipeline, then write + record an ImportBatch + return ACTUAL counts
```

The server **always parses the file**; the client never sends row data. Preview and commit are
physically the same code path, so they cannot disagree. Idempotency falls out of PMID
`skipDuplicates` (ADR-0001): re-running the same file inserts nothing new.

## Alternatives considered

- **Two-phase with a server-stored DRAFT payload.** Rejected: adds a status field, a JSON payload
  column, and idempotency-by-id to solve a tamper problem that vanishes once the server re-parses.
  Complexity with no user behind it.
- **Client resends parsed rows to commit.** Rejected: tamper vector on a write path.
- **One-shot import, no preview.** Acceptable fallback and is effectively what the P0 UI does (upload →
  results). The `dryRun` seam means the pre-commit preview screen is a pure additive UI change.

## Tradeoffs introduced

- A large file is parsed **twice** in the preview→commit flow (BUG-006). For the assignment's 25-row
  file this is free; for big files it is wasteful.
- Holding the file in browser memory between preview and commit (the client re-submits the same File).

## Risks that remain

- Memory/time for very large uploads, since parsing is synchronous and in-memory. Mitigated by a 5 MB
  upload cap in v1.

## What would change this decision

Files in the 10k+ row range → switch to presigned S3 upload + a background worker that parses once and
stores the result, with the client polling batch status. The pure pipeline is reused unchanged; only
the transport and the "where it runs" change.
