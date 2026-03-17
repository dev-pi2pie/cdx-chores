---
title: "Fix tsdown onlyAllowBundle deprecation"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Remove the `tsdown` deprecation warnings introduced by `tsdown@0.21.4` after the config option rename from `deps.onlyAllowBundle` to `deps.onlyBundle`.

## What Changed

- Replaced `deps.onlyAllowBundle` with `deps.onlyBundle` in all three build targets in `tsdown.config.ts`.
- Kept the existing bundle behavior for `picocolors` unchanged while aligning with the new `tsdown` config surface.

## Verification

- `bun run build`
