---
title: "Codex request timeout Phase 2"
created-date: 2026-08-21
status: completed
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

Implementation commits:

- `16e37f03` — added the shared/scoped rename timeout options, legacy notices,
  command-boundary routing, help parity, focused coverage, and execution record
- `af9da6bf` — made option names explicit and separated pure timeout/notice
  resolution from the stderr-writing command boundary

Review range:

```text
b7811d218534debb3128e7d0f92717969311ebdf..af9da6bf
```

The first correctness and test-quality reviews found no material gaps. The
first maintainability review found that option names were derived from
Commander syntax strings and that timeout resolution, migration construction,
and stderr output were too closely coupled. Both findings were accepted and
fixed in `af9da6bf`. The widened correctness, test-quality, and maintainability
reviews then passed with no remaining material findings.

Decision gate: `Continue`. Phase 2 is complete. The three rename surfaces have
a functional shared/scoped duration contract and retain the legacy
compatibility path; Phase 3 may introduce the shared numeric action seam.
