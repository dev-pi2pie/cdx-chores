---
title: "Data stack mixed-source input-router implementation"
created-date: 2026-04-23
status: active
agent: codex
---

## Goal

Turn the new `data stack` research into an implementation-ready plan that introduces multi-file relation assembly as its own data-command lane, with mixed raw source support and one dedicated input router, without weakening the current `data query` and `data extract` boundaries.

## Why This Plan

The updated research now freezes three important product decisions:

- multi-file assembly is a separate command family from query workspace binding
- the direct CLI should accept mixed raw sources such as files and directories in one invocation
- source normalization should happen through one dedicated stack-specific input router before later validation and materialization steps

That makes implementation planning possible without reopening the broader questions already settled by the research:

- `data query` remains the SQL lane
- `data extract` remains the one-input shaping/materialization lane
- `data stack` becomes the owned surface for assembling one logical table from many local sources

This work is best handled as a phased plan because the research deliberately separates:

1. mixed-source CLI stacking for matching-header CSV and TSV
2. interactive flow design after the direct CLI contract is proven
3. headerless CSV and TSV stacking
4. `jsonl`
5. later schema-flex features such as `union_by_name` and provenance columns

## Current State

- `data query` and `data extract` are both explicitly one-input-file commands today
- workspace relation binding already exists as a separate contract for SQLite and DuckDB-file inputs
- the new research doc now freezes `data stack` as a distinct future family with mixed-source direct CLI input
- public playground support for stack-focused examples now exists under `examples/playground/stack-cases/`
- `scripts/generate-data-stack-fixtures.mjs` creates deterministic stack-case fixtures for:
  - matching-header CSV inputs
  - matching-header TSV inputs
  - headerless CSV inputs
  - headerless TSV inputs
  - header-mismatch CSV inputs
  - basic `jsonl` inputs
  - recursive-depth CSV inputs

## Scope

### Command surface

- add a new `data stack` command under `data`
- accept one or more raw `<source>` arguments
- allow raw sources to be:
  - file
  - directory
- require one explicit output destination
- keep the command materialization-oriented rather than SQL-oriented

### Mixed-source input routing

- introduce `src/cli/data-stack/input-router.ts`
- detect source kind for each raw source
- expand directories into candidate files
- pass explicit files through directly
- apply pattern filtering to directory-expanded candidates only
- deduplicate and order the final normalized file list deterministically
- preserve raw source order while sorting directory-expanded candidates deterministically within each source
- surface one normalized file-list result to the action layer

### Discovery and traversal

- implement tool-owned source normalization instead of shell-owned glob expansion
- keep traversal shallow by default
- allow recursive traversal through `--recursive`
- allow `--max-depth` only together with `--recursive`, following the repo’s existing directory-action pattern
- preserve deterministic matched-file ordering
- exclude hidden files by default
- exclude the output file automatically when it falls inside a scanned directory

### Format handling

Phase 1:

- matching-header CSV and TSV only
- one normalized supported format across the final file list
- first output set:
  - `.csv`
  - `.tsv`
  - optional array-style `.json`
- Parquet output deferred

Phase 2:

- explicit headerless CSV and TSV through `--no-header`
- optional `--columns <name,name,...>`
- shared `column_<n>` placeholder contract when `--columns` is omitted

Phase 3:

- `jsonl` input as one object per line
- strict same-key contract first
- explicit output encoding rules when `.json` output is supported

Deferred:

- generic `.json` input
- mixed-format stacking in one invocation
- schema-flex features such as `--union-by-name`
- provenance columns such as `--add-source-column <name>`

### Documentation and fixtures

- add a dedicated `data stack` usage guide when the first implementation lands
- keep the research doc and plan aligned on the phase boundaries
- keep committed public stack fixtures reproducible through the dedicated generator
- add targeted tests for both the feature and the fixture generator as the implementation grows

### Default output-path behavior

- include default output-path behavior in this overall plan
- do not implement it before the mixed-source router and primary-source semantics are stable
- prefer rolling it out in interactive mode first
- keep direct CLI explicit until the default naming rule is validated in real stack usage

