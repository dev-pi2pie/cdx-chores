---
title: "Data stack replay and Codex assist implementation"
created-date: 2026-04-25
modified-date: 2026-04-26
status: in-progress
agent: codex
---

## Goal

Implement the next `data stack` development stage: replayable dry-run stack plans, deterministic duplicate/key diagnostics, reviewed Codex recommendations, and an interactive status-preview flow that can write, save, revise, or cancel without hiding execution state.

The deterministic stack/replay/Codex-assist foundation is implemented through Phase 11. The plan remains active for a Phase 12 interactive workflow cleanup because the current interactive mode still explains dry-run too late, makes pattern selection feel too manual, and should align more closely with the source-shape review used by `data extract`.

The implementation must keep one clear boundary:

- `data stack` and `data stack replay <record>` execute deterministic stack plans
- Codex assist proposes reviewed changes from deterministic diagnostics
- accepted Codex suggestions become explicit stack-plan fields before replay

## Why This Plan

The research records the current product-contract direction for stack replay and Codex schema assist. This plan uses that direction to implement the work in auditable phases:

- `data stack replay <record>` as the replay command
- JSON stack-plan artifacts as deterministic execution input
- direct `--dry-run` as a plan-authoring path
- duplicate/key diagnostics and policy controls in this implementation stage
- Codex reports as advisory artifacts linked to deterministic payload ids
- interactive status preview before any materialized output write

This plan turns those decisions into implementable phases. Earlier deterministic stack work remains closed; the active follow-up is limited to the interactive workflow shape.

## Starting State

Current `data stack` now supports:

- direct CLI mixed file/directory sources
- CSV, TSV, JSONL, and narrow `.json` array input
- strict schema matching by default
- `--schema-mode <strict|union-by-name|auto>`
- `--union-by-name` as a canary compatibility alias from `v0.1.2-canary.2`
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
- define `<record>` as a filesystem path to a stack-plan JSON artifact; replay does not resolve logical artifact ids in v1
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
- new `src/cli/data-stack/diagnostics.ts`
- new `src/cli/data-stack/codex-assist.ts`
- new `src/cli/data-stack/codex-report.ts`
- new `src/cli/actions/data-stack-replay.ts`
- `src/cli/interactive/data/stack.ts`
- Codex adapter usage aligned with existing query/extract/rename Codex helpers
- tests under `test/`
- `docs/guides/data-stack-usage.md`

## Phase Checklist

Status note:

- Phases 1 through 11 are implemented and checked off.
- Phase 10 closed the interactive Codex hardening follow-up.
- Phase 11 closed the schema-mode naming and automatic analysis cleanup.
- Phase 12 is reopened for an extract-shaped interactive workflow cleanup.

### Phase 1: Freeze and implement stack-plan artifacts

- [x] define stack-plan TypeScript types and validation helpers
- [x] define artifact id and payload id generation helpers
- [x] define JSON serialization with stable field ordering
- [x] define stack-plan parse errors for invalid JSON, wrong artifact type, and unsupported versions
- [x] persist source raw paths, resolved files, traversal settings, input format, header mode, schema mode, exclusions, output format, output path, overwrite intent, duplicate policy, unique key, diagnostics, and fingerprints
- [x] add artifact read/write unit tests
- [x] add fixture-style tests for v1 valid and invalid stack-plan JSON

### Phase 2: Add deterministic diagnostics

- [x] compute exact duplicate-row counts from normalized output rows
- [x] compute duplicate-key conflicts when `uniqueBy` is selected
- [x] compute single-column candidate unique keys
- [x] compute bounded two-column candidate unique keys
- [x] compute headerless column samples, null counts, uniqueness summaries, and enum-like value summaries for Codex assist
- [x] keep diagnostics bounded so large inputs do not create huge artifacts
- [x] add tests for duplicate rows, duplicate key conflicts, null-key handling, candidate keys, and bounded examples

### Phase 3: Add direct dry-run and duplicate controls

- [x] add `--dry-run`
- [x] add `--plan-output <path>`
- [x] add `--unique-by <name[,name...]>`
- [x] add `--on-duplicate preserve|report|reject`
- [x] validate `--unique-by` names against the accepted output schema
- [x] reject unknown duplicate policies
- [x] enforce `reject` failures before writing materialized output
- [x] keep `--output` required for direct dry-run in v1 so output format and default replay destination stay deterministic
- [x] make dry-run prepare diagnostics and write a stack plan without writing stack output
- [x] render a concise dry-run summary to stderr
- [x] add direct CLI tests for dry-run, generated plan paths, custom plan output, duplicate controls, and reject behavior

### Phase 4: Add replay command

- [x] register `data stack replay <record>`
- [x] read and validate stack-plan JSON
- [x] replay the accepted resolved source list and deterministic options
- [x] warn on size or mtime fingerprint drift by default
- [x] support `--output <path>` override
- [x] fail clearly when no output path is available
- [x] preserve `output.overwrite` semantics
- [x] enforce the stored duplicate policy during replay
- [x] support explicit `--auto-clean` after successful replay
- [x] ensure auto-clean removes only the stack-plan JSON
- [x] add replay tests for valid records, invalid records, output override, missing output path, fingerprint warning, duplicate policy, and auto-clean

