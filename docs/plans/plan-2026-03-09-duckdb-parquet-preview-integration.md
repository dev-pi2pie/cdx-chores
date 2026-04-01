---
title: "DuckDB Parquet preview and query action split"
created-date: 2026-03-09
modified-date: 2026-03-10
status: active
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
- uses a parallel DuckDB preview source contract rather than widening the lightweight in-memory preview source
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
- is frozen as a doc-only future direction in this plan
- should get its own research and implementation plan before any CLI or interactive surface is added

## Interactive Mode Design

### First-pass menu shape

- keep the existing `interactive -> data -> preview` flow mapped to lightweight CSV/JSON preview only
- add a separate `interactive -> data -> parquet preview` entry instead of broadening the existing preview route
- do not add `data query` to interactive mode in the first DuckDB milestone

This keeps the interactive menu aligned with the command split:

- preview is lightweight and non-DuckDB
- parquet preview is DuckDB-backed but still read-only and bounded
- query remains a later explicit workflow with its own input UX

### `interactive -> data -> parquet preview`

Prompt sequence for the first pass:

- input Parquet file
- optional row count
- optional offset
- optional comma-separated column selection

Defaults should mirror the direct CLI behavior:

- blank row count => CLI default row window
- blank offset => `0`
- blank columns => no column filter

Interaction rules:

- keep the flow stdout-only with no output-path prompt
- do not ask for `--contains` because Parquet preview does not inherit that contract in the first pass
- reuse the same bounded preview renderer as the direct action path
- show DuckDB load/init failures inline as normal interactive action errors rather than silently routing back to lightweight preview

### `interactive -> data -> query`

- keep this out of the first DuckDB milestone
- do not add a placeholder prompt sequence unless the CLI command contract for SQL input is already frozen
- only add it later when the SQL entry UX is decided explicitly, for example:
  - single prompt for `--sql`
  - editor-backed SQL entry
  - saved-query selection

The first pass should avoid pretending that query UX is solved when only the backend idea is defined.

## Fixture Generation Design

- add a deterministic fixture generator for DuckDB smoke data instead of checking in hand-made Parquet binaries without a regeneration path
- keep generated smoke assets under `examples/playground/`, consistent with the repository scratch-space convention
- use a dedicated Parquet smoke generator under `scripts/` so the existing CSV/JSON fixture script stays scoped to lightweight preview

First-pass Parquet fixture goals:

- generate at least one small happy-path Parquet file for basic preview checks
- generate at least one wider Parquet file for column-selection and hidden-column behavior
- generate at least one larger Parquet file for `--rows` / `--offset` smoke checks
- keep the row content deterministic so preview output can be compared across runs

Design constraints:

- the generator should produce Parquet from a stable source dataset rather than require a manually curated binary blob
- fixture shape should stay comparable to the existing CSV/JSON preview fixtures where that helps CLI and renderer parity checks
- the plan should treat fixture generation as part of the DuckDB milestone, not as optional follow-up polish
- generated Parquet playground assets are for manual smoke preparation, not a required dependency of routine automated test runs
- automated tests should rely on stable checked-in or generated-once Parquet fixtures rather than runtime fixture generation

## Scope

### Backend scope

- add a DuckDB-backed Parquet preview path behind `data parquet preview`
- avoid coupling Parquet loading to the current text-only `data preview` loader
- introduce a parallel DuckDB preview source contract instead of extending the current lightweight preview source as the first move
- define an explicit renderer-facing tabular adapter boundary so Parquet preview can reuse the bounded renderer without widening lightweight preview types
- keep `.csv` and `.json` on the current in-memory preview path
- keep any later `data query` work out of this milestone beyond naming and related-doc traceability

### User-facing scope

- support `data parquet preview ./file.parquet`
- preserve the bounded preview surface for Parquet where practical:
  - `--rows`
  - `--offset`
  - `--columns`
- keep `data preview` documented and implemented as CSV/JSON-only
- define `data query <input>` as the separate future DuckDB query lane instead of adding SQL to preview commands
- add a separate interactive `data -> parquet preview` route instead of expanding the current preview prompts
- update top-level `data` command/menu wording so it no longer reads as conversion-only once preview/parquet actions are present
- define a repeatable local fixture-generation path for Parquet smoke files

### Runtime behavior

