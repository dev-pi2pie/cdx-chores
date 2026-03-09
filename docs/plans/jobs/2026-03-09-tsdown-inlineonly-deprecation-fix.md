---
title: "Fix tsdown inlineOnly deprecation"
created-date: 2026-03-09
modified-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Remove the `tsdown` build warnings introduced after upgrading to `tsdown@0.21.0` by replacing deprecated config usage in `tsdown.config.ts`.

## Scope

- `tsdown.config.ts`
- `docs/plans/jobs/2026-03-09-tsdown-inlineonly-deprecation-fix.md`

## What Changed

- Replaced deprecated `inlineOnly` config usage with `deps.onlyAllowBundle` in each build target.
- Verified `bun run build` no longer emits the deprecation warning.

## Verification

- `bun run build`
