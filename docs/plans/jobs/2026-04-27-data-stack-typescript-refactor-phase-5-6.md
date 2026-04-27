---
title: "Data stack TypeScript refactor Phase 5/6"
created-date: 2026-04-27
status: completed
agent: codex
---

## Goal

Complete Phase 5 and Phase 6 of the data-stack TypeScript refactor by moving stack-specific interactive tests out of the shared routing suite and splitting the interactive `data stack` source module into focused folder modules.

## Changes

- Moved stack-specific interactive coverage into `test/cli-interactive-data-stack/`.
- Kept one shared `data stack` routing smoke case in `test/cli-interactive-routing.test.ts`.
- Split stack action mocks into `test/helpers/interactive-harness/mocks/action-stack.ts`.
- Kept query and extract action mocks in `test/helpers/interactive-harness/mocks/action-data.ts`.
- Added `test/helpers/interactive-harness/mocks/action-data-shared.ts` for shared output-path mock behavior.
- Replaced `src/cli/interactive/data/stack.ts` with the folder module `src/cli/interactive/data/stack/`.
- Preserved `runInteractiveDataStack` as the public entrypoint from `src/cli/interactive/data/stack/index.ts`.

## Verification

```bash
bun test test/cli-interactive-routing.test.ts test/cli-interactive-data-stack
bun test test/cli-interactive-data-stack test/cli-actions-data-stack test/cli-command-data-stack
bun run lint
bun run format:check
git diff --check
```

## Review

- `maintainability_reviewer`: initial findings on report persistence normalization and typed stack harness plan artifacts were resolved; re-review returned `findings: []`.
- `test_reviewer`: `findings: []`.

## Related

- `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md`
- `docs/researches/research-2026-04-27-data-stack-typescript-refactor-scan.md`
