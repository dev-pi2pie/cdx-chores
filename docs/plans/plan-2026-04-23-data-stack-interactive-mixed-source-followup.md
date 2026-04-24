---
title: "Data stack interactive mixed-source follow-up"
created-date: 2026-04-23
modified-date: 2026-04-24
status: draft
agent: codex
---

## Goal

Widen interactive `data stack` so it mirrors the shipped direct CLI more closely, instead of staying restricted to one directory plus CSV/TSV-only input selection.

This follow-up also resolves the current JSON-format ambiguity by making structured JSON a supported stack input format with a narrow first contract:

- `.jsonl` input means one JSON object per line
- `.json` input means one top-level JSON array of objects
- both formats require a strict shared key set first

The same follow-up also defines deterministic schema-flex controls, so users can deliberately stack named schemas that add or omit columns or JSON keys without weakening strict matching by default:

- `--union-by-name` widens the output schema by name
- `--exclude-columns <name,name,...>` removes explicit names from the widened output schema
- replayable records and Codex-assisted schema suggestions are deferred to a separate future plan

## Why This Plan

The completed `data stack` implementation plan intentionally shipped a narrower first-pass interactive flow:

- one input directory
- CSV or TSV only
- one pattern plus one traversal mode

That made sense for the first shipped slice, but it now creates a visible mismatch against the direct CLI:

- direct CLI accepts mixed raw sources
- direct CLI supports explicit files and directories together
- direct CLI already supports strict `jsonl`

It also leaves JSON wording ambiguous:

- interactive mode already supports JSON output
- direct CLI already supports `.json` output
- neither the current direct CLI nor interactive mode supports `.json` input yet

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

Clarification:

- current interactive mode does not expose `jsonl` input selection
- current interactive mode does not expose `json` input selection
- current interactive mode does expose JSON as an output format
- this follow-up should add narrow `.json` input support instead of treating JSON output as the only JSON surface

## Scope

### Shared stack input formats

- add `json` as a stack input format alongside the existing `csv`, `tsv`, and `jsonl` values
- keep `.json` discovery extension-based and explicit through `--input-format json` when needed
- keep mixed normalized input formats rejected; do not stack CSV, TSV, JSONL, and JSON together in one run
- expose the same structured JSON contract to direct CLI and interactive mode

### Shared schema mode

- keep strict schema matching as the default for all formats
- add `--union-by-name` as an explicit direct CLI flag
- add `--exclude-columns <name,name,...>` as an explicit direct CLI option for union-by-name runs
- when `--union-by-name` is present:
  - build the output schema from the union of all header names or JSON object keys
  - preserve the first source's header/key order first
  - append newly discovered names in first-seen order as later files or rows introduce them
  - remove names listed in `--exclude-columns` after the union is built
  - fill missing values with the stack materializer's empty-value policy
- keep exclusions deterministic:
  - only exact name matches are supported in this follow-up
  - wildcard, regex, type-based, sparseness-based, and Codex-suggested exclusions are deferred
  - unknown exclusion names are rejected after source discovery so typos are visible
- support `--union-by-name` for:
  - CSV and TSV inputs with header rows
  - `jsonl` object rows
  - `.json` top-level arrays of objects
- reject `--union-by-name` with `--no-header` in this follow-up because generated `column_<n>` names do not represent a stable user-authored schema
- reject `--exclude-columns` unless `--union-by-name` is present in this follow-up
- keep mixed normalized input formats rejected even when `--union-by-name` is present
- keep provenance columns, nested JSON flattening, and Codex-assisted schema suggestions out of this first schema-flex slice
- keep basic schema disclosure in scope:
  - report schema mode
  - report included output column/key count
  - report excluded column/key count and bounded names when exclusions are present

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
- support strict `jsonl` input
- support strict `json` input as one top-level array of row objects

### Structured JSON input contract

- `jsonl`:
  - one JSON object per line
  - no scalar rows
  - no array rows
- `json`:
  - one top-level array
  - every array item must be a JSON object
  - top-level objects, scalar arrays, nested table discovery, and flattening are out of scope
- both structured JSON input formats:
  - reject empty inputs
  - require the same key set across rows in the first supported slice
  - keep key-mismatch widening deferred to an explicit schema-flex mode such as `--union-by-name`
  - may write to `.csv`, `.tsv`, or `.json` outputs through the existing stack materialization path

