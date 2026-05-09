---
title: "Clean up build dynamic import warning"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: Codex
---

## Goal

Remove the `tsdown` ineffective dynamic import warning introduced during the dependency maintenance pass without changing interactive data-stack behavior.

## Scope

- Replace the ineffective dynamic import in the interactive data-stack source discovery path with the static import shape already used elsewhere.
- Keep the change focused on the warning source.
- Verify the build no longer reports the warning and focused interactive data-stack coverage still passes.

## Changes

- Changed `src/cli/interactive/data/stack/source-discovery.ts` to statically import `promptRequiredPathWithConfig` from `src/cli/prompts/path.ts`.
- Removed the local `await import("../../../prompts/path")` call from `collectInteractiveStackSources`.

## Rationale

`src/cli/prompts/path.ts` is already statically imported by other CLI data and interactive modules. Because that module is already in the main bundle, the dynamic import in source discovery cannot move it into a lazy chunk. The static import makes the source match the actual bundle behavior and removes the misleading warning.

## Verification

- `bun run build` passed on `tsdown v0.22.0` without the previous ineffective dynamic import warning.
- `bun run lint` passed with `0` warnings and `0` errors.
- `bun run format:check` passed.
- Focused interactive data-stack tests passed with `33` passing tests and `0` failures:
  - `test/cli-interactive-data-stack/discovery.test.ts`
  - `test/cli-interactive-data-stack/dry-run-write.test.ts`
  - `test/cli-interactive-data-stack/codex-review.test.ts`
- `bun tsc --noEmit` passed.
- `git diff --check` passed.
