---
title: "Refine cleanup auto-detect follow-up and define Codex suggestion contract"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Advance Phase 2.1 and Phase 2.2 of the interactive cleanup plan by:

- tightening the current auto-detect implementation and interactive wording
- defining the first-pass Codex analyzer-assisted cleanup contract

## Scope

- `src/cli/actions/index.ts`
- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/cleanup.ts`
- `src/cli/actions/rename/cleanup-target.ts`
- `src/cli/interactive/rename.ts`
- `test/cli-interactive-rename.test.ts`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

## Implemented

- Extracted cleanup path auto-detect into a shared helper:
  - `src/cli/actions/rename/cleanup-target.ts`
- Reused that helper from both:
  - `src/cli/actions/rename/cleanup.ts`
  - `src/cli/interactive/rename.ts`
- Kept the cleanup contract path-first and auto-detected:
  - no new file-vs-directory mode selection prompt was introduced
- Clarified the directory-only filter wording in interactive mode:
  - changed `Add directory filters?` to `Filter files before cleanup?`
- Preserved the existing behavior where file-only cleanup skips directory filter prompts entirely.
- Updated interactive tests to cover the new wording and the shared resolver dependency.
- Added a dedicated research note for Codex analyzer-assisted cleanup:
  - first pass uses filename-list analysis only
  - no file-content reading in the initial design
  - suggestions should be structured and user-confirmed before deterministic cleanup runs
- Updated the active plan to mark the completed Phase 2.1 items and the newly settled Phase 2.2 design items.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-rename.test.ts test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-validation.test.ts`

## Notes

- This job does not implement the Codex analyzer-assisted cleanup flow itself.
- The analyzer-assisted work is currently documented as a settled contract/research boundary, not a shipped interactive feature.

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Related Research

- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
