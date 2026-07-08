---
title: "Safe dependency refresh"
created-date: 2026-07-08
status: completed
agent: Codex
---

## Goal

Refresh the reviewed low-risk dependency set from the current `bun outdated`
output, update public Codex SDK baseline documentation, and leave the Node type
major for a separate decision.

## Scope

- Refresh runtime dependency:
  - `@openai/codex-sdk`
- Refresh development dependencies:
  - `oxfmt`
  - `oxlint`
  - `tsdown`
- Refresh `bun.lock`.
- Update public Codex SDK baseline documentation for `v0.1.5-canary.5`.
- Defer `@types/node@26.1.1` because it is a Node type-baseline major and
  changes the `undici-types` family while the package runtime floor remains
  `>=22.23.0`.

## Changes

Updated:

- `@openai/codex-sdk` from `^0.142.5` to `^0.143.0`
- `oxfmt` from `0.57.0` to `0.58.0`
- `oxlint` from `1.72.0` to `1.73.0`
- `tsdown` from `0.22.3` to `0.22.4`

Documentation:

- Updated the Codex SDK baseline in `README.md` and
  `docs/guides/cli-action-tool-integration-guide.md` from `0.142.5` to
  `0.143.0`.
- Updated the public baseline label from `v0.1.5-canary.4` to
  `v0.1.5-canary.5`.

## Rationale

- `@openai/codex-sdk@0.143.0` keeps the same published JavaScript and
  TypeScript surface as `0.142.5`; the package update advances its version and
  pins the matching `@openai/codex@0.143.0` wrapper.
- `@openai/codex@0.143.0` keeps the same launcher shape; the meaningful install
  change is the versioned optional platform package set.
- `oxfmt@0.58.0` and `oxlint@1.73.0` are development-tool updates; the primary
  risks are formatter churn and newly reported diagnostics.
- `tsdown@0.22.4` updates the Rolldown and declaration-generation toolchain, so
  build output plus CJS and ESM smoke checks are part of the required
  validation.

## Verification

- `bun install --frozen-lockfile` passed with no changes.
- `bun run lint` passed on `oxlint v1.73.0`.
- `bun run format:check` passed on `oxfmt v0.58.0`.
- `bun run build` passed on `tsdown v0.22.4` and `rolldown v1.1.5`.
- Focused Codex adapter/action coverage passed with `124` passing tests and
  `0` failures.
- `bun test` passed with `1460` passing tests and `0` failures.
- CJS built-output smoke passed with `require("./dist/cjs/index.cjs")`.
- ESM CLI built-output smoke passed with `node dist/esm/bin.mjs --version`,
  reporting `0.1.5-canary.5`.
- `bun audit` passed with `No vulnerabilities found`.
- `git diff --check` passed.
- `bun outdated` now reports only the intentionally deferred `@types/node`
  major update from `25.9.4` to `26.1.1`.
