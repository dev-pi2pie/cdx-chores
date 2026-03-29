---
title: "Add DuckDB interactive design to the split-action plan"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Upgrade the DuckDB split-action plan so it includes an explicit first-pass interactive-mode design instead of only mentioning prompt-copy follow-up.

## What Changed

- added an `Interactive Mode Design` section to the DuckDB plan
- defined the first-pass menu split between lightweight `data -> preview` and DuckDB-backed `data -> parquet preview`
- locked the first-pass prompt sequence for interactive Parquet preview to input path, rows, offset, and columns only
- deferred interactive `data query` until a dedicated SQL input UX is designed
- expanded the phase checklist, docs checklist, and test checklist to cover the interactive contract

## Files

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Verification

- reviewed the current interactive preview prompt flow in `src/cli/interactive/data.ts`
- reviewed the completed interactive preview plan in `docs/plans/archive/plan-2026-03-09-data-preview-interactive-and-color-polish.md`
- reviewed the updated DuckDB split-action plan for consistency across scope, wiring, docs, and tests

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/archive/plan-2026-03-09-data-preview-interactive-and-color-polish.md`
