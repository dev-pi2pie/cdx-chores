---
title: "Fix non-TTY rename preview truncation"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Restore full `rename batch --dry-run` preview output when stdout is not an interactive terminal, so redirected and piped runs remain fully inspectable from stdout.

## Implemented

- Updated `src/cli/rename-preview.ts` so preview budgets are unbounded when `stdout.isTTY` is false.
- Kept the bounded head/tail preview behavior for interactive terminal output.
- Added a regression test in `test/cli-actions-rename-batch-core.test.ts` covering a large non-TTY dry run.

## Verification

- `bun test test/cli-actions-rename-batch-core.test.ts`
- `bun test test/cli-rename-preview.test.ts`
- `bunx tsc --noEmit`
