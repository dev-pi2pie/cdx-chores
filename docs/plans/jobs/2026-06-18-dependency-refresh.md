---
title: "Refresh outdated dependencies"
created-date: 2026-06-18
status: completed
agent: Codex
---

## Goal

Update the current `bun outdated` set after review, preserve the repository's existing manifest version-style conventions, and record why each dependency was safe enough to take.

## Scope

- Refresh runtime dependencies:
  - `@duckdb/node-api`
  - `@openai/codex-sdk`
  - `fast-xml-parser`
- Refresh build and development dependencies:
  - `@types/node`
  - `oxfmt`
  - `oxlint`
  - `tsdown`
- Refresh `bun.lock`.
- Validate runtime-sensitive paths for DuckDB, OOXML metadata parsing, and Codex-assisted Markdown PDF profile generation.

## Changes

Updated:

- `@duckdb/node-api` from `^1.5.3-r.3` to `^1.5.4-r.1`
- `@openai/codex-sdk` from `^0.139.0` to `^0.141.0`
- `fast-xml-parser` from `5.8.0` to `5.9.2`
- `@types/node` from `25.9.2` to `25.9.3`
- `oxfmt` from `0.54.0` to `0.55.0`
- `oxlint` from `1.69.0` to `1.70.0`
- `tsdown` from `0.22.2` to `0.22.3`

Transitive updates included DuckDB native bindings, Codex CLI platform packages, `fast-xml-parser` entity parsing dependencies, and the `tsdown` Rolldown/dts build stack.

## Rationale

- `@duckdb/node-api@1.5.4-r.1` tracks the DuckDB 1.5.4 bugfix line. The repo uses the package through type-only imports and dynamic runtime imports for query, extract, fixture, and Parquet preview paths, so focused DuckDB tests were the right compatibility check.
- `@openai/codex-sdk@0.141.0` remains import-only ESM through package exports. The existing adapter already uses lazy dynamic `import()` for CJS compatibility, so the update was accepted with focused Codex profile adapter coverage.
- `fast-xml-parser@5.9.2` includes the 5.9.x entity-safety parser changes plus release-action follow-up releases. Because the repo uses it for OOXML metadata and part discovery, the DOCX metadata helper tests were treated as required validation.
- `@types/node@25.9.3` is a patch-level type refresh aligned with the existing TypeScript 6 and Node 22+ target.
- `oxfmt@0.55.0` and `oxlint@1.70.0` are development-tool updates. The main risks were formatter churn and new lint diagnostics, both covered by `format:check` and `lint`.
- `tsdown@0.22.3` is a patch build-tool update. Its build-host support now excludes early Node 24.0-24.10, but this repo already declares `node >=22.18.0` and builds with `target: node22`, so the update was accepted with a full build.

## Verification

- `bun outdated` reported no outdated package table after the refresh.
- `bun audit` passed with `No vulnerabilities found`.
- `git diff --check` passed.
- `bun run lint` passed on `oxlint v1.70.0`.
- `bun run format:check` passed on `oxfmt v0.55.0`.
- `bun run build` passed on `tsdown v0.22.3` and `rolldown v1.1.1`.
- Focused DuckDB, OOXML metadata, and Codex Markdown PDF profile tests passed with `118` passing tests and `0` failures.
- `bun test test/cli-path-inline.test.ts` passed with `12` passing tests and `0` failures after an initial full-suite run exposed one transient path-inline expectation mismatch.
- A final full `bun test` run passed with `1195` passing tests and `0` failures.
