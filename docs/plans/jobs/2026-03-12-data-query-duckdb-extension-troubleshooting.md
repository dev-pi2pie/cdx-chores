---
title: "Document DuckDB extension troubleshooting for data query"
created-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Capture the observed DuckDB extension-cache troubleshooting path for `data query` so future users and agents can diagnose mismatched SQLite and Excel capability states from `cdx-chores doctor`.

## Changes

- updated `docs/guides/data-query-usage.md` with a DuckDB extension troubleshooting section
- documented the distinction between `detected support`, `loadability`, and `installability` for extension-backed formats
- added targeted cache-cleanup guidance for stale DuckDB version directories
- added repo-local reinstall commands for `sqlite` and `excel` using `@duckdb/node-api`

## Verification

- confirmed locally that `bun cli doctor` reports `sqlite` as loadable and `excel` as not loadable on DuckDB `v1.5.0`
- confirmed locally that `bun cli data query test/fixtures/data-query/multi.sqlite --source users --sql "select * from file limit 3"` succeeds
- confirmed locally that `bun cli data query test/fixtures/data-query/multi.xlsx --source Summary --sql "select * from file limit 5"` fails with missing DuckDB `excel` extension guidance
- inspected the local DuckDB extension cache and verified that `excel.duckdb_extension` existed only for an older DuckDB version while `sqlite_scanner` existed for the current runtime version

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
