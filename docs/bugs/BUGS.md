# Known Issues & Limitations

Every entry is a *deliberate, known* state — not a surprise. Status is one of:
**accepted** (we're living with it on purpose), **deferred** (would build with more time),
**open** (should be fixed), **fixed**.

| ID | Issue | Why it exists | Severity | Status | Mitigation / plan |
|----|-------|---------------|----------|--------|-------------------|
| BUG-001 | Author search is weak | `Article.authors` is a raw `"Rao A; Chen L"` string, not normalized | Low | accepted | `firstAuthor` column + title search cover the common case; author normalization is deferred (separate Author table) |
| BUG-002 | No decision history / audit log | Single mutable `Review` row; reverting a decision overwrites the prior one | Medium | deferred | Append-only `ReviewEvent` table is the planned add; matters for PRISMA reproducibility |
| BUG-003 | Single shared review decision (no dual screening) | `Review` is `@@unique([articleId])` by design choice | Medium | deferred | Modeled for it: relax to `@@unique([articleId, reviewerId])` (ADR-0004) |
| BUG-004 | JWT session can outlive a revoked membership | Credentials provider forces JWT sessions (ADR-0006) | Medium | accepted | Membership re-checked on every authorized call (ADR-0003) → data access cut immediately; short token TTL |
| BUG-005 | Offset pagination degrades on deep pages | `OFFSET/LIMIT` scans-and-discards at scale | Low | accepted | Fine at assignment scale; keyset pagination is the documented seam (ADR-0005) |
| BUG-006 | Large files parsed twice in preview→commit | `dryRun` design re-parses on commit rather than trusting client rows (ADR-0002) | Low | accepted | Negligible for small files; presigned-S3 + background parse for big files |
| BUG-007 | Two no-PMID rows sharing a DOI both import | PMID is the only hard dedup key; no-PMID rows can't hard-dedup (ADR-0001) | Low | accepted | Both rows flagged `possibleDupDoi` for human resolution |
| BUG-008 | `@auth/prisma-adapter` dependency was unused | Left over from the T3 scaffold after switching to JWT/Credentials | Trivial | fixed | Removed from `package.json` |
| BUG-009 | Prisma `package.json#prisma` config deprecation warning | Prisma 6 prefers a `prisma.config.ts` file | Trivial | accepted | Cosmetic warning only; migrate to `prisma.config.ts` before Prisma 7 |

## How to add an entry

When you discover or knowingly accept a limitation, add a row here with an honest severity and a real
mitigation. A limitation that's documented with a plan is a sign of ownership; a silent one is a trap.
