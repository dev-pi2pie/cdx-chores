---
title: "CLI TUI Phase 1 raw-session extraction"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Implement Phase 1 of the CLI TUI foundation plan by extracting the raw terminal session lifecycle from `src/cli/prompts/path-inline.ts` into `src/cli/tui/raw-session.ts` while preserving current prompt behavior.

## Scope

- add `src/cli/tui/raw-session.ts`
- make the new module own:
  - `emitKeypressEvents(stdin)`
  - raw-mode enable/disable
  - cursor hide/show
  - stdin resume/pause
  - keypress listener registration/removal
- support prompt-local teardown hooks for path-inline-specific timers and escape-buffer cleanup
- update `src/cli/prompts/path-inline.ts` to use the extracted raw session
- keep behavior unchanged from a user perspective

## Out of Scope

- extracting escape-sequence parsing to `src/cli/tui/keys.ts`
- extracting screen helpers
- implementing `viewport.ts`
- changing prompt UX

## Notes

- This job intentionally leaves prompt-specific state and key handling inside `path-inline.ts`.
- The goal is to remove low-level terminal session ownership first, not to redesign the whole controller.

## Summary

- Added `src/cli/tui/raw-session.ts` as the first reusable terminal-session primitive.
- Added `src/cli/tui/index.ts` export wiring.
- Updated `src/cli/prompts/path-inline.ts` to use the extracted raw session with a prompt-local teardown hook for escape-timer and buffer cleanup.
- Added focused tests for the new raw-session module.

## What Changed

- `src/cli/tui/raw-session.ts`
  - owns `emitKeypressEvents(stdin)`
  - owns raw-mode enable/disable
  - owns cursor hide/show
  - owns stdin resume/pause
  - owns keypress listener registration/removal
  - supports a prompt-local teardown hook
- `src/cli/tui/index.ts`
  - exports the new raw-session module
- `src/cli/prompts/path-inline.ts`
  - now uses `startRawSession(...)` and `supportsRawSessionIO(...)`
  - no longer owns direct listener removal or raw-mode restoration
- `test/cli-tui-raw-session.test.ts`
  - verifies session support detection
  - verifies raw-mode lifecycle, teardown, listener cleanup, and cursor restoration

## Verification

- `bun test test/cli-tui-raw-session.test.ts test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts`
- `bunx tsc --noEmit`
- `bunx oxlint --tsconfig tsconfig.json src test scripts`

## Related Plan

- `docs/plans/archive/plan-2026-03-02-cli-tui-foundation-and-path-inline-refactor.md`
