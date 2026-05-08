---
title: "TypeScript noEmit cleanup"
created-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Restore a clean `bun tsc --noEmit` pass after the Markdown PDF and font tooling branch introduced stricter type-check failures.

## Completed Work

- Tightened the GIF contract result type so `quality` mode narrows to defined `profile` and `look` values.
- Reworked native macOS and Windows font parser normalization to return `FontFace[]` directly instead of filtering nullable map results.
- Avoided assigning explicit `undefined` values to optional `FontFace.path` properties.

## Verification

- `bun tsc --noEmit`
- `bun test test/cli-actions-video-gif.test.ts test/fonts.test.ts`
- `bun run lint`
- `bun run build`
- `bun run format:check`
- `git diff --check`
- `bun test`
