---
title: "Tabular data preview v1 implementation"
created-date: 2026-03-09
modified-date: 2026-03-09
status: completed
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
  - handle empty input and header edge cases explicitly
- JSON:
  - array of objects => one row per object
  - top-level object => one-row table
  - scalar array => single `value` column
  - scalar top-level value => one-row single `value` column
- infer stable column order from the normalized row set
- support offset/window slicing before rendering
- adapt column widths to current terminal width when `stdout.isTTY`
- truncate wide cells for terminal display instead of attempting horizontal scrolling in v1
- show only selected columns or a bounded visible subset when the full set cannot fit cleanly
- show visible-window context when the preview is partial
- keep non-TTY output deterministic and line-oriented

### Architecture

- introduce a tabular preview source contract for:
  - columns
  - total row count
  - sliced row access
  - simple type hints or display-ready values
- keep the renderer separate from file parsing logic
- keep DuckDB out of the execution path for v1, but avoid hard-wiring the renderer to one parser shape

## Implementation Guardrails

- keep the implementation modular rather than concentrating preview behavior into one large file
- prefer small focused modules when responsibilities are meaningfully different, for example:
  - source loading
  - row normalization
  - table rendering
  - CLI flag parsing and action wiring
- allow a dedicated subdirectory when that keeps related preview files easier to navigate and test
- avoid premature fragmentation when a helper is still tiny, but split files once a module starts carrying multiple distinct responsibilities

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

- [x] finalize `data preview <input>` argument and baseline flags:
  - [x] `--rows`
  - [x] `--offset`
  - [x] `--columns`
- [x] define deterministic column-order rules for:
  - [x] heterogeneous JSON object rows
  - [x] CSV header-derived columns
- [x] define invalid-input behavior for:
  - [x] unsupported extensions
  - [x] malformed JSON
  - [x] malformed CSV
  - [x] negative or non-numeric window flags
- [x] define CSV edge-case behavior for:
  - [x] empty CSV input
  - [x] blank header cells
  - [x] data rows wider than the header row
- [x] decide whether machine-readable output is in scope now or deferred

### Phase 2: Add preview source normalization

- [x] extract or add shared normalization helpers for JSON preview rows
- [x] add a preview source contract that returns:
  - [x] columns
  - [x] row count
  - [x] sliced rows
  - [x] display-safe cell values
- [x] implement internal CSV preview source
- [x] implement internal JSON preview source
- [x] preserve deterministic column ordering across runs using the Phase 1 rule

### Phase 3: Add terminal table rendering

- [x] render a compact header summary:
  - [x] input path
  - [x] detected format
  - [x] total rows
  - [x] visible row window
  - [x] shown columns
- [x] render a bounded table body with:
  - [x] column width budgeting
  - [x] cell truncation
  - [x] empty-value handling
- [x] define bounded-column fallback when selected or available columns exceed terminal width
- [x] render partial-window messaging when `offset` or `rows` limits the output
- [x] keep non-TTY output predictable and line-oriented

### Phase 4: Wire the command surface

- [x] add `data preview` to `src/command.ts`
- [x] add the preview action export path
- [x] reuse existing file/path display helpers
- [x] ensure errors stay within the existing `CliError` contract

### Phase 5: Tests

- [x] extend conversion tests only where shared helpers changed
- [x] add focused preview action coverage for:
  - [x] CSV happy path
  - [x] empty CSV behavior
  - [x] blank-header CSV behavior
  - [x] wider-than-header CSV row behavior
  - [x] JSON object-array happy path
  - [x] heterogeneous JSON key-union ordering
  - [x] JSON top-level object fallback
  - [x] scalar-array fallback
  - [x] column filtering
  - [x] offset/window slicing
  - [x] unsupported extension error
  - [x] invalid window flag error
  - [x] malformed input errors
- [x] add focused renderer coverage for truncation and visible-window notices

### Phase 6: Smoke-test fixture tooling

- [x] add `scripts/generate-tabular-preview-fixtures.mjs`
- [x] support:
  - [x] `seed`
  - [x] `clean`
  - [x] `reset`
- [x] generate fixtures under `examples/playground/tabular-preview/`
- [x] include at least:
  - [x] `basic.csv`
  - [x] `basic.json`
  - [x] `wide.csv`
  - [x] `wide.json`
  - [x] `scalar-array.json`
  - [x] `large.csv`
  - [x] `large.json`
- [x] make large fixtures deterministic so smoke output is reproducible

### Phase 7: Docs and manual verification

- [x] add a short guide for `data preview`
- [x] document the v1 boundary:
  - [x] CSV and JSON only
  - [x] non-interactive preview
  - [x] DuckDB not used in v1
- [x] run manual smoke checks against playground fixtures in:
  - [x] regular TTY
  - [x] narrow-width TTY
  - [x] non-TTY
- [x] record whether `--format json` should be added next or deferred

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

Recommended additional manual smoke focus:

- regular-width TTY rendering
- narrow-width TTY rendering to verify width adaptation and bounded visible columns
- non-TTY redirected output to verify deterministic line-oriented output

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
