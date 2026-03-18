---
title: "Data preview and query edge cases from private issue scenarios"
created-date: 2026-03-16
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Evaluate three private issue scenarios and determine whether the current `data preview` and `data query` contracts are failing because of bugs, intentionally narrow scope, or missing input-shaping options.

This document is exploratory research only.
It should not be treated as shipped behavior or guide-level usage documentation until a related plan is accepted and implementation lands.
The later `data extract` and header-mapping sections sketch candidate follow-on command and artifact contracts for planning discussion only; they are not accepted implementation scope on their own.

Completion note:

- the main contract questions in this research have now been harvested into completed data preview, query, header-mapping, source-shaping, interactive extract, and Excel header-row plans
- one extreme merged-sheet class still remains as a follow-on shaping-contract decision, but that no longer blocks marking this exploratory research complete

## Key Findings

### 1. `data preview` currently hard-codes `delimited row 1 = header`

Scenario A is a headerless CSV where every row is data.

It is rendered today as if the first data row were the header row.

Observed behavior:

- `Rows` becomes `2` instead of `3`
- visible columns become `1, Ada, active, 2026-03-01`
- the actual first record is not shown as data

This matches the current lightweight delimited preview contract in `src/cli/data-preview/source.ts` and `docs/guides/data-preview-usage.md`.[^preview-source][^preview-guide]

- `.csv` and `.tsv` both use the same header-first preview normalization path
- the first delimited row is always treated as the header row
- blank or extended columns already use generated names such as `column_2`, `column_3`, ...
- there is no opt-out for headerless delimited input

Implication:

- headerless CSV support is not a regression in the current implementation
- it is a missing contract surface in the lightweight delimited preview lane
- the first repair should extend the current CSV/TSV preview contract instead of inventing a CSV-only exception

### 2. Raw Excel sheet querying is too weak for banner rows and merged header regions

The current Excel query path creates the logical table `file` with:[^query-source]

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

- Scenario B becomes usable with a range like `A2:D7`
- Scenario C improves materially with a range like `B7:AZ20`, but in local probing it becomes queryable with the intended logical names only when that narrowed range is paired with explicit header handling and name normalization such as `header = true`, `all_varchar = true`, and `normalize_names = true`
- after narrowing the range and enabling header normalization, the logical columns `id`, `item`, `status`, and `description` become available, even though filler columns still exist between them

Implication:

- a first fix does not require replacing DuckDB or building a full workbook parser
- the first missing piece is relation-shaping options before `create temp view file as ...`
- more irregular sheets may still need follow-up header and type controls after `--range`

### 4. The two problem classes should not be solved with one heuristic

The headerless CSV case and the merged Excel case look similar only at the symptom level: both need more control over how the source becomes a table.

They should not share the same solution:

- headerless CSV needs an explicit header contract
- merged Excel needs an explicit sheet-range contract

Implication:

- avoid a generic "auto-detect the table" feature as the first repair
- prefer explicit user-controlled shaping flags first

### 5. Interactive `data query` and Codex-assisted query drafting inherit the same messy schema

The interactive query flow currently does:[^interactive-query-guide]

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
- the multiline editor itself should stay, but its seeded `# Schema:` and `# Sample rows:` hints are currently degraded because they come from the same raw source instead of the accepted shaped source

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

- directly fixes table-region selection for both new workbook fixtures
- keeps the query contract explicit
- lets users recover the correct table without inventing unreliable heuristics
- creates the prerequisite for later header-row or header-normalization follow-up on more irregular sheets

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
- optional adjunct: reviewed `--codex-suggest-headers` on top of an accepted deterministic shaping state

Why:

- `--header-row <n>` solves the common workbook case where the right table exists but the real header is lower in the sheet
- `--no-header` is still useful for truly headerless selected ranges, but it should not be the first extra query-side flag
- reviewed Codex header suggestions can be useful in the same feature family, but they are not a substitute for the deterministic flag progression

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

### Recommendation J. Keep shaping reusable in-memory, while also adding `data extract` as the explicit artifact lane

Do not make preview or query depend on writing a new cleaned CSV, TSV, or JSON artifact.

Recommended first-pass behavior:

- keep shaping reusable in-memory for:
  - `data preview`
  - direct `data query`
  - interactive `data query`
  - direct `data query codex`
- add `data extract` as the separate lane that materializes a shaped source when users want a persisted clean artifact

Why:

