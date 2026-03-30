---
title: "Interactive contextual tip first pass"
created-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Implement the first deterministic checkpoint-tip layer for interactive `data query` and interactive `data extract`.

## What Changed

- added a shared checkpoint-aware resolver in `src/cli/interactive/contextual-tip.ts`
- kept the existing abort-tip helper in `src/cli/interactive/notice.ts` as the flow-entry safety baseline
- adopted deterministic checkpoint tips in interactive `data query` for:
  - mode selection
  - SQL review
  - output selection
- adopted deterministic checkpoint tips in interactive `data extract` for:
  - extraction review
  - write boundary
- kept the behavior checkpoint-only rather than mode-specific
- kept interactive `data preview` tip-free
- updated the interactive usage guides for `data query` and `data extract`
- marked the contextual-tip follow-up plan complete

## Verification

- `bun test test/cli-interactive-notice.test.ts test/cli-interactive-contextual-tip.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-30-interactive-contextual-tip-followup.md`

## Related Research

- `docs/researches/research-2026-03-30-interactive-contextual-tip-usage.md`
