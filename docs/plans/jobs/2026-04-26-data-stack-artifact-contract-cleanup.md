---
title: "Data stack artifact contract cleanup"
created-date: 2026-04-26
modified-date: 2026-04-26
status: completed
agent: codex
---

## Goal

Implement the narrow `data stack` artifact contract cleanup from `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`.

## What Changed

- Added direct dry-run artifact path resolution that:
  - keeps UID-based generated plan/report paths
  - falls back to another generated path when a generated artifact path collides
  - rejects explicit custom same-file collisions among `--output`, `--plan-output`, and `--codex-report-output`
- Removed `/schema/includedNames` from executable Codex recommendation patch paths.
- Updated focused regression coverage for custom-path rejection, generated-path fallback, and unsupported included-name patches.
- Updated `docs/guides/data-stack-usage.md` to document generated-path fallback and explicit custom collision failure.
- Marked the implementation plan completed and linked this job record from the related research and plan docs.

## Follow-Up Note

A review follow-up found that accepted `/schema/excludedNames` Codex patches could leave the derived plan's `schema.includedNames` at the pre-exclusion list when callers used `applyDataStackCodexRecommendationDecisions()` directly. The follow-up now prunes `schema.includedNames` as exclusion patches are applied and adds regression coverage for a union-by-name exclusion recommendation.

A second review follow-up found that an accepted recommendation could first set `/duplicates/uniqueBy` and then exclude one of those selected schema names. The follow-up now prunes excluded names from `duplicates.uniqueBy` during the same exclusion patch so derived plans remain replayable, with regression coverage for the ordered unique-key-plus-exclusion recommendation.

A third review follow-up found that the interactive dry-run path could write a stack-plan JSON to the same path as the planned JSON stack output. The follow-up now rejects interactive stack-plan paths that equal the stack output path before either dry-run or write-now plan persistence, matching the direct CLI collision contract, and adds interactive harness coverage for the custom JSON collision.

A fourth review follow-up found that accepted headerless `/input/columns` recommendations could rename generated schema names while leaving `duplicates.uniqueBy` pointed at the old names. The follow-up now remaps existing unique keys by headerless column position during input-column replacement and rejects any remaining unknown unique-key names, with regression coverage for both the remap and rejection paths.

A fifth review follow-up found two remaining contract gaps: headerless `/input/columns` recommendations could change the prepared column count, and direct dry-run artifacts could be written over already-resolved input files when `--overwrite` was set. The follow-up now rejects headerless column-count changes during Codex patch validation and rejects dry-run plan/report artifact paths that overlap prepared input files before any artifact is persisted, with focused regressions for both paths.

A sixth review follow-up found that the interactive dry-run plan prompt still allowed a stack-plan JSON path to overlap a matched input source. The follow-up now applies the same reserved artifact contract in the interactive flow by rejecting stack-plan paths that equal prepared input files before either dry-run or write-now plan persistence, with harness coverage for a JSON input-source collision.

A seventh review follow-up found that replacing `/schema/excludedNames` on a plan that already carried exclusions could silently lose the previously excluded schema basis and later produce a non-replayable plan. The follow-up now rejects exclusion replacements that remove existing exclusions, still allows additive exclusions against the current included-or-excluded schema names, and covers both paths in Codex report helper regressions.

An eighth review follow-up found that accepted `/schema/mode` recommendations could change a derived plan to a mode that the stored sources could not prepare during replay. Because the plan artifact does not store per-source raw schemas, the follow-up now rejects mode-changing Codex patches, still allows no-op mode patches, and updates the Codex prompt to avoid asking for schema-mode changes.

A ninth follow-up found that the interactive Codex dry-run flow could write a plan that referenced an advisory report and then remove that report when the user declined to keep it. The follow-up now keeps Codex reports in memory until the final write boundary, asks whether to keep the report before persisting the final plan, and clears `diagnostics.reportPath` when the report is skipped.

## Verification

```text
bun test test/data-stack-artifact-paths.test.ts test/data-stack-codex-report.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts
bun run lint
bun run format:check
bun run build
git diff --check
```

Follow-up verification:

```text
bun test test/data-stack-codex-report.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-command-data-stack.test.ts
bun run lint
bun run format:check
bun run build
```

Second follow-up verification:

```text
bun test test/data-stack-codex-report.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-command-data-stack.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Third follow-up verification:

```text
bun test test/cli-interactive-routing.test.ts
bun test test/data-stack-artifact-paths.test.ts test/cli-interactive-routing.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Fourth follow-up verification:

```text
bun test test/data-stack-codex-report.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-command-data-stack.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Fifth follow-up verification:

```text
bun test test/data-stack-codex-report.test.ts
bun test test/cli-actions-data-stack.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Sixth follow-up verification:

```text
bun test test/cli-interactive-routing.test.ts
bun test test/cli-interactive-routing.test.ts test/data-stack-artifact-paths.test.ts test/cli-actions-data-stack.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Seventh follow-up verification:

```text
bun test test/data-stack-codex-report.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Eighth follow-up verification:

```text
bun test test/data-stack-codex-report.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts
bun test test/data-stack-codex-signals.test.ts test/data-stack-diagnostics.test.ts test/data-stack-plan.test.ts
bun run lint
bun run format:check
git diff --check
bun run build
```

Ninth follow-up verification:

```text
bun test test/cli-interactive-routing.test.ts
```

## Related Research

- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`

## Related Plans

- `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
