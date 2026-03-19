---
title: "Big merged-cell source-shape follow-up"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Close the remaining Excel merged-sheet extraction gap exposed by `examples/playground/data-extract/stacked-merged-band.xlsx` by fixing worksheet snapshot correctness and extending deterministic source shaping beyond `header-row`.

## Why This Plan

The latest shaping follow-up improved reviewed source-shape assistance, added `--header-row <n>`, and introduced tolerant Excel import retries. That work resolved the public header-band fixture class, but one harder merged workbook still fails.

Research for this workbook confirmed two separate issues:

- reviewed Codex shaping is currently built from corrupted sheet-snapshot evidence because the snapshot parser skips self-closing worksheet cells in merged regions
- even with the correct worksheet rectangle, `range + header-row` still cannot express where real records begin inside a stacked merged header band

This follow-up should treat those as separate layers:

1. fix worksheet evidence quality
2. extend deterministic shaping with a body-start concept
3. keep query, extract, and reviewed-shape flows on the same contract

## Scope

### Worksheet snapshot correctness

- update `src/cli/duckdb/xlsx-sources.ts` so worksheet scanning handles both:
  - `<c ...>...</c>`
  - `<c .../>`
- preserve the current snapshot contract while correcting:
  - `usedRange`
  - row summaries
  - merged-region evidence passed to reviewed shaping

### Deterministic shaping contract extension

- add one optional Excel shaping field, `body-start-row`, to represent the first true data row after the header band
- keep the common path unchanged so standard shaped Excel cases still work with only `range` and `header-row`
- use absolute worksheet row numbering to match the existing `header-row` contract
- if `range` is present, validate `body-start-row` against the selected range
- if `range` is absent, validate `body-start-row` against the detected used range
- do not require `header-row` whenever `body-start-row` is present
- keep `header-row` semantics unchanged

### Shared DuckDB integration

- apply the new field in the shared Excel relation-building path used by both query and extract
- treat `body-start-row` as import-time shaping, not only post-import filtering
- ensure tolerant import retries still work on top of the new contract
- preserve blank-row cleanup behavior for shaped Excel sources

### No-new-field fallback investigation

- investigate whether the hard workbook can be recovered internally without a new user-facing field by:
  - reading the header-only band separately
  - reading the body-only band separately
  - stitching the result into one logical shaped table
- treat that path as an internal remediation experiment, not as the primary reviewed-shape contract
- decide whether the fallback remains worthwhile after implementation and maintenance costs are clearer

### Reviewed source-shape follow-up

- allow reviewed source-shape suggestions to return the new field together with:
  - `range`
  - `headerRow`
  - `bodyStartRow`
- update reviewed-shape rendering so accepted suggestions clearly show the extra shaping value
- keep existing range-only and range-plus-header-row artifact compatibility unless an explicit migration is required

### Schema design, tests, and docs

- re-check the source-shape schema and artifact design before implementation lands
- add focused unit coverage for self-closing worksheet cells in snapshots
- add integration coverage for the hard merged workbook path
- add a dedicated docs update pass after the contract is frozen

## Design Contract

### Layered Excel shaping

The next deterministic Excel shaping layer should become:

1. `source`
2. `range`
3. `header-row`
4. optional `body-start-row`

`body-start-row` should mean:

- absolute worksheet row number
- first row that belongs to the logical record body
- valid only for Excel inputs in the first pass
- if `range` is present, must fall within the selected range
- if `range` is absent, must fall within the detected used range
- when `header-row` is also present, `header-row` becomes the governing boundary and `body-start-row` must be greater than `header-row`
- should remain optional; when omitted, current behavior stays unchanged

### Schema Design

CLI example:

```bash
cdx-chores data extract ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --header-row 7 --body-start-row 10 --output ./examples/playground/.tmp-tests/stacked.clean.csv --overwrite
```

Artifact example:

```json
{
  "shape": {
    "range": "B7:BR20",
    "headerRow": 7,
    "bodyStartRow": 10
  }
}
```

First-pass compatibility expectations:

- keep the existing `shape` object and widen it compatibly
- preserve range-only and range-plus-header-row artifacts
- allow `bodyStartRow` only when it is valid for the current Excel source
- read existing `version: 1` artifacts
- keep widened artifacts on `version: 1` in the current canary line
- do not require `headerRow` when `bodyStartRow` is present
- support these deterministic shape combinations:
  - `range`
  - `headerRow`
  - `bodyStartRow`
  - any valid combination of them