### Phase 5: Rework interactive stack around status preview

- [x] create one prepared stack-plan object before the write boundary
- [x] render source, schema, row-count, duplicate/key, output, and artifact summaries
- [x] offer write now, dry-run plan only, revise setup, and cancel
- [x] keep destination changes as a separate preview action so users can adjust output without repeating source setup
- [x] write dry-run plans from interactive mode with generated default path first and custom destination available
- [x] ensure dry-run plan only writes no materialized output
- [x] prompt to keep the dry-run stack plan with default `Yes`
- [x] ask whether to keep the applied stack plan after successful write
- [x] auto-clean only the stack-plan artifact when the user declines keeping it
- [x] keep all artifacts when execution fails
- [x] ask diagnostic/advisory report retention separately
- [x] add interactive tests for dry-run-only, write-now keep-plan, write-now clean-plan, revise, cancel, and failure-retention paths

### Phase 6: Add Codex advisory reports

- [x] add direct `--codex-assist`
- [x] add `--codex-report-output <path>`
- [x] require `--dry-run` when `--codex-assist` is used
- [x] make direct `--codex-assist` report-generation only and prevent direct recommendation application
- [x] define Codex report TypeScript types and validation helpers
- [x] build deterministic fact payloads from stack diagnostics
- [x] add report writer for `data-stack-codex-report-<timestamp>Z-<uid>.json`
- [x] add recommendation id and JSON Pointer style patch validation
- [x] support only `replace` patches against known stack-plan fields in v1
- [x] reject conflicting recommendation batches
- [x] apply accepted recommendations into a new stack plan with a new payload id
- [x] apply edited recommendations into deterministic plan fields and record `decision: "edited"`
- [x] keep advisory reports out of replay execution
- [x] add tests for direct assist flag validation, report writing, patch validation, accept/edit lineage, conflicting patches, and replay isolation

### Phase 7: Wire reviewed Codex assist into interactive mode

- [x] ask whether to request Codex recommendations after deterministic status preview
- [x] surface recommendations for headerless columns, exclusions, unique keys, duplicate policy, and schema drift
- [x] support accept, edit, skip, and cancel review outcomes
- [x] treat Codex output as advisory until the user accepts or edits recommendations
- [x] create a new deterministic stack plan with a new `payloadId` after accepted or edited recommendations
- [x] show accepted deterministic changes before write or plan save
- [x] re-run status preview before write or plan save after any accepted or edited recommendation
- [x] keep Codex failures isolated to assist mode and preserve the deterministic stack setup
- [x] add tests using deterministic Codex runners or stubs

### Phase 8: Documentation and closure

- [x] update `docs/guides/data-stack-usage.md` with dry-run, replay, duplicate policy, and Codex assist usage
- [x] add examples for `data stack --dry-run`, `data stack replay <record>`, `--unique-by`, and `--on-duplicate`
- [x] document artifact retention and auto-clean behavior
- [x] document that Codex reports are advisory and payload-linked
- [x] update related research status only after implementation evidence and job records exist
- [x] create job records for completed implementation slices
- [x] run focused tests and record verification commands

### Phase 9: Smooth interactive Codex assist trigger

- [x] move interactive Codex assist out of the final `Stack action` menu and into a contextual assist checkpoint before write/save decisions
- [x] only offer Codex assist when deterministic diagnostics show useful signals, such as headerless generated columns, noisy union columns, duplicate rows, candidate unique keys, selected-key conflicts, or schema drift
- [x] render the assist checkpoint as `review with Codex`, `continue without Codex`, `revise setup`, or `cancel`
- [x] preserve the current direct CLI contract where `--codex-assist` remains valid only with `--dry-run`
- [x] keep interactive Codex review advisory and non-materializing; accepted or edited recommendations still become deterministic plan fields before write or dry-run save
- [x] re-run the status preview after accepted or edited recommendations, then show the final action menu with write, dry-run, destination, revise, and cancel only
- [x] avoid prompting for Codex when diagnostics do not indicate a likely benefit
- [x] add interactive tests for signal-triggered assist offers, no-signal skip behavior, continue-without-Codex, accepted recommendation re-preview, and Codex failure fallback
- [x] update the guide after the interactive flow is changed so it no longer describes Codex as a final action-menu peer

### Phase 10: Interactive Codex assist hardening follow-up

- [x] fix the data-stack Codex structured-output schema so `patches[].value` uses an explicit JSON Schema `type` instead of a loose empty schema
- [x] convert raw Codex/provider failures into concise interactive messages that explain the recommendations are unavailable and that deterministic setup is preserved
- [x] stop or clear the interactive analyzer status before printing Codex success or failure output so the status line does not merge with the next message
- [x] add tests for the structured-output schema, sanitized failure copy, and status cleanup ordering around Codex failures
- [x] make large matched-file previews clearer by labeling bounded samples and reporting how many matched files are hidden from the sample
- [x] review whether manually added input sources also need bounded display in interactive stack review
- [x] update the guide and job records after the hardening pass is implemented and verified

