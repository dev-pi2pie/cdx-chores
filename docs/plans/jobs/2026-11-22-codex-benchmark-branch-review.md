---
title: "Codex benchmark branch review"
created-date: 2026-11-22
status: completed
agent: codex
---

Address the Codex lifecycle findings from the review of `dev` against `origin/main`.

| Change | Commit | Verification |
| --- | --- | --- |
| Reconcile recovered start replies before retention or the next trial. | `2c586edb` | Late match, conflict, rejection, withheld reply, and cancellation cases passed for both callers. |
| Verify shutdown after signal denial. | `2e51bc82` | Verified exit clears `EPERM`. Unverified exit preserves the denial, including through Doctor and SDK retention. |
| Recover matching completion at the start deadline. | `a43242f1` | Observer and Node-targeted live-check regressions passed. Unrelated completion and ordinary RPC errors still fail. |
| Validate the branch. | `a43242f1` | `bun run test:unit` (2,148), `bun run test:integration:app` (2,721), `bun run test:integration:codex` (41), and `bun run test:integration:pandoc` (5) passed. Type checking, lint, formatting, build, workflow lint, and diff checks passed. |

The initial application run reached the suite deadline. The affected video fixture passed on its own, and the full retry passed.

The full re-review of `dev` against `origin/main` found the deadline race. Re-review of `c15c6467..a43242f1` found no further actionable issues.
