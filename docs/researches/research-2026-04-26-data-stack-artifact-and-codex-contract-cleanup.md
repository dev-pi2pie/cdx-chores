---
title: "Data stack artifact and Codex contract cleanup"
created-date: 2026-04-26
status: draft
agent: codex
---

## Goal

Re-examine the `data stack` dry-run artifact contract and Codex recommendation patch surface after review findings showed that the implementation can advertise paths or patches that are not executable end to end.

This research should decide whether the current replay/Codex design needs a narrow cleanup plan before more feature work continues.

## Why This Research

The current replay and Codex-assist work added useful primitives:

- stack-plan JSON artifacts
- advisory Codex report artifacts
- `data stack replay <record>`
- direct `--dry-run`
- direct `--codex-assist`
- interactive Codex recommendation review
- accepted/edited recommendation lineage in stack-plan metadata

Two review findings exposed the same deeper issue from different directions:

- artifact paths are not yet governed by one clear lifecycle invariant
- Codex recommendation patches can target plan fields that are accepted by validation but are not actually executable by the preparation/replay pipeline

That means the current branch can create or accept artifacts whose names or fields look valid but do not behave as users would reasonably expect.

## Current Situation

### Artifact paths

Direct dry-run has up to three relevant paths:

- `outputPath`: the intended future materialized `.csv`, `.tsv`, or `.json` stack output
- `planPath`: the stack-plan JSON artifact produced by `--dry-run`
- `codexReportPath`: the advisory Codex report JSON artifact produced by `--codex-assist`

The current follow-up already rejects `planPath === codexReportPath` for direct dry-run with Codex assist, but the design still needs a general rule that keeps path workflows flexible.

Problem examples:

- `--dry-run --plan-output merged.csv --output merged.csv` writes a stack-plan JSON at the same path that the plan records as the future materialized output; this can be a valid consume-and-replace workflow if replay intentionally supports replacing the plan record with output
- `--dry-run --codex-assist --codex-report-output merged.csv --output merged.csv` can be valid only if the later materialization step clearly treats the report as advisory evidence that may be replaced by output
- future interactive or direct artifact additions could repeat this problem unless artifact roles are defined by lifecycle phase instead of one-off path guards

### Codex patch surface

Codex recommendations are represented as replace patches against allowed JSON Pointer-style paths.

Current allowed paths include:

- `/input/columns`
- `/schema/mode`
- `/schema/includedNames`
- `/schema/excludedNames`
- `/duplicates/uniqueBy`
- `/duplicates/policy`

The issue is that plan fields and executable preparation inputs are not the same thing.

The preparation path currently uses:

- input format and header mode
- headerless input columns
- schema mode
- excluded names
- duplicate policy
- unique key names
- source paths and discovery settings
- output format/path settings

It does not use `/schema/includedNames` as an independent column-selection or column-ordering operation. Interactive review may accept a `/schema/includedNames` patch, but the next deterministic preparation regenerates included names from sources plus exclusions. The accepted patch can therefore disappear without changing output.

## Working Invariants

These invariants should be treated as candidates until the cleanup plan is written and implemented.

### Artifact lifecycle invariant

Artifact paths should be governed by the command phase that writes or consumes them.

Same-command writes should be collision-free:

- `planPath` and `codexReportPath` must not target the same path because direct dry-run writes both artifacts in one command
- future diagnostic or advisory artifacts written in the same command must not target the same path as each other

Cross-phase path reuse can be valid when replay semantics are explicit:

- `outputPath === planPath` can mean replay consumes the stack-plan artifact and replaces it with materialized output
- `outputPath === codexReportPath` can mean the advisory report is temporary evidence that the later output command may replace
- `recordPath === outputPath` during replay must either be a first-class consume-and-replace mode or be rejected before writing
- `--auto-clean` must not delete the output when the replay record path and output path are the same

Rationale:

- users should be able to choose flexible paths for temporary plans, advisory reports, and final outputs
- same-command overwrite prevention protects artifacts from immediate data loss
- replay-time path reuse should be modeled as an intentional consume/replace lifecycle, not as an accidental conflict
- this aligns better with existing `rename` and `data extract` artifact roles: execution artifacts, advisory artifacts, and materialized outputs are distinct by contract even when a user intentionally reuses a destination path later

### Executable patch invariant

Codex recommendation patches should be limited to fields that are consumed by deterministic preparation, replay, or duplicate-policy enforcement.

If a patch path is not executable end to end, it should not be advertised as accepted input.

Candidate supported patch paths:

