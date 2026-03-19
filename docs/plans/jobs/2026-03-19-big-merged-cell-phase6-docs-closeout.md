---
title: "Big merged-cell Phase 6 docs closeout"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Completed Phase 6 of `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`.

This pass updated the user-facing guides for the shipped `body-start-row` contract and closed the related research and plan statuses.

## Changes

- updated `docs/guides/data-extract-usage.md` to document:
  - `--body-start-row <n>`
  - widened reviewed source-shape suggestions
  - the supported stacked merged-band extraction example
- updated `docs/guides/data-query-usage.md` to document:
  - `--body-start-row <n>`
  - Excel row-shaping behavior for query mode
  - strict reviewed header-mapping reuse with `bodyStartRow`
- updated `docs/guides/data-query-codex-usage.md` so Codex drafting docs now include `--body-start-row` and `--header-row`
- updated `docs/guides/data-query-interactive-usage.md` so reviewed source-shape guidance now mentions `body-start-row`
- updated `docs/guides/data-schema-and-mapping-usage.md` so strict header-mapping artifact matching now includes optional `input.bodyStartRow`
- marked:
  - `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md` as `completed`
  - `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md` as `completed`

## Verification

- reused the completed implementation verification from the same follow-up:
  - `bunx tsc --noEmit`
  - `bun test test/data-source-shape.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-query.test.ts test/cli-command-data-extract.test.ts test/cli-ux.test.ts`
  - `bun test test/cli-actions-data-query-codex.test.ts test/cli-command-data-query-codex.test.ts test/cli-interactive-routing.test.ts`
  - `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`

## Related Research

- `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md`
