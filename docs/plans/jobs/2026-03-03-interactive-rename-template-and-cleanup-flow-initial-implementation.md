---
title: "Implement interactive rename template hint simplification and cleanup flow"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Land the first implementation slice of the new interactive rename UX plan by:

- simplifying the custom-template hint text
- adding the missing interactive `rename cleanup` entry and flow

## Scope

- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/rename.ts`
- `src/cli/actions/index.ts`
- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/cleanup.ts`
- `test/cli-interactive-rename.test.ts`
- `docs/plans/archive/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Implemented

- Added `rename:cleanup` to the interactive rename submenu in `src/cli/interactive/menu.ts`.
- Updated interactive dispatch in `src/cli/interactive/index.ts` so cleanup is routed through the rename handler.
- Simplified the custom rename-template help text in `src/cli/interactive/rename.ts`:
  - reduced the inline placeholder list to the main directions
  - added a short advanced note for explicit timestamp variants and `{serial...}` params
  - kept this as static prompt text for now instead of introducing a true inline ghost placeholder
- Added a new interactive `rename cleanup` flow in `src/cli/interactive/rename.ts` covering:
  - target path entry
  - repeatable hint selection
  - style selection
  - conditional timestamp keep/remove choice
  - directory-only recursive/filter prompts
  - dry-run preview mode selection
  - optional immediate apply using `rename apply`
- Added interactive-side path inspection so cleanup branches by actual file vs directory target before asking directory-only questions.
- Extended `actionRenameCleanup(...)` to return a result object with dry-run plan CSV metadata so interactive mode can offer immediate apply consistently with other rename actions.
- Exported the cleanup result type through the rename action barrels.
- Added interactive regression coverage for:
  - shortened custom-template prompt text
  - cleanup file flow routing
  - cleanup directory dry-run flow plus immediate apply follow-up
- Updated the active implementation plan checkboxes to reflect completed Phases 1 through 3 items and targeted verification status.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-rename.test.ts test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-validation.test.ts`

## Notes

- This job intentionally stops before the optional ghost-placeholder/TUI upgrade for custom template entry.
- Manual interactive smoke checks remain open in the active plan.

## Related Plans

- `docs/plans/archive/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
- `docs/researches/archive/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`
