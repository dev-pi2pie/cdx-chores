---
title: "Phase 4 DuckDB query service split"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Execute Phase 4 from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` by converting `src/cli/duckdb/query.ts` into a folder-based module while preserving the current public exports.

## Scope

- `src/cli/duckdb/query.ts`
- new `src/cli/duckdb/query/` modules
- minimal import updates required to preserve the current public API

## Constraints

- preserve the current public exports through `src/cli/duckdb/query/index.ts`
- keep the refactor structural rather than semantic
- watch explicitly for circular imports with:
  - `src/cli/duckdb/header-mapping.ts`
  - `src/cli/duckdb/source-shape.ts`
  - `src/cli/duckdb/xlsx-sources.ts`

## Planned Target Shape

```text
src/cli/duckdb/query/
  index.ts
  execute.ts
  excel-range.ts
  formats.ts
  introspection.ts
  prepare-source.ts
  source-resolution.ts
  types.ts
```

## Verification Plan

- `bun test test/cli-actions-data-query.test.ts`
- `bun test test/cli-actions-data-extract.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bun test test/data-query-header-mapping.test.ts`
- `bun test test/data-query-xlsx-sources.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## What Changed

- Converted the old flat implementation into a folder-based module under `src/cli/duckdb/query/`.
- Added:
  - `src/cli/duckdb/query/index.ts`
  - `src/cli/duckdb/query/types.ts`
  - `src/cli/duckdb/query/formats.ts`
  - `src/cli/duckdb/query/excel-range.ts`
  - `src/cli/duckdb/query/source-resolution.ts`
  - `src/cli/duckdb/query/prepare-source.ts`
  - `src/cli/duckdb/query/execute.ts`
  - `src/cli/duckdb/query/introspection.ts`
- Replaced `src/cli/duckdb/query.ts` with a thin compatibility re-export shim.
- Preserved the current public export surface for query typing, source preparation, execution, introspection, format detection, and Excel helpers.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query.test.ts`
- `bun test test/cli-actions-data-extract.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bun test test/data-query-header-mapping.test.ts`
- `bun test test/data-query-xlsx-sources.test.ts`
