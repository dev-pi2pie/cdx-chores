---
title: "DuckDB Parquet preview and query action split"
created-date: 2026-03-09
modified-date: 2026-03-09
status: draft
agent: codex
---

## Goal

Activate `@duckdb/node-api` through explicit DuckDB-oriented `data` actions instead of extending the lightweight `data preview` contract.

Freeze the command family around:

- `data preview <input>` for `.csv` and `.json`
- `data parquet preview <file.parquet>` for DuckDB-backed bounded Parquet inspection
- `data query <input>` as the later DuckDB-backed query entry point

## Why This Plan

DuckDB should not be introduced just to make the current CSV/JSON preview path more complicated.

The strongest reason to split the actions now is that DuckDB changes product scope, not just backend implementation details:

- `data preview` already has a lightweight in-memory contract for `.csv` / `.json`
- Parquet is a concrete capability gap that justifies a DuckDB-backed action
- query-oriented expectations belong under an explicit `data query` lane instead of leaking into preview
- the current preview loader is text-oriented, so Parquet should not be forced through the same load contract

DuckDB is already present in dependencies, but enabling it should be reflected in command design.

## Current State

- `data preview` already works for `.csv` and `.json`
- `data preview` now also supports `--contains` filtering on the in-memory preview path
- interactive preview prompts and CLI help still frame `data preview` as CSV/JSON-only
- `@duckdb/node-api` is installed but unused
- there is no DuckDB command contract yet for either Parquet preview or query workflows
- there is no doctor/runtime validation path for DuckDB-backed execution yet

## Design Contract

### `data preview <input>`

- remains the lightweight in-memory preview path
- supported inputs stay limited to `.csv` and `.json`
- keeps the current bounded preview semantics, including `--contains`
- should continue to reject `.parquet` rather than silently changing backend behavior

### `data parquet preview <file.parquet>`

- becomes the first DuckDB-backed action
- is read-only and bounded like the current preview renderer
- first-pass flags should mirror the non-query preview window where practical:
  - `--rows`
  - `--offset`
  - `--columns`
- does not inherit `--contains` unless a later DuckDB-specific plan adds it explicitly

### `data query <input>`

- is the explicit future entry point for DuckDB-backed query workflows
- should treat `<input>` as one logical table for SQL-oriented operations
- is where SQL and broader DuckDB-oriented semantics should land
- should remain separate from both lightweight preview and Parquet-only preview
- may be reserved in this plan before its full execution contract is implemented

## Scope

### Backend scope

- add a DuckDB-backed Parquet preview path behind `data parquet preview`
- avoid coupling Parquet loading to the current text-only `data preview` loader
- keep `.csv` and `.json` on the current in-memory preview path
- shape DuckDB helpers so they can later support `data query`

### User-facing scope

- support `data parquet preview ./file.parquet`
- preserve the bounded preview surface for Parquet where practical:
  - `--rows`
  - `--offset`
  - `--columns`
- keep `data preview` documented and implemented as CSV/JSON-only
- define `data query <input>` as the separate DuckDB query lane instead of adding SQL to preview commands

### Runtime behavior

- validate DuckDB availability only when DuckDB-backed actions are invoked
- decide whether doctor output should expose DuckDB-backed Parquet capability in this phase
- keep lightweight `data preview` behavior unchanged when DuckDB is unavailable or deferred

## Non-Goals

- `.parquet` support through `data preview`
- SQL mode inside `data parquet preview`
- full `data query` execution semantics in this plan
- CSV/JSON migration to DuckDB in the first pass
- `--contains` support for `data parquet preview` in the first pass
- remote data sources
- grouping, aggregation, or ordering features beyond existing preview behavior
- workbook-style spreadsheet support

## Implementation Touchpoints

- `src/command.ts`
- `src/cli/actions/data-preview.ts`
- new DuckDB preview/query helpers under `src/cli/`
- new `data parquet preview` action wiring under `src/cli/actions/`
- `src/cli/actions/doctor.ts`
- `src/cli/interactive/data.ts`
- focused preview/doctor tests under `test/`
- `docs/guides/data-preview-usage.md`
- DuckDB-oriented command docs if this plan lands implementation in the same milestone

## Phase Checklist

### Phase 1: Freeze the command split

- [ ] define `data preview` as CSV/JSON-only and explicitly keep `.parquet` out of that action
- [ ] define first-pass Parquet support as `data parquet preview <file.parquet>`
- [ ] confirm which bounded preview flags must work for Parquet:
  - [ ] `--rows`
  - [ ] `--offset`
  - [ ] `--columns`
- [ ] define whether `data query <input>` is a documented future contract only or a deferred CLI stub in this phase
- [ ] define clear first-pass behavior for `--contains` on DuckDB-backed actions
- [ ] define clear failure behavior when DuckDB initialization or Parquet loading fails
- [ ] decide whether doctor should advertise Parquet capability in this pass

### Phase 2: DuckDB adapter and preview integration

- [ ] add DuckDB-backed Parquet loading that works from file paths instead of the text-only preview loader
- [ ] map Parquet results into the existing preview row contract
- [ ] preserve deterministic column ordering and row slicing behavior
- [ ] keep JSON/CSV preview sources unchanged in this phase
- [ ] keep the DuckDB helper boundary reusable for later `data query` work

### Phase 3: CLI/runtime wiring

- [ ] add `data parquet preview` command wiring
- [ ] keep `data preview` help and parsing scoped to CSV/JSON inputs
- [ ] update interactive prompt copy so lightweight preview and Parquet preview are not conflated
- [ ] decide whether to add a deferred/stub `data query` command in this phase
- [ ] surface clear runtime errors for unsupported or failed DuckDB activation
- [ ] optionally extend doctor output if the capability decision is in scope

### Phase 4: Tests

- [ ] add focused coverage for:
  - [ ] Parquet happy-path preview
  - [ ] `--columns` with Parquet
  - [ ] `--rows` / `--offset` with Parquet
  - [ ] `data preview` still rejects `.parquet`
  - [ ] `data parquet preview` rejects unsupported first-pass flags if any remain deferred
  - [ ] DuckDB initialization failure
  - [ ] unsupported Parquet-load path failures
- [ ] add CLI/help/interactive coverage for the new command split
- [ ] add doctor coverage only if doctor capability reporting is updated in this pass

### Phase 5: Docs and verification

- [ ] update `docs/guides/data-preview-usage.md` to keep `data preview` clearly CSV/JSON-only
- [ ] add DuckDB-oriented docs for `data parquet preview`
- [ ] document the first DuckDB milestone boundary:
  - [ ] Parquet preview is separate from lightweight preview
  - [ ] no SQL inside `data parquet preview`
  - [ ] `data query` is the later query lane
  - [ ] JSON/CSV remain on the existing in-memory path
- [ ] add or generate stable Parquet smoke fixtures
- [ ] run manual smoke checks for both lightweight preview and Parquet preview

## Success Criteria

- `data preview` remains a lightweight CSV/JSON inspector without DuckDB runtime coupling
- `data parquet preview` can inspect Parquet files through DuckDB without regressing the existing preview path
- the command family makes the future `data query` lane explicit instead of overloading preview semantics

## Verification

- `bunx tsc --noEmit`
- focused `bun test` preview, command-routing, interactive, and doctor suites
- manual smoke checks for both `data preview` and `data parquet preview`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-filter.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`
