---
title: "Refactor data workflow surface into smaller modules"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Reduce structural concentration in the data workflow surface without changing the public CLI or exported API behavior.

## What Changed

- split `src/cli/commands/data.ts` into focused registration helpers under `src/cli/commands/data/` for conversion, preview, DuckDB lifecycle, extract, and query command wiring
- split `src/cli/actions/data-extract.ts` into focused helpers under `src/cli/actions/data-extract/` for materialization, validation, source-shape suggestion flow, and shared extract types
- split `src/cli/interactive/data.ts` into focused interactive helpers under `src/cli/interactive/data/` for convert, extract, preview, parquet preview, and shared lightweight prompt helpers
- split `src/cli/duckdb/query/prepare-source.ts` into focused helpers under `src/cli/duckdb/query/prepare-source/` for source validation, column inspection, SQL/projection building, and Excel-specific shaping logic
- kept the stable top-level entrypoints in place:
  - `src/cli/commands/data.ts`
  - `src/cli/actions/data-extract.ts`
  - `src/cli/interactive/data.ts`
  - `src/cli/duckdb/query/prepare-source.ts`

## API Compatibility

- preserved the exported `registerDataCommands`, `actionDataExtract`, `handleDataInteractiveAction`, and `prepareDataQuerySource` entrypoints
- preserved the `data` CLI subcommand names, options, help text, and routing behavior by moving wiring into helper modules instead of changing option contracts
- preserved the data extract option surface and query preparation behavior while extracting internal helpers only

## Verification

- `bun run build`
- `bun run lint`
- `bun test`
- full test suite result: `530 pass`, `0 fail`
