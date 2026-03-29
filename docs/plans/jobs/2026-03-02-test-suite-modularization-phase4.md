---
title: "Test suite modularization phase 4"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Complete Phase 4 from `docs/plans/archive/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md` by replacing the old rename hotspot with a folder-based `src/cli/actions/rename/` module that separates batch flow, file flow, apply flow, and shared helpers.

## Scope

- `src/cli/actions/index.ts`
- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/batch.ts`
- `src/cli/actions/rename/file.ts`
- `src/cli/actions/rename/apply.ts`
- `src/cli/actions/rename/codex.ts`
- `src/cli/actions/rename/filters.ts`
- `src/cli/actions/rename/plan-output.ts`
- `src/cli/actions/rename/reporting.ts`

## Extraction Boundary

Phase 4 extraction targets:

- thin public rename action surface
- batch action orchestration
- single-file action orchestration
- apply action wrapper
- default excluded entry logic
- profile extension constants and profile normalization
- regex compilation helpers
- extension normalization helpers
- `createRenameBatchFileFilter()`
- `normalizeRenameBatchMaxDepth()`
- batch/file preview and footer rendering
- apply-result summary rendering
- dry-run plan CSV row building and writing
- shared Codex analyzer selection, execution, and summary printing

These boundaries were chosen to end with a folder-based module layout instead of leaving a partially modularized flat-file surface behind.

## Notes

- `actionRenameApply()` remains a thin wrapper inside the new module folder.
- The public rename action API should keep the existing `actionRenameBatch()`, `actionRenameFile()`, and `actionRenameApply()` surfaces and behavior.

## Implemented

- Replaced the old flat rename action file with a folder-based `src/cli/actions/rename/` module.
- Added `src/cli/actions/rename/index.ts` as the thin public surface.
- Added `src/cli/actions/rename/batch.ts`.
- Added `src/cli/actions/rename/file.ts`.
- Added `src/cli/actions/rename/apply.ts`.
- Added `src/cli/actions/rename/codex.ts`.
- Added `src/cli/actions/rename/filters.ts`.
- Added `src/cli/actions/rename/plan-output.ts`.
- Added `src/cli/actions/rename/reporting.ts`.
- Moved the following batch-specific logic into `src/cli/actions/rename/batch.ts`:
  - dry-run/apply batch orchestration
  - preview-skips validation
  - batch replan flow after Codex title overrides
- Moved the following single-file logic into `src/cli/actions/rename/file.ts`:
  - dry-run/apply file orchestration
  - file replan flow after Codex title overrides
- Kept the apply entrypoint as a thin wrapper in `src/cli/actions/rename/apply.ts`.
- Moved the following shared helper logic out of the old top-level rename action module:
  - default excluded entry handling
  - profile extension constants and profile normalization
  - optional regex compilation
  - extension normalization
  - `createRenameBatchFileFilter()`
  - `normalizeRenameBatchMaxDepth()`
- Moved the following output/reporting logic into `src/cli/actions/rename/reporting.ts`:
  - batch preview rendering
  - batch dry-run footer rendering
  - batch apply footer rendering
  - file preview/footer rendering
  - apply-result summary rendering
- Moved the following plan output logic into `src/cli/actions/rename/plan-output.ts`:
  - effective pattern resolution for timestamp-aware dry runs
  - batch dry-run CSV row construction and write flow
  - single-file dry-run CSV row construction and write flow
- Moved the following Codex logic into `src/cli/actions/rename/codex.ts`:
  - image/document candidate selection
  - analyzer progress handling
  - analyzer run result merging
  - batch/file Codex summary and note printing
- Updated `src/cli/actions/index.ts` to export from `src/cli/actions/rename/index.ts`.

## Result

- The old 1180-line `src/cli/actions/rename.ts` hotspot is gone.
- The new rename module layout is:
  - `src/cli/actions/rename/index.ts` at 6 lines
  - `src/cli/actions/rename/batch.ts` at 194 lines
  - `src/cli/actions/rename/file.ts` at 131 lines
  - `src/cli/actions/rename/apply.ts` at 32 lines
  - `src/cli/actions/rename/codex.ts` at 604 lines
  - `src/cli/actions/rename/filters.ts` at 210 lines
  - `src/cli/actions/rename/plan-output.ts` at 104 lines
  - `src/cli/actions/rename/reporting.ts` at 144 lines
- Phase 4 now ends with the intended folder-based ownership model rather than an intermediate flat-file split.

## Verification

- `bun test test/cli-actions-rename-batch-core.test.ts` ✅
- `bun test test/cli-actions-rename-batch-codex-auto.test.ts` ✅
- `bun test test/cli-actions-rename-batch-codex-docs.test.ts` ✅
- `bun test test/cli-actions-rename-batch-codex-images.test.ts` ✅
- `bun test test/cli-actions-rename-batch-filters.test.ts` ✅
- `bun test test/cli-actions-rename-batch-recursion.test.ts` ✅
- `bun test test/cli-actions-rename-batch-preview.test.ts` ✅
- `bun test test/cli-actions-rename-file.test.ts` ✅
- `bun test test/cli-actions-rename-apply-replay.test.ts` ✅
- `bun test test/cli-actions-rename-timestamp.test.ts` ✅
- `bunx tsc --noEmit` ✅
- `bun test` ✅

## Related Plans

- `docs/plans/archive/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-test-suite-audit.md`
