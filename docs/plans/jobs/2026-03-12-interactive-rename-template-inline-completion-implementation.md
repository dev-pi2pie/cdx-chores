---
title: "Implement interactive rename template inline completion"
created-date: 2026-03-12
modified-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Implement trailing-token inline completion for interactive rename custom templates, including token-family narrowing, `Tab` parity with right arrow, and sibling-style candidate browsing.

## Scope

- `src/cli/prompts/text-inline.ts`
- `src/cli/prompts/`
- `src/cli/interactive/rename.ts`
- prompt tests for inline text and interactive rename
- user-facing docs for interactive rename template behavior if the final UX changes in a user-visible way

## Notes

- First pass stays within the current append/backspace-only text prompt model.
- Completion applies only to the trailing token fragment currently being typed.

## Implemented

- Added template-specific trailing-token candidate resolution in `src/cli/prompts/text-template-candidates.ts`.
- Extended the inline text prompt so rename template entry now supports:
  - token-aware ghost suffix rendering
  - `Tab` parity with right-arrow accept
  - sibling-style up/down browsing within the active candidate scope
  - timestamp-family narrowing after `timestamp` prefixes
  - date-family narrowing after `date` prefixes
- Kept the first implementation within the existing append/backspace-only inline text model; no general cursor editing was introduced.
- Wired the interactive rename custom-template prompt onto the new template completion mode in `src/cli/interactive/rename.ts`.
- Added focused regression coverage for:
  - candidate resolution and family narrowing
  - no suggestion before `{`
  - trailing-token accept behavior
  - sibling-style cycling for timestamp/date families
- Updated user-facing rename docs to describe the new interactive template-completion controls.

## Verification

- `bun test test/cli-text-template-candidates.test.ts test/cli-text-inline.test.ts test/cli-interactive-rename.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-12-interactive-rename-template-inline-completion.md`

## Related Research

- `docs/researches/research-2026-03-12-interactive-template-inline-completion-audit.md`