Validation expectations:

- if `range` is present, `bodyStartRow` must fall within the selected range
- if `range` is absent, `bodyStartRow` must fall within the detected used range
- when `headerRow` is also present, `headerRow` becomes the governing boundary and `bodyStartRow` must be greater than `headerRow`

Import-time behavior expectations:

- `bodyStartRow` without `headerRow`:
  - derive the effective import range so the imported rectangle starts at `bodyStartRow`
  - if `range` is present, reuse the selected column span and end row
  - if `range` is absent, reuse the detected used-range column span and end row
- `range + bodyStartRow`:
  - derive the effective import range from the selected range by replacing its start row with `bodyStartRow`
- `headerRow + bodyStartRow` without `range`:
  - use the detected used-range columns
  - import the header row separately from the body rows
  - import the body rows starting at `bodyStartRow`
  - stitch header names and body rows together in application code before downstream shaping continues
- `range + headerRow + bodyStartRow`:
  - use the selected range columns
  - import the header row separately from the body rows
  - import the body rows starting at `bodyStartRow`
  - stitch header names and body rows together in application code before downstream shaping continues

### Boundaries

- `header-row` remains the row used for column naming
- `body-start-row` defines where body rows begin
- semantic header mapping still remains downstream of deterministic source shaping
- reviewed Codex shaping suggests deterministic values only and never invents semantic headers

### Generalization Boundary

- first pass: Excel-only
- later generalization can be reconsidered for CSV or TSV if real banner-row or preamble cases appear
- do not generalize to SQLite or Parquet in this follow-up

### No-New-Field Recovery Experiment

The plan should explicitly test whether the hard workbook can be recovered without a new user-facing field by:

1. reading the header band only
2. reading the body band only
3. stitching them together in application code

Decision boundary:

- if the two-pass path is robust, it may remain as an internal fallback or remediation note
- if the two-pass path still needs an explicit saved body boundary for replayable shaping, keep `body-start-row` as the deterministic contract
- do not delay contract freeze on the outcome of this experiment
- do not treat the fallback as primary user-visible contract behavior in this follow-up unless there is a strong reason to expose it

## Proposed Phases

### Phase 1: Contract freeze and schema check

- [x] freeze `body-start-row` as the preferred name
- [x] freeze absolute worksheet row numbering
- [x] freeze Excel-only first-pass scope
- [x] freeze the rule that `body-start-row` does not require `header-row`
- [x] freeze the validation rule that `header-row` becomes the governing boundary when both rows are present
- [x] freeze import-time behavior for:
  - `bodyStartRow`
  - `range + bodyStartRow`
  - `headerRow + bodyStartRow`
  - `range + headerRow + bodyStartRow`
- [x] freeze the rule that reviewed shaping may return any valid combination of `range`, `headerRow`, and `bodyStartRow`
- [x] freeze the rule that source-shape artifacts remain on `version: 1` in this canary line
- [x] freeze the compatibility rule that newer binaries read older and widened `version: 1` artifacts, while older binaries are not guaranteed to replay widened `version: 1` artifacts

### Phase 1 checkpoint

Phase 1 is now frozen at the contract level.

Schema audit result:

- the current source-shape type and artifact surface only model `range` and `headerRow`
- the current reviewed source-shape structured-output schema in `src/cli/duckdb/source-shape/suggestions.ts` only admits `range` and `header_row`
- the shared Excel preparation path in `src/cli/duckdb/query/prepare-source.ts` still validates and derives behavior only for `range` and `header-row`

That audit means later implementation should treat Phase 2, Phase 4, and Phase 5 as coordinated updates across the snapshot parser, artifact/type layer, reviewed-shape contract, and shared Excel import path.

### Phase 2: Snapshot parser correction

- [x] fix worksheet parsing for self-closing `<c .../>` cells
- [x] add a focused workbook-level snapshot test that proves the hard workbook now reports the true anchors and used range

### Phase 2 checkpoint

Worksheet snapshot correctness is now fixed for the hard merged-band fixture.

Implementation result:

