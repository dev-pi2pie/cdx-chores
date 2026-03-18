---
title: "Hard merged-sheet recovery phase 7 implementation"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Implemented the first execution slice of Phase 7 from `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`.

This slice focused on the two merged-sheet failures observed after the earlier reviewed-shape work:

- whole-sheet Excel introspection collapsing a merged worksheet into one visible column while still showing sample rows
- accepted `range + header-row` shapes failing later during DuckDB Excel parsing because blank or merged header-band rows distort type inference before the first representative records

## Changes

- broadened interactive suspicious Excel detection in `src/cli/interactive/data-query.ts` so merged-sheet one-column collapses can still trigger reviewed shape help
- added tolerant shaped-Excel import handling in `src/cli/duckdb/query.ts`
  - shaped Excel sources now prefer tolerant import behavior before falling back further
  - shaped Excel prepared views now drop fully blank spacer rows from the logical table view
- extended `scripts/generate-data-extract-fixtures.mjs` with public-safe hard workbook fixtures for:
  - collapsed merged-sheet one-column inspection
  - header-band shaped import recovery
- added focused coverage in:
  - `test/data-extract-fixture-generator.test.ts`
  - `test/data-query-xlsx-sources.test.ts`
  - `test/cli-actions-data-query.test.ts`
  - `test/cli-actions-data-extract.test.ts`
  - `test/cli-command-data-extract.test.ts`
  - `test/cli-interactive-routing.test.ts`

## Follow-up

The plan still keeps one Phase 7 item open: decide whether tolerant retry is enough, or whether the deterministic shaping contract needs another explicit field for multi-row header-band cases.

## Verification

- `bun test test/data-extract-fixture-generator.test.ts test/data-query-xlsx-sources.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`
