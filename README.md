# EasySLR — Article Review Workspace

A self-contained slice of a systematic-literature-review tool: users work inside **organizations →
projects**, **import articles from a PubMed-style Excel file**, and **review them in a table-driven
workflow** (search, sort, filter, decisions, notes, bulk actions, export).

> Engineering decisions are documented as ADRs in [`/docs`](docs/README.md). This README is the
> orientation; the ADRs are the depth.

---

## Quick start

**Prerequisites:** Node 20+, pnpm, Docker (for local Postgres).

```bash
pnpm install
cp .env.example .env                 # AUTH_SECRET already works for local; or: npx auth secret
docker compose up -d                 # Postgres 16 on host port 5433
pnpm prisma migrate dev              # apply migrations + generate client (+ runs the seed)
pnpm db:seed                         # (idempotent) ensure demo data exists
pnpm dev                             # http://localhost:3000
```

> The local DB uses host port **5433** to avoid clashing with any Postgres already on 5432.

### Demo accounts (all password `password123`)

| Email | Role | Can |
|---|---|---|
| `owner@demo.test` | OWNER | import, undo, manage + everything below |
| `reviewer@demo.test` | REVIEWER | read + write review decisions |
| `viewer@demo.test` | VIEWER | read only (writes are blocked **server-side**) |

All three are in the **Demo Research Lab** org / **Telehealth Systematic Review** project. A copy of the
provided `sample_article_import.xlsx` lives at [`test/fixtures/`](test/fixtures) — import it as `owner`.

### Scripts

| | |
|---|---|
| `pnpm dev` | run the app |
| `pnpm test` | Vitest (validation, parse failures, access, idempotency, conflict) |
| `pnpm typecheck` / `pnpm lint` | strict TS / ESLint |
| `pnpm build` | production build |
| `pnpm db:studio` | Prisma Studio |

---

## Architecture

**Stack:** Next.js 15 (App Router) · TypeScript · tRPC v11 · Prisma 6 / PostgreSQL · NextAuth v5
(Credentials + JWT) · Tailwind v4 · Vitest. Scaffolded with `create-t3-app`.

**The one rule that shapes everything:** business logic — import validation, dedup, authorization — lives
in **pure functions** under `src/server/services/`, free of tRPC/React/Next. That's what makes it readable,
unit-testable against the real sample file, and reusable.

```
HTTP / UI  →  tRPC router (thin)  →  service (pure logic)  →  Prisma  →  Postgres
                    ↑ authz middleware re-derives access from the DB on every call
```

```
src/
├─ app/                      App Router pages (login, orgs, projects/[id]) — thin
├─ server/
│  ├─ auth/                  NextAuth Credentials config + requireSession gate
│  ├─ api/
│  │  ├─ trpc.ts             procedures + the authorization ladder
│  │  └─ routers/            org · project · import · article · review · export · health
│  └─ services/
│     ├─ access.ts           requireOrg/Project/ArticleAccess, assertCanWrite/Owner
│     └─ import/             mapHeaders · parse · normalize · validate · classify  (pure, most-tested)
├─ lib/                      review vocab, csv, slug
└─ components/               table, badges, header
prisma/   schema · migrations · seed
docs/     ADRs · bug ledger · scope ledger · AI usage
test/     pipeline · units · integration (+ fixture)
```

---

## Domain model & authorization

`Organization → Project → Article → Review`, with `OrganizationMembership` and `ProjectMembership`
join tables. See [`prisma/schema.prisma`](prisma/schema.prisma).

- **Article (immutable import data) and Review (mutable workflow state) are separate tables** — the import
  path only writes Article, the review path only writes Review. ([ADR-0004](docs/adr/database/0004-article-review-split.md))
- **Authorization is enforced server-side**, not via hidden UI. A ladder of tRPC procedures
  (`protected → org → project → article`) re-derives the caller's membership from the DB on every request
  and attaches the verified entity to context; writes additionally gate on role; absent-or-forbidden both
  return `NOT_FOUND` so IDs can't be probed. ([ADR-0003](docs/adr/backend/0003-authz-middleware-ladder.md))
- **Review keyed `(articleId, reviewerId)`** with a unique-per-article constraint today → dual independent
  (PRISMA) screening is a one-line constraint change later. Reviewer FK is `onDelete: Restrict` so a
  departing reviewer's decisions never vanish.

---

## Import validation choices (the centerpiece)

The provided `sample_article_import.xlsx` is effectively a validation test harness — every odd row is a
deliberate edge case. The pipeline (`mapHeaders → parse → normalize → validate → classify`) handles each
with an explicit, defensible policy. Full reasoning in
[ADR-0001](docs/adr/database/0001-pmid-hard-doi-soft-dedup.md) and
[ADR-0002](docs/adr/backend/0002-single-dryrun-import-handler.md).

