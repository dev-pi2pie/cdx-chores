---
title: "Hard merged-sheet recovery phase draft"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Extended `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md` with a new Phase 7 for the remaining hard merged-sheet Excel gaps.

## Why

Recent interactive and reviewed-shape work fixed the schema bug, thinking-copy issue, and warning-loop regression, but two behavior gaps remain:

- some merged-sheet workbooks collapse into a single visible column with non-empty sample rows and do not trigger reviewed shape assistance
- some accepted `range` plus `header-row` shapes still fail during DuckDB Excel parsing because early blank or merged header-band rows distort type inference before the first representative records

## Added Planning Direction

- broaden suspicious Excel detection for collapsed one-column merged-sheet results
- add a public-safe fixture for that workbook pattern
- try tolerant Excel introspection/materialization retry before inventing a new shaping flag
- only draft another deterministic Excel shaping field if tolerant retry still cannot model the hard merged-sheet class
