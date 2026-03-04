---
title: "Implement rename uid pattern placeholder"
created-date: 2026-03-04
status: completed
agent: codex
---

## Goal

Implement `{uid}` support in `rename file` and `rename batch` `--pattern` templates without introducing a second UID contract separate from `rename cleanup`.

## Scope

- `src/cli/rename-uid.ts`
- `src/cli/fs-utils.ts`
- `src/cli/actions/rename/cleanup-uid.ts`
- `src/command.ts`
- `src/cli/interactive/rename.ts`
- `test/cli-fs-utils-rename-template.test.ts`
- `test/cli-actions-rename-cleanup-uid.test.ts`
- `test/cli-ux.test.ts`
- `test/cli-interactive-rename.test.ts`
- `README.md`
- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/plans/plan-2026-03-04-rename-uid-pattern-placeholder.md`

## What Changed

- Added a shared rename UID helper in `src/cli/rename-uid.ts`.
- Rewired cleanup UID generation to reuse the shared helper instead of owning a duplicate digest implementation.
- Extended rename template validation to accept `{uid}` and updated the allowed-placeholder error text.
- Precomputed deterministic UID values during single-file and batch planning only when the template contains `{uid}`.
- Rendered `{uid}` as a deterministic `uid-<token>` fragment in general rename templates.
- Updated CLI help text and interactive custom-template hint text to list `{uid}`.
- Added focused tests for `{uid}` rendering, determinism, CLI help, and interactive copy.
- Updated the live docs to describe `{uid}` as supported in general rename templates.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-fs-utils-rename-template.test.ts test/cli-actions-rename-cleanup-uid.test.ts test/cli-ux.test.ts test/cli-interactive-rename.test.ts`

## Notes

- General rename keeps the existing numeric-suffix collision behavior in this pass.
- Cleanup continues to own its `uid-suffix` conflict strategy and widening fallback list.
- The shared helper keeps the same deterministic `uid-<token>` family across cleanup and general rename.

## Related Plans

- `docs/plans/plan-2026-03-04-rename-uid-pattern-placeholder.md`

## Related Research

- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
