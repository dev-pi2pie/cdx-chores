---
title: "Remove deferred PDF and DOCX command placeholders"
created-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Remove public CLI command entries that only advertised deferred behavior, so help output reflects implemented features only.

## What Changed

- removed the deferred `pdf` command family placeholders from `src/command.ts`
- removed the deferred `docx to-pdf` placeholder from `src/command.ts`
- removed the now-unused `actionDeferred` export and deleted `src/cli/actions/deferred.ts`
- deleted the obsolete deferred-action test coverage from `test/cli-actions-doctor-markdown-video-deferred.test.ts`
- added a CLI UX assertion that root help no longer advertises `docx` or `pdf`

## Files

- `src/command.ts`
- `src/cli/actions/index.ts`
- `src/cli/actions/deferred.ts`
- `test/cli-actions-doctor-markdown-video-deferred.test.ts`
- `test/cli-ux.test.ts`

## Verification

- `bun test test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- `rg -n "actionDeferred" src test`

## Related Plans

- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
- `docs/plans/archive/plan-2026-02-25-initial-launch-lightweight-implementation.md`
