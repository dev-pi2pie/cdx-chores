---
title: "Data preview and query edge cases from private issue scenarios"
created-date: 2026-03-16
modified-date: 2026-03-18
status: draft
agent: codex
---

## Goal

Evaluate three private issue scenarios and determine whether the current `data preview` and `data query` contracts are failing because of bugs, intentionally narrow scope, or missing input-shaping options.

This document is exploratory research only.
It should not be treated as shipped behavior or guide-level usage documentation until a related plan is accepted and implementation lands.

## Key Findings

### 1. `data preview` currently hard-codes `delimited row 1 = header`

Scenario A is a headerless CSV where every row is data.

It is rendered today as if the first data row were the header row.

Observed behavior:

- `Rows` becomes `2` instead of `3`
- visible columns become `1, Ada, active, 2026-03-01`
- the actual first record is not shown as data

This matches the current lightweight delimited preview contract in `src/cli/data-preview/source.ts` and `docs/guides/data-preview-usage.md`:

- `.csv` and `.tsv` both use the same header-first preview normalization path
- the first delimited row is always treated as the header row
- blank or extended columns already use generated names such as `column_2`, `column_3`, ...
- there is no opt-out for headerless delimited input

Implication:

- headerless CSV support is not a regression in the current implementation
- it is a missing contract surface in the lightweight delimited preview lane
- the first repair should extend the current CSV/TSV preview contract instead of inventing a CSV-only exception

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

### 5. Interactive `data query` and Codex-assisted query drafting inherit the same messy schema

The interactive query flow currently does:

1. choose input
2. detect format
3. choose sheet or table when needed
4. collect schema and sample rows
5. choose `manual`, `formal-guide`, or `Codex Assistant`

That means the introspection step happens before the user has any way to shape the logical table.

The same underlying problem also affects the separate direct CLI drafting lane:

- `data query codex` gathers bounded introspection from the same shared query helper before drafting SQL
- without a shaping seam in that shared helper, direct Codex drafting inherits the same noisy Excel schema as interactive mode

Implications:

- `formal-guide` will offer noisy or misleading columns when the raw sheet shape is poor
- interactive `Codex Assistant` will draft against the wrong schema because its prompt is built directly from that introspection
- direct `data query codex` will also draft against the wrong schema for the same reason
- multiline-editor hints are also degraded because the seeded `# Schema:` and `# Sample rows:` comments come from the same raw source

For merged-cell or lower-table-start workbooks, this makes Codex-assisted drafting look less capable than it actually is, because the main problem is not SQL drafting but bad pre-draft table selection.

Implication:

- query-side shaping must be implemented in the shared relation-building and introspection layer, not only as an interactive prompt tweak

## Recommendations

### Recommendation A. Add explicit headerless delimited support to `data preview`

Recommended first contract:

- add `--no-header` for `data preview`
- when set:
  - apply it to the lightweight delimited preview lane (`.csv` and `.tsv`)
  - do not consume row 1 as headers
  - generate deterministic column names such as `column_1`, `column_2`, ...
  - keep row counting and preview windowing based on all rows
  - keep `--columns` and `--contains` targeting those generated names when no source header exists

Naming note:

- reuse the current preview-generated column family `column_n`
- do not introduce a second synthetic naming style such as spreadsheet letters or cell addresses

Why:

- low-risk
- easy to explain
- avoids brittle auto-detection
- stays consistent with the current preview contract for blank or extended delimited columns

### Recommendation B. Add explicit Excel range shaping to `data query`

Recommended first contract:

- add `--range <A1:Z99>` for Excel query inputs
- use that range when building the `read_xlsx(...)` relation for the temp view

Recommended initial behavior:

- valid only for `--input-format excel` or `.xlsx`
- still requires `--source <sheet>`
- keep the default whole-sheet behavior when `--range` is omitted
- implement it in the shared relation-building path so direct `data query`, interactive `data query`, and direct `data query codex` can reuse the same shaping result

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

Clean pattern:

1. resolve input format
2. resolve source object when needed
3. build the current shaping state
4. introspect the current shaped source
5. evaluate schema health
6. if the schema looks healthy, continue to SQL authoring
7. if the schema looks suspicious and no explicit shaping was provided, offer shape resolution:
   - continue as-is
   - enter manual shaping
   - ask Codex to suggest shaping
8. if accepted shaping changes the source contract, rebuild the shaped source and re-introspect
9. only after that, continue to SQL authoring

Important clarification:

- this should use one shared introspection engine with different pre-authoring states, not separate introspection implementations for direct CLI, interactive mode, and Codex-assisted flows

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

Implementation note:

- any accepted query-side shaping contract should be representable as concrete CLI flags
- the same shaping semantics should be shared by:
  - direct `data query`
  - interactive `data query`
  - direct `data query codex`
- the first query-side shaping flag should be available in direct `data query codex` when the shared helper lands, rather than creating a second hidden Codex-only shaping path

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
resolve format + source
   |
   v
