---
title: "Refine data query Codex drafting progress and output styling"
created-date: 2026-03-10
modified-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Add visible progress feedback to `data query codex` before result rendering, and tighten the revealed SQL and human-readable styling without breaking shell-oriented output.

## What Changed

- revised the `data query codex` plan to freeze a progress-feedback contract:
  - explicit introspection step first
  - mutable `Thinking` status during Codex drafting
  - clear the mutable status line before rendering the final result
- updated `actionDataQueryCodex` to reuse the existing TTY-aware analyzer status surface
- limited the transient progress treatment to TTY stdout so `--print-sql` and non-interactive stdout remain stable for piping
- normalized drafted SQL to one copyable line in both default and `--print-sql` output
- styled the human-readable drafting summary through the CLI color layer for TTY contexts
- changed the default SQL reveal to:
  - `SQL:` on its own line
  - the drafted SQL on the following line
- styled the `SQL` label and drafted SQL text with different colors in TTY output
- documented the TTY-only progress behavior in the `data query codex` usage guide
- documented the revised SQL reveal contract and styled summary behavior in the plan and guide
- added focused coverage for transient TTY status rendering, one-line SQL normalization, and final output shape

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query-codex.test.ts test/cli-command-data-query-codex.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/basic.csv --intent "show id and name ordered by id"`
- `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/basic.csv --intent "count rows" --print-sql`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