### Interactive output formats

- preserve the current interactive output choices:
  - `csv`
  - `tsv`
  - `json`
- keep `.json` output semantics aligned with direct CLI behavior: one JSON array of row objects
- do not treat JSON output support as arbitrary `.json` input support

### Review and write flow

- keep one explicit matched-source review before write
- show a clear normalized source summary after mixed-source routing
- show whether strict matching or union-by-name mode will be used
- show explicit excluded columns/keys when exclusions are configured
- preserve current output-format and destination selection flow
- preserve current default-output-path behavior for single-source interactive runs
- require a custom output destination for mixed-source interactive runs until a less arbitrary primary-label rule is designed

### Default output path

- keep the existing default-output rule when the interactive run has exactly one raw source:
  - derive the sibling output path from that source path
  - keep the stack-specific suffix aligned with the selected output format:
    - `.stack.csv`
    - `.stack.tsv`
    - `.stack.json`
- when the interactive run has two or more raw sources, skip the default-output shortcut and ask for a custom output path
- keep direct CLI behavior unchanged:
  - direct CLI continues to require `--output <path>`
  - direct CLI does not gain implicit output naming in this follow-up

## Non-Goals

- changing direct CLI `data stack` source routing
- provenance columns such as `--add-source-column <name>`
- replayable stack records or replay commands
- Codex-assisted stack diagnostics
- Codex-assisted schema exclude or repair suggestions
- arbitrary JSON shape inference beyond the supported top-level array-of-objects contract
- wildcard, regex, type-based, or sparseness-based exclusion matching
- nested JSON flattening

## Risks and Mitigations

- Risk: interactive mode drifts from direct CLI source semantics.
  Mitigation: make interactive wrap the same normalization contract already used by `src/cli/data-stack/input-router.ts`.

- Risk: source selection becomes too wizard-heavy.
  Mitigation: keep source selection focused on adding sources and reviewing the normalized file list, and expose schema behavior through one separate strict-versus-union choice.

- Risk: `--union-by-name` hides accidental schema drift.
  Mitigation: keep strict matching as the default, require an explicit CLI flag or interactive opt-in, and show the selected schema mode in the review checkpoint.

- Risk: explicit exclusions hide useful data.
  Mitigation: require exact user-provided names, reject unknown exclusions, and disclose excluded names/counts in direct CLI stderr and interactive review.

- Risk: `jsonl` interactive support reopens arbitrary JSON ambiguity.
  Mitigation: keep interactive `jsonl` aligned with the current direct CLI contract: one object per line, strict same-key behavior first.

- Risk: `.json` input support becomes too broad.
  Mitigation: support only one top-level array of objects in this follow-up; reject top-level objects, scalar arrays, and nested inference.

- Risk: JSON output support is mistaken for JSON input support.
  Mitigation: document and test both surfaces separately: interactive output keeps `json`, while input widening adds strict `jsonl` and strict array-of-objects `json`.

- Risk: mixed-source default output naming becomes arbitrary.
  Mitigation: keep derived defaults only for single-source runs and require a custom output path when the interactive source list contains more than one raw source.

## Implementation Touchpoints

- `src/cli/data-stack/types.ts`
- `src/cli/data-stack/formats.ts`
- structured JSON parsing helpers under `src/cli/data-stack/`
- `src/cli/commands/data/stack.ts`
- `src/cli/interactive/data/stack.ts`
- `src/cli/data-stack/input-router.ts`
- `src/cli/data-stack/rows.ts`
- `test/cli-actions-data-stack.test.ts`
- `test/cli-command-data-stack.test.ts`
- shared interactive path/source prompts under `src/cli/interactive/`
- `test/cli-interactive-routing.test.ts`
- `docs/guides/data-stack-usage.md`

## Phase Checklist

### Phase 1: Freeze the widened interactive contract

- [ ] freeze the interactive source-entry model for files, directories, or both together
- [ ] freeze how directory-specific options such as pattern and traversal apply inside mixed-source interactive runs
- [ ] freeze the normalized-source review layout for mixed-source interactive runs
- [ ] freeze the structured JSON input contract:
  - `jsonl` means one JSON object per line
  - `json` means one top-level array of objects
  - both require strict same-key behavior first
