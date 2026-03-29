---
title: "Interactive two-layer menu refactor implementation"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Implement the interactive command menu refactor so the first layer shows top-level command groups and the second layer selects subcommands, while preserving existing action prompt/dispatch behavior.

## Scope

- Interactive mode only (`src/cli/interactive.ts`)
- Minimal extraction for menu selection/submenu navigation
- Keep existing action dispatch `if` chain unchanged

## Changes Made

- Added typed interactive menu action/root/submenu choice definitions in `src/cli/interactive.ts`.
- Added data-driven root menu configuration (`doctor`, `data`, `md`, `rename`, `video`, `cancel`).
- Added submenu configuration for:
  - `data` -> `json-to-csv`, `csv-to-json`
  - `md` -> `to-docx`
  - `rename` -> `file`, `batch`, `apply`
  - `video` -> `convert`, `resize`, `gif`
- Added `selectInteractiveAction()` helper with:
  - root menu selection
  - second-layer submenu selection
  - `Back` (returns to root menu)
  - `Cancel` (exits interactive mode)
- Replaced the original flat command `select(...)` call with `selectInteractiveAction()`.

## Verification

- Build/type check via `bun run build`: passed.
- Manual interactive TTY smoke checks via `node dist/esm/bin.mjs`:
  - confirmed root menu shows only `doctor`, `data`, `md`, `rename`, `video`, `cancel`
  - confirmed second-layer `Back` returns to the root menu
  - confirmed second-layer `Cancel` exits interactive mode cleanly
  - confirmed root `Cancel` exits interactive mode cleanly
  - confirmed routing prompts appear for:
    - `doctor` -> `Output as JSON?`
    - `data -> json-to-csv` -> `Input JSON file`
    - `md -> to-docx` -> `Input Markdown file`
    - `rename -> batch` -> `Target directory`
    - `video -> gif` -> `Input video file`

## Related Plans

- `docs/plans/archive/plan-2026-02-26-interactive-two-layer-command-menu-refactor.md`
