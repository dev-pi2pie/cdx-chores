---
title: "Complete Codex rename adapter shared-utility refactor"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Complete the Codex adapter modulization refactor by extracting reusable helper patterns, finishing remaining checklist tasks, and validating behavior parity.

## Implemented

- Added shared async delay utility:
  - `src/utils/sleep.ts`
  - `src/utils/index.ts` export wiring
- Added shared Codex adapter helper module:
  - `src/adapters/codex/shared.ts`
  - shared filename/title output schema
  - shared title normalization
  - shared filename/title response parsing
  - shared chunking helper
  - shared retry/backoff batch orchestration
  - shared batch error summary formatting
  - shared read-only Codex thread creation helper
- Refactored adapters to consume shared helpers:
  - `src/adapters/codex/image-rename-titles.ts`
  - `src/adapters/codex/document-rename-titles.ts`
- Added dedicated tests for shared helper behaviors:
  - `test/adapters-codex-shared.test.ts`

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test test/adapters-codex-shared.test.ts` ✅
- `bun test test/adapters-codex-document-rename-titles.test.ts` ✅
- `bun test test/cli-actions-data-rename.test.ts` ✅

## Notes

- Shared helper usage was evaluated and accepted as the default pattern for future Codex adapters that use the same filename/title JSON contract.
- Adapters with materially different response contracts should introduce adapter-local parsing logic while reusing common primitives where compatible.

## Related Plans

- `docs/plans/archive/plan-2026-02-27-sleep-utility-modulization-refactor.md`
