---
title: "Dependency upgrade verification for March 2026 outdated packages"
created-date: 2026-03-27
modified-date: 2026-03-27
status: completed
agent: codex
---

## Goal

Verify whether the currently outdated direct dependencies should be upgraded:

- `@duckdb/node-api` `1.5.0-r.1` -> `1.5.1-r.1`
- `@openai/codex-sdk` `0.116.0` -> `0.117.0`
- `oxfmt` `0.41.0` -> `0.42.0`
- `typescript` `5.9.3` -> `6.0.2`

## Key Findings

### 1. `@duckdb/node-api` is a low-risk upgrade for this repo

- The repo uses DuckDB through typed imports and dynamic runtime loading in:
  - `src/cli/duckdb/parquet-preview.ts`
  - `src/cli/duckdb/query/formats.ts`
  - `src/cli/duckdb/extensions.ts`
  - related query and interactive helpers
- Published package diff from `1.5.0-r.1` to `1.5.1-r.1` only changed package version wiring and the `@duckdb/node-bindings` dependency version.
- The package repository does not publish separate Node Neo GitHub releases, but the corresponding DuckDB upstream `v1.5.1` release is explicitly described as a bugfix release.[^duckdb-release]
- In a temp verification copy, upgrading this package did not break `bun run build` or `bun test`.

### 2. `@openai/codex-sdk` is a low-risk upgrade for this repo

- The repo imports `Codex` only in `src/adapters/codex/shared.ts`.
- Published npm diff from `0.116.0` to `0.117.0` showed no SDK file changes in `dist/index.d.ts` or `dist/index.js`; the published package diff reduced to version bumps in `package.json`.
- The upstream `openai/codex` `0.117.0` release contains many product and TUI changes, but this repo uses the TypeScript SDK wrapper, not the CLI/TUI surface directly.[^codex-release]
- In a temp verification copy, upgrading this package did not break `bun run build` or `bun test`.

### 3. `oxfmt` is safe to upgrade, but formatter behavior can change output

- The `oxc` release for `oxfmt v0.42.0` adds JSDoc formatting support, HTML-in-JS support, a GraphQL/HTML-in-JS language comment path, and some formatter bug fixes.[^oxc-release]
- Published type surface changes are additive. The notable exported addition is `JsdocConfig` plus broader type re-exports.
- Because `oxfmt` is only used in repo formatting scripts, the main risk is formatting churn rather than runtime or compile behavior.
- In a temp verification copy, upgrading this package did not break `bun run build` or `bun test`.

### 4. TypeScript 6.0.2 now looks safe to upgrade on the current branch

- The official TypeScript 6.0 release post was published on 2026-03-23 and confirms the main transition points from 5.9 toward 7.0, including `rootDir` defaulting to `.`, `types` defaulting to `[]`, and deprecations around older module-resolution and import-assertion behavior.[^ts6-final]
- The same post also notes a few final changes since beta/RC, including stricter type-checking for some generic function-expression calls, import-assertion deprecation extended to `import()` calls, and updated DOM and Temporal types.[^ts6-final]
- This repo is already relatively aligned with the official guidance because `tsconfig.json` explicitly sets `module: "Preserve"`, `moduleResolution: "bundler"`, `target: "ESNext"`, and `strict: true`.
- After fixing the two baseline `tsc --noEmit` errors in the interactive data flow, the current branch now verifies cleanly with `typescript@6.0.2` in a temp copy:
  - `bun run build` passed
  - `bun test` passed with `550` passing tests
  - `./node_modules/.bin/tsc --noEmit -p tsconfig.json` passed
- I did not find a repo-specific issue triggered by the final 6.0 release notes.

## Implications or Recommendations

1. Upgrade `@duckdb/node-api`, `@openai/codex-sdk`, and `oxfmt` in the next dependency-maintenance pass.
2. Keep the `oxfmt` bump isolated from unrelated formatting sweeps unless formatting churn is intentionally part of the change.
3. TypeScript 6.0.2 can now be upgraded on this branch without waiting for more type-fix work.
4. If TypeScript 6 is upgraded, it is now reasonable to treat `tsc --noEmit` as part of the normal verification path because it passes on the current branch state.

## Verification

Temp-copy verification was performed with:

```bash
rsync -a --delete --exclude .git --exclude node_modules ./ /tmp/cdx-chores-upgrade-check
cd /tmp/cdx-chores-upgrade-check
bun install --frozen-lockfile
bun test
bun run build
bun add @duckdb/node-api@1.5.1-r.1 @openai/codex-sdk@0.117.0 -d oxfmt@0.42.0
bun test
bun run build
bun add -d typescript@6.0.2
./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Observed results:

- baseline: `bun test` passed with `550` passing tests; `bun run build` passed
- after `@duckdb/node-api`, `@openai/codex-sdk`, and `oxfmt` upgrades: `bun test` passed with `550` passing tests; `bun run build` passed
- after `typescript@6.0.2`: `bun run build` still passed; `tsc --noEmit` reported the same two errors already present under `typescript@5.9.3`

Follow-up verification after the interactive data type fixes:

```bash
rsync -a --delete --exclude .git --exclude node_modules ./ /tmp/cdx-chores-ts6-review
cd /tmp/cdx-chores-ts6-review
bun install --frozen-lockfile
./node_modules/.bin/tsc --noEmit -p tsconfig.json
bun add -d typescript@6.0.2
bun run build
bun test
./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Observed results:

- on the current branch with `typescript@5.9.3`: `tsc --noEmit` passed
- after upgrading only to `typescript@6.0.2` in the temp copy: `bun run build` passed, `bun test` passed with `550` passing tests, and `tsc --noEmit` passed

## References

[^duckdb-release]: [DuckDB v1.5.1 bugfix release](https://github.com/duckdb/duckdb/releases)
[^codex-release]: [openai/codex 0.117.0 release notes](https://github.com/openai/codex/releases)
[^oxc-release]: [oxlint v1.57.0 and oxfmt v0.42.0 release notes](https://github.com/oxc-project/oxc/releases)
[^ts6-final]: [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