- validate DuckDB availability only when DuckDB-backed actions are invoked
- decide whether doctor output should expose DuckDB-backed Parquet capability in this phase
- keep lightweight `data preview` behavior unchanged when DuckDB is unavailable or deferred

## Non-Goals

- `.parquet` support through `data preview`
- SQL mode inside `data parquet preview`
- any `data query` CLI stub, help entry, or interactive route in this plan
- full `data query` execution semantics in this plan
- CSV/JSON migration to DuckDB in the first pass
- `--contains` support for `data parquet preview` in the first pass
- remote data sources
- grouping, aggregation, or ordering features beyond existing preview behavior
- workbook-style spreadsheet support

## Risks and Mitigations

- Risk: DuckDB runtime availability may differ across supported environments and turn Parquet preview into a fragile feature.
  Mitigation: keep DuckDB activation scoped to `data parquet preview`, surface explicit runtime failures, and only extend `doctor` if the capability signal is stable enough to be trustworthy.

- Risk: implementation may drift back toward widening the lightweight preview contracts because the existing renderer and summary flow already assume `csv | json`.
  Mitigation: freeze the parallel DuckDB preview source plus renderer-facing adapter boundary in Phase 1 and treat direct widening of `DataPreviewSource` as out of scope for this milestone.

- Risk: top-level CLI and interactive wording may stay conversion-oriented even after Parquet preview lands, leaving the user-facing surface internally inconsistent.
  Mitigation: update `data` group descriptions and cover those labels in help/menu tests as part of the same milestone.

- Risk: Parquet fixture generation may accidentally become a hidden CI dependency and make tests fail for environment reasons unrelated to the feature itself.
  Mitigation: keep scripted Parquet generation for manual smoke preparation only and require automated tests to consume stable fixtures.

- Risk: `data query` scope may leak back into this milestone because DuckDB is present and the command family names now exist.
  Mitigation: keep `data query` doc-only here and route all query-contract work into the separate research track before any CLI or interactive exposure.

## Implementation Touchpoints

- `src/command.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/render.ts`
- new DuckDB parquet-preview helpers under `src/cli/`
- new `data parquet preview` action wiring under `src/cli/actions/`
- `src/cli/actions/doctor.ts`
- `src/cli/interactive/data.ts`
- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `scripts/generate-tabular-preview-fixtures.mjs` or a paired Parquet fixture generator under `scripts/`
- focused preview/doctor tests under `test/`
- `docs/guides/data-preview-usage.md`
- DuckDB-oriented command docs if this plan lands implementation in the same milestone

## Phase Checklist

### Phase 1: Freeze the command split

- [x] define `data preview` as CSV/JSON-only and explicitly keep `.parquet` out of that action
- [x] define first-pass Parquet support as `data parquet preview <file.parquet>`
- [x] choose the internal Parquet integration boundary:
  - [x] introduce a parallel DuckDB preview source contract
  - [x] do not widen the current lightweight `DataPreviewSource` as the first move
- [x] freeze the renderer reuse boundary:
  - [x] reuse the existing bounded renderer through a renderer-facing tabular adapter
  - [x] do not route Parquet directly through the current lightweight `DataPreviewSource` type
  - [x] decide where Parquet `format` / summary labeling is translated before rendering
- [x] confirm which bounded preview flags must work for Parquet:
  - [x] `--rows`
  - [x] `--offset`
  - [x] `--columns`
- [x] freeze `data query <input>` as doc-only in this plan
- [x] freeze first-pass interactive scope:
  - [x] keep `data -> preview` mapped to CSV/JSON only
  - [x] add `data -> parquet preview` as a separate route
  - [x] keep `data query` out of interactive mode for now
- [x] freeze top-level `data` wording updates:
  - [x] revise CLI `data` group description so it covers preview plus conversion workflows
  - [x] revise interactive root-menu `data` description so it no longer says JSON/CSV conversions only
- [x] freeze the Parquet smoke-fixture strategy:
  - [x] add a dedicated Parquet fixture generator that stays separate from the CSV/JSON fixture script
  - [x] define the minimum Parquet fixture set for basic, wide, and large-window smoke checks
  - [x] freeze scripted Parquet generation as manual-smoke preparation rather than a required CI step
  - [x] freeze automated tests to use stable fixtures rather than generating Parquet during normal test runs
