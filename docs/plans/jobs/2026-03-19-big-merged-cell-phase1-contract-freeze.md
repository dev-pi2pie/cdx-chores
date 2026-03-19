---
title: "Big merged-cell Phase 1 contract freeze"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Completed Phase 1 of `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`.

This pass did not change runtime behavior. It froze the deterministic contract for the hard merged-sheet follow-up and checked the current schema surfaces so the next implementation phases can proceed without reopening naming or validation decisions.

## Decisions Frozen

- keep `body-start-row` as the user-facing CLI name and `bodyStartRow` as the artifact field name
- use absolute worksheet row numbering, aligned with existing `header-row`
- keep the first pass Excel-only
- allow `body-start-row` without requiring `header-row`
- require `body-start-row` to be greater than `header-row` when both are present
- keep `body-start-row` as import-time shaping rather than a post-import row filter
- keep source-shape artifacts on `version: 1` in the current canary line
- allow reviewed source-shape suggestions to return any valid combination of `range`, `headerRow`, and `bodyStartRow`

## Schema Audit

The current implementation still hard-codes the pre-follow-up shape contract in three main places:

- `src/cli/duckdb/source-shape/types.ts` models source shape as only `range` plus `headerRow`
- `src/cli/duckdb/source-shape/artifact.ts` only accepts and writes artifacts containing `range` and/or `headerRow`
- `src/cli/duckdb/source-shape/suggestions.ts` only exposes `range` and `header_row` in the reviewed Codex structured-output schema
- `src/cli/duckdb/query/prepare-source.ts` validates and derives Excel import behavior only from `range` and `header-row`
- `src/cli/data-workflows/source-shape-flow.ts`, `src/cli/actions/data-query.ts`, and `src/cli/actions/data-extract.ts` currently format and pass through only the existing shape fields

## Implications

- Phase 2 can stay isolated to worksheet snapshot correctness in `src/cli/duckdb/xlsx-sources.ts`
- Phase 4 and Phase 5 will need a coordinated widening of the shape type, artifact parser/writer, reviewed-shape schema, shared Excel prepare path, and CLI flow formatting
- the current plan can move into implementation without further research or naming debate unless the no-new-field fallback later proves materially better than expected

## Related Plans

- `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`

## Related Research

- `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md`
