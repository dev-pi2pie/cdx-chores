---
title: "Tabular data preview v1 implementation"
created-date: 2026-03-09
status: active
agent: codex
---

## Goal

Implement a first `data preview` command that can inspect `.csv` and `.json` files in a predictable, Node.js-compatible, read-only terminal workflow without making DuckDB or SQL part of the required v1 execution path.

## Why This Plan

The research direction is now concrete enough to turn into implementation work:

- the current `data` command family only does format conversion
- the repo already has CSV parsing and JSON normalization building blocks
- `@duckdb/node-api` is installed, but there is still no production integration using it
- the first user-visible need is previewing tabular data, not building a SQL product surface yet

The plan therefore locks a smaller v1:

- add `data preview` as a new subcommand
- keep v1 non-interactive and flag-driven
- design a row-source boundary that can support a future DuckDB-backed source later

## Current State

- `src/command.ts` exposes `data json-to-csv` and `data csv-to-json`
- `src/cli/actions/data.ts` only handles conversion-oriented read/parse/write flows
- `src/utils/csv.ts` provides CSV parsing and object normalization
- there is no current generic tabular renderer, preview summary contract, or `data preview` test coverage
- `examples/playground/` is already the preferred scratch space for smoke-test artifacts

## Scope

### CLI surface

- add `data preview <input>`
- support `.csv` and `.json`
- support first-pass flags:
  - `--rows <n>`
  - `--offset <n>`
  - `--columns <name,name,...>`
- print a summary plus a bounded table window to stdout
- return explicit CLI errors for unsupported file types or invalid flag values

### Preview behavior

- CSV:
  - parse first row as header using the existing parser contract
- JSON:
  - array of objects => one row per object
  - top-level object => one-row table
  - scalar array => single `value` column
  - scalar top-level value => one-row single `value` column
- infer stable column order from the normalized row set
- support offset/window slicing before rendering
- truncate wide cells for terminal display instead of attempting horizontal scrolling in v1
- show visible-window context when the preview is partial

### Architecture

- introduce a tabular preview source contract for:
  - columns
  - total row count
  - sliced row access
  - simple type hints or display-ready values
- keep the renderer separate from file parsing logic
- keep DuckDB out of the execution path for v1, but avoid hard-wiring the renderer to one parser shape

## Non-Goals

- SQL execution
- Parquet input
- NDJSON / JSON Lines
- keyboard scrolling or a dedicated TUI table viewer
- workbook-style spreadsheet support
- activating DuckDB-backed runtime behavior in this implementation

## Implementation Touchpoints

- `src/command.ts`
- `src/cli/actions/data.ts`
- new preview helpers under `src/cli/`
- `src/cli/actions/index.ts`
- `test/cli-actions-data.test.ts`
- new focused preview tests under `test/`
- new smoke-fixture generator under `scripts/`
- new playground datasets under `examples/playground/`
- new user guide under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze v1 command contract

- [ ] finalize `data preview <input>` argument and baseline flags:
  - [ ] `--rows`
  - [ ] `--offset`
  - [ ] `--columns`
- [ ] define invalid-input behavior for:
  - [ ] unsupported extensions
  - [ ] malformed JSON
  - [ ] malformed CSV
  - [ ] negative or non-numeric window flags
- [ ] decide whether machine-readable output is in scope now or deferred

### Phase 2: Add preview source normalization

- [ ] extract or add shared normalization helpers for JSON preview rows
- [ ] add a preview source contract that returns:
  - [ ] columns
  - [ ] row count
  - [ ] sliced rows
  - [ ] display-safe cell values
- [ ] implement internal CSV preview source
- [ ] implement internal JSON preview source
- [ ] preserve deterministic column ordering across runs

### Phase 3: Add terminal table rendering

- [ ] render a compact header summary:
  - [ ] input path
  - [ ] detected format
  - [ ] total rows
  - [ ] visible row window
  - [ ] shown columns
- [ ] render a bounded table body with:
  - [ ] column width budgeting
  - [ ] cell truncation
  - [ ] empty-value handling
- [ ] render partial-window messaging when `offset` or `rows` limits the output
- [ ] keep non-TTY output predictable and line-oriented

### Phase 4: Wire the command surface

- [ ] add `data preview` to `src/command.ts`
- [ ] add the preview action export path
- [ ] reuse existing file/path display helpers
- [ ] ensure errors stay within the existing `CliError` contract

### Phase 5: Tests

- [ ] extend conversion tests only where shared helpers changed
- [ ] add focused preview action coverage for:
  - [ ] CSV happy path
  - [ ] JSON object-array happy path
  - [ ] JSON top-level object fallback
  - [ ] scalar-array fallback
  - [ ] column filtering
  - [ ] offset/window slicing
  - [ ] unsupported extension error
  - [ ] invalid window flag error
  - [ ] malformed input errors
- [ ] add focused renderer coverage for truncation and visible-window notices

### Phase 6: Smoke-test fixture tooling

- [ ] add `scripts/generate-tabular-preview-fixtures.mjs`
- [ ] support:
  - [ ] `seed`
  - [ ] `clean`
  - [ ] `reset`
- [ ] generate fixtures under `examples/playground/tabular-preview/`
- [ ] include at least:
  - [ ] `basic.csv`
  - [ ] `basic.json`
  - [ ] `wide.csv`
  - [ ] `wide.json`
  - [ ] `scalar-array.json`
  - [ ] `large.csv`
  - [ ] `large.json`
- [ ] make large fixtures deterministic so smoke output is reproducible

### Phase 7: Docs and manual verification

- [ ] add a short guide for `data preview`
- [ ] document the v1 boundary:
  - [ ] CSV and JSON only
  - [ ] non-interactive preview
  - [ ] DuckDB not used in v1
- [ ] run manual smoke checks against playground fixtures in TTY and non-TTY contexts
- [ ] record whether `--format json` should be added next or deferred

## Smoke-Test Strategy

Recommended fixture generator contract:

```bash
node scripts/generate-tabular-preview-fixtures.mjs seed
node scripts/generate-tabular-preview-fixtures.mjs clean
node scripts/generate-tabular-preview-fixtures.mjs reset
```

Recommended generated dataset shapes:

- `basic.*`: small, readable happy-path rows for quick visual checks
- `wide.*`: many columns plus long strings to verify truncation and column budgeting
- `scalar-array.json`: validates the single-`value` fallback
- `large.*`: hundreds or thousands of rows to validate slicing and bounded output

Recommended manual smoke commands:

```bash
bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv
bun src/bin.ts data preview examples/playground/tabular-preview/basic.json
bun src/bin.ts data preview examples/playground/tabular-preview/wide.csv --columns id,status,message
bun src/bin.ts data preview examples/playground/tabular-preview/large.json --rows 20 --offset 120
bun src/bin.ts data preview examples/playground/tabular-preview/large.csv --rows 15 > examples/playground/.tmp-tests/tabular-preview-large.txt
```

## Success Criteria

- `data preview` works for `.csv` and `.json` without requiring DuckDB
- preview output is deterministic enough for test assertions and smoke checks
- large-file inspection is bounded through explicit window flags rather than uncontrolled stdout floods
- the internal source/renderer split leaves a clean seam for later DuckDB-backed work
- playground fixture generation is reusable for future preview regressions

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data.test.ts test/cli-actions-data-preview.test.ts`
- manual smoke checks using `examples/playground/tabular-preview/`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
- `docs/researches/research-2026-02-25-excel-like-workflows-scope-and-tooling.md`