- [x] define clear first-pass behavior for `--contains` on DuckDB-backed actions
- [x] define clear failure behavior when DuckDB initialization or Parquet loading fails
- [x] decide whether doctor should advertise Parquet capability in this pass

### Phase 2: DuckDB adapter and preview integration

- [x] add DuckDB-backed Parquet loading that works from file paths instead of the text-only preview loader
- [x] map Parquet results into a renderer-facing tabular model without widening the lightweight source contract
- [x] adapt Parquet preview metadata so the bounded renderer can render summary lines without assuming `csv | json`-only source formats
- [x] preserve deterministic column ordering and row slicing behavior
- [x] keep JSON/CSV preview sources unchanged in this phase
- [x] keep the DuckDB helper boundary isolated enough that a later `data query` track can build on it without changing lightweight preview types

### Phase 3: CLI/runtime wiring

- [x] add `data parquet preview` command wiring
- [x] keep `data preview` help and parsing scoped to CSV/JSON inputs
- [x] add a separate interactive `data -> parquet preview` route
- [x] keep interactive `data -> preview` scoped to CSV/JSON inputs
- [x] update interactive prompt copy so lightweight preview and Parquet preview are not conflated
- [x] update top-level CLI and interactive `data` descriptions so they match the broadened command surface
- [x] keep `data query` out of CLI help and interactive mode in this phase
- [x] add or extend a deterministic fixture-generation script for Parquet smoke data
- [x] surface clear runtime errors for unsupported or failed DuckDB activation
- [ ] optionally extend doctor output if the capability decision is in scope

### Phase 4: Tests

- [x] add focused coverage for:
  - [x] Parquet happy-path preview
  - [x] `--columns` with Parquet
  - [x] `--rows` / `--offset` with Parquet
  - [x] `data preview` still rejects `.parquet`
  - [x] `data parquet preview` rejects unsupported first-pass flags if any remain deferred
  - [ ] DuckDB initialization failure
  - [x] unsupported Parquet-load path failures
- [x] add CLI/help/interactive coverage for the new command split
- [x] add interactive coverage for the first-pass DuckDB menu contract:
  - [x] `data -> parquet preview` prompt flow
  - [x] `data -> preview` still excludes Parquet framing
  - [x] `data query` is absent in this milestone
- [x] add coverage for updated top-level `data` labeling in CLI help and interactive menu copy
- [x] add smoke-fixture coverage or verification for the Parquet generator path:
  - [x] manual verification that generated files land under `examples/playground/`
  - [x] manual verification that repeated generation stays deterministic
  - [x] automated tests consume stable Parquet fixtures without requiring runtime generation
- [ ] add doctor coverage only if doctor capability reporting is updated in this pass

### Phase 5: Docs and verification

- [x] update `docs/guides/data-preview-usage.md` to keep `data preview` clearly CSV/JSON-only
- [x] add DuckDB-oriented docs for `data parquet preview`
- [x] document the first DuckDB milestone boundary:
  - [x] Parquet preview is separate from lightweight preview
  - [x] no SQL inside `data parquet preview`
  - [x] `data query` is a later query lane with its own research/plan track
  - [x] JSON/CSV remain on the existing in-memory path
- [x] document that the `data` command group now includes preview-oriented workflows in addition to conversions
- [x] document the interactive split between `data -> preview` and `data -> parquet preview`
- [x] document the Parquet fixture generator usage for manual smoke checks
- [x] add or generate stable Parquet fixtures for automated tests without requiring runtime generation during normal test runs
- [x] add or generate Parquet smoke fixtures through the scripted generator path for manual checks
- [x] run manual smoke checks for both lightweight preview and Parquet preview

## Success Criteria

- `data preview` remains a lightweight CSV/JSON inspector without DuckDB runtime coupling
- `data parquet preview` can inspect Parquet files through DuckDB without regressing the existing preview path
- the command family makes the future `data query` lane explicit instead of overloading preview semantics

## Verification

- `bunx tsc --noEmit`
- focused `bun test` preview, command-routing, interactive, and doctor suites
- manual smoke checks for both `data preview` and `data parquet preview`

## Related Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/archive/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/archive/plan-2026-03-09-data-preview-contains-filter.md`
- `docs/plans/archive/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`
