---
title: "Inline ghost prompt wrap fix implementation"
created-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Implement the wrapped inline ghost prompt fix tracked by issue `#31`, including the follow-up needed to resolve the remaining Ghostty-specific redraw problem.

## Summary

- added a shared wrap-aware inline renderer in `src/cli/tui/inline-renderer.ts`
- updated both `src/cli/prompts/path-inline.ts` and `src/cli/prompts/text-inline.ts` to use the shared renderer
- extended `src/cli/tui/screen.ts` with the extra cursor controls needed for wrap-aware cleanup
- added focused regression coverage for wrapped redraws, wrapped cleanup, exact-width frames, wrapped ghost acceptance, and display-width-sensitive behavior
- refined the renderer again after confirming that Ghostty still reproduced the issue while iTerm2 passed
- switched ghost rendering from left-move cursor restoration to save/restore cursor rendering so the terminal preserves the live prompt cursor position

## What Changed

- introduced a shared inline prompt repaint primitive:
  - `src/cli/tui/inline-renderer.ts`
- updated prompt integrations:
  - `src/cli/prompts/path-inline.ts`
  - `src/cli/prompts/text-inline.ts`
- extended shared TUI screen helpers:
  - `src/cli/tui/screen.ts`
- added shared test terminal emulation:
  - `test/helpers/virtual-terminal.ts`
- added and updated focused prompt/TUI tests:
  - `test/cli-tui-inline-renderer.test.ts`
  - `test/cli-tui-screen.test.ts`
  - `test/cli-path-inline.test.ts`
  - `test/cli-text-inline.test.ts`

## Why

The original wrapped prompt fix improved the general case but did not fully match real terminal behavior for exact-width prompt frames.

Manual follow-up showed:

- iTerm2 no longer reproduced the bug
- Ghostty still left ghost rows behind
- Ghostty reported `TERM=xterm-256color`, so the remaining issue was not explained by an unusual `TERM` value alone

That pointed to a terminal-compatibility gap in the renderer itself. The final implementation moved the ghost rendering path to save/restore cursor control so the terminal keeps the authoritative prompt cursor position across wrapped frames.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-tui-screen.test.ts test/helpers/virtual-terminal.ts test/cli-tui-inline-renderer.test.ts test/cli-path-inline.test.ts test/cli-text-inline.test.ts`
- `bun run build`
- manual verification matrix:
  - iTerm2: passed after the earlier wrap-aware renderer work
  - Ghostty with `TERM=xterm-256color`: still reproduced before the final save/restore cursor renderer change
  - Ghostty with `TERM=xterm-256color`: user-reported pass after the final save/restore cursor renderer change

## Related Plans

- `docs/plans/plan-2026-03-29-inline-ghost-prompt-wrap-fix.md`

## Related Research

- `docs/researches/research-2026-03-29-inline-ghost-prompt-wrap-bug.md`
