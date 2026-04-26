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

## Related Research

- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`

## Related Plans

- `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
