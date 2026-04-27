---
title: "Data stack TypeScript refactor phases 3 and 4"
created-date: 2026-04-27
status: completed
agent: codex
---

## Goal

Implement Phases 3 and 4 from `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md` without changing direct `data stack` command behavior.

## What Changed

- Split `src/cli/actions/data-stack.ts` into a folder module with:
  - `index.ts`
  - `options.ts`
  - `plan-write.ts`
  - `output-write.ts`
  - `reporting.ts`
  - `run.ts`
- Preserved the existing `src/cli/actions` public exports for:
  - `actionDataStack`
  - `DataStackOptions`
  - `createPreparedDataStackPlan`
  - `writePreparedDataStackPlan`
  - `writePreparedDataStackOutput`
- Split direct action tests into behavior-owned files under `test/cli-actions-data-stack/`.
- Split command-layer stack tests into direct stack, replay, and options files under `test/cli-command-data-stack/`.
- Updated the implementation plan checklist to mark Phases 3 and 4 done.

## Review

- `ts_structure_refactorer` confirmed the source split map, public export constraints, and command/action test grouping.
- `maintainability_reviewer` returned `findings: []`.
- `test_reviewer` returned `findings: []`.

## Verification

```text
bun test test/cli-actions-data-stack test/cli-command-data-stack
bun run lint
bun run format:check
git diff --check
```

Additional focused checks run during the split:

```text
bun test test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts
bun test test/cli-actions-data-stack test/cli-command-data-stack.test.ts
bun test test/cli-command-data-stack
```

## Related Research

- `docs/researches/research-2026-04-27-data-stack-typescript-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md`