### Interactive mode

- do not start interactive implementation before the direct CLI contract is implemented and verified
- once the direct CLI contract is stable, add a first-pass interactive `data stack` flow that mirrors the same product model where reasonable
- first-pass interactive scope should stay narrower than the eventual command family:
  - directory-first only
  - CSV and TSV only
  - no direct file-list mode yet
  - no `jsonl` yet
  - no Codex-assisted stack diagnostics yet
- keep one explicit review checkpoint before the write boundary
- in interactive mode, choose output format first and then choose the destination path inside that selected format

## Non-Goals

- expanding `data query --relation` into multi-file assembly
- expanding `data extract` into a multi-file command
- generic `.json` input support
- mixed CSV/TSV/JSONL stacking in one invocation
- reviewed Codex-owned stack-time artifact generation
- connection-backed sources
- schema-aware workspace behavior

## Risks and Mitigations

- Risk: `data stack` overlaps confusingly with current `data query` and `data extract` wording.
  Mitigation: freeze one message everywhere:
  - `data stack` assembles many sources into one logical table
  - `data extract` shapes one input file into one logical table
  - `data query` runs SQL

- Risk: mixed raw inputs create an ad hoc routing surface instead of one coherent contract.
  Mitigation: centralize raw-source handling in `src/cli/data-stack/input-router.ts` and keep the action layer file-list based.

- Risk: pattern behavior becomes unclear when explicit files and directories are mixed.
  Mitigation: freeze one rule early:
  - explicit file sources bypass pattern filtering
  - directory-expanded candidates are filtered by pattern

- Risk: mixed-source ordering becomes user-visible but underspecified.
  Mitigation: preserve raw source order and sort directory-expanded candidates deterministically within each source.

- Risk: recursive discovery silently pulls in unrelated or generated files.
  Mitigation: keep recursion opt-in through `--recursive`, require `--max-depth` to stay behind that flag, and preserve shallow-by-default behavior.

- Risk: headerless behavior drifts from the repo’s existing placeholder contract.
  Mitigation: reuse the existing `column_<n>` contract and add direct tests for headerless CSV and TSV stacking.

- Risk: `jsonl` support reintroduces generic JSON shape ambiguity by accident.
  Mitigation: keep `jsonl` explicitly one-object-per-line, require strict same-key behavior first, and continue deferring generic `.json` input.

- Risk: fixture generators become destructive for tracked playground trees.
  Mitigation: keep guarded clean behavior for the default tracked fixture root and regression-test the refusal path.

- Risk: interactive implementation starts before the direct CLI contract is stable and creates a second product model.
  Mitigation: freeze the direct CLI contract first, then make interactive wrap that behavior instead of inventing new semantics.

- Risk: default output naming becomes arbitrary or surprising in mixed-source runs.
  Mitigation: implement it only after the input router and primary-source labeling rules are stable, and ship it in interactive mode first.

## Implementation Touchpoints

- `src/cli/commands/data.ts`
- new `src/cli/commands/data/stack.ts`
- new `src/cli/actions/data-stack.ts`
- new `src/cli/data-stack/input-router.ts`
- new shared stack helpers under `src/cli/data-stack/` if the action grows beyond a thin orchestrator
- shared path or format helpers only if they stay generic enough to belong outside the stack feature
- later interactive wiring under `src/cli/interactive/data.ts` and a dedicated `src/cli/interactive/data-stack/` boundary if the flow grows beyond a small wrapper
- tests under `test/`
- future docs under `docs/guides/`
- `scripts/generate-data-stack-fixtures.mjs`
- `examples/playground/stack-cases/`

## Phase Checklist

### Phase 1: Freeze the mixed-source command contract

- [x] freeze the direct CLI command shape for `data stack`
- [x] freeze raw `<source...>` input semantics for files and directories
- [x] freeze the phase-1 input scope to matching-header CSV and TSV only
- [x] freeze the mixed-source router rules:
  - explicit files pass through directly
  - directories expand into candidates
  - pattern applies only to directory-expanded candidates
- [x] freeze the ordering rule:
  - preserve raw source order
  - sort directory-expanded candidates deterministically within each source
