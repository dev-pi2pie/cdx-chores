---
title: "CLI TUI Phase 3 screen helper extraction"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Implement Phase 3 of the CLI TUI foundation plan by extracting reusable terminal output helpers from `src/cli/prompts/path-inline.ts` and `src/cli/tui/raw-session.ts` into `src/cli/tui/screen.ts`.

## Scope

- add `src/cli/tui/screen.ts`
- move these generic helpers into it:
  - line clearing
  - cursor hide/show
  - cursor-left movement
  - `beep`
  - `dim`
- update `src/cli/tui/raw-session.ts` and `src/cli/prompts/path-inline.ts` to use the new module
- keep prompt-line composition and prompt-specific rendering in `path-inline.ts`

## Out of Scope

- implementing `viewport.ts`
- changing prompt UX
- moving prompt-line composition out of `path-inline.ts`

## Related Plan

- `docs/plans/archive/plan-2026-03-02-cli-tui-foundation-and-path-inline-refactor.md`

## Summary

- Added `src/cli/tui/screen.ts` for reusable terminal output helpers.
- Updated `src/cli/tui/raw-session.ts` to use extracted cursor visibility helpers.
- Updated `src/cli/prompts/path-inline.ts` to use extracted line-clearing, cursor movement, `beep`, and `dim` helpers.
- Added focused tests for the new screen helper module.

## What Changed

- `src/cli/tui/screen.ts`
  - added `dim(...)`
  - added `beep(...)`
  - added `clearCurrentLine(...)`
  - added `moveCursorLeft(...)`
  - added `hideCursor(...)`
  - added `showCursor(...)`
- `src/cli/tui/index.ts`
  - exports the screen helper module
- `src/cli/tui/raw-session.ts`
  - now uses `hideCursor(...)` and `showCursor(...)`
- `src/cli/prompts/path-inline.ts`
  - now uses `dim(...)`, `clearCurrentLine(...)`, `moveCursorLeft(...)`, and `beep(...)`
- `test/cli-tui-screen.test.ts`
  - verifies text styling and emitted control sequences

## Verification

- `bun test test/cli-tui-screen.test.ts test/cli-path-inline.test.ts test/cli-tui-keys.test.ts test/cli-tui-raw-session.test.ts test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts`
- `bunx tsc --noEmit`
- `bunx oxlint --tsconfig tsconfig.json src test scripts`
