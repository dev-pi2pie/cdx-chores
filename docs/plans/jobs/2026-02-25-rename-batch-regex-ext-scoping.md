---
title: "Rename batch regex/ext scoping and Codex eligibility skips"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement file scoping controls for `rename batch` / `batch-rename` and ensure Codex-assisted mode skips ineligible image files while preserving deterministic rename behavior.

## What Changed

- Added batch file scoping options in `src/cli/actions/rename.ts`:
  - `matchRegex`
  - `skipRegex`
  - `ext`
  - `skipExt`
- Added regex validation with `CliError` (`INVALID_INPUT`) for invalid scope patterns.
- Added planner-level file filtering support in `src/cli/fs-utils.ts` so dry-run previews and CSV snapshots reflect scoped files only.
- Wired CLI flags in `src/command.ts`:
  - `--match-regex`
  - `--skip-regex`
  - `--ext` (repeatable and comma-separated)
  - `--skip-ext` (repeatable and comma-separated)
- Added conservative Codex assist eligibility checks in `src/cli/actions/rename.ts`:
  - skips GIF files (non-static/animated risk)
  - skips oversized local images for Codex assist
  - continues deterministic rename planning for all scoped files

## Tests Added/Updated

- `test/cli-actions-data-rename.test.ts`
  - scopes files with regex + extension filters
  - rejects invalid regex filters
  - skips Codex assist for ineligible images while still renaming deterministically

## Verification

- `bun test test/cli-actions-data-rename.test.ts`
- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/archive/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
- `docs/plans/archive/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
