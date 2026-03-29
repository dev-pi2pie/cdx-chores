---
title: "Tabular data preview v1 implementation"
created-date: 2026-03-09
modified-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Implement the first pass of `data preview` from `docs/plans/archive/plan-2026-03-09-tabular-data-preview-v1-implementation.md`.

## Phase Slice

- Phase 1: Freeze v1 command contract
- Phase 2: Add preview source normalization
- Phase 3: Add terminal table rendering
- Phase 4: Wire the command surface
- Phase 5: Tests
- Phase 6: Smoke-test fixture tooling
- Phase 7: Docs and manual verification

## What Changed

- added `data preview <input>` as a new `data` subcommand with:
  - `--rows`
  - `--offset`
  - `--columns`
- added modular preview implementation files under `src/cli/data-preview/` for:
  - JSON normalization reuse
  - in-memory preview sources
  - terminal table rendering
- added `src/cli/actions/data-preview.ts` as a thin preview action layer
- kept JSON/CSV conversion behavior intact while reusing shared JSON normalization logic
- implemented deterministic preview rules for:
  - first-seen JSON key union ordering
  - blank CSV header name generation
  - duplicate CSV header deduplication
  - wider-than-header CSV row extension
  - scalar-array JSON fallback through a single `value` column
- implemented terminal rendering behavior for:
  - TTY width adaptation
  - aggressive wrapping avoidance through truncation
  - bounded visible column fallback
  - deterministic non-TTY output
- added focused preview tests for:
  - happy paths
  - edge cases
  - malformed input
  - invalid CLI row-count parsing
  - narrow-width TTY behavior
- added `scripts/generate-tabular-preview-fixtures.mjs`
- generated deterministic smoke fixtures under `examples/playground/tabular-preview/`
- added `docs/guides/data-preview-usage.md`
- documented that machine-readable `--format json` output is deferred and DuckDB remains out of the v1 execution path

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data.test.ts test/cli-actions-data-preview.test.ts test/cli-ux.test.ts`
- `node scripts/generate-tabular-preview-fixtures.mjs reset`
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.csv` (non-TTY)
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.json` (TTY)
- `bun src/bin.ts data preview examples/playground/tabular-preview/wide.csv` after `stty cols 20` in a PTY session (narrow-width TTY)

## Related Plans

- `docs/plans/archive/plan-2026-03-09-tabular-data-preview-v1-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
