---
title: "Interactive data shaping UX, reviewed extract flow, and Excel header-row follow-up"
created-date: 2026-03-18
modified-date: 2026-03-19
status: active
agent: codex
---

## Goal

Close the next layer of data-shaping gaps by improving the interactive reviewed Codex UX for `data query` and `data extract`, aligning interactive extract with the staged review-and-apply rhythm already used by rename dry runs, and extending deterministic Excel shaping with explicit header-row control for hard merged-sheet cases.

## Why This Plan

The recently completed follow-up landed the first reviewed source-shape layer, interactive `data extract`, and public-safe shaping fixtures.

That slice is working, but it exposes three new gaps:

- the interactive `Codex` shape and header review steps do not show the existing thinking/progress surface used by analyzer-assisted rename flows
- interactive `data extract` drops directly into a raw output-path prompt instead of using a safer destination flow with a final write boundary
- hard merged-header workbooks still remain only partially recoverable because first-pass shaping can change the `range`, but it still cannot promote the correct header row into the shaped table

Those gaps are now coupled:

- UX polish alone will not make tough Excel extraction usable
- `--header-row <n>` alone will still feel rough if interactive reviewed shaping remains abrupt and opaque
- rename-style staged review should inform the extract UX, but extract should not blindly copy the plan-CSV model

This plan therefore treats the next slice as one follow-up:

1. review and tighten the interactive Codex-assisted shaping UX
2. align interactive extract with a clearer review-before-write rhythm
3. extend shared deterministic Excel shaping with explicit header-row control
4. widen reviewed source-shape assistance so it can suggest the accepted shape state needed by hard merged sheets

## Current State

- shared deterministic shaping currently supports:
  - `--source`
  - `--range`
- reviewed source-shape assistance currently supports:
  - `--codex-suggest-shape`
  - `--write-source-shape <path>`
  - `--source-shape <path>`
- current source-shape artifacts persist only the accepted `range`
- interactive `data query` and interactive `data extract` can:
  - warn when whole-sheet Excel introspection looks suspicious
  - let the user keep the current shape, enter a range manually, or ask Codex to suggest shaping
  - re-inspect after accepted range changes
- interactive header review currently stays intentionally narrow:
  - it runs only when the current shaped source exposes generated `column_n` placeholder headers
- headerless CSV inputs currently expose DuckDB-generated names such as `column0`, `column1`, ... in some paths, which do not match the reviewed-header trigger contract assumed by the research
- interactive extract currently:
  - runs reviewed shaping and reviewed header suggestions in memory
  - asks directly for an output file path
  - writes immediately after that path and overwrite check
- some merged-sheet Excel inputs still bypass the current suspicious-shape warning because they collapse into one visible column with non-empty sample rows
- some accepted `range` plus `header-row` shapes still fail during DuckDB Excel parsing because blank or merged header-band rows remain inside the shaped rectangle ahead of the first representative data row
- analyzer-assisted rename flows already have a stronger interactive rhythm:
  - explicit progress status while Codex work is running
  - deterministic review surfaces before apply
  - a final explicit apply decision
  - auto-clean behavior only for intermediate artifacts such as plan CSVs
- the edge-case research already predicted the remaining contract gap:
  - `--range` is the first repair
  - `--header-row <n>` should be the next deterministic Excel shaping step before falling back to more extreme header overrides

## Scope

### Interactive reviewed Codex UX

- audit the current interactive `Codex` shape and header review steps for both `data query` and `data extract`
- add a thinking/progress surface during:
  - Codex source-shape suggestions
  - Codex semantic header suggestions
- reuse the existing interactive analyzer status primitive instead of inventing a second spinner implementation
- tighten prompt and review copy so shaping, semantic header review, and final writing are clearly separated

### Interactive extract review-and-write flow

- replace the raw required output-path prompt with a safer output-destination flow
- make interactive extract feel closer to rename dry-run review without forcing a literal plan-CSV model
- add an explicit final write boundary after shaping and header review are complete
- keep the actual extract execution delegated to the shared action layer

### Deterministic Excel header-row shaping

- add `--header-row <n>` as the next shared deterministic Excel shaping flag for query and extract consumers
- treat `header-row` as part of the active shaped-source state alongside `source` and `range`
- define `header-row` as an absolute worksheet row number, not a row number relative to the selected range
- apply it in the shared DuckDB relation-building path rather than only in interactive mode
- keep direct CLI, interactive query, interactive extract, and direct Codex-assisted lanes on the same shaping contract

