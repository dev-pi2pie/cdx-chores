---
title: "Consolidate March 10 data query research updates"
created-date: 2026-03-10
modified-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Consolidate the March 10 discussion-driven updates to the `data query` research into one implementation record and replace the fragmented job-log trail with a single traceable summary.

## What Changed

- expanded the research contract to cover input-detection semantics alongside SQL, file-shape, output, and error behavior
- promoted CSV, Parquet, SQLite, and Excel into the draft format set, with SQLite and Excel explicitly framed as extension-backed inputs
- recorded the SQL-first contract for direct CLI usage and kept non-SQL query helpers visible as a later feature track rather than part of the first implementation
- split direct CLI execution from future Codex-assisted SQL drafting by reserving a separate `data query codex` command lane instead of mixing assistance into base `data query`
- froze `--input-format` as the explicit input-type override and `--rows` as the bounded table-display flag
- froze the output contract as bounded table by default, `--json` with optional `--pretty` for machine-readable stdout, and `--output <path>` with `.json` / `.csv` inferred from the output path
- froze `--pretty` as a JSON-serialization-only flag that applies to JSON stdout and JSON file output, but not to table or CSV output
- froze the bounded terminal table default at 20 rows and kept `--rows` as the explicit override instead of introducing adaptive defaults or baseline pagination
- explicitly removed pagination from the current research and implementation contract rather than leaving it as an open question
- froze `--json` to stdout as full-result streaming by default
- clarified that query presentation limits must not rewrite SQL semantics and should stay application-controlled rather than DuckDB- or OS-derived
- recorded the extension guardrail that SQLite and Excel should use explicit extension-aware handling and fail with targeted guidance rather than silent automatic installation
- added an explicit `--source <name>` contract for direct CLI query against multi-object formats such as SQLite and Excel, with the selected object bound to logical table name `file`
- clarified that TSV is part of the built-in CSV-family delimited-text surface instead of leaving it only implied by detection rules
- froze doctor capability reporting for extension-backed formats as a three-part model: detected support, loadability, and installability
- froze doctor capability reporting for `data query codex` separately from DuckDB format support, including configured support, authentication or session availability, and ready-to-draft availability
- froze the interactive query design contract as an introspection-first `choose mode` workflow with `manual`, `formal-guide`, and `Codex Assistant`
- froze the first interactive `manual` mode to a single-line SQL prompt instead of leaving SQL-entry mechanics open
- froze the shared interactive guardrail that candidate SQL must always be shown back to the user and explicitly confirmed before execution
- aligned future CLI Codex drafting with the same introspection-first and advisory-only guardrails used by interactive `Codex Assistant`
- froze `data query codex` output channels so default assistant output and `--print-sql` use stdout while diagnostics and failures use stderr
- froze the minimum `formal-guide` prompt set and the default bounded introspection payload so those topics no longer remain vague future design placeholders
- reworded the final recommendation so the dedicated implementation plan can proceed from the frozen contract instead of implying unresolved contract-level ambiguity

## Files

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`

## Verification

- reviewed the current preview and output flag patterns in `src/command.ts`
- reviewed the current bounded preview defaults in `src/cli/actions/data-preview.ts`
- reviewed the current bounded preview renderer in `src/cli/data-preview/render.ts`
- reviewed the current DuckDB-backed Parquet preview boundary in `src/cli/actions/data-parquet-preview.ts`
- reviewed the current DuckDB preview loader in `src/cli/duckdb/parquet-preview.ts`
- reviewed the current interactive data flow in `src/cli/interactive/data.ts`
- reviewed the current interactive dispatcher in `src/cli/interactive/index.ts`
- reviewed the current research open-question section after resolving the remaining contract-level items
- reviewed the research for direct-CLI multi-object source-selection gaps and recommendation consistency

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
