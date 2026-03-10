---
title: "Update data query research with format detection and output contract follow-up"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Capture the March 10 discussion-driven updates to the `data query` research so the future implementation plan starts from a clearer contract around input detection, extension handling, and result output behavior.

## What Changed

- expanded the research milestone language so `data query` now explicitly includes input-detection semantics alongside SQL, file-shape, output, and error semantics
- added findings that separate input-format detection from backend capability resolution and document a conservative DuckDB extension policy for SQLite and Excel
- updated the draft baseline so SQLite and Excel are recorded as extension-backed near-term candidates rather than unexamined future expansion
- expanded the output discussion to cover `--output <path>`, `.json` / `.csv` result serialization, and the need to separate result data from status/log messaging
- refreshed the recommendation and open-question sections to cover format overrides, extension-install policy, and output-file behavior

## Files

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Verification

- reviewed the current research baseline in `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- reviewed the current DuckDB-backed Parquet preview boundary in `src/cli/actions/data-parquet-preview.ts`
- reviewed the current DuckDB preview loader in `src/cli/duckdb/parquet-preview.ts`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
