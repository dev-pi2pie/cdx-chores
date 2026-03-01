---
title: "Define inspect-preview reuse boundary and CSV contract"
created-date: 2026-02-28
status: completed
agent: codex
---

## Goal

Complete Phase 4 of the large rename preview plan by making preview composition reusable from rename plan CSV rows and documenting that `rename-*.csv` remains the inspect-preview input artifact as well as the replay/apply artifact.

## Implemented

- Extended `src/cli/rename-preview.ts` with helpers that:
  - rehydrate preview source data from `RenamePlanCsvRow[]`
  - compose full preview data from plan CSV rows
  - compose compact preview data from plan CSV rows
- Kept preview composition separate from replay/apply behavior
- Documented the artifact contract in `docs/guides/rename-plan-csv-schema.md`:
  - `rename-*.csv` remains the replayable rename plan type
  - future inspect-preview should read that artifact rather than minting another same-looking file

## Verification

- `bun test test/cli-rename-preview.test.ts`
- `bunx tsc --noEmit`
