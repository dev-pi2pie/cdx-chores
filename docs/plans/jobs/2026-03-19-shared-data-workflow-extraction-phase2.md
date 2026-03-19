---
title: "Phase 2 shared data workflow extraction"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Execute Phase 2 from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` by extracting shared data workflow helpers where duplication is already real, while preserving current CLI and interactive behavior.

## Scope

- `src/cli/actions/data-extract.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/interactive/data.ts`
- `src/cli/interactive/data-query.ts`
- new `src/cli/data-workflows/` helpers required by the extraction

## Constraints

- keep the refactor structural rather than semantic
- extract only helpers with real current duplication
- preserve command help, runtime behavior, and current output wording unless normalization is required by the shared helper
- do not start the larger `src/cli/interactive/data-query.ts` folder split in this phase

## Intended Extraction Targets

- shared header-mapping suggestion and artifact-review flow used by:
  - `src/cli/actions/data-extract.ts`
  - `src/cli/actions/data-query.ts`
- shared DuckDB extension remediation helpers used by:
  - `src/cli/interactive/data.ts`
  - `src/cli/interactive/data-query.ts`

## Deferred Unless Duplication Justifies It During Implementation

- `src/cli/data-workflows/source-shape-flow.ts`
- `src/cli/data-workflows/output.ts`
- `src/cli/data-workflows/interactive-session.ts`

## Verification Plan

- `bun test test/cli-actions-data-query.test.ts`
- `bun test test/cli-actions-data-extract.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bun test test/cli-command-data-extract.test.ts`
- `bun test test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## What Changed

- Added `src/cli/data-workflows/header-mapping-flow.ts` for the shared header-mapping review flow used by:
  - `src/cli/actions/data-query.ts`
  - `src/cli/actions/data-extract.ts`
- Added `src/cli/data-workflows/duckdb-remediation.ts` for the shared DuckDB extension remediation helpers used by:
  - `src/cli/interactive/data.ts`
  - `src/cli/interactive/data-query.ts`
- Replaced duplicated header-mapping artifact resolution, suggestion summary rendering, and suggestion follow-up wiring in the two action modules with the shared helper.
- Replaced duplicated interactive DuckDB remediation helpers in the two interactive modules with the shared helper.

## Deferred

- `src/cli/data-workflows/source-shape-flow.ts`
- `src/cli/data-workflows/output.ts`
- `src/cli/data-workflows/interactive-session.ts`

These were kept out of Phase 2 because the current duplication was not yet strong enough to justify introducing shared modules for them.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query.test.ts`
- `bun test test/cli-actions-data-extract.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bun test test/cli-command-data-extract.test.ts`
- `bun test test/cli-interactive-routing.test.ts`
