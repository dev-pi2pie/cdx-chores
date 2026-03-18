---
title: "Constrain placeholder normalization"
created-date: 2026-03-18
status: completed
agent: codex
---

## Summary

Scoped DuckDB placeholder normalization so it only rewrites truly headerless CSV and TSV inputs, instead of renaming any user column that happens to match `columnN`.

## Changes

- updated `src/cli/duckdb/query.ts` to normalize `column0`, `column1`, ... only when:
  - the source format is CSV or TSV
  - the relation columns match DuckDB's generated zero-based placeholder sequence
  - `sniff_csv(...).HasHeader` confirms the file is headerless
- added focused regressions in:
  - `test/cli-actions-data-query.test.ts`
  - `test/cli-command-data-query.test.ts`
- preserved the documented `column_<n>` contract for true headerless delimited inputs

## Verification

- `bun test test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts`
- `bunx tsc --noEmit`
