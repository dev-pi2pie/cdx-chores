---
title: "Data stack replay and Codex assist implementation"
created-date: 2026-04-25
status: draft
agent: codex
---

## Goal

Implement the next `data stack` development stage: replayable dry-run stack plans, deterministic duplicate/key diagnostics, reviewed Codex recommendations, and an interactive status-preview flow that can write, save, revise, or cancel without hiding execution state.

The implementation must keep one clear boundary:

- `data stack` and `data stack replay <record>` execute deterministic stack plans
- Codex assist proposes reviewed changes from deterministic diagnostics
- accepted Codex suggestions become explicit stack-plan fields before replay

## Why This Plan

The research now resolves the product contract for stack replay and Codex schema assist. It chooses:

- `data stack replay <record>` as the replay command
- JSON stack-plan artifacts as deterministic execution input
- direct `--dry-run` as a plan-authoring path
- duplicate/key diagnostics and policy controls in this implementation stage
- Codex reports as advisory artifacts linked to deterministic payload ids
- interactive status preview before any materialized output write

This plan turns those decisions into implementable phases without reopening earlier `data stack` work.

## Starting State

Current `data stack` already supports:

- direct CLI mixed file/directory sources
- CSV, TSV, JSONL, and narrow `.json` array input
- strict schema matching by default
- opt-in `--union-by-name`
- exact `--exclude-columns <name,name,...>` with union-by-name
- direct output to `.csv`, `.tsv`, or `.json`
- interactive mixed-source setup with generated default output paths
- one review checkpoint before writing output

Current code has useful seams for this work:

- `prepareDataStackExecution` already resolves sources, validates schema mode, and builds rows/header without writing output
- `writePreparedDataStackOutput` owns materialization
- interactive `data stack` already loops through setup, destination, review, and write decisions

Missing pieces:

- `--dry-run`
- stack-plan read/write helpers
- `data stack replay <record>`
- duplicate/key diagnostics
- `--unique-by`
- `--on-duplicate preserve|report|reject`
- replay fingerprint warnings
- plan retention and auto-clean prompts
- Codex report artifacts and recommendation application

## Scope

### Replayable stack plans

- define the v1 JSON stack-plan schema
- generate `data-stack-plan-<timestamp>Z-<uid>.json`
- include required top-level keys:
  - `version`
  - `metadata`
  - `command`
  - `sources`
  - `input`
  - `schema`
  - `duplicates`
  - `output`
  - `diagnostics`
- include `metadata.artifactId`, `metadata.payloadId`, `metadata.derivedFromPayloadId`, `metadata.acceptedRecommendationIds`, `metadata.recommendationDecisions`, and `metadata.issuedAt`
- store source fingerprints with size and mtime when available
- treat `schema` as the accepted stack output column/key contract, not a database schema
- require `input.columns` for headerless CSV/TSV replay

### Dry-run

- add direct `data stack --dry-run`
- allow `--plan-output <path>`
- write a generated stack plan by default when `--plan-output` is omitted
- keep direct v1 dry-run using `--output` to capture the intended output path and format; replay may override the output path later
- run real preparation and diagnostics
- skip materialized output writing
- show a concise source/schema/duplicate/key/output status summary
- preserve direct CLI scriptability

### Replay

- add `data stack replay <record>`
- validate the stack-plan artifact before execution
- reject non-stack-plan JSON
- reject unsupported artifact versions
- warn on source fingerprint drift by default
- allow `--output <path>` override
- require an output path at replay time if the plan omits `output.path`
- support explicit `--auto-clean` that removes only the stack-plan JSON after successful replay
- keep replay independent from Codex availability

### Duplicate and unique-key controls

- add `--unique-by <name[,name...]>`
- add `--on-duplicate preserve|report|reject`
- preserve rows by default
- detect exact duplicate rows after output normalization
- detect duplicate-key conflicts when `uniqueBy` is selected
- detect single-column candidate keys by default
- detect bounded two-column candidate keys under a documented cap
- persist selected duplicate policy and unique-key columns in the stack plan
- keep `keep-first` and `keep-last` out of v1

Duplicate policy execution rules:

- exact duplicate rows compare every normalized output column or key
- unique-key conflicts compare only the selected `--unique-by` columns
- when `--unique-by` is omitted, duplicate diagnostics use exact-row mode only
- `preserve` writes all rows and records bounded diagnostics
- `report` writes all rows and records duplicate findings in the stack plan or advisory report
- `reject` fails before materialized output is written when duplicates are found for the relevant mode
- replay must enforce the stored duplicate policy the same way as direct execution

### Interactive flow

- prepare a deterministic status preview before any write
- show matched source, schema, row count, duplicate/key, output, and Codex recommendation status
- offer:
  - write now
  - dry-run plan only
  - revise setup
  - cancel
