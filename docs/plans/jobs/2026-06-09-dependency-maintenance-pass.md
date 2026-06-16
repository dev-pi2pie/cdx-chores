---
title: "Dependency maintenance pass"
created-date: 2026-06-09
modified-date: 2026-06-10
status: completed
agent: Codex
---

## Goal

Update the remaining outdated dependency set in ordered compatibility passes, keep supply-chain checks explicit, and remove any obsolete dependency overrides that are no longer needed after the refresh.

## Scope

- Update routine runtime and tooling dependencies.
- Update the previously deferred compatibility packages with focused validation:
  - `commander`
  - `pdfjs-dist`
  - `@duckdb/node-api`
- Remove the `@xmldom/xmldom` override only if `mammoth` still resolves to a patched transitive version.
- Preserve the existing manifest version-style conventions:
  - caret ranges for careted runtime dependencies
  - exact pins for already pinned dev tools
- Refresh `bun.lock`.
- Run focused and full validation before committing.

## Changes

Updated:

- `@duckdb/node-api` from `^1.5.2-r.1` to `^1.5.3-r.3`
- `@openai/codex-sdk` from `^0.137.0` to `^0.138.0`
- `commander` from `^14.0.3` to `^15.0.0`
- `pdfjs-dist` from `^5.7.284` to `^6.0.227`
- `yauzl` from `^3.3.2` to `^3.4.0`
- `@types/node` from `25.9.1` to `25.9.2`
- `oxfmt` from `0.53.0` to `0.54.0`
- `oxlint` from `1.68.0` to `1.69.0`

Removed:

- The top-level `@xmldom/xmldom: 0.8.13` override. A refreshed lockfile now resolves `mammoth@1.12.0` to patched `@xmldom/xmldom@0.8.13` through its existing `^0.8.6` range without the override.

Code compatibility:

- Changed the Codex SDK adapter to load `@openai/codex-sdk` lazily with dynamic `import()`.
- Updated Codex call sites to await read-only thread creation.
- This keeps the CJS package entry require-able after `@openai/codex-sdk@0.138.0` became import-only through package exports.

## Notes

- `commander@15.0.0` required no command syntax changes.
- `pdfjs-dist@6.0.227` required no PDF extraction syntax changes; the existing `pdfjs-dist/legacy/build/pdf.mjs` import path still exists.
- `@duckdb/node-api@1.5.3-r.3` required no DuckDB API changes for the current query, extract, fixture, and Parquet preview paths.
- `bun outdated` no longer reports outdated packages after the refresh.
- `auto_commit_notification` reviewed the edit batch and reported that the dependency updates, override cleanup, and Codex SDK lazy-load compatibility fix are coherent as one maintenance commit.

Follow-up on 2026-06-10:

- Updated `@openai/codex-sdk` from `^0.138.0` to `^0.139.0` after it became the latest published SDK version.
- Refreshed the README and CLI action integration guide Codex SDK baseline for `v0.1.5-canary.2` from `0.138.0` to `0.139.0`.
- Re-checked the installed SDK package exports; it remains import-only ESM, so the existing lazy dynamic import compatibility path still applies.

## Verification

- Baseline `bun audit` passed with `No vulnerabilities found`.
- Override cleanup `bun audit` passed with `No vulnerabilities found`.
- Final `bun audit` passed with `No vulnerabilities found`.
- `bun why @xmldom/xmldom` resolved `mammoth@1.12.0` to `@xmldom/xmldom@0.8.13` without an override.
- `bun outdated` reported no outdated packages.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bun run build` passed on `tsdown v0.22.2`.
- CJS built-output smoke passed with `require('./dist/cjs/index.cjs')`.
- ESM CLI built-output smoke passed with `node dist/esm/bin.mjs --version`.
- Focused Codex and DOCX tests passed with `25` passing tests and `0` failures after the routine pass.
- Focused CLI command tests for `commander@15.0.0` passed with `45` passing tests and `0` failures.
- Focused Codex compatibility tests passed with `34` passing tests and `0` failures after the lazy SDK import change.
- Focused PDF/document extraction tests passed with `14` passing tests and `0` failures.
- Focused DuckDB tests passed with `36` passing tests and `0` failures.
- Full `bun test` passed with `1102` passing tests and `0` failures.

Follow-up verification on 2026-06-10:

- `bun audit` passed with `No vulnerabilities found`.
- `bun outdated` reported no outdated packages after resolving.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bun run build` passed and embedded version generation reported `0.1.5-canary.2`.
- CJS built-output smoke passed with `require('./dist/cjs/index.cjs')`.
- ESM CLI built-output smoke passed with `node dist/esm/bin.mjs --version`, reporting `0.1.5-canary.2`.
- Focused Codex compatibility tests passed with `34` passing tests and `0` failures.
