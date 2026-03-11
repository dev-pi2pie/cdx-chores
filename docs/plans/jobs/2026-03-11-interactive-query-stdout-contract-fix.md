---
title: "Fix interactive query stdout contract"
created-date: 2026-03-11
modified-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Address the review finding that interactive `data query` was writing human-readable metadata to stdout before JSON results.

## What Changed

- redirected interactive query introspection summaries to stderr
- redirected candidate SQL previews to stderr
- redirected the editor-backed Codex intent preview to stderr
- extended the interactive harness so tests can simulate query payload writes to stdout or stderr
- added regression coverage for:
  - manual interactive query with JSON stdout
  - editor-backed Codex interactive query with JSON stdout

## Verification

- `bun test test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`
