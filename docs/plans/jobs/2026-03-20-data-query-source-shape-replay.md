---
title: "Implement data query source-shape replay"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Complete Phase 6 of `docs/plans/plan-2026-03-20-data-command-surface-followup-headerless-and-source-shape-replay.md` by adding direct `data query --source-shape <path>` replay without widening this slice into `data query codex` command-surface changes.

## What Changed

- added `--source-shape <path>` to direct `data query`
- resolved reviewed source-shape artifacts before:
  - direct query introspection for reviewed header suggestions
  - accepted header-mapping reuse
  - final SQL execution
- generalized the shared source-shape replay helper so both extract and query use the same exact-match artifact contract with command-appropriate validation wording
- defined strict replay precedence for direct query:
  - `--source-shape` replaces explicit shape flags
  - direct query now rejects combining `--source-shape` with:
    - `--source`
    - `--range`
    - `--header-row`
    - `--body-start-row`
- kept direct `data query codex` explicitly unchanged in this slice
- updated docs to reflect shipped query replay behavior and the current `data query codex` boundary
- completed the remaining Phase 6 checklist items and closed the parent plan

## Verification

- `bun test test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/cli-ux.test.ts`
