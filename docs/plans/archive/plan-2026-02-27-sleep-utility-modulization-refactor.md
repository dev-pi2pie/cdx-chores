---
title: "Codex rename adapter shared-utility modulization refactor"
created-date: 2026-02-27
modified-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Reduce duplication across Codex rename adapters by extracting shared helper patterns into reusable modules while preserving runtime behavior.

## Progress Checklist

- [x] Extract `sleep(ms)` into `src/utils/sleep.ts`.
- [x] Export `sleep` from `src/utils/index.ts`.
- [x] Remove local `sleep` implementations from:
  - `src/adapters/codex/document-rename-titles.ts`
  - `src/adapters/codex/image-rename-titles.ts`
- [x] Add shared Codex adapter helpers in `src/adapters/codex/shared.ts`:
  - shared output schema
  - shared title normalization and response parsing
  - shared chunking helper
  - shared retry/backoff batch orchestration
  - shared batch error summary formatter
- [x] Refactor both rename adapters to consume shared helpers.
- [x] Verify type-check and targeted tests pass after refactor.
- [x] Add dedicated unit tests for `src/adapters/codex/shared.ts` helper behaviors.
- [x] Evaluate applying these shared helpers to future Codex adapters if they follow the same filename/title pattern.

## Scope

- `src/utils/sleep.ts`
- `src/utils/index.ts`
- `src/adapters/codex/shared.ts`
- `src/adapters/codex/document-rename-titles.ts`
- `src/adapters/codex/image-rename-titles.ts`

## Verification

- `bunx tsc --noEmit`
- `bun test test/adapters-codex-shared.test.ts`
- `bun test test/adapters-codex-document-rename-titles.test.ts`
- `bun test test/cli-actions-data-rename.test.ts`

## Evaluation Outcome

- `src/adapters/codex/shared.ts` is now the default utility layer for adapters that follow the same filename/title JSON schema and retry orchestration pattern.
- Future adapters should reuse this module unless they require a materially different response contract.

## Completion Criteria

- No duplicated core batch/retry/title-parsing helpers remain across these two Codex rename adapters.
- Shared helpers are the single source for filename/title response handling and retry summary behavior.
- Existing behavior remains stable for dry-run/apply and Codex-assisted rename flows.
