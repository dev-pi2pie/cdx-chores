---
title: "Complete data query CLI implementation plan"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Finish the remaining unchecked work in the `data query` CLI implementation plan so the direct SQL execution lane is complete and verified across all supported input families.

## What Changed

- completed multi-object source discovery for SQLite and Excel and kept `--source` mandatory for direct CLI use on those formats
- added a dedicated deterministic fixture generator at `scripts/generate-data-query-fixtures.mjs`
- generated representative smoke fixtures under `examples/playground/data-query/`
- generated checked-in test fixtures under `test/fixtures/data-query/`
- added end-to-end direct CLI coverage for CSV, TSV, Parquet, SQLite, and Excel
- added bounded table coverage for both the default row window and explicit `--rows`
- added fixture-generator determinism coverage and extension-guidance coverage
- documented the smoke-fixture generator in the `data query` usage guide
- updated the active implementation plan to completed and checked off the remaining items

## Verification

- `node scripts/generate-data-query-fixtures.mjs reset`
- `node scripts/generate-data-query-fixtures.mjs reset --output-dir test/fixtures/data-query`
- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/data-query-fixture-generator.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- manual smoke checks:
  - `bun src/bin.ts data query examples/playground/data-query/basic.csv --sql "select id, name from file order by id"`
  - `bun src/bin.ts data query examples/playground/data-query/basic.tsv --sql "select name, status from file order by id"`
  - `bun src/bin.ts data query examples/playground/data-query/basic.parquet --sql "select id, name from file order by id" --json`
  - `bun src/bin.ts data query examples/playground/data-query/multi.sqlite --source users --sql "select id, name from file order by id"`
  - `bun src/bin.ts data query examples/playground/data-query/multi.xlsx --source Summary --sql "select id, name from file order by id"`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