### Reviewed source-shape follow-up

- extend reviewed source-shape assistance so the accepted shape can describe:
  - `range` only
  - `headerRow` only
  - `range` plus `headerRow`
- keep the reviewed source-shape flow separate from semantic header-mapping artifacts
- preserve compatibility with already-written range-only source-shape artifacts

### Fixtures, docs, and verification

- add or extend public-safe smoke fixtures for range-plus-header-row workbook cases
- update behavior guides for the new reviewed interactive flow and the new deterministic Excel shaping flag
- keep public docs behavior-oriented and avoid disclosing private local repro fixture names or paths

### Merged-sheet recovery follow-up

- broaden suspicious Excel detection so interactive reviewed shaping also triggers for structurally collapsed one-column sheet views, not only for empty whole-sheet results or generated placeholder headers
- add a tolerant Excel introspection/materialization fallback for accepted shaped ranges that still fail due to type inference across blank or merged header-band rows
- defer any new shaping flag until after tolerant import behavior is tested against the hard merged-sheet class
- only freeze a new deterministic shape contract if `source + range + header-row` plus tolerant import still cannot produce a stable logical table

### Headerless placeholder follow-up

- reconcile the generated-header contract assumed by research and reviewed header suggestions with the actual placeholder names DuckDB emits for headerless CSV inputs
- ensure interactive reviewed header suggestions trigger for deterministic placeholder names regardless of whether the current path exposes `column0` or `column_1` style names
- prefer one shared placeholder contract before widening more interactive-only heuristics

## Design Contract

### Layered shaping model

Freeze the next shared layered model:

1. deterministic source shaping
   - `--source`
   - `--range`
   - `--header-row <n>`
2. optional reviewed Codex source-shape assistance
   - suggest explicit deterministic shaping values
   - never apply them silently
3. optional reviewed semantic header mapping
   - suggest semantic renames after the accepted deterministic source shape is applied
4. continuation
   - query authoring or execution
   - extraction materialization

Important boundary:

- semantic header review must stay downstream of accepted deterministic shaping
- `--header-row` is source shaping, not semantic mapping

### Excel shaping progression

For troublesome Excel inputs, the intended recovery order should become:

1. choose sheet
2. optionally narrow with `range`
3. if still structurally suspicious, resolve or suggest `header-row`
4. re-inspect the shaped source
5. if semantic placeholders still remain, review semantic header suggestions
6. continue to query or extract

This keeps the recovery steps consistent with the research:

- first deterministic table rectangle
- then deterministic header-row selection
- then optional semantic naming

### Header-row semantics

Freeze explicit first-pass semantics for `--header-row <n>`:

- valid only for Excel inputs
- row numbering uses absolute worksheet row numbers
- when `--range` is present, `header-row` must fall inside the selected worksheet rectangle
- when `--range` is absent, `header-row` still applies to the selected sheet as an absolute worksheet row number
- `header-row` changes source interpretation before semantic header review or continuation

This keeps the contract aligned with how users inspect workbook rows and how the edge-case research describes troublesome sheets.

### Source-shape artifact follow-up

Extend the shared source-shape artifact contract so the shape section can represent:

```json
{
  "shape": {
    "range": "B7:AZ20",
    "headerRow": 7
  }
}
```

Accepted first-pass reviewed source-shape outcomes should be:

- `range` only
- `headerRow` only
- `range` plus `headerRow`

Invalid reviewed source-shape outcomes should be:

- neither `range` nor `headerRow`
- semantic header names or other non-shaping fields

Compatibility note:

- existing range-only artifacts should remain reusable
- the first follow-up should avoid a breaking artifact rewrite when the current version can be widened compatibly

### Interactive reviewed Codex status UX

Interactive reviewed Codex flows should show a visible status surface while work is running.

Preferred behavior:

- reuse the existing analyzer status helper
- use short task labels such as:
  - `Inspecting worksheet structure...`
  - `Waiting for Codex source-shape suggestions...`
  - `Waiting for Codex header suggestions...`
- keep non-TTY behavior simple text-only, matching existing analyzer status fallback behavior

