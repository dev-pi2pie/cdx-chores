---
title: "Codex request timeout Phase 6"
created-date: 2026-08-21
status: completed
agent: codex
---

## Goal

Add one session-owned timeout to explicit Interactive mode and route it through
every current Interactive Codex request path, as defined by Phase 6 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `61bc886e`

Phase 5 is complete and reviewed. The working tree was clean at this boundary.

## Implementation Boundary

- register `--codex-timeout <duration>` only on the explicit `interactive`
  command
- resolve one numeric session value without mutating runtime or path-prompt
  configuration
- keep no-argument Interactive entry on the shared 30-second default without a
  new setup prompt
- pass the same value through rename, cleanup, data, and Markdown Codex helpers
- preserve user-controlled regeneration, workflow-owned recovery, saved recipe
  identity, and generated artifact schemas

## Validation

```text
bun test test/cli-command-interactive-timeout.test.ts test/cli-interactive-rename.test.ts test/cli-interactive-rename-cleanup-codex.test.ts test/cli-interactive-routing-data-query-codex-single.test.ts test/cli-interactive-routing-data-query-codex-workspace.test.ts test/cli-interactive-routing-data-query-headers.test.ts test/cli-interactive-routing-data-query-source-shape.test.ts test/cli-interactive-data-stack/codex-review.test.ts test/cli-interactive-markdown-pdf/codex-authoring.test.ts test/cli-command-rename-timeout.test.ts test/cli-command-data-codex-timeout.test.ts test/cli-command-markdown-codex-timeout.test.ts
167 pass, 0 fail

bun test test/cli-interactive-rename.test.ts test/cli-interactive-routing-data-query-codex-single.test.ts test/cli-interactive-data-stack/codex-review.test.ts test/cli-interactive-routing-data-query-headers.test.ts
24 pass, 0 fail after review hardening

bun test
2579 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

Focused coverage verifies explicit command parsing, the shared default,
root-level rejection, absence of a timeout prompt, configured and omitted
session propagation, rename and cleanup routing, data query regeneration and
workspace routing, data-stack recovery, embedded header and source-shape
helpers, and independent Markdown authoring and repair windows. Direct rename,
data, and Markdown timeout suites remained green.

The Node-target build was inspected directly:

- `cdx-chores interactive --help` lists the per-request-attempt option
- `cdx-chores --codex-timeout 2m` exits with an unknown-option error

No live Codex request was used.

## Review

Implementation commits:

- `8ecae9ad` — added explicit Interactive option registration and narrow
  session-owned timeout state with the shared default
- `bcad6216` — routed the session value through rename, cleanup, data query,
  data stack, header mapping, source shape, and extract helpers
- `b767c869` — routed the session value through Markdown profile, template,
  project, repair, revision, and regeneration requests
- `efca21ea` — added omitted-session default and no-prompt assertions across
  representative non-Markdown paths

Review range:

```text
61bc886e24917dc8936953241b5b125eec5326ed..efca21ea364d4765d1b780abb5e42cd3e499196f
```

The first correctness and maintainability reviews found no material issue. The
first test-quality review found that non-Markdown forwarding assertions used
explicit timeout values and therefore did not independently prove the inherited
30-second session default. The finding was accepted and addressed in
`efca21ea`. Final widened correctness, test-quality, and maintainability reviews
passed with no remaining material findings.

Decision gate: `Continue`. Phase 6 is complete. Every current Interactive Codex
request path receives the session value or shared default through an optional
numeric helper seam. The value survives review, revision, backtracking, and
user-triggered regeneration without adding automatic retry, a setup prompt,
root-global spelling, or persisted timeout metadata. Existing workflow-owned
recovery behavior and Markdown font-discovery timeout ownership remain intact.
