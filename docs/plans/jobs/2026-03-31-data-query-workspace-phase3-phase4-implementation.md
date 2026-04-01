---
title: "Implement data query workspace Phase 3 and Phase 4"
created-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Complete Phase 3 and Phase 4 from `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md` by adding workspace-aware Codex drafting and interactive workspace query flow for `data query`.

## Scope

- `src/cli/actions/data-query-codex.ts`
- `src/cli/commands/data/query.ts`
- `src/cli/data-query/codex.ts`
- `src/cli/duckdb/query/introspection.ts`
- `src/cli/duckdb/query/types.ts`
- `src/cli/interactive/data-query/`
- focused CLI, action, interactive, and harness tests under `test/`
- checklist updates in `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`

## Constraints

- preserve the existing single-source `file` shorthand when `--relation` is absent
- keep workspace support scoped to SQLite in this slice
- keep workspace interactive mode limited to `manual` and `Codex Assistant`
- keep workspace-mode `formal-guide` deferred
- avoid expanding into Excel multi-relation shaping or DuckDB-file execution support

## What Changed

- added repeatable `--relation <binding>` support to `data query codex`
- added workspace-aware Codex introspection payloads with per-relation schema and sampled rows
- updated Codex prompt, editor template, and rendered output so workspace mode uses explicit relation names instead of the implicit `file` alias
- kept single-source Codex behavior backward-compatible when no workspace relations are bound
- added interactive query scope selection between:
  - `single-source`
  - `workspace`
- added interactive workspace relation-binding prompts with validation for:
  - reserved `file`
  - invalid identifiers
  - duplicate aliases
- routed interactive workspace mode through:
  - `manual`
  - `Codex Assistant`
- kept interactive `formal-guide` on the single-source path only
- threaded workspace relations through interactive SQL review, output selection, and execution
- expanded focused regression coverage for:
  - workspace Codex CLI success and failure cases
  - workspace `--print-sql`
  - inline `--relation=<binding>` parsing on the Codex lane
  - interactive workspace manual and Codex routing
  - interactive workspace alias validation
  - workspace review-loop branches for `change-mode`, `regenerate`, `revise`, and `cancel`
- marked Phase 3 and Phase 4 complete in the active workspace implementation plan

## Verification

- `bun test test/cli-actions-data-query-codex.test.ts test/cli-command-data-query-codex.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts test/cli-command-data-query.test.ts test/cli-actions-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts test/cli-interactive-routing.test.ts`
- `bun run lint`
- `bun run format`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
