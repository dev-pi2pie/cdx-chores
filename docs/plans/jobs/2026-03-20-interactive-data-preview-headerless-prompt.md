---
title: "Add headerless prompt to interactive data preview"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Make interactive `data preview` handle headerless CSV and TSV inputs explicitly instead of always assuming the first row is a header.

## What Changed

- updated `src/cli/interactive/data/preview.ts` so interactive preview asks CSV and TSV users whether the input should be treated as headerless
- passed the selected header mode into both preview execution and contains-filter validation, so generated `column_n` names stay consistent in interactive `--contains` validation
- added interactive routing coverage in `test/cli-interactive-routing.test.ts` for both the default preview flow and the headerless CSV flow

## Verification

- `bun test test/cli-interactive-routing.test.ts`
- `bun run lint`
