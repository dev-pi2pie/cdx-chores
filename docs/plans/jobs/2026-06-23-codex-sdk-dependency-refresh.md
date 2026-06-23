---
title: "Refresh Codex SDK and safe dependency patches"
created-date: 2026-06-23
status: completed
agent: Codex
---

## Goal

Update the reviewed safe dependency set, advance the documented Codex SDK baseline, and explicitly defer the Node 26 type baseline.

## Scope

- Refresh runtime dependencies:
  - `@openai/codex-sdk`
  - `fast-xml-parser`
  - `papaparse`
- Refresh development dependencies:
  - `@types/node`
  - `oxfmt`
  - `oxlint`
- Refresh `bun.lock`.
- Update public Codex SDK baseline documentation for `v0.1.5-canary.3`.
- Defer `@types/node@26.0.0` because the package major no longer matches the repo's current Node 22+ runtime baseline.

## Changes

Updated:

- `@openai/codex-sdk` from `^0.141.0` to `^0.142.0`
- `fast-xml-parser` from `5.9.2` to `5.9.3`
- `papaparse` from `^5.5.3` to `^5.5.4`
- `@types/node` from `25.9.3` to `25.9.4`
- `oxfmt` from `0.55.0` to `0.56.0`
- `oxlint` from `1.70.0` to `1.71.0`

Documentation:

- Updated the Codex SDK baseline in `README.md` and `docs/guides/cli-action-tool-integration-guide.md` from `0.141.0` to `0.142.0`.

## Rationale

- `@openai/codex-sdk@0.142.0` keeps the import-only ESM package shape and depends on the matching `@openai/codex@0.142.0`; the existing lazy dynamic import adapter remains the compatibility boundary.
- `fast-xml-parser@5.9.3` updates its `strnum` dependency, so OOXML metadata and part-discovery tests are the focused compatibility check.
- `papaparse@5.5.4` includes parser and unparser bug fixes around BOM handling and custom quote characters, so CSV/TSV data-stack coverage is part of the validation surface.
- `@types/node@25.9.4` is a patch-level update that keeps the repo on the current Node type family.
- `@types/node@26.0.0` remains intentionally deferred until the project chooses a Node 26 type/runtime baseline.
- `oxfmt@0.56.0` and `oxlint@1.71.0` are development-tool updates; the primary risks are formatting churn and new diagnostics.

## Verification

- `bun audit` passed with `No vulnerabilities found`.
- `bun run lint` passed on `oxlint v1.71.0`.
- `bun run format:check` passed on `oxfmt v0.56.0`.
- `bun run build` passed.
- Focused Codex, DOCX OOXML metadata, document-rename extraction, and data-stack tests passed with `52` passing tests and `0` failures.
- `bun test` passed with `1195` passing tests and `0` failures.
- CJS built-output smoke passed with `require('./dist/cjs/index.cjs')`.
- ESM CLI built-output smoke passed with `node dist/esm/bin.mjs --version`, reporting `0.1.5-canary.3`.
- `git diff --check` passed.
- `bun outdated` now reports only the intentionally deferred `@types/node` major update from `25.9.4` to `26.0.0`.
