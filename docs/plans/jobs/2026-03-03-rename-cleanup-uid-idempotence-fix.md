---
title: "Fix rename cleanup uid idempotence"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Address the `rename cleanup --style uid` review finding so rerunning cleanup on an already-normalized UID filename does not generate a fresh UID and rename the file again.

## Scope

- `src/cli/actions/rename/cleanup-uid.ts`
- `test/cli-actions-rename-cleanup-single.test.ts`
- `test/cli-actions-rename-cleanup-uid.test.ts`

## Implemented

- Reused an existing canonical `uid-<token>` basename before falling back to path-hash generation.
- Preserved lowercase canonicalization for existing UID basenames.
- Added regression coverage for:
  - canonical UID basename reuse in the helper
  - the helper-level idempotence boundary for canonical UID basenames before later cleanup semantics removed `--style uid`

## Verification

- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-uid.test.ts`

## Related Plans

- `docs/plans/archive/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
