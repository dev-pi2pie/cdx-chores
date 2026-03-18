---
title: "Codex source-shape assistance, interactive data extract, and public-safe smoke fixtures"
created-date: 2026-03-18
modified-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Define and implement the missing reviewed Codex source-shaping layer, then use it to support interactive `data extract`, prompt polish in interactive `data query`, and a new public-safe smoke-fixture generator for shaping and extraction scenarios.

## Why This Plan

The current follow-up scope is larger than “interactive extract plus a few fixtures”.

The missing contract is that Codex-assisted shape recovery is a separate layer from:

- manual deterministic shaping such as `--source` and `--range`
- semantic header review such as `--codex-suggest-headers`
- SQL drafting in interactive `Codex Assistant`
- artifact materialization in `data extract`

The research treats those as separate LEGO layers.
Without freezing that shared source-shape contract first, any interactive `data extract` implementation would either:

- duplicate hidden logic
- overload semantic header review to solve table-region selection
- or hard-code a narrow manual-only workflow that does not match the intended product direction

This plan therefore rewrites the previous follow-up scope around the real dependency order:

1. shared reviewed Codex source-shape assistance
2. direct CLI reuse for extract-oriented shaping recovery
3. interactive `data extract`
4. prompt-copy polish
5. public-safe smoke fixtures

## Current State

- direct CLI `data extract <input>` exists and supports:
  - shared deterministic shaping through `--source` and `--range`
  - accepted semantic header reuse through `--header-mapping <path>`
  - reviewed direct CLI semantic header suggestions through `--codex-suggest-headers`
  - shaped-table output to `.csv`, `.tsv`, and `.json`
- interactive mode does not yet expose `data extract`
- interactive `data query` already supports:
  - shape-first Excel range selection
  - conservative suspicious-schema warnings
  - in-memory semantic header review when generated placeholder headers are present
  - `manual`, `formal-guide`, and `Codex Assistant` SQL-authoring modes
- interactive `Codex Assistant` intent prompts currently use `Describe the query intent` without a trailing `:`
- there is no reviewed direct CLI or interactive contract yet for Codex-assisted source shaping
- `--codex-suggest-headers` only helps after the shaped source is already good enough to inspect; it does not solve “find the right table rectangle first”
- existing public smoke fixtures and the existing generator focus on `data query`
- private local repro files remain useful for debugging, but they should not define the public or generated smoke-fixture contract

## Dependency Note

