---
title: "Reliable dependency maintenance pass"
created-date: 2026-06-04
status: completed
agent: Codex
---

## Goal

Apply the reliable dependency updates from the June 2026 outdated review, including the requested `@openai/codex-sdk` bump, while leaving major/native compatibility risks for separate work.

## Scope

- Update low-risk runtime and tooling dependencies.
- Keep the existing manifest version-style conventions:
  - exact pins for already-pinned packages
  - caret ranges for already-careted runtime packages
- Refresh `bun.lock`.
- Run security, build, formatting, and test validation.

## Changes

Updated:

- `@inquirer/prompts` from `8.4.2` to `8.5.2`
- `@openai/codex-sdk` from `^0.130.0` to `^0.137.0`
- `@shikijs/transformers` from `^4.0.2` to `^4.2.0`
- `fast-xml-parser` from `5.7.3` to `5.8.0`
- `shiki` from `^4.0.2` to `^4.2.0`
- `yaml` from `^2.8.4` to `^2.9.0`
- `yauzl` from `^3.3.0` to `^3.3.2`
- `@types/bun` from `1.3.13` to `1.3.14`
- `@types/node` from `25.6.2` to `25.9.1`
- `oxfmt` from `0.48.0` to `0.53.0`
- `oxlint` from `1.63.0` to `1.68.0`
- `tsdown` from `0.22.0` to `0.22.2`

Deferred:

- `@duckdb/node-api` remains on `^1.5.2-r.1` because the newer line updates a native runtime dependency and should be handled with a DuckDB-focused pass.
- `commander` remains on `^14.0.3` because `15.0.0` is a major ESM-only compatibility change.
- `pdfjs-dist` remains on `^5.7.284` because `6.0.227` is a major PDF.js compatibility change.

## Notes

- `bun outdated` now reports only the intentionally deferred packages.
- `oxfmt@0.53.0` reformatted one Markdown PDF code-highlight test file mechanically.
- The existing `@xmldom/xmldom: 0.8.13` override remains unchanged.

## Verification

- `bun audit` passed with `No vulnerabilities found`.
- `bun run lint` passed.
- `bun run format:check` passed after the formatter-only test adjustment.
- `bun run build` passed on `tsdown v0.22.2`.
- Focused DOCX/PDF extraction tests passed with `19` passing tests and `0` failures.
- Focused Codex adapter tests passed with `12` passing tests and `0` failures.
- Focused Markdown PDF/YAML/Shiki tests passed with `34` passing tests and `0` failures.
- Focused interactive prompt tests passed with `28` passing tests and `0` failures.
- Focused DuckDB command and helper tests passed with `13` passing tests and `0` failures.
- Full `bun test` passed with `1102` passing tests and `0` failures.
- `git diff --check` passed.
