---
title: "Data preview and query edge cases from private issue scenarios"
created-date: 2026-03-16
modified-date: 2026-03-16
status: draft
agent: codex
---

## Goal

Evaluate three private issue scenarios and determine whether the current `data preview` and `data query` contracts are failing because of bugs, intentionally narrow scope, or missing input-shaping options.

This document is exploratory research only.
It should not be treated as shipped behavior or guide-level usage documentation until a related plan is accepted and implementation lands.

## Key Findings

### 1. `data preview` currently hard-codes `CSV row 1 = header`

Scenario A is a headerless CSV where every row is data.

It is rendered today as if the first data row were the header row.

Observed behavior:

- `Rows` becomes `2` instead of `3`
- visible columns become `1, Ada, active, 2026-03-01`
- the actual first record is not shown as data

This matches the current v1 contract in `src/cli/data-preview/source.ts` and `docs/guides/data-preview-usage.md`:

- the first CSV row is always treated as the header row
- there is no opt-out for headerless CSV input

Implication:

- headerless CSV support is not a regression in the current implementation
- it is a missing contract surface

### 2. Raw Excel sheet querying is too weak for banner rows and merged header regions

The current Excel query path creates the logical table `file` with:

- `read_xlsx(<path>, sheet = <name>)`

This works for simple workbook fixtures, but it fails on the new merged-cell sheets because the useful table is not the first clean rectangular region in the sheet.

Observed behavior for Scenario B, a simple workbook with one merged banner row above the real header:

- current `data query` exposes one column named from the merged banner row
- the actual header row (`ID`, `Date`, `Due Date`, `Event`) is present in row 2, but it is not selected as the query header surface

Observed behavior for Scenario C, a larger workbook with multiple merged regions and the useful table below decorative sections:

- current `data query` exposes a single `RAW_TITLE` column and `0` result rows
- the actual table lives lower in the sheet and begins after decorative merged regions
- the meaningful records are in rows 10 to 20, with logical headers anchored in row 7

Implication:

- Excel query support currently assumes that querying a whole sheet is a good table contract
- that assumption breaks on form-like workbooks with top banners, spacer rows, and merged sections

### 3. DuckDB already provides enough Excel-shaping primitives for a first repair

Local verification against DuckDB's `read_xlsx` options shows the current failures can be improved substantially by selecting a better rectangular region before creating the temp view.

Verified scenario outcomes:

- Scenario B becomes usable with a range like `A2:D7` and forced header handling
- Scenario C becomes queryable with a range like `B7:AZ20`
- after narrowing the range, the logical columns `id`, `item`, `status`, and `description` become available, even though merged-width filler columns still exist between them

Implication:

- a first fix does not require replacing DuckDB or building a full workbook parser
- the missing piece is relation-shaping options before `create temp view file as ...`

### 4. The two problem classes should not be solved with one heuristic

The headerless CSV case and the merged Excel case look similar only at the symptom level: both need more control over how the source becomes a table.

They should not share the same solution:

- headerless CSV needs an explicit header contract
- merged Excel needs an explicit sheet-range contract

Implication:

- avoid a generic "auto-detect the table" feature as the first repair
- prefer explicit user-controlled shaping flags first

### 5. Interactive `data query` and Codex drafting inherit the same messy schema

The interactive query flow currently does:

1. choose input
2. detect format
3. choose sheet or table when needed
4. collect schema and sample rows
5. choose `manual`, `formal-guide`, or `Codex Assistant`

That means the introspection step happens before the user has any way to shape the logical table.

Implications:

- `formal-guide` will offer noisy or misleading columns when the raw sheet shape is poor
- `Codex Assistant` will draft against the wrong schema because its prompt is built directly from that introspection
- multiline-editor hints are also degraded because the seeded `# Schema:` and `# Sample rows:` comments come from the same raw source

For merged-cell or lower-table-start workbooks, this makes Codex-assisted drafting look less capable than it actually is, because the main problem is not SQL drafting but bad pre-draft table selection.

## Recommendations

### Recommendation A. Add explicit headerless CSV support to `data preview`

Recommended first contract:

- add `--no-header` for `data preview`
- when set:
  - do not consume row 1 as headers
  - generate deterministic column names such as `column_1`, `column_2`, ...
  - keep row counting and preview windowing based on all rows

