---
title: "Randomized flow tip slot follow-up"
created-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Replace the layered checkpoint-tip model with one randomized flow-entry tip slot for interactive `data query` and interactive `data extract`.

## What Changed

- replaced the earlier checkpoint-tip resolver in `src/cli/interactive/contextual-tip.ts` with:
  - a small command-scoped tip pool
  - bounded random tip selection
  - one shared flow-entry tip slot
- removed later checkpoint tip rendering from:
  - `src/cli/interactive/data-query/index.ts`
  - `src/cli/interactive/data-query/execution.ts`
  - `src/cli/interactive/data/extract.ts`
- kept `data preview` tip-free
- extended the interactive harness so tests can supply deterministic random values through `randomQueue`
- updated the tip tests and routing coverage for:
  - command-scoped pools
  - deterministic random selection
  - one-tip-only behavior
  - preview exclusions
- updated the research, guides, and plan to reflect the shipped randomized single-slot model

## Verification

- `bun test test/cli-interactive-notice.test.ts test/cli-interactive-contextual-tip.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-30-interactive-contextual-tip-followup.md`

## Related Research

- `docs/researches/research-2026-03-30-interactive-contextual-tip-usage.md`
