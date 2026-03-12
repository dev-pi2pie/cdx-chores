---
title: "Fix interactive rename custom template help rerender"
created-date: 2026-03-12
modified-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Stop the interactive rename custom-template prompt from reprinting its help text on every keystroke and keep the active input on a single line.

## Implemented

- Split the shared inline text prompt API into:
  - a single-line `message` used for the live input renderer
  - one-time `helpLines` rendered above the prompt
- Updated the interactive rename custom-template flow to use static help lines plus a single-line `Template` prompt.
- Added a dimmed helper line for the suggested ghost template so the interactive rename prompt visibly matches the inline-helper pattern used by path prompts.
- Added regression coverage for the raw TTY prompt path so repeated rerenders no longer duplicate help text.
- Updated the interactive rename routing test to match the new prompt contract.

## Verification

- `bun test test/cli-text-inline.test.ts test/cli-interactive-rename.test.ts`
