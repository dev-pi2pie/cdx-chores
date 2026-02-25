---
title: "Tune Codex rename timeout, add progress feedback, and fallback tests"
created-date: 2026-02-25
modified-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Improve the Codex-assisted image rename MVP UX and reliability by:

- showing progress while Codex title generation is running
- tuning Codex request settings for better success odds
- adding automated tests for the fallback messaging path

## Implemented

- Added visible progress feedback in `src/cli/actions/rename.ts`
  - non-TTY: prints a status line (`Codex: analyzing ...`)
  - TTY: spinner-style status line while Codex suggestion generation is running
- Added test seam to `RenameBatchOptions` for deterministic Codex fallback-path testing:
  - `codexTitleSuggester` (injected suggester)
  - `codexTimeoutMs` (optional override)
- Tuned Codex adapter request settings in `src/adapters/codex/image-rename-titles.ts`
  - timeout increased from 15s to 30s
  - `modelReasoningEffort` changed from unsupported `minimal` to supported `low` (for current Codex model behavior)
  - `networkAccessEnabled: true`
  - `webSearchMode: "disabled"`
  - retains low-cost reasoning intent via `low`
- Added user-tunable CLI controls for Codex-assisted rename:
  - `--codex-timeout-ms`
  - `--codex-retries`
  - `--codex-batch-size`
- Added adapter support for Codex batching + per-batch retries with partial-success aggregation
- Added unit test for forwarding Codex tuning options from `actionRenameBatch(...)` to the suggester
- Added automated fallback messaging test in `test/cli-actions-data-rename.test.ts`
  - verifies progress line + fallback summary + Codex note output when suggester returns an error

## Verification

Automated checks:

- `bun test` ✅ (`20 pass`, `0 fail`)
- `bunx tsc --noEmit` ✅

Manual dry-run on real fixtures:

- `bun src/bin.ts rename batch --help` ✅ (new Codex tuning flags shown)
- `bun src/bin.ts rename batch examples/playground/images --dry-run --codex` ✅
  - command succeeded
  - progress line displayed
  - unsupported reasoning-effort API error resolved after `minimal` -> `low`
  - current environment still aborted Codex request and fell back to deterministic naming

## Notes

- This pass improves UX and fallback visibility, but does not guarantee Codex suggestions in every environment.
- If suggestions keep aborting locally, likely causes are Codex CLI auth/session state or environment/network constraints.

## Follow-up Jobs

- Job: add configurable timeout/retry/batch controls for Codex-assisted rename
- Job: investigate local Codex CLI auth/environment state when rename suggestions abort
- Job: add success-path tests for Codex title suggestions via injected suggester

## Related Plans

- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
