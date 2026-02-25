---
title: "Rename batch default exclusions and inline hint render fix"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Address two user-found issues:

- batch rename should avoid renaming hidden/system junk files by default (for example `.gitignore`, `.DS_Store`)
- inline path prompt rendering should not redraw badly when optional output prompts include long default-hint paths

## Findings

- `actionRenameBatch` default file filtering did not exclude dotfiles or common OS junk files, so hidden files could be included in rename plans unintentionally.
- The inline ghost-hint prompt reused the full prompt message string containing the long `(optional, default: ...)` hint. Re-rendering that long line on each keypress caused wrapped-line redraw artifacts in terminal output.

## Implemented

- Added default batch-rename filename exclusions in `src/cli/actions/rename.ts`:
  - dotfiles (names starting with `.`)
  - AppleDouble sidecar files (`._*`)
  - `.DS_Store`
  - `Thumbs.db`
  - `desktop.ini`
- Added a rename regression test confirming hidden/system junk files are excluded by default:
  - `test/cli-actions-data-rename.test.ts`
- Updated advanced inline path prompt rendering to keep the live input line short:
  - use a shorter inline prompt message (`<label> (optional)`) instead of embedding the full default path in the live line
  - print the default path hint once as a static dimmed line before the interactive raw-input loop

## Verification

- `bunx tsc --noEmit` (passed)
- `bun test test/cli-actions-data-rename.test.ts` (passed, includes new rename exclusion test)

## Manual QA Status

- Inline prompt terminal rendering still needs manual verification in interactive mode (especially `video gif` custom output path entry).

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