### Interactive extract and rename-dry-run alignment

Interactive extract should align with the rename dry-run pattern at the level of staged commitment, not literal artifact type.

Required alignment:

- review shaping before write
- review semantic headers before write
- review output destination before write
- show a final concise summary of what will be written
- ask explicitly whether to write the extracted output now

Important non-alignment:

- do not force extract to create a rename-style plan CSV
- do not invent auto-clean behavior for the final extracted output artifact

Optional follow-up behavior to consider:

- if interactive users want replayability, offer writing reviewed source-shape and header-mapping artifacts explicitly, rather than keeping the whole interactive session as hidden state

### Output destination UX

Replace the current raw extract output-path prompt with a safer interactive contract:

1. choose output format
   - CSV
   - TSV
   - JSON
2. choose destination style
   - use default output path
   - custom output path
3. confirm overwrite when needed
4. show final write summary
5. confirm write

This keeps extract aligned with the clearer output-destination pattern already used by other interactive data flows.

### Hard-case heuristics and warnings

Do not stop the warning logic merely because any range was accepted.

Instead:

- re-evaluate schema health after every accepted shape change
- if the range-fixed shape still looks structurally suspicious, offer the next deterministic shaping step instead of silently treating the result as healthy
- keep warnings focused on source interpretation, not on SQL drafting or file writing

### Tolerant Excel recovery

Freeze the next follow-up investigation order for hard merged-sheet recovery:

1. broaden suspicious-shape detection
2. accept reviewed `source + range + header-row`
3. if DuckDB Excel parsing still fails because early rows inside the rectangle distort type inference, retry with a narrower tolerant import mode before inventing a new CLI flag
4. only if tolerant retry still fails, evaluate whether the deterministic shape contract needs another explicit field such as a data-start row

First-pass preference:

- keep the public CLI contract unchanged while testing tolerant recovery
- prefer DuckDB-side import options that reduce early-row type inference fragility for shaped Excel tables
- keep the fallback internal until it proves stable enough to document as normal behavior

Decision boundary:

- if tolerant retry makes accepted reviewed shapes materialize reliably, do not add a new shaping flag yet
- if tolerant retry still cannot represent header-band spacer rows safely, draft a separate follow-up contract for the next deterministic Excel shaping field

### Generated header placeholder contract

Freeze the next follow-up decision for headerless tabular inputs:

1. treat DuckDB-emitted placeholder names such as `column0`, `column1`, ... as generated headers, not semantic headers
2. decide whether the shared contract should normalize those names to `column_1`, `column_2`, ... or preserve them and broaden every reviewed-header detector
3. prefer shared normalization if it avoids duplicated placeholder-detection logic across preview, query, and extract

Decision boundary:

- if shared normalization is low-risk, standardize on `column_<n>` to match the research and reviewed header-mapping artifacts
- if shared normalization would be too invasive, broaden generated-header detection first and treat normalization as a later cleanup

## Non-Goals

- freeform natural-language transformation for `data extract`
- automatic merge-aware fill-down or cell propagation
- silent auto-detection of the right table without explicit reviewed shaping
- replacing semantic header mappings with `--header-row`
- replacing `--header-row` with semantic header mappings
- forcing interactive extract to generate a rename-style plan CSV

## Risks and Mitigations

- Risk: interactive extract copies rename dry-run too literally and becomes artifact-heavy.
  Mitigation: borrow the staged review/apply rhythm, not the rename plan-CSV mechanics.

- Risk: `--header-row` drifts into a vague header override contract.
  Mitigation: keep it explicit, numeric, Excel-only, and part of the shared source-shape state.

- Risk: Codex source-shape assistance becomes too broad when widened beyond `range`.
  Mitigation: keep the allowed output shape narrow and deterministic: `range`, `headerRow`, or both together.

- Risk: warning heuristics become noisy after each shaping change.
  Mitigation: only loop when strong structural signals remain and stop once the shaped source looks plausibly table-like.

- Risk: docs expose private local repro details while describing the new hard-case flow.
  Mitigation: keep all public docs scenario-oriented and use only sanitized public-safe fixtures.

- Risk: tolerant Excel fallback over-widens types and degrades downstream query ergonomics.
  Mitigation: keep tolerant recovery scoped to hard shaped-sheet failure modes first, verify extracted behavior on public-safe fixtures, and avoid widening the public contract until the fallback is predictable.

