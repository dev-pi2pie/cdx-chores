---
title: "Audit data docs and help alignment"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Check `README.md`, the data guides, and live data command help output against the current real CLI/API surface and correct any drift.

## What Changed

- updated `README.md` to include a concrete `data preview --no-header` example
- updated `docs/guides/data-preview-usage.md` to describe the interactive CSV/TSV headerless prompt and its effect on `contains` validation
- updated `docs/guides/data-query-usage.md` so the documented command shape includes `--install-missing-extension`
- updated `docs/guides/data-duckdb-usage.md` to describe the shared DuckDB dependency between `data query` and `data extract`
- updated `src/cli/commands/data/duckdb.ts` help text so `data duckdb doctor` and `data duckdb extension` no longer imply that only `data query` depends on DuckDB extensions

## Verification

- reviewed live help output for:
  - `cdx-chores data preview --help`
  - `cdx-chores data query --help`
  - `cdx-chores data duckdb doctor --help`
- confirmed the updated docs now match the currently shipped command surface for the audited data workflows
