---
title: "Interactive module folder refactor"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Implement the folder-based split of `src/cli/interactive.ts` so interactive menu routing and domain flows are separated without changing prompt behavior or action-layer semantics.

## Scope

- `docs/plans/plan-2026-03-02-interactive-module-folder-refactor.md`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/menu.ts`
- `src/cli/interactive/shared.ts`
- `src/cli/interactive/data.ts`
- `src/cli/interactive/markdown.ts`
- `src/cli/interactive/rename.ts`
- `src/cli/interactive/video.ts`
- `src/cli/interactive.ts`

## Implemented

- Replaced the monolithic `src/cli/interactive.ts` file with a folder-based `src/cli/interactive/` module.
- Moved menu-owned action types, menu choices, and submenu selection into `src/cli/interactive/menu.ts`.
- Added a thin `src/cli/interactive/index.ts` entrypoint that creates `pathPromptContext` once, keeps the `doctor` flow inline, and dispatches to domain handlers.
- Split data, markdown, rename, and video interactive flows into focused modules while preserving prompt wording and existing action calls.
- Kept rename-owned prompt helpers inside `src/cli/interactive/rename.ts`, including `promptRenamePatternConfig()` and `validateIntegerInput()`.
- Added a minimal `src/cli/interactive/shared.ts` file for the cross-module path prompt context type instead of introducing a larger helper bucket.
- Hardened the new dispatcher and domain handlers with explicit branch coverage plus an `assertNever`-style failure path for unexpected interactive actions.
- Added direct interactive-mode tests that stub `@inquirer/prompts` inside isolated Bun subprocesses so one route per domain is exercised without contaminating the main test process.
- Followed up with a small cleanup pass that moved domain action subtype ownership into `menu.ts` and replaced the top-level manual type guards with a `switch` dispatcher.
- Updated the implementation plan to reflect the completed extraction and verification.

## Verification

- `bunx tsc --noEmit` ✅
- `bun test test/cli-actions-data.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-apply-replay.test.ts test/cli-rename-interactive-router.test.ts test/cli-path.test.ts` ✅
- `bun test test/cli-interactive.test.ts` ✅
- `bun run build` ✅
- `bunx oxlint --tsconfig tsconfig.json src test scripts` ✅
- `bun test` ✅

## Outcome

- Interactive mode now has a stable folder boundary with a thin entrypoint and domain-specific handlers.
- `pathPromptContext` remains explicit and shared through a small typed contract rather than hidden module state.
- Verification completed cleanly with 201 passing tests across 32 files.

## Related Plans

- `docs/plans/plan-2026-03-02-interactive-module-folder-refactor.md`
