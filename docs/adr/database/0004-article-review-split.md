# ADR-0004: Article (immutable) and Review (mutable) are separate tables; integrity via Restrict + no cascade-delete

- **Status:** Accepted
- **Date:** 2026-06-04
- **Area:** database

## Context / forces

An article has two very different kinds of data: the **imported bibliographic record** (written once
at import, never edited) and the **review state** (decision, notes, priority, labels — edited
repeatedly by reviewers). Conflating them risks the review path accidentally clobbering imported data,
and it complicates the future move to dual independent (PRISMA) screening.

## Decision

- **Two tables.** `Article` holds immutable import data; `Review` holds mutable workflow state. The
  import path only writes `Article`; the review path only writes `Review`. Clean read/write boundaries.
- **`Review` is keyed `(articleId, reviewerId)` with `@@unique([articleId])` today.** One shared
  decision per article now; **dual independent screening = relax the unique to `[articleId, reviewerId]`**
  — a one-line migration, not a redesign.
- **Integrity choices that prevent silent data loss:**
  - `Review.reviewer` uses `onDelete: Restrict` (not Cascade). A departing reviewer's screening
    decisions must survive — deleting them would corrupt a PRISMA-defensible review and its audit
    trail. Users are deactivated (`User.active = false`), not deleted.
  - We ship **no delete-project / delete-user feature**, so no soft-delete column is needed yet.
    Import *undo* (deleting one batch's articles) is the only destructive action, and it is guarded.

## Alternatives considered

- **Denormalize review fields onto `Article`** (decision/notes/priority columns on the same row).
  Genuinely simpler for a *strict single-reviewer* product and drops a join from the list query. **It
  would win if we were committing to single-reviewer forever.** Rejected because the brief's review
  model is candidate-designed and dual-screening is a likely evolution; the split makes that evolution
  cheap and keeps import/review write paths from interfering.
- **Cascade-delete reviewers/projects.** Rejected: a cascade nukes thousands of reviewed records with
  no recovery — catastrophic for a tool whose value is reproducible screening.
- **Soft-delete (`archivedAt`) everywhere now.** Rejected as premature: it guards a delete feature we
  deliberately aren't building. Noted as the approach *if* project deletion is added.

## Tradeoffs introduced

- The article list query joins `Review` (`include: { review: true }`) — a single indexed join,
  negligible cost.
- `Restrict` means a user with reviews can't be hard-deleted; you deactivate instead. Intentional.

## Risks that remain

- A 1:1 `Article.review` relation today becomes 1:many under dual screening; code reading
  `article.review` must be updated at that point. Localized and expected.

## What would change this decision

Committing permanently to single-reviewer → denormalizing onto `Article` would be the simpler choice.
Adding project deletion → introduce `archivedAt` soft-delete rather than hard cascade.
