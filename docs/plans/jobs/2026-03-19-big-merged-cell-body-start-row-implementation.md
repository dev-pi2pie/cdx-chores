---
title: "Big merged-cell body-start-row implementation"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Completed Phases 3, 4, and 5 of `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`.

This pass validated the internal two-pass fallback, landed the deterministic `body-start-row` contract across query and extract, and widened reviewed source-shape artifacts plus prompt handling to carry `bodyStartRow`.

## Changes

- updated shared query shape types and Excel row validation in:
  - `src/cli/duckdb/query/types.ts`
  - `src/cli/duckdb/query/excel-range.ts`
  - `src/cli/duckdb/query/prepare-source.ts`
  - `src/cli/duckdb/query/introspection.ts`
- added `body-start-row` command plumbing for:
  - `data extract`
  - `data query`
  - `data query codex`
  in `src/cli/commands/data.ts`, `src/cli/actions/data-extract.ts`, `src/cli/actions/data-query.ts`, and `src/cli/actions/data-query-codex.ts`
- widened source-shape artifacts and reviewed-shape parsing in:
  - `src/cli/duckdb/source-shape/types.ts`
  - `src/cli/duckdb/source-shape/artifact.ts`
  - `src/cli/duckdb/source-shape/suggestions.ts`
  - `src/cli/data-workflows/source-shape-flow.ts`
- widened header-mapping input-context matching so reviewed header artifacts stay tied to the full shaped-source state in:
  - `src/cli/duckdb/header-mapping/types.ts`
  - `src/cli/duckdb/header-mapping/normalize.ts`
  - `src/cli/duckdb/header-mapping/artifact.ts`
  - `src/cli/data-workflows/header-mapping-flow.ts`
- updated query rendering, Codex drafting context, and interactive query/extract surfaces so `body-start-row` is visible when present in:
  - `src/cli/data-query/render.ts`
  - `src/cli/data-query/codex.ts`
  - `src/cli/interactive/data-query/*`
  - `src/cli/interactive/data.ts`

## Phase 3 Result

The no-new-field investigation confirmed that the hard workbook can be recovered internally by:

- reading the header band separately
- reading the body band separately
- stitching them into one logical table

That path is now used internally when both `header-row` and `body-start-row` are present, but it does not replace the explicit contract because the body boundary still needs to be stated deterministically.

## Phase 4 Result

The shared Excel prepare path now supports:

- `range`
- `header-row`
- `body-start-row`
- any valid combination of them

The important new behavior is:

- `body-start-row` without `header-row` narrows the effective import range so the body begins at that row
- `header-row + body-start-row` imports the header row and body rows separately, then rebuilds one logical `file_source` view before header mappings and later query/extract work continue
- the public stacked merged-band workbook now succeeds with:
  - `data extract ... --source Sheet1 --range B7:BR20 --header-row 7 --body-start-row 10`
  - `data query ... --source Sheet1 --range B7:BR20 --header-row 7 --body-start-row 10`

## Phase 5 Result

Reviewed source-shape flows now support `bodyStartRow` end to end:

- Codex source-shape structured output accepts `body_start_row`
- widened `version: 1` source-shape artifacts accept `bodyStartRow`
- reviewed shape rendering prints `--body-start-row <n>` when present
- direct query rendering and Codex drafting context include the selected body start row

## Verification

- `bunx tsc --noEmit`
- `bun test test/data-source-shape.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-query.test.ts test/cli-command-data-extract.test.ts test/cli-ux.test.ts`
- `bun test test/cli-actions-data-query-codex.test.ts test/cli-command-data-query-codex.test.ts test/cli-interactive-routing.test.ts`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`

## Related Research

- `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md`
