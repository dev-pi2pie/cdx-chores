---
title: "Phase 1 command registration split"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Execute Phase 1 from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` by splitting `src/command.ts` into command registration modules and shared option helpers while preserving current CLI behavior.

## Scope

- `src/command.ts`
- new `src/cli/commands/` modules
- new `src/cli/options/` modules
- minimal import updates required to preserve the current public CLI entrypoint

## Constraints

- keep `runCli()` as the stable public entrypoint
- preserve current command names, flags, parsing behavior, and help text
- keep the refactor structural rather than semantic
- avoid touching unrelated hotspots during this phase

## Planned Target Shape

```text
src/cli/commands/
  index.ts
  data.ts
  markdown.ts
  rename.ts
  video.ts
src/cli/options/
  common.ts
  parsers.ts
```

## Verification Plan

- `bun test test/cli-ux.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bun test test/cli-command-data-extract.test.ts`
- `bun test test/cli-command-rename-cleanup.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## What Changed

- Reduced `src/command.ts` to CLI bootstrap, global argv normalization, runtime creation, and top-level program configuration.
- Added `src/cli/options/parsers.ts` for shared CLI parser and collector helpers.
- Added `src/cli/options/common.ts` for shared option-wiring helpers.
- Added `src/cli/commands/index.ts` to register non-root command families.
- Added focused command-family modules:
  - `src/cli/commands/data.ts`
  - `src/cli/commands/markdown.ts`
  - `src/cli/commands/rename.ts`
  - `src/cli/commands/video.ts`
- Preserved `runCli()` as the public entrypoint and kept command names, flags, help text, and action wiring stable.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-ux.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-query-codex.test.ts`
- `bun test test/cli-command-data-extract.test.ts`
- `bun test test/cli-command-rename-cleanup.test.ts`
