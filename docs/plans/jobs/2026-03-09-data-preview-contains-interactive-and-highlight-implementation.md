---
title: "Implement interactive contains flow and TTY match highlighting for data preview"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Implement the `data preview` follow-up from `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`.

## What Changed

- added interactive `contains` collection to the `data:preview` flow through:
  - an optional first `column:keyword` prompt
  - an add-another confirmation loop for repeated filters
  - blank first input mapping to no contains filter
- validated interactive contains entries locally before preview execution by reusing the existing direct-CLI parser and source-column validation
- kept malformed syntax and unknown columns inside the prompt validation loop instead of surfacing post-submit action failures
- extracted a reusable preview-source loader so the interactive flow and direct action path use the same input loading behavior
- passed parsed contains-filter metadata into the renderer
- added TTY-only whole-cell emphasis for visible matching columns while preserving non-TTY and `--no-color` behavior
- added a compact summary note when active contains-filter columns are hidden by explicit column selection or width budgeting
- updated the data preview guide for:
  - interactive contains prompts
  - TTY-only matching-cell emphasis
  - hidden matching-column summary notes
- expanded automated coverage for:
  - blank/single/repeated interactive contains flows
  - local re-prompts for malformed syntax and unknown columns
  - visible-cell highlighting in TTY mode
  - no highlighting in non-TTY output
  - no highlighting when color is disabled
  - hidden matching-column summary notes

## Files

- `src/cli/actions/data-preview.ts`
- `src/cli/actions/index.ts`
- `src/cli/data-preview/render.ts`
- `src/cli/data-preview/source.ts`
- `src/cli/interactive/data.ts`
- `test/cli-actions-data-preview.test.ts`
- `test/cli-interactive-routing.test.ts`
- `test/helpers/interactive-harness.ts`
- `docs/guides/data-preview-usage.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-preview.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts`
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv --contains status:active`
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv --columns id,name --contains status:active`
- `bun src/bin.ts --no-color data preview examples/playground/tabular-preview/basic.csv --contains status:active`
- PTY smoke check of `bun src/bin.ts interactive` through `data -> preview` with `status:active`

## Related Plans

- `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-filter.md`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
