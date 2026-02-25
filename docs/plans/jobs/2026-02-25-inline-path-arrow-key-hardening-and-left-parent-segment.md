---
title: "Inline path prompt arrow-key hardening and left-parent-segment action"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Harden the inline ghost-hint path prompt for non-right arrow keys and add a useful `Left Arrow` behavior without reintroducing the escape-sequence cancel/jump bug.

## Finding

- After fixing `Right Arrow`, other arrow directions could still trigger broken prompt flow depending on terminal escape-sequence timing.
- `Up/Down` are not currently used for history in this prompt, but they should not cause prompt cancellation or leaked bytes.
- `Left Arrow` had no behavior, and a path-segment "go to parent segment" action is a useful input-first shortcut.

## Implemented

- Increased standalone `Esc` cancel grace window in `src/cli/prompts/path-inline.ts` to reduce false cancels during arrow-key escape sequences.
- Added explicit handling for arrow escape sequences so `Left/Up/Down` do not fall through into abort behavior.
- Added `Left Arrow` action in `src/cli/prompts/path-inline.ts`:
  - trims to the previous path segment boundary
  - refreshes the ghost hint after the path value changes
- Added explicit `Up/Down` MVP no-op behavior (no history yet; prompt remains stable)

## Verification

- `bunx tsc --noEmit` (passed)
- `bun test test/cli-path-suggestions.test.ts` (passed; regression check for shared suggestion engine)

## Manual QA Status

- Not executed in this job.
- Terminal-specific arrow-key behavior still requires manual validation.

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
