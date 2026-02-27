---
title: "Refactor oversized rename action test suite into feature-scoped files"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Split the oversized rename/data action test file into smaller feature-scoped test files, keep coverage intact, and improve future maintainability and reviewability.

## Implemented

- Added shared action-test helpers:
  - `test/helpers/cli-action-test-utils.ts`
  - shared `expectCliError`
  - shared `removeIfPresent`
- Split the former monolithic test file into focused files:
  - `test/cli-actions-data.test.ts`
  - `test/cli-actions-rename-file.test.ts`
  - `test/cli-actions-rename-batch-core.test.ts`
  - `test/cli-actions-rename-batch-codex-images.test.ts`
  - `test/cli-actions-rename-batch-codex-docs.test.ts`
  - `test/cli-actions-rename-batch-codex-auto.test.ts`
  - `test/cli-actions-rename-apply.test.ts`
- Removed the oversized source file:
  - `test/cli-actions-data-rename.test.ts`
- Preserved behavior coverage instead of deleting tests during the split.

## Resulting Layout

Largest test files after refactor:

- `test/cli-actions-rename-batch-core.test.ts` (`463` lines)
- `test/cli-actions-rename-file.test.ts` (`393` lines)
- `test/cli-actions-md-frontmatter-to-json.test.ts` (`297` lines)
- `test/cli-actions-rename-batch-codex-auto.test.ts` (`223` lines)
- `test/cli-actions-rename-batch-codex-docs.test.ts` (`212` lines)
- `test/cli-actions-rename-batch-codex-images.test.ts` (`188` lines)

This removed the previous single `1725`-line action test file and replaced it with feature-level groupings.

## Notes

- The refactor prioritized separation by behavior boundary over immediate test deletion.
- No assertions were intentionally removed as part of this pass.
- Redundancy review can now happen file-by-file with much lower risk.

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`100 pass`, `0 fail`)

## Related Files

- `test/helpers/cli-action-test-utils.ts`
- `test/cli-actions-data.test.ts`
- `test/cli-actions-rename-file.test.ts`
- `test/cli-actions-rename-batch-core.test.ts`
- `test/cli-actions-rename-batch-codex-images.test.ts`
- `test/cli-actions-rename-batch-codex-docs.test.ts`
- `test/cli-actions-rename-batch-codex-auto.test.ts`
- `test/cli-actions-rename-apply.test.ts`