Why:

- low-risk
- easy to explain
- avoids brittle auto-detection

### Recommendation B. Add explicit Excel range shaping to `data query`

Recommended first contract:

- add `--range <A1:Z99>` for Excel query inputs
- use that range when building the `read_xlsx(...)` relation for the temp view

Recommended initial behavior:

- valid only for `--input-format excel` or `.xlsx`
- still requires `--source <sheet>`
- keep the default whole-sheet behavior when `--range` is omitted

Why:

- directly fixes both new workbook fixtures
- keeps the query contract explicit
- lets users recover the correct table without inventing unreliable heuristics

### Recommendation C. Defer auto-detection and merge-aware cleanup

Do not make the first repair depend on:

- automatic table-region detection
- automatic header-row detection
- automatic dropping of all-null Excel filler columns
- merge-aware value propagation across the selected range

Those may be useful follow-up features, but they are a second layer after explicit shaping works.

### Recommendation D. Add a shape-first step before interactive introspection

Recommended first interactive behavior for troublesome formats:

- when the input is Excel, ask for optional sheet-shaping inputs before schema inspection
- first candidate: optional `range`
- later candidate: optional header override if needed

Recommended flow:

1. choose file
2. detect format
3. choose sheet
4. optionally enter a range for the sheet
5. collect schema and sample rows from the shaped source
6. continue into `manual`, `formal-guide`, or `Codex Assistant`

Why:

- keeps the schema shown to the user aligned with the actual intended table
- improves `formal-guide` and `Codex Assistant` at the same time
- avoids teaching Codex to compensate for a broken source contract

### Recommendation E. Treat source shaping, Codex shape assistance, and SQL drafting as separate LEGO layers

Recommended model:

- Layer 1: deterministic source shaping
  - explicit flags such as `--no-header` and `--range`
  - must work without Codex
- Layer 2: optional Codex shape assistance
  - suggest likely headers for headerless CSV
  - suggest likely table ranges for messy sheets
  - suggestions stay advisory until confirmed
- Layer 3: query authoring
  - `manual`
  - `formal-guide`
  - `Codex Assistant` for SQL drafting

Important seam:

- schema and sample-row introspection must happen after the accepted shaping choices are applied

That means introspection is not a separate user-facing layer, but it is a required internal boundary between shape resolution and SQL authoring.

Why:

- users can skip Codex and still shape sources explicitly
- Codex can help with difficult files without becoming a hidden parser
- SQL drafting gets clean schema context instead of raw-sheet noise

### Recommendation F. Explain the future interactive flow with one stable diagram

Suggested design sketch:

```text
raw input
   |
   v
Layer 1: deterministic source shaping
  - preview: --no-header
  - query: --range
   |
   +------------------------------+
   | accept as-is                 |
   |                              v
   |                      rebuild shaped source
   |                              |
   |                              v
   |                      introspect schema + sample rows
   |                              |
   |                              v
   |                      Layer 3: query authoring
   |                        - manual
   |                        - formal-guide
   |                        - Codex SQL drafting
   |
   +-> Layer 2: optional Codex shape assistance
         - suggest headers
         - suggest ranges
         - require confirmation
                |
                v
         rebuild shaped source
                |
                v
         introspect schema + sample rows
                |
                v
         Layer 3: query authoring
```

## Open Questions

- Should headerless CSV support be added to `data query` at the same time for consistency, or can preview lead here?
- Should Excel range support also be exposed in the interactive `data query` flow immediately, or should direct CLI land first?
- After `--range` exists, do we want a follow-up `--header` override for Excel as a separate flag?
- Should interactive mode show a short warning when the introspected schema looks suspiciously sparse or placeholder-heavy?
- Should Codex shape assistance write back accepted shaping choices as concrete flags or only as transient interactive state?

## Documentation Note

These scenarios should be referred to in documentation by behavior, not by private fixture names or paths.

Recommended wording pattern:

- Scenario A: headerless CSV input
- Scenario B: workbook with a merged banner row above the real header
- Scenario C: workbook with multiple merged decorative regions and a lower table start

This keeps design and contract discussion focused on the data shape instead of exposing internal fixture names.

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
