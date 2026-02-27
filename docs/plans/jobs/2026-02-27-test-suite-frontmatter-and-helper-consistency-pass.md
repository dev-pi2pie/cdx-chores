---
title: "Compact frontmatter tests and normalize test helpers"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Do the next low-risk cleanup pass on the test suite by compacting the Markdown frontmatter action tests and improving consistency across shared test helpers.

## Implemented

- Compacted `test/cli-actions-md-frontmatter-to-json.test.ts` by:
  - removing the file-local `expectCliError` duplicate
  - switching repeated temp-fixture cleanup to a shared helper
- Added `withTempFixtureDir(...)` to `test/helpers/cli-test-utils.ts` for shared temporary fixture setup and teardown.
- Normalized helper usage in `test/cli-actions-doctor-markdown-video-deferred.test.ts` by:
  - removing the file-local `expectCliError` duplicate
  - switching repeated temp-fixture cleanup to `withTempFixtureDir(...)`

## Result

- `test/cli-actions-md-frontmatter-to-json.test.ts` reduced from `297` lines to `248` lines.
- `test/cli-actions-doctor-markdown-video-deferred.test.ts` now uses the shared error/assertion helper and shared temp-fixture lifecycle helper.
- The remaining `expectCliError` implementation now lives only in `test/helpers/cli-action-test-utils.ts`.

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`100 pass`, `0 fail`)

## Related Jobs

- `docs/plans/jobs/2026-02-27-test-suite-rename-action-split-refactor.md`
- `docs/plans/jobs/2026-02-27-test-suite-second-pass-redundancy-audit.md`
- `docs/plans/jobs/2026-02-27-test-suite-core-batch-file-third-pass-compaction.md`
- `docs/plans/jobs/2026-02-27-test-suite-file-rename-fourth-pass-compaction.md`
