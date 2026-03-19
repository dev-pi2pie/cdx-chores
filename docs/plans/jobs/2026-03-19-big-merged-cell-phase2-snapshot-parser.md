---
title: "Big merged-cell Phase 2 snapshot parser"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Completed Phase 2 of `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`.

This phase fixed the worksheet snapshot corruption that affected reviewed source-shape evidence for the hard merged-band workbook.

## Changes

- updated `src/cli/duckdb/xlsx-sources.ts` so worksheet cell scanning handles both:
  - `<c .../>`
  - `<c ...>...</c>`
- prevented self-closing blank cells in merged regions from being treated as opening tags for the next populated cell
- strengthened `test/data-query-xlsx-sources.test.ts` with workbook-level assertions for:
  - corrected `usedRange`
  - true row 5 title anchor
  - true row 7 header anchors
  - true row 10 body anchors

## Result

The stacked merged-band worksheet snapshot now reflects the true populated anchors instead of the shifted values seen before the fix.

Confirmed examples from the corrected snapshot:

- row 5: `BG5=RAW_TITLE`
- row 7: `B7=id`, `E7=question`, `AL7=status`, `AZ7=notes`
- row 10: `B10=1.0`, `E10=Does the customer need a follow-up call after the outage review?`, `AL10=- [ ] Yes; - [ ] No`, `AZ10=callback`
- corrected `usedRange`: `B5:BG20`

## Verification

- `bun test test/data-query-xlsx-sources.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`

## Related Research

- `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md`
