---
title: "Data stack interactive mixed-source follow-up"
created-date: 2026-04-23
modified-date: 2026-04-24
status: completed
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

At the time this follow-up was drafted, it also left JSON wording ambiguous:

- interactive mode already supported JSON output
- direct CLI already supported `.json` output
- neither direct CLI nor interactive mode supported `.json` input yet

This follow-up should be handled in its own plan because the base `data stack` plan is already complete and this work is a widening/refinement pass rather than initial bring-up.

## Starting State

At plan start, interactive `data -> stack` supported:

- one directory only
- `csv` or `tsv` input selection
- pattern filtering
- shallow or recursive traversal
- output formats:
  - `csv`
  - `tsv`
  - `json`
- default or custom output destination

At plan start, direct CLI `data stack` already supported more:

- one or more raw `<source...>` arguments
- explicit files, directories, or both together
- strict `jsonl`

Starting clarification:

- interactive mode did not expose `jsonl` input selection
- interactive mode did not expose `json` input selection
- interactive mode did expose JSON as an output format
- this follow-up should add narrow `.json` input support instead of treating JSON output as the only JSON surface

## Completion State

This plan is completed. The current implementation now supports:

- direct CLI `.json` input as one top-level array of row objects
- interactive mixed file/directory source entry
- interactive `csv`, `tsv`, `json`, and `jsonl` input selection
- strict schema matching as the default
- opt-in direct CLI `--union-by-name`
- opt-in direct CLI `--exclude-columns <name,name,...>` with exact-name validation
- interactive union-by-name schema mode and optional exact exclusions
- schema-mode and exclusion disclosure in direct CLI stderr and interactive review
- generated interactive default output names rooted at the current working directory
- public guide wording for JSON input/output separation, schema-flex controls, generated defaults, and deferred replay/Codex-assist work

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
- replace source-derived default output paths with generated stack artifact names
- keep custom output destination available for users who want a source-specific name or location

### Default output path

- use a generated artifact-style default output path for interactive runs:
  - `data-stack-<timestamp>-<uid>.csv`
  - `data-stack-<timestamp>-<uid>.tsv`
  - `data-stack-<timestamp>-<uid>.json`
- derive the default path from the current working directory rather than a raw source path
- use the same naming rule for one raw source, multiple explicit files, multiple directories, and mixed file/directory source lists
- do not derive a default output path from source stems or normalized matched files
- do not silently overwrite a generated default path:
  - the timestamp and uid should make collisions rare
  - if the generated path already exists, the interactive destination flow must treat it like any other existing output path and ask before overwrite
  - when overwrite is declined, the user must be able to choose a custom path or return to destination selection for a newly generated default candidate
- keep direct CLI behavior unchanged:
  - direct CLI continues to require `--output <path>`
  - direct CLI does not gain implicit output naming in this follow-up

## Frozen Phase 1 Contract

Phase 1 freezes the implementation contract below. Later phases should treat this section as the source of truth unless a follow-up doc explicitly revises it.

### Interactive source entry

- interactive `data stack` collects a raw source list, not one directory
- the raw source list accepts files, directories, or both together
- each entered source is kept as a raw source and then passed through the shared stack source normalizer
- per-source input-format, pattern, traversal, or schema options are out of scope for this follow-up
- source normalization owns file-vs-directory detection and deterministic matched-file ordering
- duplicate matched files are suppressed by the shared source normalizer
- duplicate detection uses the exact normalized path string emitted by the router; the first occurrence wins

### Directory options in mixed-source runs

- pattern and traversal prompts are global run options
- pattern filtering applies only to candidates expanded from directory sources
- traversal options apply only to directory sources
- explicit file sources are included directly and are not filtered out by the directory pattern
- recursive traversal and max-depth behavior should remain aligned with the existing direct CLI source router
- max-depth is valid only when recursive traversal is enabled
- interactive mode should only ask for max-depth after recursive traversal is selected

### Normalized-source review

