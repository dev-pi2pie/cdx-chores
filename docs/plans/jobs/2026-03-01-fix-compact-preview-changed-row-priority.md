---
title: "Fix compact preview changed-row priority"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Keep actionable rename rows visible in bounded dry-run previews when large batches also contain many unchanged rows.

## Implemented

- Updated `src/cli/rename-preview.ts` so the compact preview prefers changed rename rows when the full plan list would otherwise exceed the preview budget.
- Preserved the previous full mixed-row rendering for smaller batches that do not need truncation.
- Added unit and CLI-level regression coverage for mixed changed/unchanged batches.

## Verification

- `bun test test/cli-rename-preview.test.ts`
- `bun test test/cli-actions-rename-batch-core.test.ts`
- `bunx tsc --noEmit`
