---
title: "CLI TUI Architecture Guide"
created-date: 2026-03-02
modified-date: 2026-03-29
status: completed
agent: codex
---

## Goal

Document the current `src/cli/tui/` boundary in `cdx-chores` and record the intended viewport boundary for future table or preview surfaces without implementing `src/cli/tui/viewport.ts` prematurely.

## Current Module Boundary

The current terminal UI split is:

- `src/cli/tui/raw-session.ts`
  - raw-mode session setup and teardown
  - `emitKeypressEvents(stdin)` ownership
  - cursor visibility restore during session lifecycle
  - prompt-local teardown hook support
- `src/cli/tui/keys.ts`
  - stateful escape/key parser
  - arrow normalization
  - bare-escape abort callback handling
- `src/cli/tui/screen.ts`
  - reusable terminal output helpers
  - line clearing
  - cursor movement
  - cursor visibility helpers
  - `beep`
  - `dim`
- `src/cli/prompts/path-inline.ts`
  - path-prompt controller
  - prompt-local state
  - path suggestion and sibling-preview orchestration
  - key-to-action mapping for the path prompt

Design rule:

- `src/cli/tui/**` owns reusable terminal mechanics
- `src/cli/prompts/**` owns prompt-domain behavior

## Why This Boundary Exists

This split keeps future terminal surfaces from depending on path-prompt internals while avoiding a broad framework abstraction.

In practice, it means:

- path prompts can reuse raw session and key parsing
- a future table/preview surface can reuse those same primitives
- filesystem suggestion logic does not leak into generic TUI modules

## Deferred Viewport Boundary

`src/cli/tui/viewport.ts` is intentionally deferred until a real consumer exists.

The intended future concerns are:

- visible row count
- offset clamping
- page up/down movement
- home/end movement
- row-window calculations independent of any specific renderer

The intended non-goals for the first viewport module are:

- column layout policy
- ANSI rendering
- prompt-domain behavior
- data fetching/parsing

Recommended future layering for a table or preview surface:

1. data source
2. viewport/window math
3. renderer
4. controller

This keeps the eventual viewport helper narrowly scoped and prevents overdesign before `data preview` or another table consumer actually lands.

## Path Inline Notes

The current `src/cli/prompts/path-inline.ts` is smaller and cleaner than before the TUI extraction, but it still intentionally owns:

- prompt-line composition
- async ghost-refresh policy
- sibling-preview behavior
- prompt lifecycle guards around settling and late async work

That is acceptable because those concerns are still path-prompt-specific.

If further cleanup is needed later, prefer extracting:

- duplicated suggestion-request option assembly
- prompt-local action helpers

before introducing any new generic TUI abstraction.

## Placement Rules For Future Work

- Put reusable raw terminal/session/key/rendering helpers in `src/cli/tui/`
- Put prompt-specific state machines and domain rules in `src/cli/prompts/`
- Do not move filesystem/path suggestion logic into `src/cli/tui/`
- Do not add `src/cli/tui/viewport.ts` until a real preview/table consumer needs it

## Historical Plans

- `docs/plans/archive/plan-2026-03-02-cli-tui-foundation-and-path-inline-refactor.md`
- `docs/plans/archive/plan-2026-03-02-interactive-path-sibling-navigation-and-ghost-preview.md`

## Historical Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/researches/archive/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
