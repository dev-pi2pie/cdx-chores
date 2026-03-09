---
title: "DuckDB Parquet preview integration"
created-date: 2026-03-09
status: draft
agent: codex
---

## Goal

Activate `@duckdb/node-api` as a later `data preview` backend for Parquet-first preview support, while keeping the existing JSON/CSV in-memory path intact.

## Why This Plan

DuckDB should not be introduced just to make the current JSON/CSV preview path more complicated.

The strongest first reason to activate DuckDB is Parquet support because:

- Parquet is a concrete capability gap
- DuckDB is already present in dependencies
- Parquet is a better justification for a database-backed preview source than simple CSV/JSON filtering
- the current preview architecture already has a row-source boundary that can be extended

## Current State

- `data preview` already works for `.csv` and `.json`
- lightweight preview filtering is planned separately from DuckDB work
- `@duckdb/node-api` is installed but unused
- there is no Parquet preview contract yet
- there is no doctor/runtime validation path for DuckDB-backed execution yet

## Scope

### Backend scope

- add a DuckDB-backed preview source for `.parquet`
- keep `.csv` and `.json` on the current in-memory path in the first DuckDB milestone
- keep DuckDB activation bounded to preview source responsibilities

### User-facing scope

- support `data preview ./file.parquet`
- preserve the current preview surface where practical:
  - `--rows`
  - `--offset`
  - `--columns`
- keep SQL out of the first DuckDB milestone unless a later plan explicitly adds it

### Runtime behavior

- validate DuckDB availability and surface a clear CLI error if runtime activation fails
- decide whether doctor output should expose DuckDB-backed Parquet capability in this phase
- keep non-Parquet preview behavior unchanged when DuckDB is unavailable or deferred

## Non-Goals

- SQL mode
- CSV/JSON migration to DuckDB in the first pass
- remote data sources
- grouping, aggregation, or ordering features beyond existing preview behavior
- workbook-style spreadsheet support

## Implementation Touchpoints

- `src/cli/data-preview/source.ts`
- new DuckDB adapter helpers under `src/cli/data-preview/`
- `src/cli/actions/data-preview.ts`
- `src/cli/actions/doctor.ts`
- focused preview/doctor tests under `test/`
- `docs/guides/data-preview-usage.md`

## Phase Checklist

### Phase 1: Freeze Parquet contract

- [ ] define first-pass Parquet support as `data preview <file.parquet>`
- [ ] confirm which existing preview flags must work unchanged:
  - [ ] `--rows`
  - [ ] `--offset`
  - [ ] `--columns`
- [ ] define clear failure behavior when DuckDB initialization or Parquet loading fails
- [ ] decide whether doctor should advertise Parquet capability in this pass

### Phase 2: DuckDB adapter and source integration

- [ ] add a DuckDB-backed preview source for Parquet
- [ ] map Parquet results into the existing preview row contract
- [ ] preserve deterministic column ordering and row slicing behavior
- [ ] keep JSON/CSV sources unchanged in this phase

### Phase 3: CLI/runtime wiring

- [ ] route `.parquet` inputs to the DuckDB-backed source
- [ ] surface clear runtime errors for unsupported or failed DuckDB activation
- [ ] optionally extend doctor output if the capability decision is in scope

### Phase 4: Tests

- [ ] add focused coverage for:
  - [ ] Parquet happy-path preview
  - [ ] `--columns` with Parquet
  - [ ] `--rows` / `--offset` with Parquet
  - [ ] DuckDB initialization failure
  - [ ] unsupported Parquet-load path failures
- [ ] add doctor coverage only if doctor capability reporting is updated in this pass

### Phase 5: Docs and verification

- [ ] update `docs/guides/data-preview-usage.md` for Parquet support
- [ ] document the first DuckDB milestone boundary:
  - [ ] Parquet first
  - [ ] no SQL yet
  - [ ] JSON/CSV remain on the existing in-memory path
- [ ] add or generate stable Parquet smoke fixtures
- [ ] run manual preview smoke checks

## Success Criteria

- `data preview` can inspect Parquet files through DuckDB without regressing the existing JSON/CSV path
- DuckDB activation remains bounded to a backend concern instead of redefining the whole preview contract
- Parquet support lands before any larger SQL/query surface is introduced

## Verification

- `bunx tsc --noEmit`
- focused `bun test` preview and doctor suites
- manual smoke checks for Parquet preview

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-filter.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`