- `src/cli/duckdb/xlsx-sources.ts` now scans worksheet cells with a pattern that distinguishes self-closing `<c .../>` nodes from `<c ...>...</c>` nodes
- blank merged-region placeholders no longer swallow the next populated cell and misassign its value to the earlier reference
- the stacked merged-band workbook snapshot now reports the expected anchors:
  - row 5 title anchor at `BG5`
  - row 7 header anchors at `B7`, `E7`, `AL7`, `AZ7`
  - row 10 body anchors at `B10`, `E10`, `AL10`, `AZ10`
- the corrected workbook-level `usedRange` is now `B5:BG20`

### Phase 3: No-new-field fallback investigation

- [x] prototype two-pass header-only plus body-only recovery on the public stacked merged-band workbook
- [x] decide whether that path is robust enough to keep as an internal remediation
- [x] document the tradeoff between internal fallback and explicit deterministic shaping
- [x] keep this phase non-blocking for the explicit contract

### Phase 3 checkpoint

The header-only plus body-only recovery path works on the hard public workbook.

Implementation conclusion:

- the split path is viable as an internal remediation for `header-row + body-start-row`
- it does not remove the need for an explicit deterministic body boundary
- the follow-up keeps `body-start-row` as the user-visible contract and uses the split path internally when both rows are present

### Phase 4: Shared `body-start-row` implementation

- [x] extend the shared Excel relation-preparation path
- [x] implement effective-range derivation for `bodyStartRow` without `headerRow`
- [x] implement split header-row plus body-row import for cases where both `headerRow` and `bodyStartRow` are present
- [x] wire `body-start-row` through direct query
- [x] wire `body-start-row` through direct extract
- [x] preserve or revise tolerant retry ordering based on implementation results

### Phase 4 checkpoint

Shared Excel preparation now supports three deterministic row-shaping modes:

- `header-row` only: existing effective-range behavior remains in place
- `body-start-row` only: the effective import range starts at `body-start-row`
- `header-row + body-start-row`: the header row and body rows are imported separately and stitched into one logical table before downstream shaping continues

Observed implementation behavior:

- split header/body import now keeps the meaningful worksheet anchors and drops columns that remain blank across the body with no header label
- direct `data query` and `data extract` now materialize the stacked merged-band workbook successfully with `--range B7:BR20 --header-row 7 --body-start-row 10`

### Phase 5: Reviewed-shape and artifact updates

- [x] update Codex source-shape prompt schema and parsing
- [x] update the prompt guidance so Codex can suggest `bodyStartRow` alone when appropriate
- [x] update source-shape artifact compatibility and rendering for widened `version: 1`
- [x] update reviewed-shape rendering to show `body-start-row`
- [x] add focused interactive and command-level tests

### Phase 5 checkpoint

Reviewed source-shape assistance now understands and renders `body-start-row`.

Implementation result:

- reviewed Codex source-shape structured output now includes `body_start_row`
- widened `version: 1` source-shape artifacts now accept `bodyStartRow`
- source-shape rendering, interactive reviewed-shape output, direct query rendering, and Codex query context all surface the new field when present
- targeted tests now cover:
  - widened source-shape artifacts
  - `bodyStartRow`-only reviewed suggestions
  - action and command success on the public stacked merged-band workbook

### Phase 6: Docs and verification

- [x] update `docs/guides/data-extract-usage.md`
- [x] update `docs/guides/data-query-usage.md` if the CLI surface changes there
- [x] update any reviewed source-shape behavior docs that mention accepted shape fields
- [x] verify the hard merged workbook against source, tests, and built `dist`
- [x] verify existing public header-band fixtures still work

### Phase 6 checkpoint

The user-facing docs now match the shipped shaping contract.

Documentation result:

- updated `docs/guides/data-extract-usage.md` for `--body-start-row`, widened reviewed source-shape behavior, and the stacked merged-band success path
- updated `docs/guides/data-query-usage.md`, `docs/guides/data-query-codex-usage.md`, and `docs/guides/data-query-interactive-usage.md` so query, Codex drafting, and interactive query docs expose the new row-shaping field
- updated `docs/guides/data-schema-and-mapping-usage.md` so strict header-mapping artifact matching now includes optional `bodyStartRow`
- verified the hard workbook and existing public header-band fixtures through targeted tests and a fresh build

## Verification

- `bun test` for focused snapshot, query, extract, and interactive routing coverage
- `bunx tsc --noEmit`
- `bun run build`
- built CLI validation against:
  - `examples/playground/data-extract/stacked-merged-band.xlsx`
  - existing public header-band fixtures

## Related Research

- `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