### Phase 11: Schema-mode naming and automatic analysis follow-up

- [x] introduce `--schema-mode <strict|union-by-name|auto>` as the explicit schema-mode contract for direct CLI
- [x] decide whether `--union-by-name` should be removed during canary development or kept as a temporary compatibility alias that prints a concise migration warning
- [x] document the canary compatibility note: `--union-by-name` existed in `v0.1.2-canary.2`, and `--schema-mode union-by-name` is the intended replacement surface
- [x] keep direct CLI default behavior fail-closed as `--schema-mode strict`
- [x] make interactive mode default to deterministic automatic schema analysis, with explicit `Strict matching` and `Union by name` choices still available
- [x] define direct CLI `--schema-mode auto` as deterministic analysis first, with interactive Codex assist remaining an optional reviewed checkpoint after diagnostics show useful signals
- [x] ensure `--schema-mode auto` never silently widens ambiguous schemas when Codex assist is unavailable; print concise next-step hints instead
- [x] keep accepted Codex schema recommendations materialized as deterministic stack-plan fields before write, dry-run save, or replay
- [x] update direct CLI, interactive, dry-run, replay, and guide tests for schema-mode naming, default behavior, canary transition handling, and unavailable-Codex fallback copy
- [x] update the research, guide, and job records after the schema-mode follow-up is implemented and verified

### Phase 12: Extract-shaped interactive workflow cleanup

- [ ] revise interactive stack setup so source discovery happens before schema and output decisions, closer to the `data extract` source-shape flow
- [ ] make pattern selection smarter by inferring a useful default, showing a bounded matched-file preview, and offering revise-pattern before schema prompts
- [ ] explain dry-run during source discovery, before schema prompts and before the final action menu, as "save a replayable stack plan without writing output"
- [ ] split the stack review screen into clearer groups: input discovery, schema analysis, duplicate/key diagnostics, output target, and plan action
- [ ] replace the current deterministic auto-analysis label with wording that does not imply Codex, and reserve `Analyze with Codex (powered by Codex)` for Codex-backed reviewed suggestions
- [ ] keep deterministic `--schema-mode auto` wording separate from Codex-powered reviewed suggestions so users do not think direct CLI auto requires Codex
- [ ] align final write/save/revise/cancel prompts with the `data extract` review rhythm while preserving stack-plan retention and replay semantics
- [ ] update the ASCII sketches in the research after the implementation details settle
- [ ] add or update interactive routing tests for source discovery, pattern preview revision, early dry-run explanation, Codex-powered labeling, and final action behavior
- [ ] update `docs/guides/data-stack-usage.md`, this plan, the research doc, and a job record after implementation evidence exists

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
- interactive Codex assist appears as a contextual review checkpoint when diagnostics suggest it can help, not as a peer of final write/save actions
- interactive Codex assist handles provider/schema failures with concise output and clean status-line behavior
- direct schema-mode usage has a single explicit surface, `--schema-mode <strict|union-by-name|auto>`, with strict as the direct CLI default
- interactive schema setup offers deterministic automatic schema analysis while still allowing explicit strict and union-by-name choices
- unavailable Codex assist never causes `--schema-mode auto` to make an ambiguous schema choice silently
- interactive source discovery shows matched-file evidence before schema decisions
- interactive dry-run is explained during source discovery before schema prompts and before the final write/save decision point
- Codex-powered analysis is labeled clearly in interactive mode while deterministic replay remains Codex-independent

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

- Risk: `--schema-mode auto` is mistaken for "always use Codex" or silently changes script output.
  Mitigation: define auto as deterministic-first, keep strict as the direct CLI default, and require reviewed confirmation or a clear diagnostic for ambiguous cases.

- Risk: interactive "auto analysis" wording makes deterministic auto and Codex-powered suggestions sound like the same thing.
  Mitigation: keep deterministic `--schema-mode auto` copy separate from `Analyze with Codex (powered by Codex)` copy in interactive mode.

- Risk: smarter pattern inference hides which files will be stacked.
  Mitigation: always show a bounded matched-file preview and a revise-pattern branch before schema decisions.

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

## Related Plans

- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`

## Related Jobs

- `docs/plans/jobs/2026-04-25-data-stack-plan-artifact-foundation.md`
- `docs/plans/jobs/2026-04-26-data-stack-diagnostics-dry-run-replay.md`
- `docs/plans/jobs/2026-04-26-data-stack-interactive-preview-and-codex-reports.md`
- `docs/plans/jobs/2026-04-26-data-stack-interactive-codex-and-guide-closeout.md`
- `docs/plans/jobs/2026-04-26-data-stack-interactive-codex-checkpoint-closeout.md`
- `docs/plans/jobs/2026-04-26-data-stack-codex-hardening-and-schema-mode.md`
