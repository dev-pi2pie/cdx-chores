---
title: "Delimited-text preview and conversion parity"
created-date: 2026-03-17
modified-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Implement the next lightweight `data` expansion for the `csv` / `tsv` / `json` family by:

- adding TSV support to `data preview`
- expanding direct conversions to the full explicit CSV/TSV/JSON triangle
- grouping interactive conversions under `data -> convert`

This plan stays on the lightweight in-memory path and does not introduce DuckDB-backed parsing or conversion for this track.

## Why This Plan

The research direction is now concrete enough to freeze implementation work:

- `data preview` currently supports `.csv` and `.json`, but not `.tsv`
- direct conversion currently exposes only `json-to-csv` and `csv-to-json`
- the current lightweight conversion path already exists and is separate from DuckDB-backed query work
- interactive `data` conversion is still flat and will become noisy if every new transform is added as another top-level submenu entry

The plan therefore locks one coherent lightweight family contract:

- direct CLI remains explicit with `data <convert-action>`
- interactive mode gets one guided `data -> convert` lane
- CSV and TSV share one delimited-text implementation seam
- delimited-to-delimited and delimited-to-JSON contracts are frozen separately so parity does not hide lossy edge cases
- JSON-output formatting rules remain narrow and predictable

## Current State

- `src/command.ts` exposes:
  - `data json-to-csv`
  - `data csv-to-json`
  - `data preview`
- `src/cli/actions/data.ts` contains the current direct conversion actions
- `src/utils/csv.ts` uses `papaparse` for the lightweight CSV parse/stringify path
- `src/cli/data-preview/source.ts` supports only `csv` and `json` preview source loading
- `src/cli/interactive/menu.ts` still lists `json-to-csv` and `csv-to-json` as flat `data` submenu actions
- DuckDB-backed `data query` and `data parquet preview` already exist, but they are not the implementation base for this plan

## Scope

### Lightweight parsing and conversion boundary

- keep this track on the existing lightweight in-memory text path
- reuse the current `papaparse`-backed delimited parsing/stringification layer rather than introducing DuckDB-backed conversion
- generalize the current CSV-specific helper seam so CSV and TSV share the same implementation path where practical
- keep row-array delimited handling and object-based JSON normalization as distinct internal stages rather than collapsing every conversion through one object model
- preserve existing CSV helper behavior for unrelated callers such as rename-plan CSV handling

### Direct CLI surface

- keep the current direct command pattern:
  - `cdx-chores data <convert-action> -i <source> -o <output>`
- preserve existing commands:
  - `json-to-csv`
  - `csv-to-json`
- add new explicit commands:
  - `csv-to-tsv`
  - `tsv-to-csv`
  - `tsv-to-json`
  - `json-to-tsv`
- do not add a generic direct CLI `data convert ...` command
- keep `--pretty` available only on JSON-output commands:
  - `csv-to-json`
  - `tsv-to-json`

### Preview surface

- extend `data preview <input>` to support `.tsv`
- infer TSV by file extension only in this plan
- keep the current header-first delimited preview contract
- keep the current JSON preview contract unchanged
- keep preview on the same lightweight parser path rather than routing through DuckDB

### Interactive surface

- replace flat interactive conversion entries with one `convert` lane under `data`
- show the detected source format after input-path selection
- do not add interactive format override in this plan
- let the wizard choose the target format from the remaining supported lightweight formats
- keep direct CLI command names unchanged even if interactive mode groups the flow differently

### Shared conversion contract

- `json-to-csv` and `json-to-tsv` share the same JSON normalization rules
- `csv-to-json` and `tsv-to-json` share the same header-first delimited parsing rules
- `csv-to-tsv` and `tsv-to-csv` should behave as delimited-row transforms, not as object-normalized rewrites
- delimited-to-delimited conversions must preserve row shape and column positions through the parsed row-array model, including:
  - blank header cells
  - duplicate header cells
  - rows wider than the header row
- delimited-to-delimited conversions may change delimiter, quoting, and terminal newline formatting, but must not silently drop or merge cells
- `csv-to-json` and `tsv-to-json` intentionally remain on the existing object contract for this track:
  - first header cell strips BOM and all header cells are trimmed
  - blank header names are omitted from JSON object output
  - duplicate header names collapse by last-write-wins object assignment
  - extra cells beyond the header width are not represented in JSON output
- `data preview` keeps its existing preview-specific delimited contract rather than inheriting JSON conversion semantics:
  - blank headers become `column_n`
  - duplicate headers are deduplicated for display
  - wider rows extend the visible preview column set
- `--pretty` remains JSON-output-only

## Non-Goals

