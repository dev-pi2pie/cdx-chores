---
title: "Data stack artifact contract cleanup"
created-date: 2026-04-26
modified-date: 2026-04-26
status: completed
agent: codex
---

## Goal

Patch the two concrete `data stack` contract gaps recorded in the cleanup research:

- direct dry-run should fall back from generated artifact paths that collide, and reject custom paths that resolve to the same file for output, stack-plan, or Codex report artifacts
- Codex accepted patches should remove the unsupported `/schema/includedNames` path from the executable patch surface

This is a small review-fix plan. It does not redesign replay, add advisory report shapes, or introduce stack column selection/reordering.

## Scope

### Artifact path guard

- keep UID-based generated stack-plan and Codex report names
- keep generated artifacts in the current CLI execution directory
- keep custom `--plan-output` and `--codex-report-output` paths supported
- add one shared exact-path helper for direct dry-run paths:
  - `outputPath`
  - `planPath`
  - `codexReportPath`
- when a generated artifact path collides, fall back to another generated UID path before writing
- fail before writing any dry-run artifact when an explicit custom artifact path collides with another artifact path or the intended output path
- compare absolute paths resolved from the CLI cwd; do not depend on the target file already existing; symlink identity and case-insensitive filesystem aliases are out of scope for this patch
- keep existing replay behavior unchanged

### Codex patch surface

- remove `/schema/includedNames` from the allowed Codex patch paths
- remove `/schema/includedNames` from patch validation and application
- update only the structured Codex output schema entry needed so Codex is not asked to emit `/schema/includedNames`
- keep `/schema/excludedNames` as the current executable schema-pruning path
- do not change any other patch path, replay behavior, or report shape

## Implementation Steps

- [x] Add a small helper in the direct `data stack` action to compare resolved dry-run paths, track whether artifact paths were generated or custom, and report the conflicting custom option names.
- [x] Use the helper before writing the stack-plan artifact or Codex report artifact.
- [x] Regenerate generated plan/report paths when the helper finds a collision involving a generated artifact path.
- [x] Remove `/schema/includedNames` from `DATA_STACK_CODEX_PATCH_PATHS`.
- [x] Remove the `/schema/includedNames` validation and application branches.
- [x] Update Codex report tests that currently expect `/schema/includedNames` to be valid.
- [x] Add direct dry-run regression tests for explicit custom-path rejection:
  - custom `--plan-output` resolves to the same file as `--output`
  - custom `--codex-report-output` resolves to the same file as `--output`
  - custom `--codex-report-output` resolves to the same file as custom `--plan-output`
- [x] Add direct dry-run regression tests for generated-path fallback:
  - omitted `--plan-output` generated path collides and falls back to another generated UID path
  - omitted `--codex-report-output` generated path collides and falls back to another generated UID path
- [x] Update guide wording only if the public docs mention allowed Codex patch paths or dry-run artifact path behavior.

## Validation

Run focused coverage first:

```text
bun test test/data-stack-artifact-paths.test.ts test/data-stack-codex-report.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts
```

Then run the usual patch gates:

```text
bun run lint
bun run format:check
bun run build
git diff --check
```

## Non-Goals

- no consume-and-replace replay behavior
- no `data stack replay` output-path behavior change
- no advisory-only Codex shape field
- no stack column selection or reordering feature
- no changes to default UID-based artifact naming

## Related Research

- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`
- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`

## Related Plans

- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/jobs/2026-04-26-data-stack-review-finding-followup.md`

## References

[^cleanup-research]: `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`
[^cleanup-job]: `docs/plans/jobs/2026-04-26-data-stack-artifact-contract-cleanup.md`
[^data-stack-action]: `src/cli/actions/data-stack.ts`
[^codex-report]: `src/cli/data-stack/codex-report.ts`
