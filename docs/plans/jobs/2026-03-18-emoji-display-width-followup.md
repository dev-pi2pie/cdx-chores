---
title: "Fix emoji display width handling in terminal tables"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Address the review finding that emoji-rich values were still mismeasured by the shared terminal display-width helper, which could leave `data preview` and `data query` tables misaligned or untruncated.

## What Changed

- updated `src/cli/text-display-width.ts` to measure text by grapheme clusters instead of raw code points
- treated emoji graphemes, joined emoji sequences, keycaps, and regional-indicator flags as width `2`
- preserved the existing CJK-width behavior for non-emoji wide characters
- added regression coverage in `test/cli-text-display-width.test.ts`
- added a preview-level regression test in `test/cli-actions-data-preview/rendering.test.ts` to verify emoji-heavy columns now truncate

## Verification

- `bun test test/cli-text-display-width.test.ts test/cli-actions-data-preview/rendering.test.ts test/cli-actions-data-query.test.ts`
- `bunx tsc --noEmit`
