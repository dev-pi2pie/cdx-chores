---
title: "Fix data preview no-header CLI wiring"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Fix the `data preview --no-header` CLI flag so headerless CSV and TSV preview works end to end as documented.

## What Changed

- updated `src/cli/commands/data/preview.ts` to map the negated Commander flag correctly into the action-layer `noHeader` option
- added a CLI end-to-end regression test in `test/cli-ux.test.ts` to cover `data preview <csv> --no-header`

## Verification

- `bun test test/cli-ux.test.ts test/cli-actions-data-preview/rendering.test.ts`
