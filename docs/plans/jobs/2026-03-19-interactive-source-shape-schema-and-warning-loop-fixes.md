---
title: "Interactive source-shape schema and warning-loop fixes"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Patched three follow-up issues in the interactive Excel extract/query shaping flow:

- fixed the reviewed Codex source-shape structured-output schema so it remains compatible with the current response-format validator
- removed duplicate trailing ellipsis behavior from interactive analyzer-status messages in the source-shape and header-suggestion flows
- kept the suspicious-shape warning loop active after failed or still-suspicious shaping so interactive extract does not fall straight into materializing a zero-row output unless the user explicitly continues

## Changes

- updated `src/cli/duckdb/source-shape/suggestions.ts` to require all declared schema keys and allow `null` for omitted `range` or `header_row` fields
- updated the source-shape prompt contract so reviewed Codex suggestions return `null` for unchanged optional shaping fields
- widened source-shape suggestion parsing to treat `null` as omission for optional shaping fields
- updated interactive source-shape and header-suggestion analyzer-status call sites in `src/cli/interactive/data-query.ts` to use message text without trailing `...`
- changed interactive suspicious Excel handling in `src/cli/interactive/data-query.ts` so warnings continue after failed reviewed shaping instead of silently proceeding
- added focused regression coverage in:
  - `test/data-source-shape.test.ts`
  - `test/cli-interactive-routing.test.ts`

## Verification

- `bun test test/data-source-shape.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`