build current shaping state
  - preview: --no-header
  - query: --range
  - later: --header-row / --no-header for query if needed
   |
   +------------------------------+
   | preview                      |
   |                              v
   |                      render preview
   |
   +-> query
         |
         v
      introspect current shaped source
         |
         v
      evaluate schema health
         |
         +------------------------------+
         | schema looks healthy         |
         |                              v
         |                      SQL authoring
         |                        - manual
         |                        - formal-guide
         |                        - Codex SQL drafting
         |
         +-> schema looks suspicious and no explicit shaping
               |
               v
            shape resolution
              - continue as-is
              - manual shaping
              - Codex shape suggestion
               |
               v
            accept shaping?
               |
               +------ no ------> SQL authoring
               |
               +------ yes ----->
                          rebuild shaped source
                               |
                               v
                          introspect again
                               |
                               v
                          SQL authoring
```

Clarification:

- `data preview` does not have a separate schema-and-sample introspection phase
- after lightweight shape resolution, preview renders directly
- schema-and-sample introspection is query-only because it exists to support SQL authoring

### Recommendation G. Keep suspicious-schema warnings conservative and Excel-specific at first

Recommended first-pass warning policy:

- evaluate warnings only for Excel inputs
- do not warn when the user already provided explicit shaping such as `--range`
- warn only on strong structural signals, not vague semantic guesses

Good first-pass warning examples:

- one title-like column with no useful sample rows
- placeholder-heavy generated columns such as `column_2`, `column_3`, ... combined with sparse sample rows
- zero useful sample rows after whole-sheet introspection on a sheet that likely contains decorative banner or spacer regions

Examples:

- suspicious:
  - columns: `Quarterly Operations Report`
  - sample rows: none
- suspicious:
  - columns: `RAW_TITLE`
  - sample rows: none
- suspicious:
  - columns: `id`, `column_2`, `column_3`, `status`, `column_5`
  - sample rows: mostly blank in the generated columns
- do not warn:
  - columns: `email`
  - sample rows: populated
- do not warn:
  - columns: `metric`, `value`
  - sample rows: populated

Why:

- avoids punishing valid narrow tables
- keeps the warning tied to obvious schema-shape failures
- prevents the first pass from drifting into fuzzy header semantics

### Recommendation H. Prefer `--header-row <n>` before query-side `--no-header`

Recommended progression after `--range`:

- first: `--range`
- second: `--header-row <n>`
- third: `--no-header`
- later: Codex-assisted custom header suggestions if they prove useful

Why:

- `--header-row <n>` solves the common workbook case where the right table exists but the real header is lower in the sheet
- `--no-header` is still useful for truly headerless selected ranges, but it should not be the first extra query-side flag
- custom header generation is a separate feature from `--no-header` and should remain explicit if it lands later

### Recommendation I. Present interactive shape resolution as source interpretation, not SQL drafting

Recommended prompt-copy principle:

- make it explicit that this step changes how the source is interpreted as a table
- make it explicit that the user is not writing SQL yet
- avoid wording that sounds like query drafting or result export

Recommended prompt direction:

- `Adjust source shape before SQL?`
- `This step changes how the source is interpreted as a table.`
- `You are not writing SQL yet.`
- `Current sheet shape looks suspicious. Choose how to continue: keep as-is, enter a range manually, or ask Codex to suggest shaping.`
- after acceptance: `Accepted source shape: --range B7:AZ20`
- before the next step: `Re-inspecting shaped source before SQL authoring.`

Why:

- keeps the user oriented around table selection first
- reduces confusion between source shaping and SQL drafting
- makes the pre-authoring loop easier to explain in both direct and interactive guidance

### Recommendation J. Defer persisted clean extraction as a separate feature track

Do not make the first shaping repair depend on writing a new cleaned CSV, TSV, or JSON artifact.

Recommended first-pass behavior:

- keep shaping ephemeral and in-memory
- make accepted shaping reproducible through explicit flags
- let preview, direct query, interactive query, and direct `data query codex` operate on the shaped view

Defer as a later question:

- whether users should be able to export a shaped source as a new artifact
- what format that artifact should use
- whether Codex-assisted shaping should ever produce persisted outputs

Why:

- keeps the first shaping track focused on source interpretation rather than file generation
- avoids introducing a second product decision around artifact creation, naming, and ownership
- preserves one clear contract: shape the source first, then preview or query it

### Recommendation K. Keep Codex semantic header guesses advisory if they land later

If Codex later helps on headerless inputs:

- keep deterministic contract names such as `column_1`, `column_2`, ...
- present semantic header guesses only as advisory mappings
- do not silently replace the actual contract names with Codex-generated labels

Why:

- preserves reproducibility
- keeps `--columns`, `--contains`, and future query-side shaping flags deterministic
- separates stable source-shaping contracts from optional AI assistance

### Recommendation L. Define `data extract` as the explicit materialization lane

Recommended command-family model:

- `data preview`: inspect a shaped source
- `data query`: run SQL against a shaped source
- `data extract`: materialize a shaped source as a clean output artifact

Recommended first-pass contract for `data extract`:

- one input file per invocation
- no SQL
- one shaped logical table per invocation
- output is a new artifact derived from the accepted shaping state
- accepted shaping must remain reproducible through explicit flags and reviewed choices

Recommended first-pass output targets:

- `.csv`
- `.tsv`
- `.json`

Recommended shaping inputs:

- `--source` where the input exposes multiple logical source objects
- `--range`
- later `--header-row <n>`
- later `--no-header`
- `--codex-suggest-headers` as a reviewed shaping aid rather than an automatic rewrite

Important boundary:

- `data extract` should not be required for preview or query shaping to work
- it is a separate lane for users who want a persisted clean artifact after shaping decisions are accepted

Why:

- keeps inspection, SQL, and artifact generation as separate product concepts
- gives messy-source cleanup a clear home without overloading `data preview` or `data query`
- creates a natural place to persist accepted header mappings or shaped ranges when users need a reusable clean file

### Recommendation M. Make `--codex-suggest-headers` a review-first shaping feature

Recommended contract:

- `--codex-suggest-headers` is a shaping aid, not an automatic rewrite
- it should propose semantic headers for weak-header or headerless inputs
- the user must review suggestions before they become active
- accepted suggestions become part of the active shaped header set for the current operation

Recommended first homes:

- interactive shaping flow
- `data extract`

Recommended review rule:

- keep the deterministic underlying names visible during review
- do not silently replace `column_n` names without user acceptance

Smallest reviewable mapping UI:

```text
Suggested headers

