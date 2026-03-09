---
title: "Data preview contains interactive flow and TTY highlighting"
created-date: 2026-03-09
modified-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Add a follow-up polish pass for `data preview` so the existing `--contains <column>:<keyword>` filter is reachable from interactive mode and matching cells receive restrained TTY-only emphasis.

## Why This Plan

The direct CLI contains filter now exists and is documented, but two user-facing gaps remain:

- interactive preview cannot collect `contains` filters yet
- matches are functionally applied but visually unmarked in color-capable TTY output

These are both follow-up UX improvements on top of the completed filter contract, not changes to the filter semantics themselves.

## Current State

- `data preview` supports repeatable `--contains <column>:<keyword>` on the direct CLI
- contains parsing already uses the first unescaped `:` and supports `\:` and `\\`
- matching is already case-insensitive and literal
- filtering already happens before offset/window slicing and summary totals already reflect the filtered row set
- interactive preview currently prompts only for:
  - input path
  - optional row count
  - optional offset
  - optional comma-separated columns
- preview styling currently emphasizes summary labels and header cells only
- cell values remain plain text in both TTY and non-TTY output

## Scope

### Interactive prompt contract

- keep the existing CLI `--contains <column>:<keyword>` contract unchanged
- add optional interactive collection for one or more contains filters
- map interactive answers to the same internal `contains?: string[]` action shape used by the direct CLI path
- treat blank interactive contains input as no contains filter
- validate each non-blank interactive contains entry before final preview execution
- reuse the existing contains parser rules so interactive syntax matches the direct CLI contract exactly
- reject malformed interactive contains input in-prompt and re-prompt instead of surfacing a post-submit `CliError`
- validate unknown interactive contains columns against the selected preview source before final render and re-prompt with a local validation message
- avoid comma-separated contains parsing in interactive mode because the current escape rules only cover `:` and `\\`
- use a simple repeat-entry flow:
  - prompt for one optional `column:keyword` value
  - if present, ask whether to add another filter
  - repeat until the user stops

### Highlighting behavior

- add matching emphasis only when stdout is a TTY and color is enabled
- keep non-TTY output free of added ANSI sequences
- keep `--no-color` and `NO_COLOR` behavior unchanged
- highlight whole matching cells rather than substring spans in the first pass
- apply highlighting only to cells that satisfy at least one contains filter
- do not force hidden filter columns visible just to show highlighting
- when an active contains filter targets a column that is hidden by `--columns` or width budgeting, add a short summary note that matching columns are hidden from the rendered table
- keep header styling and summary styling readable after highlight is added
- preserve table layout, truncation behavior, and visible-column budgeting

## Non-Goals

- changing the `--contains <column>:<keyword>` CLI grammar
- adding interactive mini-query-builder behavior
- introducing comma-separated contains parsing in interactive mode
- substring-span highlighting in this pass
- highlighting in non-TTY output
- changing contains matching semantics away from case-insensitive literal substring matching

## Implementation Touchpoints

- `src/cli/interactive/data.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/source.ts`
- `src/cli/data-preview/render.ts`
- focused preview and interactive tests under `test/`
- `docs/guides/data-preview-usage.md`

## Phase Checklist

### Phase 1: Freeze interactive and highlight contract

- [x] define the interactive contains prompt sequence
- [x] define blank-input behavior as no contains filter
- [x] define how repeated interactive entries map to `contains?: string[]`
- [x] define prompt-time validation behavior for malformed contains syntax
- [x] define prompt-time validation behavior for unknown columns
- [x] define TTY-only highlight boundaries and color-control behavior
- [x] define whether multiple matching filters on one cell share the same highlight treatment
- [x] define summary behavior when matching columns are hidden from the rendered table

### Phase 2: Interactive wiring

- [x] add optional contains collection to the interactive preview flow
- [x] keep the existing prompt order readable and low-friction
- [x] pass collected contains values through `actionDataPreview`
- [x] preserve the current behavior when the user leaves contains blank
- [x] keep malformed syntax and unknown-column errors inside the prompt loop instead of failing after submission

### Phase 3: TTY-only highlighting

- [x] surface contains-match metadata needed by the renderer without changing filter semantics
- [x] highlight matching cells only in TTY output with color enabled
- [x] keep non-matching cells plain text
- [x] add a compact summary note when matching columns are hidden from the rendered table
- [x] keep truncated cells and narrow-width tables readable
- [x] ensure highlighted cells do not break width calculations or snapshot determinism after ANSI stripping

### Phase 4: Tests

- [x] add interactive coverage for:
  - [x] blank contains input
  - [x] single contains entry
  - [x] repeated contains entries
  - [x] malformed syntax re-prompts locally
  - [x] unknown columns re-prompt locally
- [x] add renderer/action coverage for:
  - [x] TTY-only matching-cell highlighting
  - [x] no highlight in non-TTY mode
  - [x] no highlight when color is disabled
  - [x] multi-filter highlighting on matching cells
  - [x] hidden matching-column summary note
  - [x] stable output after ANSI stripping

### Phase 5: Docs and verification

- [x] update `docs/guides/data-preview-usage.md`
- [x] document that interactive preview now supports contains filters
- [x] document that highlighting is TTY-only and cell-level
- [x] document that hidden matching columns produce a summary note rather than forced column visibility
- [x] run manual checks for:
  - [x] direct CLI preview with contains filters in TTY mode
  - [x] interactive preview with one contains filter
  - [x] interactive preview with multiple contains filters
  - [x] interactive malformed contains re-prompt behavior
  - [x] interactive unknown-column re-prompt behavior
  - [x] `--no-color` behavior
  - [x] contains filters whose matching columns are hidden by column selection or width limits
  - [x] non-TTY redirected output

## Success Criteria

- interactive users can apply the existing contains-filter contract without leaving the interactive flow
- blank interactive contains input remains equivalent to no filter
- TTY output makes matched cells easier to scan without changing non-TTY output behavior
- hidden matching columns are explained in the summary instead of silently losing visible highlight cues
- the completed contains-filter plan remains the authoritative record for the base filter contract

## Verification

- `bunx tsc --noEmit`
- focused `bun test` preview and interactive suites
- manual smoke checks for direct CLI and interactive preview flows

## Related Plans

- `docs/plans/plan-2026-03-09-data-preview-contains-filter.md`
- `docs/plans/plan-2026-03-09-data-preview-interactive-and-color-polish.md`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