- DuckDB-backed parsing, conversion, or preview for this track
- explicit format override flags for `data preview` or interactive convert
- delimiter auto-detection for atypical filenames
- NDJSON / JSON Lines support
- Excel-, SQLite-, Parquet-, or query-surface changes
- a new generic direct CLI `data convert ...` command
- source-shaping features such as header inference or workbook range selection

## Implementation Touchpoints

- `src/utils/csv.ts`
- new or adjacent lightweight delimited helpers under `src/utils/`
- `src/cli/actions/data.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/source.ts`
- `src/command.ts`
- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/data.ts`
- `src/cli/actions/index.ts`
- `README.md`
- `docs/guides/data-preview-usage.md`
- interactive/path-output guidance docs where current conversion examples need refreshing
- preview and conversion tests under `test/`
- `scripts/generate-tabular-preview-fixtures.mjs`
- lightweight preview fixtures under `examples/playground/tabular-preview/`

## Phase Checklist

### Phase 1: Freeze the lightweight family contract

- [x] freeze the implementation boundary as lightweight in-memory delimited parsing, not DuckDB
- [x] freeze extension-based detection for TSV preview and interactive convert
- [x] freeze the full explicit direct conversion family:
  - [x] `json-to-csv`
  - [x] `csv-to-json`
  - [x] `csv-to-tsv`
  - [x] `tsv-to-csv`
  - [x] `tsv-to-json`
  - [x] `json-to-tsv`
- [x] freeze `--pretty` as valid only when the output format is JSON
- [x] freeze interactive convert as detected-format display only, without format override

### Phase 2: Generalize lightweight delimited helpers

- [x] add one delimiter-aware parse/stringify seam for lightweight delimited text
- [x] keep existing CSV wrappers stable for current callers
- [x] support at least:
  - [x] comma-delimited parsing/stringification
  - [x] tab-delimited parsing/stringification
- [x] share header-row-to-object conversion rules across CSV and TSV
- [x] preserve current BOM/header normalization and error-shaping behavior where applicable
- [x] keep a row-array delimited path for `csv-to-tsv` / `tsv-to-csv` so they do not route through lossy object normalization
- [x] codify the existing delimited-to-JSON edge-case behavior explicitly:
  - [x] blank headers omitted
  - [x] duplicate headers collapse by last-write-wins
  - [x] cells beyond header width are ignored in JSON output
- [x] avoid regressions for rename-plan CSV and data-query CSV export callers that already depend on existing CSV helpers

### Phase 3: Extend `data preview` to TSV

- [x] extend preview format detection to include `.tsv`
- [x] reuse the generalized lightweight delimited parser for CSV and TSV preview loading
- [x] keep the current header-first contract for TSV preview
- [x] keep existing preview filtering, slicing, and rendering behavior unchanged outside the new format support
- [x] update preview summary/help text so CSV and TSV are both named explicitly

### Phase 4: Expand explicit direct conversion actions

- [x] refactor conversion internals so one shared worker or helper layer can serve all six explicit direct commands
- [x] preserve existing `json-to-csv` and `csv-to-json` behavior unless the new shared contract intentionally changes it
- [x] keep `csv-to-tsv` and `tsv-to-csv` on the delimited row-array path instead of reusing the JSON object conversion path
- [x] add new direct commands and action wiring for:
  - [x] `csv-to-tsv`
  - [x] `tsv-to-csv`
  - [x] `tsv-to-json`
  - [x] `json-to-tsv`
- [x] keep default output-path derivation aligned with the target extension
- [x] keep success output consistent with current conversion actions:
  - [x] written output path
  - [x] row count
- [x] ensure JSON-output commands alone expose `--pretty`

### Phase 5: Add interactive `data -> convert`

- [x] replace flat interactive conversion entries in the `data` submenu with one `convert` entry
- [x] add a new interactive action key and route for `data:convert`
- [x] inside the wizard:
  - [x] prompt for the source file path
  - [x] detect and display source format from file extension
  - [x] reject unsupported source formats for this lightweight lane
  - [x] prompt for the target format from remaining valid lightweight choices
  - [x] derive the default output path from the chosen target format
  - [x] prompt for `Pretty-print JSON?` only when the target format is JSON
  - [x] prompt for overwrite behavior
- [x] dispatch the wizard to the existing explicit actions underneath instead of inventing a new direct CLI contract

### Phase 6: Tests

- [x] extend helper coverage for delimiter-aware parsing and stringification
- [x] add direct action coverage for:
  - [x] `csv-to-tsv`
  - [x] `tsv-to-csv`
  - [x] `tsv-to-json`
  - [x] `json-to-tsv`
  - [x] JSON-output-only `--pretty`
  - [x] invalid input shape or malformed file handling
  - [x] unsupported extension handling where relevant
- [x] add explicit delimited parity coverage for edge cases that are easy to make lossy during refactor:
  - [x] quoted delimiters
  - [x] embedded newlines inside quoted cells
  - [x] blank header cells
  - [x] duplicate header cells
  - [x] rows wider than the header row
- [x] add round-trip-focused assertions for `csv -> tsv -> csv` and `tsv -> csv -> tsv` using parsed row-array equivalence rather than raw string equality
- [x] add direct conversion coverage proving current delimited-to-JSON edge-case behavior remains intentional:
  - [x] blank headers omitted from JSON output
  - [x] duplicate headers collapse by last-write-wins
  - [x] wider-than-header cells are not surfaced in JSON output
- [x] extend preview coverage for TSV happy path and edge cases parallel to current CSV coverage
- [x] add interactive coverage for:
  - [x] `data -> convert` menu routing
  - [x] detected-format display
  - [x] target-format selection
  - [x] JSON-only `--pretty` prompt
  - [x] output-path defaulting
- [x] add CLI UX coverage for the expanded direct command surface:
  - [x] `data --help` lists the new explicit conversions
  - [x] each new command is wired in `src/command.ts`
  - [x] `--pretty` is exposed only on JSON-output commands
  - [x] `data preview --help` and related copy name TSV support explicitly
- [x] verify existing CSV/JSON conversion tests still pass under the shared helper layer

### Phase 7: Fixtures, docs, and manual verification

- [x] revise `scripts/generate-tabular-preview-fixtures.mjs` so `seed`, `clean`, and `reset` cover TSV fixtures alongside the existing lightweight preview fixtures
- [x] extend existing lightweight preview fixture generation to include TSV fixtures
- [x] add at least:
  - [x] `basic.tsv`
  - [x] `wide.tsv`
  - [x] `large.tsv`
- [x] update `docs/guides/data-preview-usage.md` for TSV preview support
- [x] update `README.md` command examples for the expanded explicit conversion family
- [x] update interactive docs where current conversion menu wording is now outdated
- [x] document this plan's architecture boundary explicitly:
  - [x] lightweight `papaparse`-backed delimited parsing for `csv` / `tsv` / `json`
  - [x] no DuckDB-backed conversion in this track
- [x] run manual smoke checks for:
  - [x] direct TSV preview
  - [x] each new direct conversion path
  - [x] interactive `data -> convert`
  - [x] JSON pretty-print behavior

## Manual Smoke Strategy

Recommended direct smoke commands:

```bash
bun src/bin.ts data preview examples/playground/tabular-preview/basic.tsv
bun src/bin.ts data csv-to-tsv -i examples/playground/tabular-preview/basic.csv -o examples/playground/.tmp-tests/basic.tsv --overwrite
bun src/bin.ts data tsv-to-csv -i examples/playground/tabular-preview/basic.tsv -o examples/playground/.tmp-tests/basic.csv --overwrite
bun src/bin.ts data tsv-to-json -i examples/playground/tabular-preview/basic.tsv -o examples/playground/.tmp-tests/basic.json --pretty --overwrite
bun src/bin.ts data json-to-tsv -i examples/playground/tabular-preview/basic.json -o examples/playground/.tmp-tests/basic.tsv --overwrite
```

Recommended edge-case smoke focus:

- quoted commas and quoted tabs survive `csv-to-tsv` / `tsv-to-csv`
- embedded newlines inside quoted cells survive delimiter swaps
- blank and duplicate headers are preserved across delimited-to-delimited transforms
- blank headers, duplicate headers, and extra trailing cells still follow the documented lossy JSON contract for `csv-to-json` / `tsv-to-json`

Recommended interactive smoke focus:

- `data -> convert` appears as one submenu action instead of one action per transform
- source format is shown from extension detection, not manually overridden
- target choices exclude the detected source format
- `Pretty-print JSON?` appears only when target format is JSON
- output path defaults follow the chosen target extension

## Success Criteria

- `data preview` supports `.tsv` through the same lightweight family contract as `.csv`
- direct CLI exposes the full explicit CSV/TSV/JSON conversion triangle without adding a generic direct `data convert ...` command
- interactive `data` conversion becomes one guided `convert` lane without changing direct CLI command names
- the implementation stays on the lightweight `papaparse`-backed path and does not pull DuckDB into this track
- CSV and TSV delimiter swaps preserve delimited row shape without silently collapsing cells through object normalization
- lossy delimited-to-JSON behavior remains explicit, documented, and covered by tests rather than hidden behind “parity” wording
- existing CSV/JSON conversion behavior remains stable except where the plan intentionally broadens format parity

## Verification

- `bunx tsc --noEmit`
- `bun test` on focused data preview, data conversion, and interactive suites
- manual direct-conversion smoke checks under `examples/playground/.tmp-tests/`
- manual interactive `data -> convert` smoke checks in a PTY session

## Related Research

- `docs/researches/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/plan-2026-03-09-data-preview-interactive-and-color-polish.md`
