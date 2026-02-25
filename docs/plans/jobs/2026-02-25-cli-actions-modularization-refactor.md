---
title: "Refactor CLI actions into domain modules"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement the CLI action modularization plan by splitting `src/cli/actions.ts` into domain-oriented modules while preserving current CLI and interactive-mode behavior.

## Scope

- Extract action domains from `src/cli/actions.ts`
- Add a shared action helper module for common validation/output helpers
- Keep imports stable through a compatibility re-export
- Preserve runtime behavior and output text
- Record the `src/markdown/**` taxonomy decision

## Implemented

- Added modular action files under `src/cli/actions/`:
  - `shared.ts`
  - `doctor.ts`
  - `data.ts`
  - `markdown.ts`
  - `rename.ts`
  - `video.ts`
  - `deferred.ts`
  - `index.ts` (barrel exports)
- Replaced `src/cli/actions.ts` with a thin compatibility re-export:
  - `export * from "./actions/index";`
- Preserved action names and option interfaces used by:
  - `src/command.ts`
  - `src/cli/interactive.ts`

## Taxonomy Decision (Module Layout Follow-up)

- `src/markdown/**` stays in place for now.
- Rationale:
  - it behaves like a standalone parsing/domain subsystem, not a generic utility bucket
  - moving it into `src/utils/markdown/**` would increase the chance that `src/utils/**` becomes a catch-all
  - directory moves can be handled later in a dedicated taxonomy cleanup plan/job if we decide to rename toward `src/parsers/**` or `src/core/**`

## Verification

Tests:

- `bun test` ✅ (`3 pass`, `0 fail`)

Type checking:

- `bunx tsc --noEmit` -> unchanged pre-existing failure only:
  - `src/markdown/types.ts` imports missing `../wc/types`

Manual smoke checks:

- `bun src/bin.ts doctor --json` ✅
- `bun src/bin.ts rename batch .tmp-refactor-rename --dry-run` ✅

## Related Plans

- `docs/plans/plan-2026-02-25-cli-actions-modularization.md`

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

