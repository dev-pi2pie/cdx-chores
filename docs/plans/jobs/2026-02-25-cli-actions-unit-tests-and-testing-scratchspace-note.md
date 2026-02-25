---
title: "Add unit tests for CLI action modules and testing scratch-space note"
created-date: 2026-02-25
modified-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Add unit-level regression tests for the extracted CLI action modules (`data` and `rename`), and document the preferred scratch-space location for manual smoke-test artifacts.

## Implemented

- Added unit tests in `test/cli-actions-data-rename.test.ts` covering:
  - `actionJsonToCsv`
  - `actionCsvToJson`
  - `actionRenameBatch` (`dryRun: true`)
  - `actionRenameBatch` (`dryRun: false`)
- Added failure-mode and edge-case tests in `test/cli-actions-data-rename.test.ts` for:
  - invalid JSON input
  - missing input file
  - output exists without overwrite
  - empty rename directory (`dryRun`)
- Added shared test helpers in `test/helpers/cli-test-utils.ts` for:
  - captured CLI runtime creation
  - black-box CLI invocation
  - playground-based temp fixture directories
  - repo-relative path conversion
- Updated `test/cli-ux.test.ts` to use `examples/playground/.tmp-tests` as the temporary fixture root
- Updated `test/cli-ux.test.ts` and `test/cli-actions-data-rename.test.ts` to reuse shared test helpers
- Added a short AGENTS note in `AGENTS.md` to prefer `examples/playground/` for isolated manual smoke-test artifacts and temporary local test files

## Verification

- `bun test` ✅
  - `11 pass`, `0 fail`

## Related Plans

- `docs/plans/plan-2026-02-25-cli-actions-modularization.md`

## Follow-up Jobs

- Job: add unit tests for remaining extracted CLI action modules (`doctor`, `markdown`, `video`, `deferred` where meaningful)
- Job: extract shared test fixtures/runtime helpers for wider test reuse (CLI + action tests)
- Job: add failure-mode tests for data and rename actions (invalid input, overwrite collisions, empty directories)