- preserves one clear contract: shape the source first, then choose whether to preview, query, or extract it
- keeps preview and query lightweight when persistence is unnecessary
- still gives artifact generation a clear, explicit home

### Recommendation K. Keep Codex semantic header guesses advisory when used

If Codex helps on headerless inputs:

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

Recommended first-pass input boundary:

- make `data extract` a broader shaped-table lane from the start
- include messy Excel recovery cases
- also include delimited inputs immediately so the same shaping model can materialize headerless or weak-header CSV/TSV sources without inventing an Excel-only export concept

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
- reviewed direct `data query`

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

### Recommendation N. Use an explicit mapping-artifact review flow for direct CLI `data query`

Recommended direct-CLI pattern:

- do not let `--codex-suggest-headers` silently continue straight into SQL execution
- keep the accepted mapping explicit and scriptable through a review artifact

Recommended first-pass flow:

1. run `data query` with `--codex-suggest-headers`
2. inspect the current shaped source
3. ask Codex for semantic header suggestions
4. write a reviewable header-mapping artifact
5. print a compact human-readable summary and stop before SQL execution
6. rerun `data query` with the accepted `--header-mapping <path>` plus `--sql "..."`
7. rebuild the shaped source with the accepted mapping, re-introspect, and then continue to SQL execution

Example shape:

```text
cdx-chores data query <input> --source <name> --range <A1:Z99> --codex-suggest-headers --write-header-mapping ./header-map.json
cdx-chores data query <input> --source <name> --range <A1:Z99> --header-mapping ./header-map.json --sql "select ..."
```

Why:

- keeps direct CLI workflows scriptable
- makes the accepted mapping visible and reusable
- avoids hidden state between the suggestion step and the query step
- preserves a clear review boundary before SQL runs

### Recommendation O. Share the suggestion engine, but keep the review UX command-specific

Shared helper behavior should own:

- collecting evidence from the current shaped source:
  - deterministic column names
  - sample values
  - inferred types when available
- calling Codex and normalizing suggested semantic headers
- validating suggested mappings:
  - non-empty names
  - uniqueness
  - collision handling
- serializing and reading the mapping artifact
- applying the accepted mapping to rebuild the shaped source
- re-introspecting after accepted mappings are applied

Command-specific UX should own:

- how the user enters the suggestion flow
- how review is displayed
- whether the command stops for external review or keeps the user inside an interactive acceptance loop
- what happens after acceptance

Recommended command-specific continuations:

- `data query`:
  - shape source
  - suggest and review headers
  - accept mapping
  - rebuild shaped source
  - re-introspect
  - continue to SQL authoring or execution
- `data extract`:
  - shape source
  - suggest and review headers
  - accept mapping
  - rebuild shaped source
  - write the clean artifact

Why:

- keeps the hard logic shared and testable
- avoids duplicating Codex suggestion, validation, and mapping-application code
- still lets each command explain and continue the workflow in a way that matches its own purpose

### Recommendation P. Use JSON as the first-pass header-mapping artifact format

Recommended first-pass artifact policy:

- use JSON as the canonical header-mapping artifact
- print a compact human-readable mapping summary to stdout or the interactive terminal for review
- do not require a second persisted text-oriented artifact format in the first pass

Why JSON first:

- easy to validate and round-trip
- easy to edit in scripts or editors
- easy to extend later with metadata such as:
  - input format
  - source object
  - range
  - generated headers
  - sample values
  - inferred types
- avoids delimiter and escaping edge cases in the source-of-truth artifact

Recommended minimal structure direction:

- keep `version` as the artifact schema-contract version
- use a small `metadata` object for artifact-level details such as:
  - artifact type
  - issued timestamp in UTC
- keep input reference details under `input`

Important clarification:

- `version` should mean the JSON schema contract version for this artifact family
- it should not mean the CLI app version
- it should not mean edit history or a revision snapshot of user changes
- if app-version or history fields are needed later, they should live under `metadata` or a later dedicated history field

Recommended first-pass input reference policy:

- record the original input reference in the artifact
- prefer a CLI-facing or cwd-relative path representation
- avoid machine-specific absolute paths by default

Recommended narrowest required first-pass field set:

- required:
  - `version`
  - `metadata.artifactType`
  - `metadata.issuedAt`
  - `input.path`
  - `input.format`
  - `mappings`
  - `mappings[].from`
  - `mappings[].to`
- conditionally required:
  - `input.source` when the input exposes multiple logical source objects
  - `input.range` when shaping used an explicit range
