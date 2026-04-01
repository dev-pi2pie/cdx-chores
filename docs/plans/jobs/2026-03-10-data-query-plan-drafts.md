---
title: "Draft data query CLI and interactive implementation plans"
created-date: 2026-03-10
modified-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Draft the follow-up implementation plans for `data query` now that the research contract is frozen, while keeping the direct CLI, Codex CLI drafting, and interactive-flow tracks separate and ordered.

## What Changed

- added a dedicated draft plan for direct CLI `data query` implementation
- added a dedicated draft plan for CLI `data query codex` drafting
- added a dedicated draft plan for interactive `data query` flow implementation
- kept the plan order explicit:
  - direct CLI `data query`
  - CLI `data query codex`
  - interactive `data query`
- updated the research doc so its related-plan section points to all three implementation plans
- clarified in the research and plans that any later Codex-assisted CLI drafting should live in a separate `data query codex` lane rather than inside base `data query`
- tightened the draft plans to remove remaining implementation guesswork around `--pretty`, interactive manual SQL entry, Codex stdout/stderr behavior, and Codex doctor/preflight expectations
- clarified the direct CLI plan so `data query` owns an independent smoke-fixture generator suite under `scripts/` rather than relying on preview fixture generation

## Files

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`

## Verification

- reviewed the frozen `data query` research contract
- reviewed existing plan-doc structure in the repo
- aligned the new plans with the existing DuckDB Parquet preview split plan

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