## Implementation Touchpoints

- `src/cli/duckdb/query.ts`
- source-shape helpers under `src/cli/duckdb/source-shape/`
- header-mapping helpers under `src/cli/duckdb/header-mapping/`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-extract.ts`
- `src/cli/interactive/analyzer-status.ts`
- `src/cli/interactive/data-query.ts`
- `src/cli/interactive/data.ts`
- shared interactive path prompts under `src/cli/prompts/path.ts`
- tests under `test/`
- guides under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze the follow-up shaping and UX contract

- [x] freeze the staged interactive review-and-write contract for extract
- [x] freeze how rename dry-run concepts map to interactive extract and where they do not
- [x] freeze `--header-row <n>` as the next deterministic Excel shaping flag
- [x] freeze absolute worksheet row numbering semantics for `--header-row <n>`
- [x] freeze source-shape artifact widening for optional `headerRow`
- [x] freeze which reviewed source-shape combinations are valid: `range`, `headerRow`, or both
- [x] freeze warning-loop behavior after accepted shape changes

### Phase 2: Shared deterministic header-row shaping

- [x] implement `--header-row <n>` in the shared Excel relation-building path
- [x] wire `--header-row` into direct `data query`
- [x] wire `--header-row` into direct `data extract`
- [x] wire `--header-row` into direct Codex-assisted query and reviewed shape reuse
- [x] add focused tests for range-plus-header-row shaped workbooks

### Phase 3: Reviewed source-shape assistance follow-up

- [x] widen the source-shape artifact helper surface for optional `headerRow`
- [x] allow reviewed Codex source-shape suggestions to return `range`, `headerRow`, or both
- [x] preserve compatibility with existing range-only source-shape artifacts
- [x] add focused tests for reviewed source-shape suggestion and reuse with `headerRow`

### Phase 4: Interactive reviewed Codex UX parity

- [x] show thinking/progress status for interactive Codex source-shape suggestions
- [x] show thinking/progress status for interactive Codex header suggestions
- [x] keep non-TTY fallback text aligned with the existing analyzer-status behavior
- [x] add focused tests for the new status copy and flow boundaries

### Phase 5: Interactive extract review-and-write flow

- [x] replace the raw output-path prompt with output-format plus destination-style selection
- [x] show a final write summary before extraction runs
- [x] require explicit write confirmation after review is complete
- [x] keep extraction execution routed through shared action helpers
- [x] add focused interactive coverage for the new extract flow

### Phase 6: Hard-case warnings, fixtures, and docs

- [x] keep warning loops active when strong structural suspicion remains after range-only shaping
- [x] add or extend public-safe workbook fixtures for range-plus-header-row recovery
- [x] add semantic validation coverage for the generated hard workbook, not only byte-level determinism
- [ ] update interactive and extract guides for the staged review-and-write flow
- [ ] document `--header-row <n>` behavior without exposing private local repro details
- [x] verify with focused tests and `bunx tsc --noEmit`

### Phase 7: Hard merged-sheet recovery and tolerant Excel shaping

- [x] broaden suspicious Excel detection for merged-sheet cases that collapse into one visible column with non-empty sample rows
- [x] add a focused public-safe workbook fixture that reproduces the collapsed-one-column merged-sheet pattern
- [x] add tolerant Excel introspection/materialization retry for accepted shaped ranges that still fail due to early-row type inference
- [x] add focused tests for accepted reviewed shapes that previously failed after `--range` plus `--header-row`
- [ ] evaluate whether a new deterministic shaping field is still needed after tolerant retry, and only then draft the next contract change

### Phase 8: Placeholder normalization and rebuilt-dist verification

- [ ] normalize or otherwise recognize DuckDB-generated headerless names such as `column0`, `column1`, ... as reviewed-header trigger placeholders
- [ ] decide whether to standardize those placeholders to `column_<n>` in the shared contract or broaden generated-header detection without rewriting names
- [ ] verify the hard merged-sheet recovery path against a rebuilt `dist` artifact before deciding another deterministic shaping field is required
- [ ] if rebuilt `dist` still fails on the hard merged-sheet class, record the remaining failure mode and feed it into the next shaping-contract decision

## Related Plans

- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
