---
title: "Implement initial data query CLI surface"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Start the direct CLI `data query` implementation plan by landing the SQL-first command surface, core output modes, DuckDB capability reporting, and the first focused test/doc pass.

## What Changed

- added `data query <input> --sql "<query>"` to the CLI with:
  - `--input-format`
  - `--source`
  - `--rows`
  - `--json`
  - `--pretty`
  - `--output <path>`
  - `--overwrite`
- added a shared DuckDB query module for:
  - input-format detection
  - DuckDB connection creation
  - source preparation against logical table `file`
  - extension-aware SQLite and Excel gating
  - bounded table execution
  - full-result execution for JSON and file output
- added a dedicated table renderer for `data query`
- added query capability reporting to `doctor` with built-in-format readiness plus extension-backed loadability/installability detail
- added a first `data query` usage guide and updated the preview guide to point at it
- updated the active implementation plan to mark the completed checklist items from this slice

## Notes

- CSV/TSV and Parquet are implemented end to end in this slice
- SQLite and Excel now have explicit extension-aware command paths and guidance-first failures, but the remaining multi-object source-discovery and smoke-fixture work is still open in the plan

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