- intentionally optional in the first pass:
  - `sample`
  - `inferredType`
  - `confidence`
  - edit-history fields

Illustrative first-pass shape:

```json
{
  "version": 1,
  "metadata": {
    "artifactType": "data-header-mapping",
    "issuedAt": "2026-03-18T14:30:00Z"
  },
  "input": {
    "path": "examples/playground/data-query/multi.xlsx",
    "format": "excel",
    "source": "Summary",
    "range": "B7:AZ20"
  },
  "mappings": [
    { "from": "column_1", "to": "id", "sample": "1001", "inferredType": "INTEGER" },
    { "from": "column_2", "to": "created_at", "sample": "2026-03-01", "inferredType": "DATE" },
    { "from": "column_3", "to": "status", "sample": "active", "inferredType": "VARCHAR" },
    { "from": "column_4", "to": "amount", "sample": "19.95", "inferredType": "DOUBLE" }
  ]
}
```

Documentation implication:

- this should ship with a dedicated schema-and-mapping guide that explains the artifact contract and review flow
- related command guides for `data query` and `data extract` should link back to that shared guide rather than duplicating the canonical mapping schema contract
- non-JSON review presentation should stay in CLI output only in the first pass, not as a second persisted contract
- that guide should explicitly clarify that `version` is the schema-contract version, not app-version history

### Recommendation R. Use one shared filename convention for header-mapping artifacts

Recommended naming rule:

- `data-header-mapping-<uid>.json`

Recommended design principle:

- keep one neutral artifact family for both `data query` and `data extract`
- reuse the same explicit-review-artifact philosophy as `rename-plan-*.csv`
- do not create command-specific naming families unless the artifact contracts later diverge

Why:

- keeps the mapping artifact portable across command flows
- avoids implying that the file belongs exclusively to query or extract
- makes docs, scripting, and artifact recognition simpler

### Recommendation Q. Treat any later TTY accept-in-place shortcut as dry-run-like review convenience

Recommended policy:

- do not make a TTY-only accept-in-place shortcut part of the first pass
- if it lands later, keep it optional
- even when used, require the final accepted mapping to be written back to an explicit artifact

Why:

- preserves scriptability and reproducibility
- keeps the accepted mapping inspectable after the TTY session ends
- makes the shortcut analogous to a dry-run review boundary:
  - visible proposal first
  - explicit acceptance second
  - real command continuation only after acceptance

Important distinction:

- this is dry-run-like in workflow shape
- it is not the same feature as filesystem dry-run output such as `rename --dry-run`
- the object under review here is a schema-shaping contract, not a file-operation batch

### Recommendation S. Use strict input-context matching when reusing accepted mappings in the first pass

Recommended first-pass reuse rule:

- reuse an accepted mapping only when the current shaped-input context matches exactly

Recommended first-pass matching keys:

- `input.path`
- `input.format`
- `input.source` when present
- `input.range` when present

Why:

- header mappings are schema-shaping contracts, not loose hints
- applying the wrong mapping to a similar-looking source is a high-risk silent failure
- exact matching is easier to explain, validate, and test in the first pass

Defer for later:

- looser compatibility heuristics
- explicit override flags for advanced users if they are actually needed

### Recommendation T. Preserve unknown JSON fields when rewriting mapping artifacts

Recommended rewrite policy:

- preserve unknown top-level fields
- preserve unknown fields under `metadata`
- preserve unknown fields inside mapping entries
- update only the fields the CLI owns during the current operation

Why:

- improves forward compatibility
- prevents older CLI versions from silently deleting metadata written by newer versions
- keeps room for later optional fields such as confidence, edit history, or review annotations

Fail-closed rule:

- if the CLI encounters an artifact schema version it cannot safely understand and preserve, it should fail clearly instead of rewriting destructively

## Decision Updates

These are research conclusions for planning use, not shipped CLI contracts.

