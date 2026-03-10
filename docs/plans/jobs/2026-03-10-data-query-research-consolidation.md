---
title: "Consolidate March 10 data query research updates"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Consolidate the March 10 discussion-driven updates to the `data query` research into one implementation record and replace the fragmented job-log trail with a single traceable summary.

## What Changed

- expanded the research contract to cover input-detection semantics alongside SQL, file-shape, output, and error behavior
- promoted CSV, Parquet, SQLite, and Excel into the draft format set, with SQLite and Excel explicitly framed as extension-backed inputs
- recorded the SQL-first contract for direct CLI usage and kept non-SQL query helpers visible as a later feature track rather than part of the first implementation
- froze `--input-format` as the explicit input-type override and `--rows` as the bounded table-display flag
- froze the output contract as bounded table by default, `--json` with optional `--pretty` for machine-readable stdout, and `--output <path>` with `.json` / `.csv` inferred from the output path
- clarified that query presentation limits must not rewrite SQL semantics and should stay application-controlled rather than DuckDB- or OS-derived
- recorded the extension guardrail that SQLite and Excel should use explicit extension-aware handling and fail with targeted guidance rather than silent automatic installation
- froze the interactive query design contract as an introspection-first `choose mode` workflow with `manual`, `formal-guide`, and `Codex Assistant`
- froze the shared interactive guardrail that candidate SQL must always be shown back to the user and explicitly confirmed before execution
- froze the minimum `formal-guide` prompt set and the default bounded introspection payload so those topics no longer remain vague future design placeholders

## Files

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Verification

- reviewed the current preview and output flag patterns in `src/command.ts`
- reviewed the current bounded preview defaults in `src/cli/actions/data-preview.ts`
- reviewed the current bounded preview renderer in `src/cli/data-preview/render.ts`
- reviewed the current DuckDB-backed Parquet preview boundary in `src/cli/actions/data-parquet-preview.ts`
- reviewed the current DuckDB preview loader in `src/cli/duckdb/parquet-preview.ts`
- reviewed the current interactive data flow in `src/cli/interactive/data.ts`
- reviewed the current interactive dispatcher in `src/cli/interactive/index.ts`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
