---
title: "Implement data extract shaped-table materialization"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Land the first direct `data extract` lane so one shaped logical table can be materialized to `.csv`, `.tsv`, or `.json` without introducing a second shaping or header-mapping system.

## What Changed

- added `data extract <input>` to the CLI with:
  - `--output <path>`
  - `--input-format <format>`
  - `--source <name>`
  - `--range <A1:Z99>`
  - `--header-mapping <path>`
  - `--codex-suggest-headers`
  - `--write-header-mapping <path>`
  - `--overwrite`
- implemented `src/cli/actions/data-extract.ts` on top of the existing shared helpers for:
  - input-format detection
  - shaped-source preparation
  - accepted header-mapping reuse
  - reviewed Codex header-suggestion artifacts
- kept the reviewed suggestion flow explicitly two-step:
  - suggestion run writes the JSON mapping artifact and stops
  - follow-up run reuses `--header-mapping <path>` plus `--output <path>` to materialize the shaped table
- added direct materialization writers for:
  - `.csv`
  - `.tsv`
  - `.json`
- kept artifact-writing behavior explicit:
  - materialization writes no result payload to stdout
  - materialization status lines go to stderr
  - suggestion review summaries stay on stdout and artifact status lines stay on stderr
- added a dedicated `docs/guides/data-extract-usage.md` guide
- updated the shared schema-and-mapping guide and the query guide so the new extract lane is discoverable
- completed the checklist in `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`

## Verification

- `bun test test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts test/cli-ux.test.ts`
- `bunx tsc --noEmit`

## Notes

- the implementation reuses the same shaped-table contract as `data query`; it does not introduce a parallel shaping or mapping path
- public docs stay behavior-oriented and avoid naming private local repro files
- private manual smoke verification can still use local-only repro files without documenting those paths here

## Related Plans

- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
