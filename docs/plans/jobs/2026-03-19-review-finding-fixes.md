---
title: "Address March 19 review findings"
created-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Address the March 19 review findings for Excel workbook metadata parsing and reviewed header-suggestion extension handling.

## What Changed

- made workbook sheet and relationship parsing in `src/cli/duckdb/xlsx-sources.ts` independent of XML attribute order by extracting attributes from each tag instead of relying on fixed-order regex captures
- kept entity decoding on parsed XML attributes so reordered workbook metadata still resolves the same logical worksheet names and targets
- extended `collectDataQuerySourceIntrospection(...)` with optional source-preparation options and forwarded `installMissingExtension` plus `statusStream` into `prepareDataQuerySource(...)`
- updated the reviewed `data query --codex-suggest-headers` path to pass `--install-missing-extension` through the introspection branch used before artifact writing
- added a regression test that rebuilds a valid `.xlsx` fixture with reordered workbook metadata attributes and verifies both sheet listing and sheet snapshots still work
- added a regression test that verifies reviewed header-suggestion runs forward `installMissingExtension` into the extension-backed introspection path

## Files

- `src/cli/actions/data-query.ts`
- `src/cli/duckdb/query.ts`
- `src/cli/duckdb/xlsx-sources.ts`
- `test/cli-actions-data-query.test.ts`
- `test/data-query-xlsx-sources.test.ts`

## Verification

- `bun test test/data-query-xlsx-sources.test.ts test/cli-actions-data-query.test.ts`
- `./node_modules/.bin/tsc --noEmit`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/archive/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
