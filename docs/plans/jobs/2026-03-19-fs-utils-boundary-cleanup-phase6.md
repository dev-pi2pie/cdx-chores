---
title: "Phase 6 fs-utils boundary cleanup"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Execute Phase 6 from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` by removing the mixed-responsibility ownership in `src/cli/fs-utils.ts` without breaking existing import compatibility.

## Scope

- `src/cli/fs-utils.ts`
- new `src/cli/path-utils.ts`
- new `src/cli/file-io.ts`
- new `src/cli/rename/planner.ts`
- new `src/cli/rename/apply.ts`
- internal import rewires required to move source modules onto the new boundaries

## Constraints

- keep the refactor structural rather than semantic
- preserve current rename planning and apply behavior
- preserve current path-display and file-write behavior
- avoid broad unrelated rename workflow rewrites beyond import ownership cleanup

## Planned Target Shape

```text
src/cli/
  file-io.ts
  fs-utils.ts
  path-utils.ts
  rename/
    apply.ts
    planner.ts
```

## Verification Plan

- `bunx oxlint --tsconfig tsconfig.json src test scripts`
- `bunx tsc --noEmit`
- `bun test test/cli-fs-utils-rename-template.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-path.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-extract.test.ts`
- `bun run build`
- `node dist/esm/bin.mjs rename file --help`
- `bun test`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## What Changed

- Added `src/cli/path-utils.ts` for:
  - `defaultOutputPath`
  - `resolveFromCwd()`
  - `formatPathForDisplay()`
- Added `src/cli/file-io.ts` for:
  - `readTextFileRequired()`
  - `ensureParentDir()`
  - `writeTextFileSafe()`
- Added `src/cli/rename/planner.ts` for:
  - rename-template rendering
  - batch rename planning
  - single-file rename planning
- Added `src/cli/rename/apply.ts` for:
  - `applyPlannedRenames()`
- Replaced the old implementation in `src/cli/fs-utils.ts` with a thin compatibility re-export shim.
- Rewired internal source imports onto the new ownership modules so `src/cli/fs-utils.ts` is no longer the active utility bucket inside the codebase.

## Compatibility Decision

- Kept `src/cli/fs-utils.ts` as a compatibility shim.
- Reason:
  - it preserves the existing import surface for callers that still rely on it
  - the shim is now thin enough that it no longer owns mixed behavior itself
  - internal source modules now import from the new focused modules directly

## Verification

- `bunx oxlint --tsconfig tsconfig.json src test scripts`
- `bunx tsc --noEmit`
- `bun test test/cli-fs-utils-rename-template.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-path.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-extract.test.ts`
- `bun run build`
- `node dist/esm/bin.mjs rename file --help`
- `bun test`
