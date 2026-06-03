# Demo Credentials

Seeded by `prisma/seed.ts`. These are throwaway accounts for local/demo use only — no real data, no
real secret. Safe to commit (see ADR-0006).

| Email | Password | Project role | Use it to demo |
|-------|----------|--------------|----------------|
| `owner@demo.test` | `password123` | OWNER | import, undo, manage — full access |
| `reviewer@demo.test` | `password123` | REVIEWER | read + write review decisions |
| `viewer@demo.test` | `password123` | VIEWER | read-only (writes are blocked server-side) |

All three are members of the **Demo Research Lab** org and the **Telehealth Systematic Review** project.

To demonstrate the authorization boundary, sign in as `viewer@demo.test` and confirm that review
mutations are rejected by the server (not merely hidden in the UI), and that a user with no membership
gets `NOT_FOUND` on the project.
