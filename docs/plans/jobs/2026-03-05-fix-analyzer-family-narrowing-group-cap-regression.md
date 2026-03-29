---
title: "Fix analyzer family narrowing group-cap regression"
created-date: 2026-03-05
status: completed
agent: codex
---

## Goal

Fix the interactive `rename cleanup` regression where selected analyzer families could be dropped before narrowing because grouped evidence was capped too early.

## Scope

- `src/cli/interactive/rename-cleanup.ts`
- `test/helpers/interactive-harness.ts`
- `test/cli-interactive-rename.test.ts`

## What Changed

- Updated interactive analyzer evidence collection to request a wider temporary grouped-pattern cap (`groupLimit` aligned to analyzer `sampleLimit`) before family narrowing.
- Kept grouped review and Codex prompt output bounded by their existing presentation/prompt safety limits.
- Added interactive harness capture for analyzer evidence collection options (`rename:cleanup:collect-evidence`) to support regression assertions.
- Added a regression test that verifies interactive cleanup requests uncapped group collection for family narrowing.

## Verification

- `bun test test/cli-interactive-rename.test.ts`
- `bun test test/cli-interactive-rename.test.ts test/cli-ux.test.ts`

## Related Plans

- `docs/plans/archive/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`
- `docs/plans/archive/plan-2026-03-05-rename-cleanup-analyzer-scalability.md`

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
