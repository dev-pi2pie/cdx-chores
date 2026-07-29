---
title: "Refresh runtime and tooling dependencies"
created-date: 2026-07-29
status: completed
agent: Codex
---

## Goal

Apply the reviewed July dependency updates through runtime-focused checkpoints,
keep the Node.js runtime and type boundaries unchanged, and record complete
validation evidence.

## Scope

- update the Codex SDK and its matching bundled Codex CLI
- update the DuckDB Node API, native bindings, and PDF.js runtime packages
- update the exact Oxfmt, Oxlint, and tsdown development-tool pins
- preserve the Node.js `>=22.23.0` runtime contract and Node-only ambient types
- keep `@types/node@26` outside this refresh
- update the Codex SDK baseline for `v0.1.6` in `README.md` and
  `docs/guides/cli-action-tool-integration-guide.md`

## Changes

- Updated `@openai/codex-sdk` from `0.145.0` to `0.146.0`, including the
  matching bundled Codex CLI and platform packages.
- Updated `@duckdb/node-api` and its native bindings from `1.5.4-r.1` to
  `1.5.5-r.2`.
- Updated `pdfjs-dist` from `6.1.200` to `6.2.108`.
- Updated `oxfmt` from `0.60.0` to `0.61.0`.
- Updated `oxlint` from `1.75.0` to `1.76.0`.
- Updated `tsdown` from `0.22.13` to `0.22.14`.
- Kept `@types/node` at `25.9.5` as an intentional major-version deferral.
- Updated the public Codex SDK baseline to identify
  `v0.1.6` / `0.146.0`.
- Preserved caret ranges for runtime dependencies and exact pins for
  development tooling.

## Package Review

- Confirmed registry signatures, established maintainers, repository identity,
  integrity metadata, and engine requirements for the accepted releases.
- Confirmed that the Codex SDK remains import-only ESM and that its published
  JavaScript and declaration payload is unchanged; preserved the lazy dynamic
  import in `src/adapters/codex/shared.ts`.
- Reviewed DuckDB `1.5.5` as a bugfix release containing out-of-bounds security
  fixes. The Node API wrapper also adds the required list-vector capacity
  reservation before resizing.
- Confirmed that PDF.js keeps `legacy/build/pdf.mjs` and `standard_fonts/`.
  Its API-minor `Map` return changes do not affect the repository's
  `getMetadata`, `getOutline`, and `getTextContent` usage.
- Reviewed tsdown `0.22.14`, including its build-concurrency feature and
  declaration-plugin update, without changing `tsdown.config.ts`.

## Validation

- The Codex SDK import smoke passed, and the bundled executable reported
  `codex-cli 0.146.0`.
- 545 focused Codex tests passed across 58 files.
- A live DuckDB query reported runtime `v1.5.5`.
- 259 focused DuckDB, data-query, data-extract, and Parquet tests passed across
  52 files.
- 14 focused PDF extraction tests passed across 2 files.
- Native `tsc --noEmit` passed before and after the tooling update.
- `bun run lint` passed with Oxlint `1.76.0`.
- `bun run format:check` passed with Oxfmt `0.61.0` across 770 files.
- `bun run build` passed with tsdown `0.22.14`, Rolldown `1.2.0`, and
  TypeScript `7.0.2` declaration generation.
- All generated build artifacts remained byte-for-byte identical across the
  tsdown update.
- `bun install --frozen-lockfile` completed without changes.
- The full test suite passed with 1,854 tests across 230 files and 0 failures.
- CJS and ESM library import smokes passed, and the built CLI reported `0.1.6`.
- `bun audit` reported no vulnerabilities.
- `git diff --check` passed.
- Final `bun outdated` reported only the intentionally deferred
  `@types/node@26.1.2` major update.

## Notes

- The package version remains `0.1.6`; this dependency refresh prepares the
  existing version without advancing it.
- README and the CLI integration guide identify
  `v0.1.6` / `0.146.0` as the current public baseline.
- TypeScript 7 still emits its expected experimental programmatic-API warning
  during declaration generation; the build succeeds.