- execute accepted setup through a concrete stack plan
- dry-run plan only writes the stack-plan artifact and never writes materialized output
- dry-run plan only asks whether to keep the generated stack plan, with default `Yes`
- after successful write, ask whether to keep the applied stack plan
- auto-clean only the stack-plan artifact when the user declines keeping it
- ask separately whether to keep Codex or diagnostic reports
- keep all generated artifacts if execution fails

### Codex assist

- build deterministic fact payloads before Codex is called
- add direct `--codex-assist` as an advisory dry-run companion, valid only with `--dry-run` in v1
- allow `--codex-report-output <path>` when `--codex-assist` is used
- make direct `--codex-assist` report-generation only; it must stop without applying recommendations
- support advisory recommendations for:
  - headerless CSV/TSV column names
  - noisy union columns or keys to exclude
  - unique-key selection
  - duplicate policy selection
  - schema drift explanation
- write `data-stack-codex-report-<timestamp>Z-<uid>.json`
- link reports to the analyzed stack plan through `metadata.payloadId`
- represent recommendations as stable ids plus JSON Pointer style `replace` patches
- validate recommendation patches atomically before applying them
- create a new stack-plan `payloadId` after accepted or edited recommendations
- record exact accepts and edited accepts in `recommendationDecisions`
- write or replay only the updated deterministic stack plan, not the advisory report
- never replay advisory reports directly

## Non-Goals

- automatic schema repair
- automatic row repair
- silent deduplication
- `keep-first` or `keep-last` duplicate policies
- arbitrary JSON flattening
- schema-aware query workspace redesign
- a generic `data replay` command
- making Codex required for stack replay

## Implementation Touchpoints

- `src/cli/commands/data/stack.ts`
- `src/cli/actions/data-stack.ts`
- `src/cli/data-stack/prepare.ts`
- `src/cli/data-stack/materialize.ts`
- `src/cli/data-stack/types.ts`
- new `src/cli/data-stack/plan.ts`
- new `src/cli/data-stack/replay.ts`
- new `src/cli/data-stack/diagnostics.ts`
- new `src/cli/data-stack/codex-assist.ts`
- new `src/cli/data-stack/codex-report.ts`
- new `src/cli/actions/data-stack-replay.ts`
- `src/cli/interactive/data/stack.ts`
- Codex adapter usage aligned with existing query/extract/rename Codex helpers
- tests under `test/`
- `docs/guides/data-stack-usage.md`

## Phase Checklist

### Phase 1: Freeze and implement stack-plan artifacts

- [ ] define stack-plan TypeScript types and validation helpers
- [ ] define artifact id and payload id generation helpers
- [ ] define JSON serialization with stable field ordering
- [ ] define stack-plan parse errors for invalid JSON, wrong artifact type, and unsupported versions
- [ ] persist source raw paths, resolved files, traversal settings, input format, header mode, schema mode, exclusions, output format, output path, overwrite intent, duplicate policy, unique key, diagnostics, and fingerprints
- [ ] add artifact read/write unit tests
- [ ] add fixture-style tests for v1 valid and invalid stack-plan JSON

### Phase 2: Add deterministic diagnostics

- [ ] compute exact duplicate-row counts from normalized output rows
- [ ] compute duplicate-key conflicts when `uniqueBy` is selected
- [ ] compute single-column candidate unique keys
- [ ] compute bounded two-column candidate unique keys
- [ ] compute headerless column samples, null counts, uniqueness summaries, and enum-like value summaries for Codex assist
- [ ] keep diagnostics bounded so large inputs do not create huge artifacts
- [ ] add tests for duplicate rows, duplicate key conflicts, null-key handling, candidate keys, and bounded examples

### Phase 3: Add direct dry-run and duplicate controls

- [ ] add `--dry-run`
- [ ] add `--plan-output <path>`
- [ ] add `--unique-by <name[,name...]>`
- [ ] add `--on-duplicate preserve|report|reject`
- [ ] validate `--unique-by` names against the accepted output schema
- [ ] reject unknown duplicate policies
- [ ] enforce `reject` failures before writing materialized output
- [ ] keep `--output` required for direct dry-run in v1 so output format and default replay destination stay deterministic
- [ ] make dry-run prepare diagnostics and write a stack plan without writing stack output
- [ ] render a concise dry-run summary to stderr
- [ ] add direct CLI tests for dry-run, generated plan paths, custom plan output, duplicate controls, and reject behavior

### Phase 4: Add replay command

- [ ] register `data stack replay <record>`
- [ ] read and validate stack-plan JSON
- [ ] replay the accepted resolved source list and deterministic options
- [ ] warn on size or mtime fingerprint drift by default
- [ ] support `--output <path>` override
- [ ] fail clearly when no output path is available
- [ ] preserve `output.overwrite` semantics
- [ ] enforce the stored duplicate policy during replay
- [ ] support explicit `--auto-clean` after successful replay
- [ ] ensure auto-clean removes only the stack-plan JSON
- [ ] add replay tests for valid records, invalid records, output override, missing output path, fingerprint warning, duplicate policy, and auto-clean

