---
title: "Data stack interactive mixed-source follow-up"
created-date: 2026-04-23
status: draft
agent: codex
---

## Goal

Widen interactive `data stack` so it mirrors the shipped direct CLI more closely, instead of staying restricted to one directory plus CSV/TSV-only input selection.

## Why This Plan

The completed `data stack` implementation plan intentionally shipped a narrower first-pass interactive flow:

- one input directory
- CSV or TSV only
- one pattern plus one traversal mode

That made sense for the first shipped slice, but it now creates a visible mismatch against the direct CLI:

- direct CLI accepts mixed raw sources
- direct CLI supports explicit files and directories together
- direct CLI already supports strict `jsonl`

This follow-up should be handled in its own plan because the base `data stack` plan is already complete and this work is a widening/refinement pass rather than initial bring-up.

## Current State

Interactive `data -> stack` currently supports:

- one directory only
- `csv` or `tsv` input selection
- pattern filtering
- shallow or recursive traversal
- output formats:
  - `csv`
  - `tsv`
  - `json`
- default or custom output destination

Direct CLI `data stack` already supports more:

- one or more raw `<source...>` arguments
- explicit files, directories, or both together
- strict `jsonl`

## Scope

### Interactive source selection

- widen interactive `data stack` from directory-only to true mixed-source input
- support adding one or more sources before stack preparation
- allow each source to be:
  - file
  - directory
- keep source-kind detection aligned with the existing stack input router

### Interactive routing model

- mirror direct CLI source normalization rather than inventing a separate interactive-only contract
- preserve explicit-file passthrough
- preserve directory expansion plus optional pattern filtering
- preserve deterministic ordering after normalization

### Interactive input formats

- support `csv`
- support `tsv`
- support strict `jsonl`
- keep generic `.json` input deferred

### Review and write flow

- keep one explicit matched-source review before write
- show a clear normalized source summary after mixed-source routing
- preserve current output-format and destination selection flow
- preserve current default-output-path behavior unless a separate change is required

## Non-Goals

- changing direct CLI `data stack` source routing
- widening into schema-flex features such as `--union-by-name`
- provenance columns such as `--add-source-column <name>`
- Codex-assisted stack diagnostics
- generic `.json` input

## Risks and Mitigations

- Risk: interactive mode drifts from direct CLI source semantics.
  Mitigation: make interactive wrap the same normalization contract already used by `src/cli/data-stack/input-router.ts`.

- Risk: source selection becomes too wizard-heavy.
  Mitigation: keep the first widening focused on adding sources and reviewing the normalized file list rather than adding new schema-flex controls.

- Risk: `jsonl` interactive support reopens generic JSON ambiguity.
  Mitigation: keep interactive `jsonl` aligned with the current direct CLI contract: one object per line, strict same-key behavior first.

## Implementation Touchpoints

- `src/cli/interactive/data/stack.ts`
- `src/cli/data-stack/input-router.ts`
- shared interactive path/source prompts under `src/cli/interactive/`
- `test/cli-interactive-routing.test.ts`
- `docs/guides/data-stack-usage.md`

## Phase Checklist

### Phase 1: Freeze the widened interactive contract

- [ ] freeze the interactive source-entry model for files, directories, or both together
- [ ] freeze how directory-specific options such as pattern and traversal apply inside mixed-source interactive runs
- [ ] freeze the normalized-source review layout for mixed-source interactive runs
- [ ] freeze whether strict `jsonl` ships in the same widening slice or immediately after it

### Phase 2: Implement mixed-source interactive selection

- [ ] add interactive prompts to collect one or more raw sources
- [ ] route those raw sources through the existing stack normalization contract
- [ ] review the normalized source summary before write
- [ ] add focused interactive routing coverage for mixed file/directory selection

### Phase 3: Add interactive `jsonl`

- [ ] add `jsonl` input selection in interactive mode
- [ ] keep strict same-key behavior aligned with the shipped direct CLI
- [ ] add focused interactive coverage for `jsonl` selection and validation flow

### Phase 4: Docs and final alignment

- [ ] update `docs/guides/data-stack-usage.md` so the interactive section matches the widened flow
- [ ] update any data-command guide wording that still describes interactive stack as directory-only
- [ ] add a job record when implementation lands

## Related Research

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`

## Related Plans

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-04-23-data-stack-phase-1-2-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-3-5-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-6-8-implementation.md`