- [x] freeze shallow-by-default traversal behavior
- [x] freeze opt-in recursion through `--recursive`
- [x] freeze `--max-depth` as valid only with `--recursive`
- [x] freeze deterministic final file ordering and hidden-file exclusion
- [x] freeze the first output set:
  - `.csv`
  - `.tsv`
  - optional array-style `.json`
- [x] keep Parquet output out of the first shipped slice

### Phase 2: Implement the first shipped slice

#### 2A. Input router

- [x] add `src/cli/data-stack/input-router.ts`
- [x] implement raw-source resolution and source-kind detection
- [x] implement directory expansion and explicit file passthrough
- [x] implement pattern filtering for directory-expanded candidates
- [x] implement deduplication and deterministic final ordering

#### 2B. Command and action

- [x] add `data stack` command wiring
- [x] implement matching-header CSV stacking
- [x] implement matching-header TSV stacking
- [x] implement first-pass validation and error messages for:
  - no matches
  - unsupported extension or format
  - mixed normalized formats
  - header mismatch
  - output path conflicts
- [x] add focused command and action tests for the phase-1 contract

### Phase 3: Freeze and implement the first interactive flow

- [x] freeze the first-pass interactive `data stack` contract in line with the updated research
- [x] add an interactive `data -> stack` route only after the direct CLI behavior is stable
- [x] keep first-pass interactive scope to directory-first CSV and TSV stacking
- [x] add prompts for:
  - input directory
  - pattern
  - traversal mode
  - output format
  - output destination within the selected format
- [x] add one explicit review checkpoint before the write boundary
- [x] add focused interactive routing and flow coverage

### Phase 4: Add headerless delimited support

- [x] add `--no-header`
- [x] add optional `--columns <name,name,...>`
- [x] reuse the `column_<n>` placeholder contract when `--columns` is omitted
- [x] reject mismatched column counts across headerless inputs
- [x] extend fixtures and tests for headerless CSV and TSV stacking

### Phase 5: Add `jsonl`

- [x] freeze the first `jsonl` row-shape contract as one object per line
- [x] keep first-pass row-key mismatch as a strict failure
- [x] record opt-in union behavior as a later schema-flex follow-up instead of widening the first `jsonl` slice
- [x] define `.json` output explicitly as one JSON array of row objects if that output is supported
- [x] add focused `jsonl` fixtures and command tests

### Phase 6: Documentation and guide alignment

- [ ] add a `data stack` usage guide
- [ ] update command-family docs so `stack`, `extract`, and `query` read as complementary lanes rather than competing ones
- [ ] keep examples anchored to `examples/playground/stack-cases/`
- [ ] document the guarded fixture-generator behavior for the tracked playground tree if the guide references local reproduction
- [ ] update interactive documentation once `data -> stack` lands

### Phase 7: Add default output-path behavior

- [ ] freeze the default-output-path naming rule after mixed-source primary-label semantics are stable
- [ ] introduce `use default output path` versus `custom output path` in interactive `data stack`
- [ ] keep the default output extension aligned with the selected output format
- [ ] prefer a stack-specific derived stem such as `.stack.csv`, `.stack.tsv`, or `.stack.json`
- [ ] add focused tests for the chosen default-path rule
- [ ] update docs once the default-output-path behavior ships

### Phase 8: Record follow-up work explicitly

- [ ] record `--union-by-name` as the preferred first schema-flex widening for later `jsonl` key-mismatch handling
- [ ] record any future interactive widening beyond directory-first as a true mixed-source mode that mirrors the CLI contract
- [ ] record later schema-flex features beyond `--union-by-name`, such as provenance columns, as separate follow-up work
- [ ] record any later Codex-assisted stack diagnostics as a separate future slice

## Related Research

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/research-2026-04-01-schema-aware-query-workspace-direction.md`
- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/archive/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-20-data-command-surface-followup-headerless-and-source-shape-replay.md`

## Related Jobs

- `docs/plans/jobs/2026-04-23-data-stack-phase-1-2-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-3-5-implementation.md`
