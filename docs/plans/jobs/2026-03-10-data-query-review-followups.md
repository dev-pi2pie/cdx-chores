---
title: "Apply data query review follow-ups"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Address the March 10 code-review findings for the new `data query` and `data query codex` flows.

## What Changed

- removed SQL whitespace collapsing from the Codex drafting path so rendered SQL and `--print-sql` preserve the exact internal formatting returned by Codex
- taught Codex environment inspection to validate `CDX_CHORES_CODEX_PATH` before reporting doctor readiness, preventing false-positive `ready-to-draft` results when the override path is missing or not executable
- normalized corrupt `.xlsx` workbook metadata failures into the CLI `INVALID_INPUT` contract so bad ZIP offsets or inflate failures no longer surface as generic runtime errors
- added regression coverage for preserved SQL formatting, invalid Codex override reporting, and corrupt workbook metadata handling

## Files

- `src/cli/data-query/codex.ts`
- `src/adapters/codex/shared.ts`
- `src/cli/duckdb/xlsx-sources.ts`
- `test/cli-actions-data-query-codex.test.ts`
- `test/cli-actions-doctor-markdown-video-deferred.test.ts`
- `test/cli-command-data-query-codex.test.ts`
- `test/data-query-xlsx-sources.test.ts`

## Verification

- `bun test test/cli-actions-data-query-codex.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/data-query-xlsx-sources.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts test/cli-command-data-query.test.ts test/cli-ux.test.ts`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
