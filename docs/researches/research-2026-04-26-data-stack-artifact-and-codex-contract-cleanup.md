---
title: "Data stack artifact and Codex contract cleanup"
created-date: 2026-04-26
modified-date: 2026-04-26
status: completed
agent: codex
---

## Goal

Record the small `data stack` cleanup needed after review findings showed two concrete contract mismatches: custom dry-run paths can point at the same file, and one Codex patch path is accepted even though stack preparation does not consume it.

This is not a replay redesign or stack-shaping redesign.

## Why This Research

The current replay and Codex-assist work added useful primitives:

- stack-plan JSON artifacts
- advisory Codex report artifacts
- `data stack replay <record>`
- direct `--dry-run`
- direct `--codex-assist`
- interactive Codex recommendation review
- accepted/edited recommendation lineage in stack-plan metadata

Two review findings exposed small contract gaps:

- custom artifact paths are not yet governed by one clear same-file guard
- Codex recommendation patches can target plan fields that are accepted by validation but are not actually executable by the preparation/replay pipeline

That means the current branch needs a narrow cleanup, not a broader design change.

## Current Situation

### Artifact paths

Direct dry-run has up to three relevant paths:

- `outputPath`: the intended future materialized `.csv`, `.tsv`, or `.json` stack output
- `planPath`: the stack-plan JSON artifact produced by `--dry-run`
- `codexReportPath`: the advisory Codex report JSON artifact produced by `--codex-assist`

Default generated plan/report paths should live in the current CLI execution directory and include a UID, so normal dry-runs do not collide. If a generated artifact path still collides with the intended output or another artifact path, the command should fall back to another generated UID path. Custom paths should stay flexible, but explicit custom paths that resolve to the same file as another dry-run path should be rejected.

Explicit custom-path rejection examples:

- `--dry-run --plan-output merged.csv --output merged.csv` writes stack-plan JSON at the same path that the plan records as the future materialized output; replay then does not have a clean plan artifact to consume
- `--dry-run --codex-assist --codex-report-output merged.csv --output merged.csv` writes an advisory report at the exact file path intended for materialized stack output
- custom `--plan-output` and `--codex-report-output` can also point to the same file unless checked

Generated-path fallback example:

- when `--plan-output` or `--codex-report-output` is omitted and the generated path collides, generate another UID path instead of failing

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

## Small Contract Rules

### Artifact paths

Generated artifact paths should include a UID and default to the current CLI execution directory. Same directory is fine. Same resolved file path should either fall back when generated or fail when explicitly customized.

Direct dry-run should handle exact same-file collisions among:

- materialized output intent path
- stack-plan artifact path
- Codex report artifact path

Generated artifact paths should fall back to another generated UID path when they collide. Explicit custom artifact paths should fail when they collide with another artifact path or the intended output path.

Rationale:

- UID defaults avoid normal collisions without extra user decisions
- generated fallback handles rare UID or basename collisions without making users care about generated paths
- custom paths remain supported
- rejecting explicit exact same-file collisions prevents a user-specified plan or advisory report from replacing another artifact or occupying the future output path
- this keeps the rule close to existing artifact workflows: generated names avoid collisions, generated fallbacks avoid edge cases, custom names are allowed, and exact unsafe custom overlaps fail early

### Codex patches

Codex recommendation patches should be limited to fields that are consumed by deterministic preparation, replay, or duplicate-policy enforcement.

If a patch path is not executable end to end, it should not be advertised as accepted input.

Supported executable patch paths should remain:

- `/input/columns` for headerless CSV/TSV column names
- `/schema/mode` for `strict` or `union-by-name`
- `/schema/excludedNames` for union-by-name exclusions
- `/duplicates/uniqueBy` for selected unique key columns
- `/duplicates/policy` for `preserve`, `report`, or `reject`

Unsupported patch paths for the current cleanup:

- `/schema/includedNames`

## Small Cleanup Solution

### Keep UID defaults, fallback generated paths, and reject exact custom collisions

The path solution should stay small:

- keep generated stack-plan and Codex report names UID-based
- keep generated artifacts in the current CLI execution directory
- regenerate generated artifact paths when they collide with another dry-run path
- keep custom paths supported
- reject custom paths that resolve to the exact same file as another dry-run artifact or the intended output

No replay behavior change is needed for this cleanup.

### Keep Codex patches executable-only

Remove `/schema/includedNames` from the executable recommendation patch surface for now:

- allowed patch paths
- structured output schema
- validation logic
- prompt wording, if any wording implies direct included-name edits
- tests that treat included-name replacement as valid

Keep `/schema/excludedNames` as the supported executable way to remove union-by-name noise. This:

- matches the currently executable pipeline
- reduces review and replay ambiguity
- avoids accidental hidden column-selection semantics

## Implemented Direction

The follow-up implementation landed through `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`:

- keep UID-based generated artifact paths in the current CLI execution directory
- fall back to another generated UID path when a generated dry-run artifact path collides
- reject explicit custom same-file collisions among dry-run output, plan, and Codex report paths
- keep Codex patches limited to fields that deterministic stack preparation and replay consume
- remove `/schema/includedNames` from the executable patch surface for now
- keep `/schema/excludedNames` as the supported schema-pruning operation for the current branch

This keeps the shipped canary contract honest without adding new replay semantics, advisory report shapes, or stack column-shaping features.

## Follow-up Plan Notes

No redesign is needed. The follow-up implementation plan should stay narrow:

- add one shared exact-path collision check for direct dry-run artifacts, with fallback for generated artifact paths
- remove `/schema/includedNames` from accepted Codex patch paths
- update only the tests and guide text needed for those two contract fixes

## Related Plans

- `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`

## Related Jobs

- `docs/plans/jobs/2026-04-26-data-stack-codex-schema-patch-validation.md`
- `docs/plans/jobs/2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/jobs/2026-04-26-data-stack-review-finding-followup.md`

## References

[^data-stack-plan]: `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
[^data-stack-research]: `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
[^data-stack-cleanup-plan]: `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`
[^data-stack-schema-patch-job]: `docs/plans/jobs/2026-04-26-data-stack-codex-schema-patch-validation.md`
[^data-stack-cleanup-job]: `docs/plans/jobs/2026-04-26-data-stack-artifact-contract-cleanup.md`
[^data-stack-review-job]: `docs/plans/jobs/2026-04-26-data-stack-review-finding-followup.md`
[^codex-report-code]: `src/cli/data-stack/codex-report.ts`
[^data-stack-action-code]: `src/cli/actions/data-stack.ts`
