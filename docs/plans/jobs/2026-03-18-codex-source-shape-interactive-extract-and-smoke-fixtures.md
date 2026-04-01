---
title: "Implement Codex source-shape assistance, interactive data extract, and public-safe smoke fixtures"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Land the missing reviewed Codex source-shape layer, reuse it in `data extract`, expose `data extract` in interactive mode, polish the interactive Codex prompt copy, and add a dedicated public-safe fixture generator for extract and shaping smoke scenarios.

## What Changed

- added shared source-shape helpers under `src/cli/duckdb/source-shape/` for:
  - source-shape artifact naming and writing
  - exact-match artifact reuse validation
  - Codex suggestion normalization
- expanded `src/cli/duckdb/xlsx-sources.ts` with worksheet snapshot inspection so reviewed source-shape suggestions can operate on Excel structure instead of inventing a second parsing path
- added first-pass direct CLI source-shape support to `data extract`:
  - `--codex-suggest-shape`
  - `--write-source-shape <path>`
  - `--source-shape <path>`
- kept the source-shape flow explicitly review-first:
  - suggestion runs write a JSON source-shape artifact and stop
  - reuse runs apply the accepted shape before header review or extraction continues
- kept semantic header review downstream of accepted source shaping
- added interactive `data extract` to the data submenu and dispatcher
- implemented the interactive extract flow so it can:
  - choose SQLite tables or Excel sheets
  - detect suspicious whole-sheet Excel schemas
  - keep the current shape, enter a range manually, or ask Codex to suggest shaping
  - re-inspect after accepted shape changes
  - reuse the existing in-memory semantic header review before materialization
- updated interactive `data query` Codex Assistant prompts to use `Describe the query intent:`
- added `scripts/generate-data-extract-fixtures.mjs` for deterministic public-safe extract and shaping fixtures under `examples/playground/data-extract/`
- documented the new shape-suggestion flow and interactive extract behavior in `docs/guides/data-extract-usage.md` and refreshed the interactive query guide
- completed the checklist in `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`

## Verification

- `bun test test/data-source-shape.test.ts test/data-extract-fixture-generator.test.ts test/data-query-xlsx-sources.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts`
- `bunx tsc --noEmit`

## Notes

- first-pass reviewed source-shape assistance stays intentionally narrow:
  - Excel-only
  - explicit sheet selection still comes from `--source`
  - Codex suggests an explicit `range`
- interactive extract delegates the actual write step to the shared `data extract` action rather than duplicating materialization logic
- public docs and generated fixture names stay behavior-oriented and avoid private local repro references

## Related Plans

- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/archive/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`

## Related Research

- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
