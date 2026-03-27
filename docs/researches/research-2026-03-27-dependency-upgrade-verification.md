---
title: "Dependency upgrade verification for March 2026 outdated packages"
created-date: 2026-03-27
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

### 4. TypeScript 6.0.2 is not blocked by a new regression, but it should still be a separate upgrade

- TypeScript 6.0 introduces meaningful defaults and deprecations, including `types: []` by default and other config-level changes.[^ts6-rc]
- For this repo specifically, `bun run build` still succeeded after upgrading to `typescript@6.0.2`.
- Direct `tsc --noEmit -p tsconfig.json` reported the same two errors under both `typescript@5.9.3` and `typescript@6.0.2`:
  - `src/cli/interactive/data.ts:44`
  - `src/cli/interactive/data/shared.ts:55`
- That means TypeScript 6 did not introduce a new typecheck failure here. The repo already has a baseline gap between "build passes" and "`tsc --noEmit` passes".

## Implications or Recommendations

1. Upgrade `@duckdb/node-api`, `@openai/codex-sdk`, and `oxfmt` in the next dependency-maintenance pass.
2. Keep the `oxfmt` bump isolated from unrelated formatting sweeps unless formatting churn is intentionally part of the change.
3. Treat `typescript@6.0.2` as a separate PR or commit from the smaller dependency bumps.
4. If TypeScript 6 is upgraded, decide explicitly whether this repo wants to start enforcing `tsc --noEmit`; if yes, fix the two existing errors in the same change or immediately after it.

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

## References

[^duckdb-release]: [DuckDB v1.5.1 bugfix release](https://github.com/duckdb/duckdb/releases)
[^codex-release]: [openai/codex 0.117.0 release notes](https://github.com/openai/codex/releases)
[^oxc-release]: [oxlint v1.57.0 and oxfmt v0.42.0 release notes](https://github.com/oxc-project/oxc/releases)
[^ts6-rc]: [Announcing TypeScript 6.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0-rc/)
