---
title: "Data query DuckDB generator split"
created-date: 2026-04-01
modified-date: 2026-04-01
status: completed
agent: Codex
---

## Goal

Split the heavier DuckDB fixture generation out of `scripts/generate-data-query-fixtures.mjs` into a dedicated generator with its own default playground location and alias output.

## Scope

- remove DuckDB fixture creation from `scripts/generate-data-query-fixtures.mjs`
- add a dedicated DuckDB-only generator script
- default local DuckDB playground fixtures to `examples/playground/data-query-duckdb/`
- generate both `multi.duckdb` and `multi.db`
- update user-facing guide examples to use the new DuckDB playground path and clarify generic `.db` handling
- add focused generator coverage for the new DuckDB-only script

## Verification Plan

- `node scripts/generate-data-query-fixtures.mjs reset`
- `node scripts/generate-data-query-duckdb-fixtures.mjs reset`
- `bun test test/data-query-fixture-generator.test.ts test/data-query-duckdb-fixture-generator.test.ts`

## Notes

- Added `scripts/generate-data-query-duckdb-fixtures.mjs` as the dedicated heavy-fixture generator.
- Kept the existing shared generator focused on CSV, TSV, Parquet, SQLite, and Excel fixtures.
- Added a DuckDB-only generator that reproduces `multi.duckdb` and `multi.db` under `examples/playground/data-query-duckdb/` locally.
- Updated `docs/guides/data-query-usage.md` fixture-generation wording and DuckDB example paths.
- Updated related guide examples in `docs/guides/data-query-codex-usage.md` and `docs/guides/data-extract-usage.md` so playground DuckDB examples no longer point at the mixed `data-query` fixture directory.
- Verification passed with the commands listed above.
