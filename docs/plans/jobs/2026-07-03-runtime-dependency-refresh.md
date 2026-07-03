---
title: "Refresh runtime dependency patches and Oxc tooling"
created-date: 2026-07-03
status: completed
agent: codex
---

## Goal

Apply the reviewed dependency updates from the July 2026 `bun outdated` pass while preserving the repository's Node 22 runtime/type baseline.

## Scope

- Refresh runtime dependencies:
  - `@openai/codex-sdk`
  - `@shikijs/transformers`
  - `pdfjs-dist`
  - `shiki`
- Refresh development tooling:
  - `oxfmt`
  - `oxlint`
- Refresh `bun.lock`.
- Update public Codex SDK baseline documentation.
- Defer `@types/node@26.1.0` until the project intentionally moves to a Node 26 type/runtime baseline.

## Changes

Updated:

- `@openai/codex-sdk` from `^0.142.0` to `^0.142.5`
- `@shikijs/transformers` from `^4.2.0` to `^4.3.1`
- `pdfjs-dist` from `^6.0.227` to `^6.1.200`
- `shiki` from `^4.2.0` to `^4.3.1`
- `oxfmt` from `0.56.0` to `0.57.0`
- `oxlint` from `1.71.0` to `1.72.0`

Documentation:

- Updated the Codex SDK baseline in `README.md` and `docs/guides/cli-action-tool-integration-guide.md` from `v0.1.5-canary.3` / `0.142.0` to `v0.1.5-canary.4` / `0.142.5`.

## Rationale

- `@openai/codex-sdk@0.142.5` keeps the import-only ESM package shape and depends on the matching `@openai/codex@0.142.5`; the existing lazy dynamic import adapter remains the CJS compatibility boundary.
- `shiki@4.3.1` and `@shikijs/transformers@4.3.1` keep the exported highlighter and transformer APIs used by the Markdown PDF code-highlighting path.
- `pdfjs-dist@6.1.200` still ships `legacy/build/pdf.mjs` and `standard_fonts/`, so the existing PDF evidence extractor import and font lookup paths remain valid.
- `oxfmt@0.57.0` and `oxlint@1.72.0` are development-tool updates; the primary risks are formatting churn and new diagnostics.
- `@types/node@26.1.0` remains intentionally deferred because the package still advertises a Node 22 runtime floor.

## Verification

- `bun install --frozen-lockfile` passed with no changes.
- `bun run lint` passed on `oxlint v1.72.0`.
- `bun run format:check` passed on `oxfmt v0.57.0`.
- `git diff --check` passed.
- `bun run build` passed and embedded version generation reported `0.1.5-canary.4`.
- Focused Codex, Markdown PDF Shiki, and PDF extraction tests passed with `104` passing tests and `0` failures.
- `bun test` passed with `1347` passing tests and `0` failures.
- CJS built-output smoke passed with `require('./dist/cjs/index.cjs')`.
- ESM CLI built-output smoke passed with `node dist/esm/bin.mjs --version`, reporting `0.1.5-canary.4`.
- `bun audit` passed with `No vulnerabilities found`.
- `bun outdated` now reports only the intentionally deferred `@types/node` major update from `25.9.4` to `26.1.0`.
