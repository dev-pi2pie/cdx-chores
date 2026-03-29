---
title: "Revise DuckDB plan around separate parquet preview and query actions"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Update the DuckDB follow-up docs so they stop treating Parquet as an implicit `data preview` backend and instead freeze a separate DuckDB action contract.

## What Changed

- reviewed the tabular preview research to confirm that DuckDB changes product scope rather than only backend implementation details
- updated the research doc to recommend separate DuckDB-oriented actions: `data parquet preview <file.parquet>` and `data query <input>`
- rewrote the DuckDB plan so `data preview` stays CSV/JSON-only, `data parquet preview` becomes the first DuckDB-backed milestone, and `data query` is reserved as the future query lane
- expanded the plan touchpoints and test checklist to include command/help/prompt surfaces that would otherwise stay inconsistent with the new contract

## Files

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Verification

- reviewed the current `data preview` text-only loader in `src/cli/actions/data-preview.ts`
- reviewed the current `data preview` command/help contract in `src/command.ts`
- reviewed the interactive prompt copy in `src/cli/interactive/data.ts`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/archive/plan-2026-03-09-tabular-data-preview-v1-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
