---
title: "Placeholder normalization, docs, and built-dist verification"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Completed the remaining implementation tasks from `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`.

This slice finished three areas:

- standardized headerless query/extract placeholder names in the shared DuckDB layer to the `column_<n>` contract expected by reviewed semantic header suggestions
- updated the public behavior guides for staged interactive extract writing, `--header-row <n>`, reviewed source-shape reuse, and the shared generated-placeholder contract
- rebuilt `dist` and verified packaged behavior against headerless CSV, public hard workbook fixtures, and the remaining hard local merged-sheet repro

## Changes

- normalized DuckDB-generated headerless names like `column0`, `column1`, ... to shared names like `column_1`, `column_2`, ... in `src/cli/duckdb/query.ts`
- kept reviewed header-mapping and interactive semantic header review aligned with that shared placeholder contract
- updated:
  - `docs/guides/data-extract-usage.md`
  - `docs/guides/data-query-interactive-usage.md`
  - `docs/guides/data-schema-and-mapping-usage.md`
- added focused tests for:
  - headerless CSV placeholder normalization
  - headerless CSV reviewed semantic header suggestions
  - command-level query behavior with normalized placeholder names
- rebuilt `dist` with `bun run build`

## Built Dist Verification

Verified on the built CLI:

- headerless CSV query uses normalized `column_<n>` placeholder names
- the public hard header-band workbook now extracts successfully after tolerant shaped import and blank-row cleanup
- the remaining hard local merged-sheet repro still fails after `range + header-row`

Remaining failure mode:

- a merged or stacked header-band case can still place non-representative rows between the accepted header row and the first real data row
- tolerant import is not sufficient for that class
- the next shaping-contract follow-up should introduce and evaluate an explicit data-start concept rather than stretching `header-row` further

## Verification

- `bun test test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/cli-interactive-routing.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts`
- `bunx tsc --noEmit`
- `bun run build`
- built CLI spot checks:
  - headerless CSV query
  - public hard header-band extract
  - hard local merged-sheet extract repro
