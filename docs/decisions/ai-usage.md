# AI Usage Disclosure

Per the assignment's AI policy.

## Tools used

- **Claude (Anthropic), via an agentic coding CLI** — used as a pair-programmer for design,
  scaffolding, code generation, and documentation.

## What was AI-assisted

- Architecture and design exploration (multiple adversarial review passes on the plan before any code).
- Project scaffolding decisions (create-t3-app flags) and the rework to Credentials/JWT auth.
- The Prisma schema, import pipeline, tRPC routers, and React components (generated, then reviewed).
- This documentation set (ADRs, bug ledger, scope ledger).

## What I personally verified

- The data model boundaries and the authorization ladder — reasoned through each access path.
- The import validation policy against the **actual** `sample_article_import.xlsx`: I profiled all 25
  rows and confirmed each intentional edge case (blank title, non-numeric year, future year, duplicate
  PMID, colliding DOI, blank PMID, whitespace/`DOI:` normalization) lands in the right bucket.
- Migrations apply, the app typechecks, the seed runs, and the tests pass locally.

## One example where I changed / rejected AI output

An earlier AI-proposed plan deduplicated articles on **DOI** as well as PMID. I rejected it: the sample
file's row 5 is a *different* PMID with a DOI that collides with row 1, i.e. a distinct article. DOI
dedup would have silently deleted it. I changed the design so **PMID is the only hard dedup key** and
DOI collisions are imported and flagged for human review (ADR-0001). A second example: I collapsed an
AI-proposed two-phase import (with a server-stored DRAFT payload) into a single `dryRun` handler after
realizing the extra state only existed to patch a tamper hole that disappears once the server re-parses
the file (ADR-0002).

## Time spent

(To be filled in at submission — running total tracked during the build.)