- `/input/columns` for headerless CSV/TSV column names
- `/schema/mode` for `strict` or `union-by-name`
- `/schema/excludedNames` for union-by-name exclusions
- `/duplicates/uniqueBy` for selected unique key columns
- `/duplicates/policy` for `preserve`, `report`, or `reject`

Candidate unsupported patch paths:

- `/schema/includedNames`, unless a real output column selection/reorder feature is intentionally designed

## Candidate Solutions

### Solution 1: Make replay path reuse explicit

The better path solution is not a blanket dry-run path ban. It is a small lifecycle rule:

- reject only artifact paths that the same command writes at the same time
- allow a dry-run plan to record an output path that matches the plan path or Codex report path
- update replay so `recordPath === outputPath` is handled deliberately
- define `--auto-clean` behavior for consume-and-replace replay before enabling that workflow

Preferred replay behavior:

- if `recordPath !== outputPath`, keep current behavior
- if `recordPath === outputPath`, read and validate the plan first, prepare output in memory, write the materialized output over the record path only after preparation and duplicate policy checks pass
- if `--auto-clean` is also set with `recordPath === outputPath`, reject the command because cleanup would target the final output path

This keeps the tool flexible while preventing accidental same-command artifact replacement.

### Solution 2: Keep Codex patches executable, move shape advice elsewhere

Remove `/schema/includedNames` from the executable recommendation patch surface for now:

- allowed patch paths
- structured output schema
- validation logic
- prompt wording, if any wording implies direct included-name edits
- tests that treat included-name replacement as valid

Keep `/schema/excludedNames` as the supported executable way to remove union-by-name noise.

If Codex should still comment on ideal output shape, add a separate advisory-only field that is not accepted as a patch:

- `shapeObservations`
- `suggestedColumns`
- `schemaNotes`

The exact field name can be chosen in the follow-up plan, but the important boundary is that advisory shape observations are not replay inputs.

Benefits:

- matches the currently executable pipeline
- reduces review and replay ambiguity
- avoids accidental hidden column-selection semantics
- preserves room for useful Codex shape comments without pretending they are accepted patches

Costs:

- Codex cannot directly recommend a full output schema list
- users who want reorder/selection need a future explicit feature

### Solution 3: Defer first-class stack shaping

Keep `/schema/includedNames` only if a later plan designs it as real stack shaping, similar in seriousness to `data extract` source-shape artifacts.

This would need decisions for:

- whether missing selected names should fail or materialize as empty values
- whether selected names imply order
- how selected names interact with `--exclude-columns`
- whether direct CLI needs a non-Codex flag for the same capability
- how replay verifies the chosen schema against changed sources

This is useful, but it is larger than the review-fix cleanup and should not be introduced indirectly through Codex patches.

## Provisional Direction

Solutions 1 and 2 are the current candidate direction pending a cleanup plan.

This research does not approve implementation by itself. A follow-up plan should turn the candidate direction into a checked implementation scope, including the exact code, test, and guide edits.

The candidate cleanup direction is:

- define one artifact lifecycle invariant instead of a blanket path-collision rule
- reject same-command artifact write collisions
- make replay consume-and-replace behavior explicit when record and output paths match
- reject `--auto-clean` when it would delete the final output path
- keep Codex patches limited to fields that deterministic stack preparation and replay consume
- remove `/schema/includedNames` from the executable patch surface unless a separate plan designs column selection or ordering
- optionally keep non-executable shape observations in a separate advisory report field
- keep `/schema/excludedNames` as the supported schema-pruning operation for the current branch

This keeps the shipped canary contract honest without removing useful path flexibility or adding a new shaping feature under review pressure.

## Open Questions

The remaining questions are implementation-scope questions for the follow-up plan:

- Should consume-and-replace replay for `recordPath === outputPath` be supported now, or should the next patch only reject `--auto-clean` and document the current override flow?
- Should `outputPath === codexReportPath` be explicitly documented as a user-controlled replace-later workflow?
- What exact name should the Codex report use for non-executable shape advice if that advice remains useful?
- Should a future plan consider a first-class stack column-selection/reorder flag, or should that remain outside `data stack` and belong to `data extract` or `data query`?

No current plan covers these cleanup decisions yet. The next document should be a narrow implementation plan for replay path lifecycle and Codex recommendation contract cleanup.

## Related Plans

- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`

## Related Jobs

- `docs/plans/jobs/2026-04-26-data-stack-review-finding-followup.md`

## References

[^data-stack-plan]: `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
[^data-stack-research]: `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
[^data-stack-review-job]: `docs/plans/jobs/2026-04-26-data-stack-review-finding-followup.md`
[^codex-report-code]: `src/cli/data-stack/codex-report.ts`
[^data-stack-action-code]: `src/cli/actions/data-stack.ts`
