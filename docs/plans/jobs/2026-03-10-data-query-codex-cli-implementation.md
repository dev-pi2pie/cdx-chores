---
title: "Implement data query Codex CLI drafting lane"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Implement the separate `data query codex` CLI lane that drafts SQL from natural-language intent through bounded introspection, while keeping execution out of the first pass.

## What Changed

- added `data query codex <input> --intent "..."` with `--input-format`, `--source`, and `--print-sql`
- added bounded schema/sample introspection for supported query inputs before Codex drafting
- added a deterministic prompt contract and structured Codex response parsing for drafted SQL plus reasoning summary
- kept the drafting lane advisory-only and surfaced drafted SQL explicitly in both default and SQL-only modes
- added doctor reporting for `data query codex` with configured support, auth/session availability, and ready-to-draft availability
- added focused action, CLI, and UX coverage, including end-to-end CLI tests through a stub Codex binary
- added a dedicated `data query codex` usage guide and cross-linked the base `data query` guide
- completed the active Codex drafting implementation plan

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-command-data-query.test.ts test/cli-command-data-query-codex.test.ts test/data-query-fixture-generator.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- manual smoke checks:
  - `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/basic.csv --intent "show id and name ordered by id"`
  - `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/basic.csv --intent "count rows" --print-sql`
  - `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/multi.sqlite --source users --intent "list users ordered by id"`
  - `bun src/bin.ts doctor --json`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
