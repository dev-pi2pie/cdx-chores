---
title: "Shared interactive UX first rollout"
created-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Implement the first frozen rollout from the shared interactive UX consistency follow-up plan.

## What Changed

- standardized the width-aware abort notice behind a shared opt-in helper in `src/cli/interactive/notice.ts`
- adopted the shared abort notice in:
  - `src/cli/interactive/data-query/index.ts`
  - `src/cli/interactive/data/extract.ts`
  - `src/cli/interactive/data/preview.ts`
- added coarse checkpoint backtracking to interactive `data extract` with separate:
  - extraction review
  - final write boundary
- aligned interactive `data extract` wording so source interpretation and semantic header review stay separate from output setup and destination choices
- updated the interactive usage guides for `data extract` and `data preview`
- marked the completed rollout items in `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`

## Verification

- `bun test test/cli-interactive-notice.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`
- `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`

## Related Research

- `docs/researches/research-2026-03-30-interactive-data-query-followup-ux.md`
