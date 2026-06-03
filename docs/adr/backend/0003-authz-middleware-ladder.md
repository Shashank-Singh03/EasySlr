# ADR-0003: Layered tRPC procedures re-derive project access from the DB on every call

- **Status:** Accepted
- **Date:** 2026-06-04
- **Area:** backend

## Context / forces

The rubric is explicit: *"Project access enforced server-side, not only through hidden UI controls."*
Article visibility must be scoped by project membership. The risk is scattering ad-hoc `if (member)`
checks across resolvers, where one missed check is a data leak.

## Decision

Authorization is a **ladder of tRPC procedures**, each building on the last and attaching verified
context. Every level re-derives access from the database on every request:

```
publicProcedure
  protectedProcedure   requires a session                              → ctx.session.user
    orgProcedure       input.orgId   → assert OrganizationMembership
      projectProcedure input.projectId → assert ProjectMembership      → ctx.membership.role
        articleProcedure input.articleId → one indexed query joining article→project→membership
```

- **Writes** additionally gate on `role` via a small `assertCanWrite` helper (VIEWER is read-only;
  OWNER-only for import/undo).
- **`NOT_FOUND` for both "absent" and "forbidden,"** so an attacker can't probe which project/article
  IDs exist.
- **No org-level role.** Org membership is the outer tenancy boundary; all real authorization weight is
  on the project role. Adding an org role later is a one-field change.

## Alternatives considered

- **Manual checks inside each resolver.** Rejected: repetitive and one omission = a leak. The ladder
  makes "I forgot to check access" structurally hard — you literally pick the procedure that encodes
  the scope.
- **UI-only gating.** Rejected: not a security boundary; the rubric calls this out specifically.
- **Postgres Row-Level Security (RLS).** Deferred (not rejected): excellent defense-in-depth that would
  enforce scoping even if app code regressed, but it is heavier to set up and out of timebox. Noted as
  the path to higher assurance.

## Tradeoffs introduced

- A membership lookup per authorized call. It is a single indexed query (`@@unique([userId, projectId])`),
  so the cost is negligible, and it is what lets us tolerate the JWT revocation lag from ADR-0006.

## Risks that remain

- A new endpoint could be written on the wrong (too-permissive) procedure. Mitigation: convention +
  the access tests in `test/access.test.ts` that assert non-members get `NOT_FOUND`.
- No RLS, so a raw/ad-hoc DB query that bypasses the procedures would not be scoped.

## What would change this decision

Multiple services touching the same database, or a higher assurance bar → add RLS so the database
itself enforces tenancy regardless of which code path reaches it.
