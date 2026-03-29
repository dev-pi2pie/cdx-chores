---
title: "Data preview interactive mode and color polish"
created-date: 2026-03-09
modified-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Implement the follow-up `data preview` improvements from `docs/plans/archive/plan-2026-03-09-data-preview-interactive-and-color-polish.md`.

## Phase Slice

- Phase 1: Interactive route and prompt contract
- Phase 2: Interactive action wiring
- Phase 3: Color styling pass
- Phase 4: Tests
- Phase 5: Docs and verification

## What Changed

- added `data:preview` to the interactive action key set and `data` submenu
- implemented interactive preview prompting for:
  - input path
  - optional rows
  - optional offset
  - optional comma-separated columns
- kept interactive preview stdout-only and routed it through `actionDataPreview`
- added shared CLI color helpers in `src/cli/colors.ts`
- introduced runtime-level `colorEnabled` handling through:
  - global `--no-color`
  - `NO_COLOR`
- applied restrained preview styling to:
  - summary labels
  - table header cells
- kept preview data rows uncolored
- updated other existing styled surfaces to use the runtime-aware/global color contract:
  - version label
  - doctor output
  - interactive analyzer status
- added focused tests for:
  - interactive preview routing
  - styled preview output in TTY mode
  - preview output with color disabled
  - `NO_COLOR`
  - `--no-color`
- updated `docs/guides/data-preview-usage.md` with:
  - interactive usage
  - global color control
  - styling boundaries

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-routing.test.ts test/cli-actions-data-preview.test.ts test/cli-color.test.ts test/cli-ux.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-interactive-analyzer-status.test.ts`
- manual PTY run:
  - `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv`
- manual PTY run:
  - `NO_COLOR=1 bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv`
- manual PTY run:
  - `bun src/bin.ts --no-color data preview examples/playground/tabular-preview/basic.csv`
- manual interactive PTY run:
  - `bun src/bin.ts interactive` -> `data` -> `preview` -> `examples/playground/tabular-preview/basic.json`
- redirected output check:
  - `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv > examples/playground/.tmp-tests/data-preview-redirected.txt`

## Related Plans

- `docs/plans/archive/plan-2026-03-09-data-preview-interactive-and-color-polish.md`
- `docs/plans/archive/plan-2026-03-09-tabular-data-preview-v1-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
