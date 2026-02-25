---
title: "Inline path prompt right-arrow accept and escape-sequence fix"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Fix two issues found in the new inline ghost-hint path prompt:

- `Right Arrow` should accept the current ghost-hint completion (user expectation)
- arrow-key escape sequences should not be misinterpreted as immediate `Esc` cancel and break the prompt flow

## Finding

- `Right Arrow` was not implemented in the inline key handler, so only `Tab` accepted/cycled completions.
- The prompt treated `Esc` as an immediate abort. In terminals that deliver arrow keys via escape sequences (for example `ESC [ C`), the leading escape byte could trigger prompt cancellation and leave follow-up bytes to interfere with the next prompt.

## Implemented

- Added `Right Arrow` completion acceptance in `src/cli/prompts/path-inline.ts`
  - accepts the current ghost suffix (if present)
  - beeps/no-ops when no ghost completion is available
- Added delayed `Esc` abort handling and escape-sequence buffering in `src/cli/prompts/path-inline.ts`
  - short timeout before standalone `Esc` cancels
  - swallow/recognize common arrow-key escape sequences instead of aborting
  - map right-arrow escape sequence to ghost-hint acceptance
- Preserved `Ctrl+C` cancellation behavior

## Verification

- `bunx tsc --noEmit` (passed)
- `bun test test/cli-path-suggestions.test.ts` (passed; regression check for suggestion engine)

## Manual QA Status

- Not executed in this job (interactive terminal behavior still requires manual verification).

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