column_1 -> id          sample: 1001
column_2 -> created_at  sample: 2026-03-01
column_3 -> status      sample: active
column_4 -> amount      sample: 19.95
```

Recommended first-pass actions:

- `Accept all`
- `Edit one`
- `Keep generated names`

Why:

- keeps Codex assistance reviewable
- preserves the underlying deterministic contract
- makes the feature useful without requiring a large spreadsheet-like editing UI in the first pass

## Decision Updates

- Treat headerless preview shaping as lightweight delimited-preview work that applies to `.csv` and `.tsv`, not as a CSV-only exception.
- Reuse the existing preview-generated column family `column_n` for `--no-header`; do not introduce spreadsheet-style synthetic labels such as `A`, `AA`, or `A1`.
- Let direct/shared CLI shaping land before interactive prompting, then layer interactive support on top of the shared helper path.
- Keep one shared shaping and introspection engine across direct CLI, interactive query, and direct `data query codex`; vary only the pre-authoring loop, not the core introspection implementation.
- When shared query-side shaping lands, direct `data query codex` should accept the same shaping flag instead of relying on a hidden Codex-only path.
- Add suspicious-schema warnings only for strong Excel-specific structural signals, and suppress them when explicit shaping is already present.
- Defer Excel header override as a follow-up question after `--range`; if it becomes necessary later, avoid a vague bare `--header` flag.
- If later Excel header control is needed, prefer `--header-row <n>` before adding query-side `--no-header`.
- Present interactive shape resolution as source interpretation before SQL authoring, not as query drafting or result extraction.
- Defer persisted clean extraction as a separate feature track; keep first-pass shaping ephemeral and flag-driven.
- If query-side `--no-header` lands later, it should apply to delimited `data query` inputs as well rather than remaining Excel-only.
- If Codex later suggests semantic headers, keep those suggestions advisory and preserve deterministic `column_n` contract names underneath.
- Define `data extract` as the separate materialization lane for shaped sources rather than overloading `data preview` or `data query` with artifact generation.
- Treat `--codex-suggest-headers` as an in-scope review-first shaping feature, not as a hidden or purely deferred idea.
- Keep the first `--codex-suggest-headers` review surface small and explicit: mapping table plus `Accept all`, `Edit one`, or `Keep generated names`.
- Accepted shaping choices should map back to concrete CLI flags so the resulting behavior remains visible and reproducible.

## Open Questions

- What is the narrowest v1 input-format boundary for `data extract`: Excel-only messy-source recovery first, or a broader shaped-table lane that also covers delimited inputs immediately?
- Should `--codex-suggest-headers` be available on direct CLI only through `data extract` first, or should a reviewed direct `data query` variant also be part of the first implementation slice?

## Documentation Note

These scenarios should be referred to in documentation by behavior, not by private fixture names or paths.

Recommended wording pattern:

- Scenario A: headerless CSV input
- Scenario B: workbook with a merged banner row above the real header
- Scenario C: workbook with multiple merged decorative regions and a lower table start

This keeps design and contract discussion focused on the data shape instead of exposing internal fixture names.

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`
