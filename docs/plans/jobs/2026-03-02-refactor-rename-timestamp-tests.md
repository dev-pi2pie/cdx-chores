---
title: "Refactor rename timestamp tests"
created-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Reduce duplication across the rename action tests and keep the large action test files readable by moving timestamp-specific coverage into a focused module.

## What Changed

- Added `test/cli-actions-rename-timestamp.test.ts` to hold action-level timestamp behavior coverage for:
  - legacy timestamp rewriting
  - explicit Route A metadata
  - mixed and timestamp-free metadata
  - Codex replanning with preserved timestamp basis
- Removed timestamp-focused tests from:
  - `test/cli-actions-rename-batch-core.test.ts`
  - `test/cli-actions-rename-file.test.ts`
- Kept lower-level timestamp rendering and template detection tests in:
  - `test/cli-fs-utils-rename-template.test.ts`
  - `test/cli-rename-template.test.ts`

## Why

The timestamp behavior tests had grown into two already-large action files and were repeating the same action-layer behavior across batch and file flows. Consolidating them into one focused file makes the remaining core action files easier to scan while preserving the integration coverage that still matters.

## Verification

- `bun test test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-timestamp.test.ts`
- `bunx tsc --noEmit`
