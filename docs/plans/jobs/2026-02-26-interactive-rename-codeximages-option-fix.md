---
title: "Fix interactive rename codexImages option key mismatch"
created-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Resolve TypeScript errors in `src/cli/interactive.ts` caused by passing outdated `codex` option keys into rename actions that now expect `codexImages`.

## Implemented

- Updated interactive rename batch action call to pass `codexImages: codex`.
- Updated interactive rename file action call to pass `codexImages: codex`.

## Verification

- `bunx tsc --noEmit` (run after patch to confirm the reported TS2353 errors are cleared)