The interactive review checkpoint must show enough information for the user to understand what will be stacked before writing:

- raw source count and matched file count
- selected input format
- selected pattern and traversal mode when directory sources are present
- normalized matched files in deterministic order, using bounded display if the list is long
- selected schema mode, either strict or union-by-name
- excluded column/key names and excluded count when exclusions are configured

### Structured JSON input

- `jsonl` input means one JSON object per non-empty line
- `json` input means one top-level JSON array whose items are all JSON objects
- scalar rows, array rows, top-level objects, scalar arrays, nested table discovery, and flattening are rejected
- empty structured JSON inputs are rejected
- strict matching remains the default: all rows across all matched structured JSON sources must share the same key set
- direct CLI and interactive mode must call the same structured JSON parser and validation path

### Union-by-name schema mode

- strict schema matching remains the default in direct CLI and interactive mode
- `--union-by-name` is opt-in for direct CLI
- interactive mode exposes union-by-name as an explicit opt-in schema-mode choice
- the first source's column/key order wins
- newly discovered names append in first-seen order as later files or rows introduce them
- explicit exclusions are removed after union construction
- missing values use the stack materializer's existing empty-value policy
- headerless mode is rejected with union-by-name in this follow-up
- mixed normalized input formats remain rejected even when union-by-name is enabled

### Explicit exclusions

- direct CLI accepts `--exclude-columns <name,name,...>` only with `--union-by-name`
- interactive mode asks for exclusions only when union-by-name is selected
- exclusions use exact column/key-name matches only
- exclusions are validated after source discovery and union construction
- unknown exclusion names are rejected so typos are visible
- direct CLI stderr and interactive review must disclose the excluded count and bounded excluded names when exclusions are present

### Default output behavior

- interactive default output uses generated stack artifact naming: `data-stack-<timestamp>-<uid>.<format>`
- interactive default output is rooted at the current working directory, not beside any raw source
- the generated default applies equally to single-source and multi-source interactive runs
- generated defaults are collision-resistant but still go through the existing overwrite confirmation if the target already exists
- declining overwrite should keep the destination flow recoverable through a custom path or a newly generated default candidate
- custom output remains available when the user wants a source-specific or directory-local path
- direct CLI keeps requiring `--output <path>` and does not gain implicit output naming

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

- Risk: source-derived default output naming becomes arbitrary for mixed-source runs.
  Mitigation: use generated artifact naming for every interactive stack default and keep source-specific names behind the custom-output path.

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

- [x] freeze the interactive source-entry model for files, directories, or both together
- [x] freeze how directory-specific options such as pattern and traversal apply inside mixed-source interactive runs
- [x] freeze the normalized-source review layout for mixed-source interactive runs
- [x] freeze the structured JSON input contract:
  - `jsonl` means one JSON object per line
  - `json` means one top-level array of objects
  - both require strict same-key behavior first
- [x] freeze direct CLI and interactive mode as sharing the same structured JSON parser and validation behavior
- [x] freeze `--union-by-name` as opt-in:
  - strict matching remains default
  - first source order wins
  - newly discovered names append in first-seen order
  - explicit exclusions are removed after union construction
  - missing values use the stack materializer's empty-value policy
  - headerless mode is rejected for this first schema-flex slice
- [x] freeze explicit exclusion behavior:
  - `--exclude-columns <name,name,...>` is accepted only with `--union-by-name`
  - exact matches only
  - unknown names are rejected
  - exclusion disclosure is required in direct CLI stderr and interactive review
- [x] freeze default-output behavior for widened source lists:
  - interactive defaults use generated `data-stack-<timestamp>-<uid>.<format>` artifact names
  - generated defaults apply to single-source and multi-source interactive runs
  - direct CLI keeps requiring `--output <path>`

### Phase 2: Implement mixed-source interactive selection

