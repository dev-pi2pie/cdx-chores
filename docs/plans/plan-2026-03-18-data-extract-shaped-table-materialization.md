---
title: "Data extract shaped-table materialization"
created-date: 2026-03-18
modified-date: 2026-03-18
status: draft
agent: codex
---

## Goal

Implement `data extract` as the explicit lane for materializing one shaped table from one input file into a clean `.csv`, `.tsv`, or `.json` artifact.

## Why This Plan

The research now treats `data extract` as a real command-family lane, not a vague future note.

It deserves its own plan because it introduces:

- a new direct command surface
- output-file semantics separate from preview and query
- shaped-table materialization rules
- output-format inference and overwrite behavior
- reuse of header-mapping artifacts and reviewed Codex suggestions in a non-SQL workflow

That is enough product surface to keep separate from both deterministic shaping and mapping-artifact review infrastructure.

## Dependency Note

- this plan should follow the shared source-shaping foundation plan
- this plan should follow the header-mapping artifact and Codex-review plan if `--codex-suggest-headers` is included in the first slice
- `data extract` should reuse those shared helpers rather than inventing new shaping or mapping behavior
- if reviewed header suggestions are included, `data extract` should reuse the same explicit mapping-artifact flags and two-step review contract rather than combining review and extraction in one opaque pass

## Current State

- the research now freezes `data extract` as:
  - one shaped logical table per invocation
  - no SQL
  - output as a new clean artifact
  - broader than Excel-only recovery, including delimited inputs in the first slice
- no command or guide currently exists for `data extract`

## Scope

### Command shape

- add `data extract <input>`
- one input file per invocation
- no SQL
- output required through an explicit file target for materialization runs

### Input and shaping support

- support the shared shaping state provided by the foundation plan
- expected first-pass shaping inputs:
  - `--input-format` when needed
  - `--source` where required
  - `--range`
  - later `--header-row <n>` / `--no-header` only if those already exist in shared helpers
  - `--header-mapping <path>`
  - reviewed `--codex-suggest-headers` if the mapping-artifact plan lands first

### Reviewed header-suggestion flow

- reuse the mapping-artifact output and input flags defined by the header-mapping plan
- when `--codex-suggest-headers` is used in the first pass:
  - inspect the current shaped source
  - write the reviewable mapping artifact
  - stop before writing the extracted output artifact
  - require a follow-up run with accepted `--header-mapping <path>` to materialize the clean output artifact
- keep `--output <path>` required for actual extraction runs, but not for suggestion-only review runs that stop after writing the mapping artifact
- keep overwrite behavior explicit and separate for mapping-artifact writes versus extracted output writes

### Output contract

- support `.csv`
- support `.tsv`
- support `.json`
- infer output format from the output path extension
- require explicit overwrite behavior
- keep result payload in the output artifact, not mixed into stdout

### Shared behavior

- reuse strict mapping-artifact compatibility checks
- reuse preserve-unknown-fields logic only where mapping artifacts themselves are rewritten
- keep `data extract` on the same shaped-table contract as preview/query rather than inventing a parallel interpretation layer

### Documentation

- add a `data extract` usage guide
- link back to the dedicated schema-and-mapping guide
- document outputs by behavior, not by private local issue-data fixture paths

## Non-Goals

- interactive `data extract` in the first pass
- SQL execution
- automatic table-region detection
- hidden Codex-only shaping paths
- single-invocation suggest-and-materialize shortcuts in the first pass
- non-JSON mapping artifacts
- machine-specific absolute paths in public docs

## Risks and Mitigations

- Risk: `data extract` duplicates query or preview logic instead of reusing shared shaping.
  Mitigation: keep it downstream of the same shared shaping and mapping helpers.

- Risk: output semantics drift across `.csv`, `.tsv`, and `.json`.
  Mitigation: freeze output-format inference and keep one clean materialization contract.

- Risk: `data extract` grows into a general transform command too early.
  Mitigation: keep it scoped to materializing one already-shaped table rather than adding unrelated transform families.

## Implementation Touchpoints

- `src/command.ts`
- new `src/cli/actions/data-extract.ts`
- shared shaping and mapping helpers under `src/cli/duckdb/` or adjacent modules
- output helpers for CSV/TSV/JSON serialization
- tests under `test/`
- new usage guide under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze CLI materialization contract

- [ ] add `data extract <input>`
- [ ] define required output-path behavior for materialization runs
- [ ] freeze output-format inference for `.csv`, `.tsv`, and `.json`
- [ ] freeze overwrite behavior
- [ ] freeze stdout/stderr contract for artifact-writing commands
- [ ] freeze the reviewed two-step `--codex-suggest-headers` flow so suggestion runs stop after writing a mapping artifact and materialization runs require accepted `--header-mapping <path>`

### Phase 2: Reuse shared shaping helpers

- [ ] consume shared source-shaping state from the foundation plan
- [ ] support `--source` and `--range` where applicable
- [ ] support `--header-mapping <path>`
- [ ] reuse shared mapping-artifact output/input flags when `--codex-suggest-headers` is requested
- [ ] support `--codex-suggest-headers` if the mapping plan has landed

### Phase 3: Output writers

- [ ] write shaped rows to CSV
- [ ] write shaped rows to TSV
- [ ] write shaped rows to JSON
- [ ] add focused tests for output inference, overwrite checks, and content shape

### Phase 4: Documentation and verification

- [ ] add `data extract` guide
- [ ] link back to the dedicated schema-and-mapping guide
- [ ] keep docs behavior-focused and avoid private local issue-data paths
- [ ] add manual verification notes for local-only private repro files without naming them in public docs

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`

## Related Plans

- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
