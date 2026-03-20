---
title: "Implement Direction B headerless query and extract parity"
created-date: 2026-03-20
modified-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Implement Direction B from `docs/plans/plan-2026-03-20-data-command-surface-followup-headerless-and-source-shape-replay.md` without broadening into query-side source-shape replay or `data query codex` surface changes.

## What Changed

- added direct `--no-header` support to:
  - `data query`
  - `data extract`
- extended the shared DuckDB source-preparation path so explicit CSV or TSV headerless mode:
  - forces headerless import
  - preserves row 1 as data
  - normalizes generated placeholders to the shared `column_n` contract
- carried explicit headerless state through interactive query and extract flows:
  - headerless prompt for `.csv` and `.tsv`
  - introspection
  - interactive header review
  - SQL execution
  - extraction materialization
- widened header-mapping exact-match context to include explicit `noHeader` when present
- updated follow-up command rendering so reviewed header-mapping guidance preserves `--no-header`
- added `docs/guides/data-source-shape-usage.md`
- updated related guides so source-shape and header-mapping are documented as separate layers
- left `data query --source-shape <path>` deferred
- left direct `data query codex` command behavior and surface unchanged

## Status Note

This job record is completed for Direction B only.

The parent plan at `docs/plans/plan-2026-03-20-data-command-surface-followup-headerless-and-source-shape-replay.md` remains active because the later direct query replay slice for `data query --source-shape <path>` is still pending.

## Verification

- `bun test test/data-query-header-mapping.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-query.test.ts test/cli-command-data-extract.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts`