- [x] add interactive prompts to collect one or more raw sources
- [x] route those raw sources through the existing stack normalization contract
- [x] review the normalized source summary before write
- [x] keep pattern and traversal prompts global, matching the direct CLI rule that they apply only to directory-expanded candidates
- [x] preserve JSON output as a write option while changing the source-selection flow
- [x] add an interactive schema-mode prompt with strict matching as the default and union-by-name as an explicit opt-in
- [x] add an interactive explicit-exclusion prompt only when union-by-name is selected
- [x] include the selected schema mode in the final review checkpoint
- [x] include excluded column/key names and counts in the final review checkpoint
- [x] add focused interactive routing coverage for mixed file/directory selection

### Phase 3: Add structured JSON input

- [x] add `json` to the shared stack input-format model
- [x] add direct CLI `json` input support for top-level arrays of objects
- [x] add interactive `jsonl` input support where it is still missing from interactive mode
- [x] add interactive `json` input support for top-level arrays of objects
- [x] keep strict same-key behavior aligned across direct CLI and interactive mode
- [x] add direct CLI coverage for `.json` discovery, `--input-format json`, strict same-key validation, and unsupported JSON shapes
- [x] add focused coverage for `jsonl` input selection and validation flow
- [x] add focused coverage for `json` input selection and validation flow
- [x] add rejection coverage for unsupported JSON shapes

### Phase 4: Add opt-in union-by-name

- [x] add direct CLI `--union-by-name`
- [x] add direct CLI `--exclude-columns <name,name,...>`
- [x] apply union-by-name to CSV and TSV headers
- [x] apply union-by-name to `jsonl` object keys
- [x] apply union-by-name to `.json` array-of-object keys
- [x] apply exact-name exclusions after union construction
- [x] reject unknown exclusions
- [x] reject `--exclude-columns` unless `--union-by-name` is present
- [x] reject `--union-by-name` with `--no-header`
- [x] keep mixed normalized input formats rejected even with `--union-by-name`
- [x] disclose schema mode, included output count, and excluded names/counts in direct CLI stderr
- [x] use bounded disclosure for long exclusion lists
- [x] add focused direct CLI coverage for column/key order, missing-value behavior, strict-default failures, exclusions, and disclosure
- [x] add focused interactive coverage for selecting union-by-name, entering exclusions, and reviewing the selected schema mode plus exclusions
- [x] replace interactive source-derived default output paths with generated `data-stack-<timestamp>-<uid>.<format>` defaults
- [x] apply the generated default output naming to single-source and multi-source interactive stack runs
- [x] keep the generated default output rooted at the current working directory
- [x] preserve overwrite confirmation if a generated default output path already exists
- [x] keep declined-overwrite recovery ergonomic by allowing a custom path or newly generated default candidate
- [x] preserve custom output selection for source-specific or directory-local output paths
- [x] update interactive default-output tests so they no longer expect source-adjacent `.stack.<format>` paths

### Phase 5: Docs and final alignment

- [x] update `docs/guides/data-stack-usage.md` so the interactive section matches the widened flow
- [x] update any data-command guide wording that still describes interactive stack as directory-only
- [x] keep guide wording explicit that JSON output and JSON input are separate supported surfaces
- [x] document the narrow `.json` input contract and unsupported JSON shapes
- [x] document `--union-by-name` and `--exclude-columns` as opt-in deterministic schema-flex controls and keep strict matching documented as the default
- [x] document replayable stack records and Codex-assisted schema suggestions as deferred to separate future work, not part of this implementation session
- [x] document generated interactive default-output naming and direct CLI explicit-output behavior
- [x] add a job record when implementation lands

## Related Research

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`

## Related Plans

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-04-23-data-stack-phase-1-2-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-3-5-implementation.md`
- `docs/plans/jobs/2026-04-23-data-stack-phase-6-8-implementation.md`
- `docs/plans/jobs/2026-04-24-data-stack-generated-default-output.md`
- `docs/plans/jobs/2026-04-24-data-stack-interactive-followup-docs-closeout.md`
