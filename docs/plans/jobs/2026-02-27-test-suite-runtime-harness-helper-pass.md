---
title: "Add shared runtime harness helpers for action tests"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Do a final low-risk test-harness cleanup pass by extracting repeated captured-runtime assertions into a small shared helper and applying it to lower-risk action test files.

## Implemented

- Added `createActionTestRuntime(...)` to `test/helpers/cli-action-test-utils.ts`.
- The new helper wraps `createCapturedRuntime(...)` and provides:
  - `expectNoStderr()`
  - `expectNoStdout()`
  - `expectNoOutput()`
- Applied the helper to:
  - `test/cli-actions-data.test.ts`
  - `test/cli-actions-doctor-markdown-video-deferred.test.ts`
  - `test/cli-actions-md-frontmatter-to-json.test.ts`

## Result

- Repeated `createCapturedRuntime()` + empty-stream assertion noise is reduced in the lower-risk action test files.
- The helper remains intentionally small and focused, so test intent stays explicit.
- More complex rename-focused test files were left unchanged in this pass to avoid hiding behavior-heavy assertions behind too much abstraction.

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`100 pass`, `0 fail`)

## Related Jobs

- `docs/plans/jobs/2026-02-27-test-suite-rename-action-split-refactor.md`
- `docs/plans/jobs/2026-02-27-test-suite-second-pass-redundancy-audit.md`
- `docs/plans/jobs/2026-02-27-test-suite-core-batch-file-third-pass-compaction.md`
- `docs/plans/jobs/2026-02-27-test-suite-file-rename-fourth-pass-compaction.md`
- `docs/plans/jobs/2026-02-27-test-suite-frontmatter-and-helper-consistency-pass.md`