- this plan should follow:
  - `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
  - `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
  - `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- the new source-shape contract should reuse the same shared introspection engine and shaped-source helpers rather than inventing a second Codex-only parsing path
- interactive `data extract` should sit downstream of the accepted shared source-shape contract
- the new fixture generator should produce public-safe scenarios and should not disclose private local repro paths in plan text, guides, script output, or generated fixture names

## Design Contract

### Layered model

Freeze one shared layered model:

1. deterministic source shaping
   - explicit user-controlled flags such as `--source` and `--range`
   - must work without Codex
2. optional Codex source-shape assistance
   - suggest explicit reproducible shaping values
   - suggestions stay advisory until confirmed
3. optional semantic header review
   - suggest semantic header mappings after the accepted source shape is applied
   - do not use semantic header review to solve table-region selection
4. command continuation
   - `data query`: SQL authoring or execution
   - `data extract`: materialization

Important boundary:

- introspection must happen after accepted shaping is applied
- if a suggested shape changes the source contract, rebuild the shaped source and re-introspect before header review or command continuation

### First-pass Codex source-shape contract

First-pass scope should stay intentionally narrow:

- Excel-only
- source sheet still chosen explicitly through `--source`
- Codex suggests an explicit `range`
- suggestion stays review-first and stops before extraction or SQL execution

Recommended direct CLI flags:

- `--codex-suggest-shape`
- `--write-source-shape <path>`
- `--source-shape <path>`

Recommended first-pass direct CLI behavior:

- `--codex-suggest-shape`:
  - inspect the current shaped source context
  - ask Codex to suggest a better explicit source shape
  - write a reviewable source-shape artifact
  - print a compact human-readable summary
  - stop before extraction or SQL execution
- `--source-shape <path>`:
  - read a previously accepted source-shape artifact
  - validate exact input-context compatibility
  - apply the accepted shape
  - rebuild and re-introspect the shaped source before any later continuation step

Recommended first-pass validation rules:

- `--write-source-shape` requires `--codex-suggest-shape`
- `--codex-suggest-shape` cannot be used with `--output`
- `--codex-suggest-shape` cannot be used with `--header-mapping`
- `--codex-suggest-shape` cannot be used with `--codex-suggest-headers`
- `--source-shape <path>` is mutually exclusive with explicit `--range` in the first pass
- `--codex-suggest-shape` is valid only for Excel inputs and still requires `--source`

### Source-shape artifact contract

Add one shared JSON artifact family for accepted source shaping.

Recommended first-pass filename family:

- `data-source-shape-<uid>.json`

Recommended first-pass required fields:

- `version`
- `metadata.artifactType`
- `metadata.issuedAt`
- `input.path`
- `input.format`
- `input.source`
- `shape.range`

Recommended first-pass artifact shape:

```json
{
  "version": 1,
  "metadata": {
    "artifactType": "data-source-shape",
    "issuedAt": "2026-03-18T14:30:00Z"
  },
  "input": {
    "path": "examples/playground/data-extract/messy.xlsx",
    "format": "excel",
    "source": "Summary"
  },
  "shape": {
    "range": "B7:AZ20"
  }
}
```

Recommended first-pass matching rule for reuse:

- exact match on:
  - `input.path`
  - `input.format`
  - `input.source`

Defer for later:

- file fingerprints
- stale-file detection after in-place edits
- shape fields other than `range`

### Relationship to semantic header review

Keep source-shape assistance and semantic header review separate.

Expected progression for messy Excel recovery:

1. pick sheet
2. inspect current shaped source
3. if suspicious and no explicit shaping is present:
   - keep as-is
   - enter a range manually
   - ask Codex to suggest shaping
4. accept a range
5. rebuild and re-introspect
6. if generated placeholder headers still remain, optionally review semantic header suggestions
7. continue to query authoring or extraction

Important clarification:

- `--codex-suggest-headers` is not the source-shape helper
- it operates only after the accepted source shape exists

### Interactive `data extract`

Interactive `data extract` should become a materialization workflow layered on top of the shared shaping contracts.

Recommended interactive flow:

1. choose input
2. detect input format, with override support when needed
3. choose source object for SQLite or Excel when required
4. build the current shaping state
5. introspect the current shaped source
6. if the schema looks suspicious and no explicit shaping was provided, offer shape resolution:
   - keep as-is
   - enter a range manually
   - ask Codex to suggest shaping
7. if accepted shaping changes the source contract, rebuild and re-introspect
8. when generated placeholder headers are present, optionally review semantic header suggestions
9. choose output format through the output path extension
10. confirm overwrite behavior when needed
11. materialize the shaped table

Interactive extract should not invent a second mapping-artifact authoring path in the first pass.
Direct CLI remains the explicit artifact-writing lane for reviewed shape artifacts and header-mapping artifacts.

### Interactive `data query` prompt polish

Prompt-copy fix:

- change `Describe the query intent` to `Describe the query intent:`

Scope note:

- the editor-backed path already provides multiline authoring
- the first pass should improve copy and readability without introducing a custom terminal input renderer
- any future stronger multiline-default authoring UX should be evaluated separately

### Public-safe fixture generator

Add a dedicated deterministic generator script for shaping and extraction smoke scenarios.

Recommended boundary:

- create a new generator script rather than stretching the current query generator into a mixed-scope tool
- generate public-safe fixtures for:
  - clean CSV or TSV extraction
  - semantic header review on generated placeholder columns
  - Excel sheet extraction with explicit `--source`
  - Excel range-based extraction for shaped-table recovery
  - at least one sanitized workbook scenario inspired by the private edge cases, rewritten so public fixtures and docs remain safe to share

Recommended output targets:

- manual smoke fixtures under `examples/playground/data-extract/`
- optional checked-in deterministic test-fixture output under `test/fixtures/data-extract/` if generator-backed test parity is useful

The generator should stay public-safe:

- no private local repro names
- no private local repro paths
- no fixture text copied directly from private issue scenarios without sanitization

## Scope

### Phase A: Shared source-shape contract

- define the direct CLI flag contract for reviewed Codex source-shape assistance
- define the JSON source-shape artifact schema and filename family
- define strict first-pass compatibility matching for source-shape reuse
- define first-pass validation and stop-before-continuation behavior

### Phase B: Direct CLI reuse for extraction-first flows

- add direct CLI source-shape suggestion and reuse support for `data extract`
- reuse the shared introspection and shaped-source helpers
- keep the direct CLI flow artifact-based and review-first
- stop before extraction when only source-shape suggestion output was requested

### Phase C: Interactive `data extract`

- add `data:extract` to the interactive action-key set
- add the submenu entry under `data`
- route `data:extract` through the interactive dispatcher
- implement the shape-first interactive extract flow
- reuse in-memory semantic header review when placeholder headers remain after accepted shaping
- execute through the shared `data extract` action rather than duplicating materialization logic

### Phase D: Prompt polish

- update the single-line interactive `Codex Assistant` prompt copy to end with `:`
- update the editor-backed interactive `Codex Assistant` prompt copy to end with `:`
- update prompt-copy expectations in interactive tests

### Phase E: Public-safe smoke fixtures

- add a new generator script under `scripts/`
- define `seed`, `clean`, and `reset` behavior if that pattern remains the best fit
- generate deterministic public-safe source fixtures for extract and shaping smoke scenarios
- add generator determinism coverage under `test/`
- document how to regenerate the manual smoke fixtures without referencing private local repro files

## Non-Goals

- inventing a freeform natural-language `data extract codex` transformation lane
- letting Codex source-shape assistance silently continue into extraction or SQL execution
- using semantic header review to substitute for source-shape recovery
- introducing hidden shaping heuristics
- documenting private local repro paths
- replacing the existing `data query` fixture generator

## Risks and Mitigations

- Risk: source-shape assistance may blur into a hidden parser instead of explicit shaping.
  Mitigation: keep first-pass suggestions limited to explicit reproducible flags, starting with Excel `range`.

- Risk: interactive extract may drift from the direct CLI materialization contract.
  Mitigation: keep the interactive layer thin and delegate actual materialization to shared action helpers.

- Risk: semantic header review may be asked to solve the wrong problem.
  Mitigation: freeze the dependency order so source-shape review happens first and header review happens only after re-introspection.

- Risk: prompt polish expands into a larger TTY-rendering refactor.
  Mitigation: freeze this slice to copy polish only and defer custom input rendering decisions.

- Risk: sanitized smoke fixtures become too artificial and stop covering the real failure shapes.
  Mitigation: preserve the structural characteristics that matter for shaping and extraction while rewriting labels and values to stay public-safe.

- Risk: a new fixture generator duplicates too much of the existing query generator.
  Mitigation: reuse shared fixture-building helpers where practical, but keep the command surface focused on extract and shaping scenarios.

## Implementation Touchpoints

- `src/command.ts`
- shared shaping, introspection, and artifact helpers under `src/cli/duckdb/`
- `src/cli/actions/data-extract.ts`
- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/data.ts`
- `src/cli/interactive/data-query.ts`
- `scripts/` for the new fixture generator
- tests under `test/`
- docs under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze shared source-shape contract

