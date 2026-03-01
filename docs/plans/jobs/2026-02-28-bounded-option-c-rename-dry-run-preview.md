---
title: "Implement bounded Option C rename dry-run preview"
created-date: 2026-02-28
status: completed
agent: codex
---

## Goal

Complete Phase 2 of the large rename preview plan by switching batch dry-run output to a bounded Option C preview with terminal-height-aware truncation and skipped-item summaries.

## Implemented

- Extended `src/cli/rename-preview.ts` with:
  - preview-budget calculation using terminal height plus a fixed cap
  - compact Option C preview composition
  - head-and-tail truncation metadata for rename rows
- Updated `src/cli/actions/rename.ts` so `rename batch --dry-run` now:
  - renders a bounded rename preview
  - shows skipped items as grouped summary rows
  - prints explicit truncation messaging
  - emphasizes the generated plan CSV when the rename list is truncated
- Kept non-dry-run batch preview behavior stable for this phase

## Verification

- `bun test test/cli-rename-preview.test.ts`
- `bun test test/cli-actions-rename-batch-core.test.ts`
- `bunx tsc --noEmit`
