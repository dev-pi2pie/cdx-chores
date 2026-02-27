---
title: "Compact single-file rename action tests"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Do one more low-risk compaction pass on `test/cli-actions-rename-file.test.ts` by extracting repeated setup and cleanup without removing distinct action-layer contracts.

## Implemented

- Added shared local helpers in `test/cli-actions-rename-file.test.ts` for repeated single-file fixture setup:
  - file creation or fixture copy
  - fixed timestamp assignment
- Added a shared local helper for DOCX experimental-gate setup and restoration.
- Added a shared workspace wrapper to centralize temporary fixture cleanup and optional plan CSV cleanup.
- Kept distinct tests separate for:
  - dry-run preview
  - apply with collision suffix handling
  - no-prefix behavior
  - symlink rejection
  - image Codex fallback
  - auto document routing
  - DOCX disabled
  - DOCX extraction error
  - DOCX heading-rich success

## Result

- `test/cli-actions-rename-file.test.ts` reduced from `360` lines to `335` lines.
- Repeated setup noise is lower, while action behavior coverage stays explicit.

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`100 pass`, `0 fail`)

## Related Jobs

- `docs/plans/jobs/2026-02-27-test-suite-rename-action-split-refactor.md`
- `docs/plans/jobs/2026-02-27-test-suite-second-pass-redundancy-audit.md`
- `docs/plans/jobs/2026-02-27-test-suite-core-batch-file-third-pass-compaction.md`
