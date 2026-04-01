---
title: "Implement follow-up Phase 1 and Phase 2 for Excel header-row shaping"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Implement the Phase 1 contract freeze and Phase 2 shared deterministic Excel header-row shaping slice from the interactive data-shaping follow-up plan.

## What Changed

- updated the follow-up plan contract in `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md` so the next shaping surface is explicitly frozen around:
  - `--header-row <n>`
  - absolute worksheet row numbering
  - valid reviewed source-shape outcome combinations
  - the staged extract review-before-write direction
- extended the shared DuckDB Excel shaping layer in `src/cli/duckdb/query.ts` with:
  - `headerRow` on the shared source-shape model
  - positive-integer validation for `--header-row`
  - effective-range derivation for Excel when `headerRow` is present
  - forced `header = true` on the derived `read_xlsx(...)` relation
- kept the public shape state separate from the internal effective range:
  - direct render surfaces still show the accepted user-facing range
  - direct Codex and query/extract flows now also show the accepted header row when present
- wired `--header-row` into:
  - direct `data query`
  - direct `data extract`
  - direct `data query codex`
- extended reviewed header-mapping artifact matching so `headerRow` is part of exact input-context reuse
- kept reviewed source-shape artifacts range-only in this slice; source-shape artifact widening remains deferred to Phase 3
- added focused tests for:
  - shared header-mapping exact-match behavior with `headerRow`
  - direct query with range-plus-header-row shaping
  - direct extract with range-plus-header-row shaping
  - direct query Codex prompts and output with `headerRow`
  - CLI help and validation for the new `--header-row` option

## Verification

- `bun test test/data-query-header-mapping.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-query.test.ts test/cli-command-data-query-codex.test.ts test/cli-command-data-extract.test.ts test/cli-ux.test.ts`
- `bunx tsc --noEmit`

## Notes

- this slice intentionally does not yet implement:
  - reviewed source-shape artifacts with `headerRow`
  - interactive thinking/progress parity for shape/header suggestions
  - the staged interactive extract write confirmation flow
  - hard-case warning loops after range-only shaping
- the current implementation uses derived Excel ranges plus `header = true` because DuckDB does not expose a native `header_row` option on `read_xlsx(...)`

## Related Plans

- `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`

## Related Research

- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
