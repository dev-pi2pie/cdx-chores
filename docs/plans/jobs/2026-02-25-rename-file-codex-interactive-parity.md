---
title: "Add Codex assist parity for rename file CLI and interactive mode"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Close the UX gap where interactive `rename file` did not ask about Codex assistance, by adding Codex support to the single-file rename action and wiring it through CLI and interactive mode.

## What Changed

- Added optional Codex support to `actionRenameFile` in `src/cli/actions/rename.ts`
  - best-effort image title suggestion for eligible single image files
  - deterministic fallback behavior preserved on error/timeout/ineligible file
  - progress and fallback messaging aligned with `rename batch`
  - dry-run CSV rows record AI title metadata when present
- Added `rename file` CLI flags in `src/command.ts`
  - `--codex`
  - `--codex-timeout-ms`
  - `--codex-retries`
  - `--codex-batch-size`
- Updated interactive `rename file` flow in `src/cli/interactive.ts`
  - prompts whether to use Codex-assisted image title when possible

## Tests Added

- `test/cli-actions-data-rename.test.ts`
  - single-file Codex fallback/progress messaging path (injected suggester)

## Verification

- `bun test test/cli-actions-data-rename.test.ts`
- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