- [ ] freeze direct CLI and interactive mode as sharing the same structured JSON parser and validation behavior
- [ ] freeze `--union-by-name` as opt-in:
  - strict matching remains default
  - first source order wins
  - newly discovered names append in first-seen order
  - explicit exclusions are removed after union construction
  - missing values use the stack materializer's empty-value policy
  - headerless mode is rejected for this first schema-flex slice
- [ ] freeze explicit exclusion behavior:
  - `--exclude-columns <name,name,...>` is accepted only with `--union-by-name`
  - exact matches only
  - unknown names are rejected
  - exclusion disclosure is required in direct CLI stderr and interactive review
- [ ] freeze default-output behavior for widened source lists:
  - single raw source keeps the current derived `.stack.<format>` default
  - multiple raw sources require a custom output path

### Phase 2: Implement mixed-source interactive selection

- [ ] add interactive prompts to collect one or more raw sources
- [ ] route those raw sources through the existing stack normalization contract
- [ ] review the normalized source summary before write
- [ ] keep pattern and traversal prompts global, matching the direct CLI rule that they apply only to directory-expanded candidates
- [ ] preserve JSON output as a write option while changing the source-selection flow
- [ ] add an interactive schema-mode prompt with strict matching as the default and union-by-name as an explicit opt-in
- [ ] add an interactive explicit-exclusion prompt only when union-by-name is selected
- [ ] include the selected schema mode in the final review checkpoint
- [ ] include excluded column/key names and counts in the final review checkpoint
- [ ] add focused interactive routing coverage for mixed file/directory selection

### Phase 3: Add structured JSON input

- [ ] add `json` to the shared stack input-format model
- [ ] add direct CLI `json` input support for top-level arrays of objects
- [ ] add interactive `jsonl` input support where it is still missing from interactive mode
- [ ] add interactive `json` input support for top-level arrays of objects
- [ ] keep strict same-key behavior aligned across direct CLI and interactive mode
- [ ] add direct CLI coverage for `.json` discovery, `--input-format json`, strict same-key validation, and unsupported JSON shapes
- [ ] add focused coverage for `jsonl` input selection and validation flow
- [ ] add focused coverage for `json` input selection and validation flow
- [ ] add rejection coverage for unsupported JSON shapes

### Phase 4: Add opt-in union-by-name

- [ ] add direct CLI `--union-by-name`
- [ ] add direct CLI `--exclude-columns <name,name,...>`
- [ ] apply union-by-name to CSV and TSV headers
- [ ] apply union-by-name to `jsonl` object keys
- [ ] apply union-by-name to `.json` array-of-object keys
- [ ] apply exact-name exclusions after union construction
- [ ] reject unknown exclusions
- [ ] reject `--exclude-columns` unless `--union-by-name` is present
- [ ] reject `--union-by-name` with `--no-header`
- [ ] keep mixed normalized input formats rejected even with `--union-by-name`
- [ ] disclose schema mode, included output count, and excluded names/counts in direct CLI stderr
- [ ] use bounded disclosure for long exclusion lists
- [ ] add focused direct CLI coverage for column/key order, missing-value behavior, strict-default failures, exclusions, and disclosure
- [ ] add focused interactive coverage for selecting union-by-name, entering exclusions, and reviewing the selected schema mode plus exclusions

### Phase 5: Docs and final alignment

- [ ] update `docs/guides/data-stack-usage.md` so the interactive section matches the widened flow
- [ ] update any data-command guide wording that still describes interactive stack as directory-only
- [ ] keep guide wording explicit that JSON output and JSON input are separate supported surfaces
- [ ] document the narrow `.json` input contract and unsupported JSON shapes
- [ ] document `--union-by-name` and `--exclude-columns` as opt-in deterministic schema-flex controls and keep strict matching documented as the default
- [ ] document replayable stack records and Codex-assisted schema suggestions as deferred to separate future work, not part of this implementation session
- [ ] document the single-source default-output rule and mixed-source custom-output requirement
- [ ] add a job record when implementation lands

## Related Research

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`

## Related Plans

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-04-23-data-stack-phase-1-2-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-3-5-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-6-8-implementation.md`
