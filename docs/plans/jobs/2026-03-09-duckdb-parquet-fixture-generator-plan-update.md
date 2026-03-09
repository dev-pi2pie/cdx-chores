---
title: "Add Parquet fixture generation to the DuckDB split-action plan"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Update the DuckDB plan so Parquet smoke testing depends on a repeatable fixture-generation script rather than ad hoc binary fixtures.

## What Changed

- added a `Fixture Generation Design` section to the DuckDB plan
- defined the first-pass Parquet smoke-fixture set around basic, wide, and large-window datasets
- expanded scope, implementation touchpoints, tests, and docs so a scripted Parquet generator is part of the milestone contract
- aligned the plan with the repository convention of using `examples/playground/` for manual smoke-test assets

## Files

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Verification

- reviewed the current tabular fixture generator in `scripts/generate-tabular-preview-fixtures.mjs`
- reviewed the existing manual smoke-fixture guidance in `docs/guides/data-preview-usage.md`
- reviewed the updated DuckDB plan for fixture-generation coverage across implementation, tests, and docs

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
