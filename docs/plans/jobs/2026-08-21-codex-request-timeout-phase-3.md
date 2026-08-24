---
title: "Codex request timeout Phase 3"
created-date: 2026-08-21
status: completed
agent: codex
---

## Goal

Thread the shared normalized Codex timeout through rename file and batch actions,
resolve effective analyzer values after routing, and preserve existing retry and
fallback behavior as defined by Phase 3 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `6e5b162525927df83d0167e5e907a9c89607aae7`

Phases 1 and 2 are complete and reviewed. The working tree was clean at this
boundary.

## Implementation Boundary

- add one optional shared numeric timeout seam to rename file and batch actions
- preserve existing image and document numeric action fields
- resolve scoped, shared, and default precedence only after analyzer routing
- pass one effective timeout to each enabled analyzer and every retry attempt
- keep timeout options from enabling Codex analysis
- preserve retry counts, delays, ordering, partial suggestions, fallback, and
  exit behavior

## Validation

```text
bun test test/cli-options-codex-timeout.test.ts test/cli-command-rename-timeout.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-images.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-codex-internals.test.ts test/adapters-codex-shared.test.ts
101 pass, 0 fail

bun test
2508 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

Focused coverage verifies command/action separation, shared/scoped/default
precedence, enabled-only routing, mixed analyzers, action-level numeric values
above the duration-option cap, retry and batch option preservation, file-action
forwarding, and `batch-rename` parity. No live Codex request was used.

## Review

Implementation commits:

- `12bb3fa6` — added the shared action seam, post-routing effective timeout
  resolution, command/action separation, focused routing coverage, and the
  initial Phase 3 execution record
- `0394978d` — added the file-action shared timeout, retry, and batch forwarding
  regression requested during review

Review range:

```text
6e5b162525927df83d0167e5e907a9c89607aae7..0394978dcc62297220b6b62e7e2b7f7f6c5d2e81
```

The first correctness and maintainability reviews found no material issues. The
test-quality review found that batch coverage proved the shared action seam but
the file action lacked equivalent custom shared-timeout and tuning-option
coverage. The finding was accepted and fixed in `0394978d`. The widened
correctness, test-quality, and maintainability reviews then passed with no
remaining material findings.

Decision gate: `Continue`. Phase 3 is complete. Rename actions now own
scoped/shared/default resolution after routing, and Phase 4 may add bounded
timeout-failure classification without changing retry behavior.