### Phase 5: Rework interactive stack around status preview

- [ ] create one prepared stack-plan object before the write boundary
- [ ] render source, schema, row-count, duplicate/key, output, and artifact summaries
- [ ] offer write now, dry-run plan only, revise setup, and cancel
- [ ] write dry-run plans from interactive mode with generated default path first and custom destination available
- [ ] ensure dry-run plan only writes no materialized output
- [ ] prompt to keep the dry-run stack plan with default `Yes`
- [ ] ask whether to keep the applied stack plan after successful write
- [ ] auto-clean only the stack-plan artifact when the user declines keeping it
- [ ] keep all artifacts when execution fails
- [ ] ask diagnostic/advisory report retention separately
- [ ] add interactive tests for dry-run-only, write-now keep-plan, write-now clean-plan, revise, cancel, and failure-retention paths

### Phase 6: Add Codex advisory reports

- [ ] add direct `--codex-assist`
- [ ] add `--codex-report-output <path>`
- [ ] require `--dry-run` when `--codex-assist` is used
- [ ] make direct `--codex-assist` report-generation only and prevent direct recommendation application
- [ ] define Codex report TypeScript types and validation helpers
- [ ] build deterministic fact payloads from stack diagnostics
- [ ] add report writer for `data-stack-codex-report-<timestamp>Z-<uid>.json`
- [ ] add recommendation id and JSON Pointer style patch validation
- [ ] support only `replace` patches against known stack-plan fields in v1
- [ ] reject conflicting recommendation batches
- [ ] apply accepted recommendations into a new stack plan with a new payload id
- [ ] apply edited recommendations into deterministic plan fields and record `decision: "edited"`
- [ ] keep advisory reports out of replay execution
- [ ] add tests for direct assist flag validation, report writing, patch validation, accept/edit lineage, conflicting patches, and replay isolation

### Phase 7: Wire reviewed Codex assist into interactive mode

- [ ] ask whether to request Codex recommendations after deterministic status preview
- [ ] surface recommendations for headerless columns, exclusions, unique keys, duplicate policy, and schema drift
- [ ] support accept, edit, skip, and cancel review outcomes
- [ ] treat Codex output as advisory until the user accepts or edits recommendations
- [ ] create a new deterministic stack plan with a new `payloadId` after accepted or edited recommendations
- [ ] show accepted deterministic changes before write or plan save
- [ ] re-run status preview before write or plan save after any accepted or edited recommendation
- [ ] keep Codex failures isolated to assist mode and preserve the deterministic stack setup
- [ ] add tests using deterministic Codex runners or stubs

### Phase 8: Documentation and closure

- [ ] update `docs/guides/data-stack-usage.md` with dry-run, replay, duplicate policy, and Codex assist usage
- [ ] add examples for `data stack --dry-run`, `data stack replay <record>`, `--unique-by`, and `--on-duplicate`
- [ ] document artifact retention and auto-clean behavior
- [ ] document that Codex reports are advisory and payload-linked
- [ ] update related research status only after implementation evidence and job records exist
- [ ] create job records for completed implementation slices
- [ ] run focused tests and record verification commands

## Acceptance Criteria

- direct `data stack --dry-run` writes a replayable JSON stack plan and does not write materialized output
- `data stack replay <record>` can execute the reviewed plan without Codex
- duplicate diagnostics are visible in dry-run and interactive status preview
- `--unique-by` and `--on-duplicate preserve|report|reject` are deterministic, tested, and persisted
- duplicate policy behavior is enforced the same way in direct execution and replay
- interactive mode offers write now, dry-run only, revise, and cancel from one status preview
- interactive dry-run only writes no materialized output and defaults to keeping the generated stack plan
- auto-clean is scoped to stack-plan artifacts and runs only after successful execution
- Codex recommendations are review-only and become deterministic stack-plan fields only after accept or edit
- accepted or edited Codex recommendations create a new stack-plan `payloadId` before write or replay
- Codex advisory reports are never replayed directly
- public guide docs explain the new workflow without duplicating the full JSON schema

## Risks and Mitigations

- Risk: stack-plan JSON becomes both executable contract and oversized diagnostic dump.
  Mitigation: keep bounded diagnostics in the plan and put detailed advisory evidence in separate reports.

- Risk: replay uses stale sources after input files changed.
  Mitigation: store size and mtime fingerprints in v1 and warn on mismatch before execution.

- Risk: duplicate handling silently changes output cardinality.
  Mitigation: ship only `preserve`, `report`, and `reject` in v1.

- Risk: Codex suggestions blur into automatic repair.
  Mitigation: accept or edit recommendations into explicit plan fields before any write or replay.

- Risk: interactive auto-clean removes evidence users need later.
  Mitigation: prompt separately for execution stack plans and advisory reports.

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

## Related Plans

- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
