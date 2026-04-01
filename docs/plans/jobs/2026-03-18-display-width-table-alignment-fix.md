---
title: "Fix mixed-width table alignment in preview and query output"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Fix terminal table misalignment for mixed English and CJK content in `data preview` and `data query` output, without opening a new plan track.

## What Changed

- added a small shared display-width helper for terminal-oriented width measurement, truncation, and padding
- updated `src/cli/data-preview/render.ts` to size, truncate, and pad cells by display width instead of raw string length
- updated `src/cli/data-query/render.ts` with the same display-width rendering logic so query tables do not drift separately from preview tables
- added regression coverage for mixed English and CJK rows in both preview and query rendering tests
- rebuilt `dist/` so `node dist/esm/bin.mjs ...` uses the fix

## Files

- `src/cli/text-display-width.ts`
- `src/cli/data-preview/render.ts`
- `src/cli/data-query/render.ts`
- `test/cli-actions-data-preview/rendering.test.ts`
- `test/cli-actions-data-query.test.ts`

## Verification

- `bunx tsc --noEmit`
- `bun lint`
- `bun test test/cli-actions-data-preview/rendering.test.ts test/cli-actions-data-query.test.ts`
- `bun run build`
- `node dist/esm/bin.mjs data preview examples/playground/tsv-list/core-hierarchy-structure-words.tsv`

## Related Plans

- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`
