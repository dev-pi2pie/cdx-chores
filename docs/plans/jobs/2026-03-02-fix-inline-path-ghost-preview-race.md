---
title: "Fix inline path ghost preview race"
created-date: 2026-03-02
status: completed
agent: codex
---

## Summary

Prevented stale async suggestion results from overwriting an active sibling-preview ghost suffix in the inline path prompt.

## What Changed

- added a shared ghost-selection helper in `src/cli/prompts/path-inline-state.ts`
- updated `src/cli/prompts/path-inline.ts` to re-check active sibling preview state after async suggestion resolution
- added regression coverage in `test/cli-path-inline-state.test.ts`

## Why

Sibling preview could become active while `resolvePathSuggestions()` was still in flight. When that stale request completed, it could replace the rendered ghost suffix with the default suggestion even though `Tab` or `Right Arrow` would still accept the sibling preview.

## Verification

- `bun test test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts`
