---
title: "Data preview interactive mode and color polish"
created-date: 2026-03-09
status: draft
agent: codex
---

## Goal

Add a follow-up polish pass for `data preview` so it is available from interactive mode and uses restrained `picocolors` styling where that improves scanability without harming table readability.

## Why This Plan

The first `data preview` implementation is complete as a CLI-first, non-interactive terminal table workflow.

Two follow-up improvements are now desirable:

- expose `data preview` through the existing interactive command flow
- add light visual emphasis for summary and header output

These are real user-facing improvements, but they are separate from the completed v1 command contract and should not reopen that implementation record.

## Current State

- `data preview` exists as a direct CLI subcommand
- interactive `data` routing currently supports:
  - `data:json-to-csv`
  - `data:csv-to-json`
- `picocolors` is already used in other CLI surfaces, but `data preview` output is currently plain text
- there is not yet an explicit preview-level color control contract for `NO_COLOR` or `--no-color`
- the preview renderer already has deterministic TTY and non-TTY behavior that should be preserved

## Color Scope Note

- `--no-color` should be designed as a global CLI flag, not a `data preview`-only flag
- `NO_COLOR` and `--no-color` should disable ANSI styling across the whole command execution
- `data preview` should consume that shared runtime color setting rather than inventing command-local color semantics

## Scope

### Interactive mode

- add `data:preview` to the interactive menu
- add interactive routing and prompt flow for preview input
- allow interactive entry for:
  - input path
  - optional row count
  - optional offset
  - optional column selection text
- lock interactive defaults to the existing CLI behavior:
  - blank row count => CLI default row window
  - blank offset => `0`
  - blank columns => no column filter
- keep interactive preview as stdout-only; it should not ask for an output path
- keep the actual preview execution path inside the existing `actionDataPreview` action

### Color styling

- use `picocolors` sparingly
- keep the core preview content contract plain-text-first and apply ANSI styling in a thin presentation layer
- allow emphasis for:
  - summary labels such as `Input`, `Format`, `Rows`, `Window`
  - table header labels
  - optional hidden-column notice emphasis
- keep cell values plain text
- keep non-TTY output readable and deterministic
- avoid color making snapshots or redirected output harder to inspect
- support both:
  - `NO_COLOR`
  - `--no-color`
- treat `--no-color` as a global CLI runtime flag, even though this follow-up plan only applies new styling work to `data preview`

## Non-Goals

- changing the core preview data contract
- adding keyboard-driven table navigation
- adding SQL or DuckDB-backed behavior
- adding semantic per-cell coloring
- redesigning the broader interactive menu architecture

## Implementation Touchpoints

- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/data.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/render.ts`
- interactive harness/tests under `test/`
- `docs/guides/data-preview-usage.md`

## Phase Checklist

### Phase 1: Interactive route and prompt contract

- [ ] add `data:preview` to the interactive action key set
- [ ] add the submenu entry under `data`
- [ ] define the prompt sequence for:
  - [ ] input path
  - [ ] optional row count
  - [ ] optional offset
  - [ ] optional comma-separated column list
- [ ] keep prompt defaults aligned with the v1 CLI defaults
- [ ] keep interactive preview stdout-only with no output-path prompt

### Phase 2: Interactive action wiring

- [ ] route `data:preview` through `src/cli/interactive/index.ts`
- [ ] implement the new branch in `src/cli/interactive/data.ts`
- [ ] call `actionDataPreview` instead of duplicating preview logic
- [ ] ensure empty optional prompts map cleanly to action defaults

### Phase 3: Color styling pass

- [ ] define color-control precedence for preview output:
  - [ ] `--no-color`
  - [ ] `NO_COLOR`
- [ ] define the global runtime scope for `--no-color` so preview styling follows the same CLI-wide color contract as other commands
- [ ] add restrained `picocolors` styling to preview summary labels
- [ ] add restrained styling to table headers only if it stays readable
- [ ] keep cell contents uncolored
- [ ] keep narrow-width TTY rendering legible after styling
- [ ] ensure color usage degrades safely in non-color environments
- [ ] keep redirected output free of unintended ANSI escape sequences

### Phase 4: Tests

- [ ] add interactive routing coverage for `data:preview`
- [ ] add interactive prompt flow coverage for optional values
- [ ] add focused output coverage for styled summary/header rendering
- [ ] verify non-TTY output remains deterministic enough for assertions
- [ ] verify `NO_COLOR=1` disables preview styling
- [ ] verify `--no-color` disables preview styling
- [ ] verify redirected output does not leak ANSI sequences

### Phase 5: Docs and verification

- [ ] update `docs/guides/data-preview-usage.md` with interactive usage
- [ ] document the color-styling boundary
- [ ] run manual checks for:
  - [ ] direct CLI preview
  - [ ] interactive preview flow
  - [ ] TTY rendering with color
  - [ ] TTY rendering with `NO_COLOR=1`
  - [ ] TTY rendering with `--no-color`
  - [ ] non-TTY redirected preview output

## Success Criteria

- users can reach `data preview` from interactive mode without losing the existing CLI path
- color improves scanability of the preview summary/header without coloring the whole table
- tests cover the new interactive route and colorized output behavior
- the completed v1 plan remains unchanged as the baseline implementation record

## Verification

- `bunx tsc --noEmit`
- `bun test` on focused interactive/data preview suites
- manual interactive smoke checks

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
