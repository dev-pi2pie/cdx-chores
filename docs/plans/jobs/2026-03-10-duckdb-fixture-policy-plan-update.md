---
title: "Freeze DuckDB fixture generation as manual-smoke-only in the plan"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Clarify the DuckDB Parquet preview plan so Parquet fixture generation is treated as manual smoke-test preparation, while automated tests rely on stable fixtures.

## What Changed

- updated the fixture-generation design to state that scripted Parquet generation is for manual smoke preparation only
- clarified that automated tests should use stable checked-in or generated-once Parquet fixtures instead of generating them during routine test runs
- updated the checklist and verification items so generator determinism is verified manually and automated tests stay decoupled from runtime fixture generation

## Files

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Verification

- reviewed the updated fixture-generation design and phase checklist in the DuckDB plan

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
