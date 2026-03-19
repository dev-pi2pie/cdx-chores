---
title: "Phase 3 interactive data-query split"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Execute Phase 3 from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` by converting `src/cli/interactive/data-query.ts` into a folder-based module while preserving current interactive behavior.

## Scope

- `src/cli/interactive/data-query.ts`
- new `src/cli/interactive/data-query/` modules
- minimal import updates required to keep the same public interactive entrypoints

## Constraints

- keep `runInteractiveDataQuery()` as the stable public entrypoint
- preserve current prompt wording, output wording, and execution behavior
- keep the refactor structural rather than semantic
- avoid starting the `src/cli/duckdb/query.ts` split inside this phase

## Planned Target Shape

```text
src/cli/interactive/data-query/
  index.ts
  duckdb-remediation.ts # only if still needed after shared data-workflow extraction
  execution.ts
  header-review.ts
  source-selection.ts
  source-shape.ts
  types.ts
  sql/
    codex.ts
    formal-guide.ts
    manual.ts
```

## Verification Plan

- `bun test test/cli-interactive-routing.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## What Changed

- Converted the old flat implementation into a folder-based module under `src/cli/interactive/data-query/`.
- Added:
  - `src/cli/interactive/data-query/index.ts`
  - `src/cli/interactive/data-query/types.ts`
  - `src/cli/interactive/data-query/source-selection.ts`
  - `src/cli/interactive/data-query/source-shape.ts`
  - `src/cli/interactive/data-query/header-review.ts`
  - `src/cli/interactive/data-query/execution.ts`
  - `src/cli/interactive/data-query/sql/formal-guide.ts`
  - `src/cli/interactive/data-query/sql/manual.ts`
  - `src/cli/interactive/data-query/sql/codex.ts`
- Replaced `src/cli/interactive/data-query.ts` with a thin compatibility re-export shim.
- Kept the public entrypoints stable for:
  - `promptInteractiveInputFormat()`
  - `promptOptionalSourceSelection()`
  - `collectInteractiveIntrospection()`
  - `reviewInteractiveHeaderMappings()`
  - `runInteractiveDataQuery()`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-routing.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
