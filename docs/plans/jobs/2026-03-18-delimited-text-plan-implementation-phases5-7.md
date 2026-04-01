---
title: "Implement delimited-text plan phases 5 to 7"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Complete Phase 5 through Phase 7 of `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md` so the lightweight delimited-text expansion is fully implemented, documented, and verified.

## What Changed

- replaced the flat interactive `data` conversion entries with one `data -> convert` lane
- added interactive routing for `data:convert` while still dispatching to the explicit direct actions underneath
- made the interactive convert flow:
  - prompt for one CSV / TSV / JSON input path
  - detect and print the source format from file extension
  - offer only the remaining valid target formats
  - ask `Pretty-print JSON?` only for JSON targets
  - reuse the existing default-vs-custom output path choice
- extended `scripts/generate-tabular-preview-fixtures.mjs` so TSV fixtures are generated alongside CSV and JSON fixtures
- generated and validated `basic.tsv`, `wide.tsv`, and `large.tsv` under `examples/playground/tabular-preview/`
- updated user-facing docs to reflect:
  - TSV support in `data preview`
  - the full explicit CSV / TSV / JSON conversion family
  - the grouped interactive `data -> convert` flow
  - the lightweight PapaParse-backed architecture boundary for this track
- completed the remaining checklist items in `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`

## Files

- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/data.ts`
- `test/helpers/interactive-harness.ts`
- `test/cli-interactive-routing.test.ts`
- `scripts/generate-tabular-preview-fixtures.mjs`
- `README.md`
- `docs/guides/data-preview-usage.md`
- `docs/guides/interactive-path-prompt-ux.md`
- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-routing.test.ts test/cli-actions-data.test.ts test/cli-actions-data-preview/rendering.test.ts test/cli-actions-data-preview/failures.test.ts test/cli-ux.test.ts`
- `node scripts/generate-tabular-preview-fixtures.mjs reset`
- `bun src/bin.ts data preview examples/playground/tabular-preview/basic.tsv`
- `bun src/bin.ts data csv-to-tsv -i examples/playground/tabular-preview/basic.csv -o examples/playground/.tmp-tests/basic.tsv --overwrite`
- `bun src/bin.ts data tsv-to-csv -i examples/playground/tabular-preview/basic.tsv -o examples/playground/.tmp-tests/from-tsv.csv --overwrite`
- `bun src/bin.ts data tsv-to-json -i examples/playground/tabular-preview/basic.tsv -o examples/playground/.tmp-tests/basic.json --pretty --overwrite`
- `bun src/bin.ts data json-to-tsv -i examples/playground/tabular-preview/basic.json -o examples/playground/.tmp-tests/from-json.tsv --overwrite`
- PTY interactive smoke of `bun src/bin.ts` through `data -> convert` with:
  - detected source format display
  - target-format selection
  - default output collision guard
  - successful custom TSV output write

## Related Plans

- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`

## Related Research

- `docs/researches/archive/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
