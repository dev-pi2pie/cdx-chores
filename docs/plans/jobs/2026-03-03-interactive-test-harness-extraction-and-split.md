---
title: "Interactive test harness extraction and split"
created-date: 2026-03-03
status: completed
agent: codex
---

## Summary

Split the interactive test coverage into narrower files and extracted the shared harness into a reusable helper.

## What Changed

- extracted the interactive mock harness into `test/helpers/interactive-harness.ts`
- split the former `test/cli-interactive.test.ts` into:
  - `test/cli-interactive-routing.test.ts`
  - `test/cli-interactive-rename.test.ts`
- kept the rename cleanup and custom-template coverage in the rename-focused test file
- kept general command-router coverage in the routing-focused test file

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-routing.test.ts test/cli-interactive-rename.test.ts test/cli-text-inline.test.ts test/cli-path-inline.test.ts`
