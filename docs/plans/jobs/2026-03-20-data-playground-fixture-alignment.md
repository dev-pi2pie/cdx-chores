---
title: "Data playground fixture alignment"
created-date: 2026-03-20
status: completed
agent: codex
---

Aligned the public playground data examples with the data-command guides and generator outputs.

What changed:

- added `generic.csv` to the `scripts/generate-data-query-fixtures.mjs` output set
- added committed `examples/playground/data-query/generic.csv` so the guide examples point at a real public fixture
- widened `examples/playground/.gitignore` so public data-command example directories are intentionally visible/tracked:
  - `data-extract/`
  - `data-query/`
  - `data-query-probe/`
  - `issue-data/`
  - `parquet-preview/`
  - `tabular-preview/`
- updated the data-query fixture generator test to expect the new representative fixture

Why:

- multiple guides referenced `examples/playground/data-query/generic.csv`
- the query fixture generator never created that file, so the docs and public playground set were out of sync
- the broad `examples/playground/.gitignore` made public example intent harder to read for the data-command directories

Verification:

- `bun test test/data-query-fixture-generator.test.ts`
- `node scripts/generate-data-query-fixtures.mjs reset --output-dir examples/playground/.tmp-tests/data-query-fixture-check`