| Sample row | What it tests | How we handle it |
|---|---|---|
| Blank Title | incomplete record | **Reject** (title + ≥1 identifier required) |
| DOI collides w/ another row, **different PMID** | is it a duplicate? | **Import + flag `possibleDupDoi`** — never silently deleted |
| Year `"Twenty twenty"` / `2035` | bad metadata | **Import**, `year = null`, flag `suspectYear`, keep original text |
| Duplicate **PMID** | true duplicate | **Hard-skip** the later occurrence |
| Blank PMID but valid DOI + title | partial identity | **Import** (the "≥1 identifier" rule earns its keep) |
| `" 38910023 "`, `" DOI:10.1000/NQ... "` | messy but valid | **Normalized** → imported |

**Key decision — PMID is the only hard dedup key.** Two different PMIDs sharing a DOI is a data-quality
signal, not a confirmed duplicate, so DOI/title collisions are imported and *flagged* for a human, never
auto-deleted. (Postgres treats NULLs as distinct in unique indexes, which gives the `(projectId, pmid)`
constraint correct "skip duplicate non-null PMIDs, allow many null-PMID rows" behaviour for free.)

**Two-phase, tamper-safe import:** one pure pipeline, exposed via `import.process({ dryRun })`.
`dryRun: true` previews (no writes); `dryRun: false` re-runs the *same* code and commits. The server always
parses the file — the client never sends row data — so preview and commit can't disagree, and re-importing
the same file is naturally idempotent (`createMany … skipDuplicates`).

---

## Review workflow

After import, the table is the workspace: server-side **search / sort / filter / paginate** (the client
never holds the whole dataset — [ADR-0005](docs/adr/frontend/0005-server-side-table.md)), data-quality
**flag badges**, and a detail **drawer** to set a decision (**Include / Exclude / Maybe**) with an
exclusion reason (PRISMA), priority, notes, and labels. **Bulk actions** apply a decision to selected rows;
**CSV export** downloads the (filtered) set; **undo import** removes a batch (guarded if any of its
articles are already reviewed). Concurrent edits use optimistic concurrency (`updatedAt`) → a stale write
gets `CONFLICT`, not a silent clobber. Loading / empty / no-results / error states are all handled.

---

## Tests

`pnpm test` — focused on behaviour that matters (26 tests):

- **`import.pipeline`** — the real `sample_article_import.xlsx` end-to-end; asserts every edge case above + summary counts.
- **`import.units`** — normalize / validate / mapHeaders / dedup.
- **`api.access`** (integration, real DB) — non-member → `NOT_FOUND`, VIEWER write → `FORBIDDEN`, import idempotency, review `CONFLICT`.

> Verified end-to-end against a running production build: demo login sets a session and a protected tRPC
> call returns correctly scoped data.

---

## Tradeoffs & known gaps

Honest list with severity/status in [`docs/bugs/BUGS.md`](docs/bugs/BUGS.md); deferred scope in
[`docs/decisions/scope-ledger.md`](docs/decisions/scope-ledger.md). Highlights:

- **Author search is limited** — authors are a raw `"Rao A; Chen L"` string; `firstAuthor` + title search mitigate.
- **No decision history / audit log** — a single mutable Review row; an append-only event log is the planned add.
- **Single shared decision** (not dual-reviewer) — modeled for it, not built.
- **JWT can outlive a revoked membership** — mitigated by the per-call DB membership check; data access is cut immediately.
- **Offset pagination** — fine at this scale; keyset is the seam.
- **No-PMID rows can't be hard-deduped** — they re-import on a second run (flagged); a faithful consequence of the PMID-only dedup rule.

---

## Deployment

Not deployed (timeboxed). Credible plan: **SST (OpenNext)** → Lambda + CloudFront; **Aurora Serverless v2 /
RDS behind RDS Proxy** (the serverless-Postgres connection-explosion mitigation); secrets in SST Config /
SSM (never committed — `.env` is gitignored); migrations via `prisma migrate deploy` as a deploy step; S3
presigned upload + an SQS worker as the seam for large imports; CloudWatch logs. `next.config.js` pins
`outputFileTracingRoot` for correct standalone output.

---

## AI usage

Full disclosure in [`docs/decisions/ai-usage.md`](docs/decisions/ai-usage.md). In short: built with an
agentic Claude coding assistant for design, scaffolding, code, and docs. I personally verified the data
model and authorization paths, profiled the sample file row-by-row to confirm each edge case lands
correctly, and confirmed migrations/typecheck/tests/build all pass. **One example I changed:** an early
AI-proposed plan deduplicated on DOI as well as PMID — I rejected it because the sample's row 5 is a
distinct article that DOI-dedup would silently delete, and changed the design to PMID-hard / DOI-soft-flag.

## Approximate time spent

~10 focused hours (design + adversarial design review, implementation, tests, docs).

## What I'd improve next

Dual independent screening + conflict resolution (the model already supports it); an append-only decision
audit log; author normalization for real author-level filtering; keyset pagination + `pg_trgm`/`tsvector`
search at scale; and an actual SST deployment with RDS Proxy.
