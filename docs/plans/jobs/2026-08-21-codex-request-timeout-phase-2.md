---
title: "Codex request timeout Phase 2"
created-date: 2026-08-21
status: in-progress
agent: codex
---

## Goal

Add the duration-based Codex timeout contract and legacy compatibility notices
to `rename file`, `rename batch`, and `batch-rename` as defined by Phase 2 of
the [Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `b7811d218534debb3128e7d0f92717969311ebdf`

Phase 1 is complete and reviewed. The working tree was clean at this boundary.

## Implementation Boundary

- register the shared and scoped duration flags through one helper
- retain the two legacy millisecond flags and current numeric parsing behavior
- resolve public precedence at the command boundary
- map effective image/document values into the existing scoped numeric action
  fields so the public flags are functional before Phase 3
- emit one compatibility notice before action invocation only when a legacy
  flag was explicitly supplied
- keep analyzer activation, retry behavior, and action internals unchanged

## Validation

```text
bun test test/cli-command-rename-timeout.test.ts test/cli-options-codex-timeout.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-batch-codex-images.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-codex-internals.test.ts test/cli-ux.test.ts
125 pass, 0 fail

bun test
2506 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

Built Node CLI help checks for `rename file`, `rename batch`, and `batch-rename`
all exited `0` and showed the same shared/scoped duration options, deprecated
legacy options, and clarified retry descriptions. No live Codex request was
used for this command-boundary phase.

## Review

Pending. The completed Phase 2 commit range will be recorded after validation
and exact-range review.