- Treat headerless preview shaping as lightweight delimited-preview work that applies to `.csv` and `.tsv`, not as a CSV-only exception.
- Reuse the existing preview-generated column family `column_n` for `--no-header`; do not introduce spreadsheet-style synthetic labels such as `A`, `AA`, or `A1`.
- Let direct/shared CLI shaping land before interactive prompting, then layer interactive support on top of the shared helper path.
- Keep one shared shaping and introspection engine across direct CLI, interactive query, and direct `data query codex`; vary only the pre-authoring loop, not the core introspection implementation.
- When shared query-side shaping lands, direct `data query codex` should accept the same shaping flag instead of relying on a hidden Codex-only path.
- Add suspicious-schema warnings only for strong Excel-specific structural signals, and suppress them when explicit shaping is already present.
- Defer Excel header override as a follow-up question after `--range`; if it becomes necessary later, avoid a vague bare `--header` flag.
- If later Excel header control is needed, prefer `--header-row <n>` before adding query-side `--no-header`.
- Present interactive shape resolution as source interpretation before SQL authoring, not as query drafting or result extraction.
- Keep first-pass shaping reusable and in-memory across preview and query, while implementing `data extract` as the explicit materialization lane.
- If query-side `--no-header` lands later, it should apply to delimited `data query` inputs as well rather than remaining Excel-only.
- When Codex suggests semantic headers, keep those suggestions advisory and preserve deterministic `column_n` contract names underneath.
- Define `data extract` as the separate materialization lane for shaped sources rather than overloading `data preview` or `data query` with artifact generation.
- Treat `--codex-suggest-headers` as an in-scope review-first shaping feature, not as a hidden or purely deferred idea.
- Keep the first `--codex-suggest-headers` review surface small and explicit: mapping table plus `Accept all`, `Edit one`, or `Keep generated names`.
- Make `data extract` a broader shaped-table lane in the first implementation slice instead of limiting it to Excel-only messy-source recovery.
- Make `--codex-suggest-headers` available in both `data extract` and a reviewed direct `data query` path in the first implementation slice.
- For direct CLI `data query`, keep accepted Codex header suggestions explicit through a reviewed mapping artifact rather than a hidden in-memory acceptance step.
- Share one Codex header-suggestion engine across `data extract` and `data query`, but keep review and continuation UX command-specific.
- Use JSON as the first-pass canonical header-mapping artifact format.
- Keep header-mapping artifacts JSON-only in the first implementation slice.
- Treat `version` as the header-mapping artifact schema-contract version, not as app-version history or edit-history snapshot.
- Freeze the narrowest required first-pass field set as:
  - `version`
  - `metadata.artifactType`
  - `metadata.issuedAt`
  - `input.path`
  - `input.format`
  - optional `input.source`
  - optional `input.range`
  - `mappings[].from`
  - `mappings[].to`
- If a later TTY-only accept-in-place shortcut lands, keep it optional and still require the final accepted mapping to be written to an explicit artifact.
- Add one dedicated schema-and-mapping guide for the shared artifact contract, and link command guides back to it.
- Use one shared on-disk mapping filename convention across `data extract` and `data query`: `data-header-mapping-<uid>.json`.
- Reuse accepted mappings only on strict exact input-context matches in the first implementation slice.
- Preserve unknown JSON fields when rewriting mapping artifacts, and fail clearly rather than rewriting when the schema version is too new or unsupported to preserve safely.
- Accepted shaping choices should map back to concrete CLI flags so the resulting behavior remains visible and reproducible.

## Remaining Open Questions

- none for this research pass

## Verification Notes

Local verification was re-run on 2026-03-18 UTC against private repro fixtures that are intentionally kept out of public docs and repository-visible guide examples.

Observed current behavior:

- Scenario A:
  - current `data preview` still treats row 1 as the header row on a headerless delimited input
  - the first data row is therefore consumed into visible column names instead of remaining in the rendered row set
- Scenario B:
  - current whole-sheet Excel query binding still collapses the useful table into one merged-banner-derived visible column
- Scenario C:
  - current whole-sheet Excel query binding still produces one sparse title-like column and no meaningful rows

Observed shaping probe outcomes:

- Scenario B:
  - narrowing the sheet to the real table region makes the intended logical header row queryable
- Scenario C:
  - narrowing the sheet materially improves the result, but the most usable query surface in local probing still depended on explicit header and name-normalization options in addition to the narrowed range

Public-doc note:

- do not reference the private local repro fixture filenames or paths in public guides, research summaries, or plan docs
- document these cases by behavior only:
  - headerless delimited input
  - workbook with a merged banner row above the real header
  - workbook with multiple decorative merged regions and a lower table start

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
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`

## References

[^preview-source]: `src/cli/data-preview/source.ts`
[^preview-guide]: `docs/guides/data-preview-usage.md`
[^query-source]: `src/cli/duckdb/query.ts`
[^interactive-query-guide]: `docs/guides/data-query-interactive-usage.md`
