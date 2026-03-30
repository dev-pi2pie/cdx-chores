---
title: "Interactive data query review follow-up"
created-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Address the follow-up review findings in interactive `data query` without regressing the new checkpoint-based review flow.

## What Changed

- separated output-selection backtracking from mode-specific revise handling in `src/cli/interactive/data-query/execution.ts`
- kept `Back to SQL review` inside the current reviewed candidate instead of treating it like a full mode rebuild
- fixed interactive `Codex Assistant` review handling in `src/cli/interactive/data-query/sql/codex.ts`
- made `Revise intent` from SQL review return directly to intent entry instead of falling through to the extra post-draft next-step menu
- added interactive routing regression coverage in `test/cli-interactive-routing.test.ts` for:
  - returning from output selection to the current SQL review without reopening manual SQL entry
  - revising Codex intent directly from SQL review

## Why

The shipped checkpoint follow-up introduced two control-flow mismatches:

- output backtracking said it returned to SQL review, but it actually restarted the mode-specific builder
- Codex SQL-review revise required an unnecessary second confirmation menu before the intent prompt reopened

The follow-up keeps the prompt labels aligned with the real navigation behavior.

## Verification

- `bun test test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`
