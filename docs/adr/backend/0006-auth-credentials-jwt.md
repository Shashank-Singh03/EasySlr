# ADR-0006: Credentials provider + seeded users + JWT sessions

- **Status:** Accepted
- **Date:** 2026-06-04
- **Area:** backend

## Context / forces

A reviewer must be able to clone, run, and demo this app with **zero external setup**, and demo
accounts must be trivially shareable. Authentication is required but is not the point of the exercise —
the points are import handling, authorization, and the review workflow.

## Decision

NextAuth (Auth.js v5) with the **Credentials** provider, **seeded demo users** (`owner@demo.test`,
`reviewer@demo.test`, `viewer@demo.test`), passwords stored as bcrypt hashes, and **JWT sessions**.
The `authorize` callback returns `null` for both "user not found" and "wrong password" (no user
enumeration), and rejects deactivated users.

## Alternatives considered

- **OAuth (Discord/GitHub).** Rejected: requires registering an OAuth app and managing client
  secrets, and demo accounts can't be shared (they'd be the reviewer's real identity). High friction
  for a take-home.
- **Email magic link.** Rejected: needs an SMTP/email service configured before anyone can even log in.
- **DB sessions.** Not available: the Credentials provider in Auth.js requires the **JWT** session
  strategy. This is the root cause of the tradeoff below.

## Tradeoffs introduced

- **JWT sessions can outlive a revoked membership.** If a user is removed from a project, their signed
  token remains valid until it expires. We mitigate by **re-checking project membership on every
  authorized tRPC call** (ADR-0003), so *data access* is cut immediately even though the session token
  lingers; the client also redirects on a mid-session `NOT_FOUND`.
- **No password reset / email verification.** Acceptable for a demo; called out explicitly.
- The seed commits a **known demo password** (`password123`). Acceptable because these are throwaway
  demo accounts with no real data; documented in `docs/decisions/demo-credentials.md`. No real secret
  is ever committed.

## Risks that remain

- Token revocation lag (mitigated as above). A short `AUTH_SECRET`-signed token TTL further bounds it.

## What would change this decision

A real product → OAuth/SSO or email+password with verification and reset, **DB sessions** (so logout
and revocation are immediate), and likely RLS for defense-in-depth.
