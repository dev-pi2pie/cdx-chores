---
title: "Implement data preview contains filter"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Implement the `data preview` contains-filter follow-up from `docs/plans/archive/plan-2026-03-09-data-preview-contains-filter.md`.

## What Changed

- added repeatable `--contains <column:keyword>` support to `data preview`
- implemented first-unescaped-`:` parsing with explicit support for `\:` and `\\` escapes
- routed malformed filter input through the existing `CliError` contract with deterministic validation messages
- applied contains filtering on the in-memory preview rows before offset/window slicing
- kept matching literal and case-insensitive against the same display-safe string values already shown in preview rows
- preserved row order after filtering and made preview summaries report filtered totals for both `Rows` and `Window`
- left interactive preview prompts unchanged and documented that row filtering remains CLI-only for now
- expanded focused preview coverage for:
  - single-filter matching
  - multi-filter `AND` behavior
  - filtered summary semantics
  - escaped `:` parsing
  - escaped `\` parsing
  - malformed filter input and escape validation
  - unknown contains-column validation
  - CLI help and CLI-surface error reporting

## Files

- `src/command.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/source.ts`
- `test/cli-actions-data-preview.test.ts`
- `test/cli-ux.test.ts`
- `docs/guides/data-preview-usage.md`
- `docs/plans/archive/plan-2026-03-09-data-preview-contains-filter.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-preview.test.ts test/cli-ux.test.ts`
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv --contains status:active`
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.json --contains name:ada --contains status:active`

## Related Plans

- `docs/plans/archive/plan-2026-03-09-data-preview-contains-filter.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
