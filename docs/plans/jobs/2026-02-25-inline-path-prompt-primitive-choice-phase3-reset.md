---
title: "Inline path prompt primitive choice Phase 3 reset"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Reset the interactive path prompt UI approach after the list-first prototype proved misaligned, and choose a replacement implementation primitive for Fish-style inline ghost-hint completion.

## Decision Summary

- Superseded the list-first `@inquirer/search` path prompt approach for the default path-entry UX.
- Chosen primitive for MVP replacement: custom raw TTY path prompt renderer using Node `readline` keypress events (`emitKeypressEvents`) with the existing filesystem suggestion engine.

## Why This Primitive (MVP)

- Supports input-first interaction directly (typed text remains primary).
- Enables inline dimmed ghost-suffix rendering without forcing a selection list UI.
- Keeps dependencies stable (no new package required for the MVP).
- Reuses existing Phase 1/2 foundations:
  - `src/cli/prompts/path.ts`
  - `src/cli/prompts/path-suggestions.ts`
  - `src/cli/prompts/path-config.ts`

## Tradeoffs

- Manual key handling and terminal rendering are more implementation work than `@inquirer/search`.
- MVP does not yet implement a full shell editor surface (for example, rich cursor movement/history semantics).
- Manual terminal QA is required to validate feel and compatibility.

## Related Research

- `docs/researches/archive/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## Related Plans

- `docs/plans/archive/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
