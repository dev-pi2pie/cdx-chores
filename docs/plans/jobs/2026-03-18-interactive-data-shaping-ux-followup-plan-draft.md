---
title: "Draft follow-up plan for interactive data shaping UX and Excel header-row recovery"
created-date: 2026-03-18
modified-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Capture the next follow-up plan after the first reviewed source-shape implementation, focusing on interactive reviewed Codex UX, staged interactive extract writing, rename-pattern alignment, and deterministic Excel header-row shaping for hard workbook cases.

## What Changed

- reviewed the current interactive shaping and extract behavior against:
  - the recently completed reviewed source-shape and interactive extract implementation plan
  - the edge-case research for merged-header Excel workbooks
  - the existing rename dry-run and analyzer-assisted cleanup interaction pattern
- drafted `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`
- froze the main follow-up themes in the new plan:
  - interactive Codex thinking/progress UX parity
  - staged review-before-write extract flow
  - rename dry-run rhythm alignment without copying the plan-CSV model
  - explicit `--header-row <n>` as the next deterministic Excel shaping step
  - widened reviewed source-shape artifacts for optional `headerRow`
- revised the draft after review to tighten the most ambiguous contracts:
  - `--header-row <n>` uses absolute worksheet row numbering
  - reviewed source-shape suggestions may return `range`, `headerRow`, or both
  - fixture-generator follow-up should include semantic workbook validation, not only deterministic hashes

## Verification

- document review only

## Notes

- no product code changed in this step
- the new plan intentionally treats merged-header workbook recovery and interactive UX as one follow-up because the remaining problems are coupled

## Related Plans

- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`

## Related Research

- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
