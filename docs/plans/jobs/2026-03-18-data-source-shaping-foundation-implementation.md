---
title: "Implement data source-shaping foundation"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Land the first deterministic source-shaping slice from the edge-case research so preview, query, interactive query, and `data query codex` all operate on the same explicit table-shaping contract.

## What Changed

- added `data preview --no-header` for `.csv` and `.tsv`
- kept headerless preview deterministic by:
  - preserving row 1 as data
  - generating `column_n` names
  - keeping `--columns` and `--contains` aligned with those generated names
- added Excel `--range <A1:Z99>` to:
  - `data query`
  - `data query codex`
  - the shared DuckDB relation-building and introspection path
- exposed accepted Excel range state in:
  - bounded `data query` output
  - `data query codex` prompts and rendered summaries
  - interactive query introspection summaries
- changed interactive Excel query flow to become shape-first:
  - optional range prompt before introspection
  - conservative suspicious raw whole-sheet warning
  - manual range recovery with re-inspection before SQL authoring
- updated public guides for preview, direct query, interactive query, and Codex drafting
- completed the checklist in `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-preview/rendering.test.ts test/cli-actions-data-preview/failures.test.ts test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/cli-command-data-query-codex.test.ts test/cli-actions-data-query-codex.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts`

## Notes

- public docs stay behavior-oriented and do not disclose the private repro files under `examples/playground/issue-data/`
- the first slice keeps shaping explicit; it does not add auto-detection, Excel header-row overrides, or header-mapping artifacts

## Related Plans

- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/archive/plan-2026-03-18-data-extract-shaped-table-materialization.md`

## Related Research

- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
