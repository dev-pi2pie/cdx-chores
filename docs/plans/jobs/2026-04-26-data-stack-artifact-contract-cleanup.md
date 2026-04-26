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

## Related Research

- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`

## Related Plans

- `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