- [x] freeze `--codex-suggest-shape`
- [x] freeze `--write-source-shape <path>`
- [x] freeze `--source-shape <path>`
- [x] freeze the JSON source-shape artifact schema helper surface
- [x] freeze one filename family: `data-source-shape-<uid>.json`
- [x] freeze strict first-pass source-shape reuse matching
- [x] freeze direct-CLI validation and stop-before-continuation rules

### Phase 2: Direct CLI shape-suggestion reuse for extract

- [x] implement direct CLI source-shape artifact writing for `data extract`
- [x] implement direct CLI source-shape artifact reuse for `data extract`
- [x] rebuild and re-introspect after accepted source-shape reuse
- [x] keep `--codex-suggest-headers` downstream of accepted source shaping
- [x] add focused direct CLI coverage for source-shape suggestion and reuse

### Phase 3: Interactive extract route and shape resolution

- [x] add `data:extract` to the interactive menu
- [x] route `data:extract` through the interactive dispatcher
- [x] implement interactive source selection for SQLite or Excel extract inputs
- [x] implement suspicious-schema shape-resolution choices for extract:
  - [x] keep as-is
  - [x] enter range manually
  - [x] ask Codex to suggest shaping
- [x] rebuild and re-introspect after accepted shaping changes

### Phase 4: Interactive extract review and output flow

- [x] reuse in-memory semantic header review when placeholder headers remain
- [x] prompt for output path with `.csv`, `.tsv`, or `.json`
- [x] reuse explicit overwrite confirmation behavior
- [x] execute extraction through shared action helpers
- [x] add focused interactive coverage for the new flow

### Phase 5: Interactive query prompt polish

- [x] add `:` to the single-line `Codex Assistant` intent prompt
- [x] add `:` to the editor-backed `Codex Assistant` intent prompt
- [x] update prompt-copy expectations in tests

### Phase 6: Public-safe smoke fixtures

- [x] add a new deterministic fixture-generator script
- [x] generate public-safe extraction and shaping smoke fixtures
- [x] add generator determinism tests
- [x] document how to regenerate the smoke fixtures
- [x] keep public docs and generated fixture names free of private local repro references

## Related Plans

- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
