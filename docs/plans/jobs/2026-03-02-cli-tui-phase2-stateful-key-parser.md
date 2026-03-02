---
title: "CLI TUI Phase 2 stateful key parser extraction"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Implement Phase 2 of the CLI TUI foundation plan by extracting the escape-sequence buffering and abort-timer behavior from `src/cli/prompts/path-inline.ts` into a stateful parser in `src/cli/tui/keys.ts`.

## Scope

- add `src/cli/tui/keys.ts`
- model escape parsing as a stateful parser/session object
- move these responsibilities out of `path-inline.ts`:
  - escape-sequence buffering
  - incomplete-sequence waiting
  - bare-escape abort timer
  - arrow-sequence normalization
- keep path-specific actions and prompt state in `path-inline.ts`
- add focused parser tests

## Out of Scope

- extracting screen helpers
- changing prompt UX
- implementing viewport helpers

## Related Plan

- `docs/plans/plan-2026-03-02-cli-tui-foundation-and-path-inline-refactor.md`

## Summary

- Added `src/cli/tui/keys.ts` as a stateful keypress parser.
- Moved escape-sequence buffering and bare-escape timeout behavior out of `src/cli/prompts/path-inline.ts`.
- Kept prompt-specific actions and rename/path logic in the controller.
- Added focused tests for the parser and reran controller-level prompt coverage.

## What Changed

- `src/cli/tui/keys.ts`
  - added `createKeypressParser(...)`
  - owns the escape-sequence buffer
  - owns the bare-escape abort timer
  - normalizes arrow escape sequences into explicit `left` / `right` / `up` / `down` events
  - exposes `dispose()` for teardown
- `src/cli/tui/index.ts`
  - exports the new key parser module
- `src/cli/prompts/path-inline.ts`
  - now delegates escape parsing to `createKeypressParser(...)`
  - no longer owns `escapeSequenceBuffer` or the abort timer directly
- `test/cli-tui-keys.test.ts`
  - verifies arrow-sequence normalization
  - verifies ordinary key passthrough
  - verifies bare-escape abort callback behavior
  - verifies `dispose()` clears a pending abort

## Verification

- `bun test test/cli-tui-keys.test.ts test/cli-path-inline.test.ts test/cli-tui-raw-session.test.ts test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts`
- `bunx tsc --noEmit`
- `bunx oxlint --tsconfig tsconfig.json src test scripts`
