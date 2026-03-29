---
title: "Inline path ghost-hint prompt Phase 4 implementation"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement the replacement interactive path prompt UX:

- input-first inline path prompt
- dimmed ghost-hint suffix for best completion
- `Tab` accept/cycle and `Enter` submit semantics
- simple-prompt fallback behavior preserved

## Implemented

- Added `src/cli/prompts/path-inline.ts`:
  - custom raw TTY path prompt renderer
  - inline dimmed ghost suffix rendering from the Phase 2 suggestion engine
  - `Tab` accept/cycle behavior (MVP forward-cycle)
  - `Enter` submit current typed/accepted text
  - `Backspace` and `Ctrl+U` editing support
  - `Ctrl+C` / `Esc` prompt abort behavior
- Replaced the list-first `@inquirer/search` path prompt integration in `src/cli/prompts/path.ts`
- Kept simple prompt fallback in `src/cli/prompts/path.ts` for unsupported/error cases
- Wired interactive path prompts to pass `stdin`/`stdout` so the inline prompt can run in TTY mode (`src/cli/interactive.ts`)

## Rename Prompt Impact

- `rename batch` target directory path now uses the replacement inline prompt path
- `rename file` target file path now uses the replacement inline prompt path
- `rename apply` CSV path now uses the replacement inline prompt path (CSV file filtering preserved)

## Verification

- `bunx tsc --noEmit` (passed)
- `bun test test/cli-path-suggestions.test.ts` (passed)

## Manual QA Status

- Not executed yet in this job.
- Terminal compatibility and interaction feel remain tracked in the plan’s Manual QA checklist.

## Notes

- The current MVP intentionally omits a list-first picker UI and keeps completion hints secondary to typed input.
- The current cycling behavior is forward-only (`Tab`) in the MVP; reverse cycling (`Shift+Tab`) remains a possible follow-up.

## Related Plans

- `docs/plans/archive/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
