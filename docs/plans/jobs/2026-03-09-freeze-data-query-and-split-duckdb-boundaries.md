---
title: "Freeze data query and lock DuckDB preview to a parallel source contract"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Clarify the DuckDB Parquet preview plan so it no longer branches on unresolved query decisions and so its implementation boundary does not widen the lightweight preview source types.

## What Changed

- froze `data query` as a doc-only future direction in the DuckDB Parquet preview plan
- added a dedicated research doc for `data query` contract definition and follow-up scope
- updated the DuckDB plan to choose a parallel DuckDB preview source contract instead of widening the current lightweight preview source as the first move
- expanded the DuckDB plan touchpoints so interactive menu/index files are explicitly in scope for the Parquet preview route

## Files

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`

## Verification

- reviewed the current lightweight preview source contract in `src/cli/data-preview/source.ts`
- reviewed the current renderer summary contract in `src/cli/data-preview/render.ts`
- reviewed the current interactive menu and dispatch wiring in `src/cli/interactive/menu.ts` and `src/cli/interactive/index.ts`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
