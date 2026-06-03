# ADR-0005: Server-side pagination/sort/filter/search; the client never holds the dataset

- **Status:** Accepted
- **Date:** 2026-06-04
- **Area:** frontend

## Context / forces

The review table is the core surface. A real SLR project can hold thousands to tens of thousands of
articles, and article visibility is project-scoped. The sample file has 25 rows, which tempts a
client-side table — but that choice doesn't survive contact with a real project.

## Decision

All of pagination, sorting, filtering, and search happen **in Postgres**, driven by one query
`article.list({ projectId, page, pageSize, sort, filters, search })`. The frontend uses **TanStack
Table v8 in `manual*` mode** (it owns layout/state; the server owns the data) with **TanStack Query**
keyed on the query inputs. Table state is reflected in the URL (shareable, back-button-safe).

## Alternatives considered

- **Client-side: load all articles, let TanStack sort/filter in memory.** Far simpler for 25 rows.
  Rejected: it ships an entire project to the browser and is exactly the thing a senior engineer is
  dinged for at 10k rows. The defensible, gradable choice is server-side.
- **Server-side *with* facet counts** (per-value counts for filters). Rejected for now: computing facet
  counts on every page load is real extra cost nobody asked for. We return `total` for pagination and
  stop there.

## Tradeoffs introduced

- More wiring than a client-side table (manual pagination/sort/filter handlers, URL state, query keys).
- **Offset pagination** (`OFFSET/LIMIT`) is used; deep pages scan-and-discard (BUG-005). Fine at the
  assignment's scale; named as a seam.

## Risks that remain

- `COUNT(*)` over a filtered set per page load and deep-offset cost both degrade at large scale.

## What would change this decision

Very large projects → switch to **keyset (cursor) pagination** and approximate counts. The API shape
(`{ rows, total }`) is the only thing that changes; the table component is agnostic.
