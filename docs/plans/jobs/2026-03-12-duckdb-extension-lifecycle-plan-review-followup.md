---
title: "Revise DuckDB extension lifecycle plan after review"
created-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Address review findings in the DuckDB extension lifecycle follow-up plan so the implementation scope is narrower, safer, and more consistent with the existing `data query` and `doctor` contracts.

## Changes

- updated `docs/plans/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`
- froze install-attempt progress output to stderr so stdout payload contracts remain intact
- narrowed `--install-missing-extension` to `data query` only for the first implementation
- removed uninstall from the first-pass command shape and deferred it explicitly
- clarified that `doctor` remains read-only
- clarified that interactive mode should surface exact CLI remediation commands rather than add a first-pass extension-management menu entry

## Verification

- re-read the lifecycle plan after revision
- cross-checked the revised scope against:
  - `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
  - `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
  - `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`
- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
