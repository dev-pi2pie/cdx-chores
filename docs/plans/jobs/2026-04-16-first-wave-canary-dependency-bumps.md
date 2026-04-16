---
title: "Apply first-wave canary dependency bumps"
created-date: 2026-04-16
status: completed
agent: Codex
---

## Goal

Apply the first-wave canary dependency bumps for low-risk tooling packages, refresh the lockfile, and verify the repository still passes its standard checks.

## Scope

- update `package.json`
- update `bun.lock`
- rerun repo verification after the toolchain bumps
- leave runtime-sensitive dependency bumps for a later pass

## Related Research

- `docs/researches/research-2026-04-16-canary-dependency-review.md`

## Changes

- Updated:
  - `oxfmt` -> `0.45.0`
  - `oxlint` -> `1.60.0`
  - `tsdown` -> `0.21.8`
- Refreshed the Bun lockfile and picked up `defu@6.1.7` through `tsdown`.
- Left runtime-oriented packages unchanged in this pass:
  - `@duckdb/node-api`
  - `fast-xml-parser`

## Verification

- `bun audit`
- `bun run lint`
- `bun run format:check`
- `bun run build`
- `bun test`

Results:

- `bun run lint` passed.
- `bun run format:check` passed.
- `bun run build` passed on `tsdown v0.21.8`.
- `bun test` passed with `711` passing tests and `0` failures.
- `bun audit` improved from `2` high findings to `1` high finding.

## Residual Risk

- One high-severity audit finding remains outside this first-wave bump set:
  - `mammoth` -> `@xmldom/xmldom@0.8.11`
- This should be handled in a follow-up pass, likely by forcing the transitive resolution to `0.8.12+` if Bun does not naturally re-resolve it.
