---
title: "Refresh canary dependencies and migrate to TypeScript 7"
created-date: 2026-07-20
status: completed
agent: Codex
---

## Goal

Prepare the existing `v0.1.6-canary.2` package state with reviewed dependency
updates, an isolated TypeScript 7 migration, synchronized public baseline
wording, and complete validation evidence.

## Scope

- update the reviewed runtime dependency patches
- update formatter, linter, and tsdown tooling in separate checkpoints
- keep the existing tsdown output configuration and Node.js `>=22.23.0`
  runtime contract
- migrate from TypeScript 6 to TypeScript 7 only after the earlier checkpoints
  pass
- update the current canary and Codex SDK baseline wording in `README.md` and
  `docs/guides/cli-action-tool-integration-guide.md`
- keep `@types/node@26` and standalone executable packaging outside this slice

## Checkpoints

- [x] review package metadata, provenance indicators, and relevant package diffs
- [x] update and validate runtime dependency patches
- [x] update and validate formatter and linter tooling
- [x] update and validate tsdown without changing `tsdown.config.ts`
- [x] prepare TypeScript 7-compatible configuration and migrate the compiler
- [x] synchronize public baseline wording for `v0.1.6-canary.2`
- [x] complete focused and repository-wide validation

## Changes

- Updated runtime dependencies:
  - `@openai/codex-sdk` from `0.144.3` to `0.144.6`
  - `fast-xml-parser` from `5.10.0` to `5.10.1`
- Updated development tooling:
  - `oxfmt` from `0.58.0` to `0.59.0`
  - `oxlint` from `1.73.0` to `1.74.0`
  - `tsdown` from `0.22.7` to `0.22.12`
  - `typescript` from `6.0.3` to `7.0.2`
- Added explicit Node ambient types plus stable type ordering to preserve the
  Node runtime boundary under TypeScript 7 defaults. Bun test types continue
  to resolve through explicit `bun:test` imports.
- Materialized mutable expected arrays in one parameterized Markdown PDF test
  so its matcher contract remains type-safe under the explicit compiler check.
- Updated the README and CLI integration guide to identify Codex SDK `0.144.6`
  as the baseline for `v0.1.6-canary.2`.
- Kept `tsdown.config.ts`, the `node22` build target, the Node.js
  `>=22.23.0` runtime contract, and the existing package version unchanged.

## Package Review

- Confirmed npm registry signatures, established maintainers, repositories,
  integrity metadata, and engine requirements for every accepted release.
- Confirmed that the Codex SDK package changed only its version metadata and
  matching `@openai/codex` dependency pin.
- Reviewed the fast-xml-parser source change that rejects multiple `DOCTYPE`
  declarations and its entity-package update.
- Reviewed the tsdown move to Rolldown 1.2, its updated declaration plugin, and
  its standardized executable-mode Node floor; executable mode is not enabled
  in this task.
- Kept `@types/node@26` deferred because the package runtime contract remains
  Node.js 22 and the type-baseline decision is separate from the local Node.js
  26 development environment.

## Validation

- Baseline `bun install --frozen-lockfile`, lint, format check, and build passed
  before dependency changes.
- 80 focused Codex SDK and DOCX/OOXML tests passed after the runtime updates.
- The TypeScript 6 compatibility preflight and TypeScript 7 native
  `tsc --noEmit` check passed after the test-only matcher adjustment.
- The final Node-only ambient type configuration passed the full project type
  check while keeping direct Bun API usage confined to tests.
- `bun run lint` passed with oxlint `1.74.0`.
- `bun run format:check` passed with oxfmt `0.59.0` across 688 files.
- `bun run build` passed with tsdown `0.22.12`, Rolldown `1.2.0`, and
  TypeScript `7.0.2` declaration generation.
- The ESM library, CJS library, CLI, and declaration artifacts remained
  byte-for-byte identical to the pre-update build.
- The full test suite passed with 1,517 tests across 206 files and 0 failures.
- A packed `0.1.6-canary.2` tarball passed ESM CLI and CJS import smokes under
  Node.js `26.5.0` and Node.js `22.23.1`.
- The packed CLI's DuckDB doctor completed under Node.js `22.23.1`, loaded the
  native DuckDB runtime and SQLite extension, and accurately reported the
  optional Excel extension as unavailable in the test environment.
- `bun audit` reported no vulnerabilities.
- `git diff --check` passed.
- Final `bun outdated` reported only the intentionally deferred
  `@types/node@26.1.1` major update.

## Notes

- Canary releases do not receive a manually authored file under `CHANGELOGS/`.
- The package and embedded version source already identify
  `0.1.6-canary.2`; this task does not advance the version again.
- TypeScript 7 still emits the expected upstream warning that its programmatic
  API is not yet stable. This repository does not import that API, and its
  tsdown declaration output remained unchanged.
