---
title: "Compact core batch rename tests after second-pass audit"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Do one more low-risk compaction pass on the remaining largest core batch-rename test file without removing distinct action-layer coverage.

## Implemented

- Compacted repeated invalid `maxDepth` cases in `test/cli-actions-rename-batch-core.test.ts` into table-driven form:
  - missing `--recursive`
  - negative `maxDepth`
- Compacted repeated profile-scope assertions into one scenario loop:
  - `media`
  - `docs`
- Compacted repeated invalid scope-input assertions into one scenario loop:
  - invalid `--profile`
  - invalid `--match-regex`

## Result

- `test/cli-actions-rename-batch-core.test.ts` reduced from `463` lines to `455` lines.
- The file remains the largest action test file, but repeated setup/teardown noise is lower.
- Distinct contracts were preserved.

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`100 pass`, `0 fail`)

## Related Jobs

- `docs/plans/jobs/2026-02-27-test-suite-rename-action-split-refactor.md`
- `docs/plans/jobs/2026-02-27-test-suite-second-pass-redundancy-audit.md`
