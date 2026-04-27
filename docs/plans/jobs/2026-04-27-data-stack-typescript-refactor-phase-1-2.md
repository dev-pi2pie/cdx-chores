---
title: "Data stack TypeScript refactor phases 1 and 2"
created-date: 2026-04-27
status: completed
agent: codex
---

## Goal

Implement Phases 1 and 2 from `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md` without changing the `data stack` artifact contracts.

## What Changed

- Split `src/cli/data-stack/plan.ts` into a folder module with:
  - `index.ts`
  - `types.ts`
  - `identity.ts`
  - `parse.ts`
  - `serialize.ts`
  - `io.ts`
- Split `src/cli/data-stack/codex-report.ts` into a folder module with:
  - `index.ts`
  - `types.ts`
  - `validation.ts`
  - `artifact.ts`
  - `apply.ts`
- Preserved the existing `data-stack/plan` and `data-stack/codex-report` import style through `index.ts` facades.
- Split stack-plan tests into identity/serialization and parse/I/O groups.
- Split Codex report tests into validation and recommendation-application groups.
- Added `test/helpers/data-stack-test-utils.ts` for shared stack-plan and Codex-report builders while keeping assertions explicit in the test files.
- Updated the implementation plan checklist to mark Phases 1 and 2 done.

## Review

- `ts_structure_refactorer` reviewed the split risks before Phase 2 and called out the ordering, normalization, and stateful Codex patch-validation contracts to preserve.
- `maintainability_reviewer` found one widened facade export; the follow-up removed the accidental public export of internal Codex patch helpers.
- `test_reviewer` returned `findings: []`.

## Verification

```text
bun test test/data-stack-plan test/cli-command-data-stack.test.ts
bun test test/data-stack-codex-report test/cli-actions-data-stack.test.ts
bun run lint
bun run format:check
git diff --check
```

## Related Research

- `docs/researches/research-2026-04-27-data-stack-typescript-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md`
