---
title: "Implement Codex-assisted image rename MVP and action integration guide"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement a first Codex-assisted rename MVP for image files in `rename batch` (opt-in, best-effort, fallback-safe) and add an action/tool integration guide for future chores development.

## Implemented

- Added Codex adapter boundary:
  - `src/adapters/codex/image-rename-titles.ts`
- Implemented opt-in Codex-assisted image title generation in `src/cli/actions/rename.ts`
  - filters supported image extensions
  - requests semantic titles via Codex SDK in batch
  - reuses deterministic rename planning via `titleOverrides`
  - falls back to deterministic naming when Codex returns no suggestions or errors
  - prints user-facing Codex summary + fallback note
- Added a 15s timeout for Codex rename title generation to avoid hanging the CLI
- Extended `planBatchRename(...)` in `src/cli/fs-utils.ts` to accept optional title overrides
- Added CLI flags for rename commands:
  - `rename batch --codex`
  - `batch-rename --codex`
- Added interactive mode prompt toggle for Codex-assisted image titles in `src/cli/interactive.ts`
- Added documentation guide:
  - `docs/guides/cli-action-tool-integration-guide.md`

## Verification

Automated checks:

- `bun test` ✅ (`19 pass`, `0 fail`)
- `bunx tsc --noEmit` ✅

Manual CLI checks:

- `bun src/bin.ts rename batch --help` ✅ (`--codex` flag shown)
- `bun src/bin.ts rename batch examples/playground/images --dry-run --codex` ✅
  - In current environment, Codex suggestion generation timed out and deterministic fallback was used
  - Command remained successful and preview output was produced

## Notes

- This is an MVP implementation. Production-hardening items (configurable timeout/retries, richer tests for Codex failure modes, and docs examples) remain follow-up work.

## Follow-up Jobs

- Job: add automated tests for Codex unavailable/timeout fallback messaging in `rename batch`
- Job: add configurable Codex timeout/retry/batch-size controls
- Job: add docs examples for image-folder rename workflows using `--dry-run --codex`

## Related Plans

- `docs/plans/archive/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`

