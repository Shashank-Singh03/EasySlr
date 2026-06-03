# EasySLR — Engineering Documentation

This `docs/` tree is part of the codebase, not an afterthought. It records *why* the system looks
the way it does, so the next engineer (or an interviewer) can reconstruct the reasoning without
archaeology.

## Layout

```
docs/
├─ adr/                 Architecture Decision Records — one file per real decision
│  ├─ backend/          tRPC layering, import handler, auth
│  ├─ database/         dedup strategy, table boundaries, integrity
│  └─ frontend/         table strategy, states
├─ bugs/                BUGS.md — known issues & limitations (severity, status, mitigation)
├─ decisions/           cross-cutting notes: scope ledger, demo creds, AI usage
└─ _template.md         ADR template
```

## ADR index

| ADR | Area | Decision |
|-----|------|----------|
| [0001](adr/database/0001-pmid-hard-doi-soft-dedup.md) | database | PMID is the only hard dedup key; DOI/title collisions are flagged, never deleted |
| [0002](adr/backend/0002-single-dryrun-import-handler.md) | backend | One pure import pipeline exposed via a `dryRun` flag (preview = no writes) |
| [0003](adr/backend/0003-authz-middleware-ladder.md) | backend | Layered tRPC procedures re-derive project access from the DB on every call |
| [0004](adr/database/0004-article-review-split.md) | database | Article (immutable) and Review (mutable) are separate; integrity via Restrict + no cascade-delete |
| [0005](adr/frontend/0005-server-side-table.md) | frontend | Server-side pagination/sort/filter/search; client never holds the dataset |
| [0006](adr/backend/0006-auth-credentials-jwt.md) | backend | Credentials provider + seeded users + JWT sessions (demoability) |

## Conventions

- ADRs are immutable once **Accepted**. To reverse one, write a new ADR that supersedes it.
- Every ADR states the alternatives we **rejected** and **why**, the tradeoff each choice introduces,
  and what would make us revisit it. Generic ADRs are worse than none.
- Known limitations live in [bugs/BUGS.md](bugs/BUGS.md) with an explicit status: `fixed`,
  `deferred`, or `accepted`.
