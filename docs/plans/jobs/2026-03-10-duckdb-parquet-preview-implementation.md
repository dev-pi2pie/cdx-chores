---
title: "Implement DuckDB Parquet preview command split"
created-date: 2026-03-10
status: in-progress
agent: codex
---

## Summary

Implemented the first DuckDB-backed preview lane as `data parquet preview` while keeping lightweight `data preview` scoped to CSV/JSON.

## What Changed

- added `data parquet preview <input>` CLI wiring with `--rows`, `--offset`, and `--columns`
- kept `data preview` on the existing in-memory CSV/JSON path
- introduced a DuckDB-backed Parquet preview helper with clear invalid-input and load-failure errors
- reused the bounded preview renderer through a renderer-facing adapter instead of widening `DataPreviewSource`
- added interactive `data -> parquet preview`
- updated top-level `data` wording to reflect preview plus conversion workflows
- added a dedicated Parquet smoke generator: `scripts/generate-parquet-preview-fixtures.mjs`
- kept `scripts/generate-tabular-preview-fixtures.mjs` focused on CSV/JSON fixtures
- split stable Parquet test fixtures into `test/fixtures/parquet-preview/`
- updated preview docs for the CSV/JSON vs Parquet command split

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-parquet-preview.test.ts test/cli-ux.test.ts test/cli-interactive-routing.test.ts test/cli-actions-data-preview/rendering.test.ts test/cli-actions-data-preview/failures.test.ts test/cli-actions-data-preview/highlighting.test.ts`
- `node scripts/generate-tabular-preview-fixtures.mjs reset`
- `node scripts/generate-parquet-preview-fixtures.mjs reset`
- manual hash comparison across repeated Parquet fixture generation
- manual smoke:
  - `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv --rows 2`
  - `bun src/bin.ts data parquet preview examples/playground/parquet-preview/basic.parquet --rows 2`

## Remaining Open Items

- doctor capability reporting remains unchanged in this pass
- there is still no focused automated test that simulates DuckDB module initialization failure
