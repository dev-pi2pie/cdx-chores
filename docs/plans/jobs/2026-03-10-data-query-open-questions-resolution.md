---
title: "Resolve March 10 data query research open questions"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Turn the March 10 discussion on `data query` open questions into a narrower draft contract so the remaining open items are implementation-level safeguards rather than core product-scope ambiguity.

## What Changed

- promoted CSV, Parquet, SQLite, and Excel into the draft v1 format set, with SQLite and Excel explicitly framed as extension-backed inputs
- recorded `--sql` as the draft v1 requirement and documented non-SQL query helpers as deferred shorthand modes rather than part of the first contract
- chose `--input-format` as the draft override flag for explicit input-type control
- froze the draft output shape as bounded table by default, `--json` with optional `--pretty` for machine-readable stdout, and `--output <path>` for `.json` / `.csv` file export
- clarified that v1 should not inject a hidden SQL `LIMIT`, and that bounded behavior should apply to presentation rather than query semantics
- recorded the draft guardrail that missing SQLite or Excel extensions should fail with targeted guidance instead of automatic installation from the command path
- narrowed the remaining research questions to terminal row bounds, large-stdout safeguards, and doctor capability detail

## Files

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Verification

- reviewed the current research draft and its existing recommendation/open-question structure
- aligned the updated draft decisions with the current DuckDB-backed Parquet split already implemented in `src/cli/actions/data-parquet-preview.ts`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
