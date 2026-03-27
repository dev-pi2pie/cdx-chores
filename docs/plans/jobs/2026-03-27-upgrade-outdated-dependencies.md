---
title: "Upgrade verified outdated dependencies"
created-date: 2026-03-27
status: completed
agent: codex
---

## Goal

Apply the already-verified direct dependency upgrades for March 2026 and confirm that the upgraded workspace still typechecks, builds, and passes tests.

## Related Research

- `docs/researches/research-2026-03-27-dependency-upgrade-verification.md`

## Changes

- Updated `@duckdb/node-api` from `^1.5.0-r.1` to `^1.5.1-r.1`.
- Updated `@openai/codex-sdk` from `^0.116.0` to `^0.117.0`.
- Updated `oxfmt` from `^0.41.0` to `^0.42.0`.
- Updated `typescript` from `^5.9.3` to `^6.0.2`.
- Refreshed `bun.lock` to the upgraded dependency graph while preserving the repo's caret-based version specifier style in the workspace manifest section.

## Verification

- `./node_modules/.bin/tsc --noEmit -p tsconfig.json`
- `bun run build`
- `bun test`

## Outcome

- TypeScript typecheck passed.
- Build passed.
- Test suite passed with `550` passing tests.

