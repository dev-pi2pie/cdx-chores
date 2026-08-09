---
title: "Canary dependency review for April 16 2026 outdated packages"
created-date: 2026-04-16
status: completed
agent: Codex
---

## Goal

Assess whether the current outdated packages are safe to advance during the next canary-stage dependency pass, with attention to:

- repo-specific usage and blast radius
- published upstream release notes
- published upstream security advisories
- live registry audit results against the current lockfile

Packages reviewed:

- `@duckdb/node-api` `1.5.1-r.1` -> `1.5.1-r.2` (`latest: 1.5.2-r.1`)
- `fast-xml-parser` `5.5.11` -> `5.6.0`
- `oxfmt` `0.44.0` -> `0.45.0`
- `oxlint` `1.59.0` -> `1.60.0`
- `tsdown` `0.21.7` -> `0.21.8`

Additional security finding discovered during review:

- `mammoth` currently resolves `@xmldom/xmldom@0.8.11`, which is below the patched `0.8.12` floor flagged by `bun audit`

## Related Plans

- `docs/plans/jobs/2026-04-11-apply-reviewed-dependency-bumps.md`

## Key Findings

### 1. `tsdown` should be updated now

- This repo only uses `tsdown` in `package.json` build scripts and `tsdown.config.ts`.
- The `v0.21.8` release is small and does not intersect the repo's current config surface (`deps.onlyBundle`, Node ESM/CJS outputs, `target: "node22"`).[^tsdown-release]
- `bun audit` on the current lockfile reports `defu <=6.1.4` as a high-severity prototype-pollution issue, and the current lockfile resolves `defu@6.1.4` under `tsdown@0.21.7`.
- Registry metadata for `tsdown@0.21.8` now depends on `defu ^6.1.7`, which should clear that audit item on reinstall.[^defu-ghsa]

Assessment:

- Safe and recommended now.
- This is the clearest "yes" in the set because it reduces audit exposure and has low repo-specific regression risk.

### 2. `oxfmt` is safe to update

- Repo usage is limited to `format` and `format:check` scripts in `package.json`.
- The `v0.45.0` release mostly contains formatter bug fixes and behavior improvements, plus support for `.editorconfig` `quote_type`.[^oxc-release]
- The repo does not currently have a `.editorconfig`, so that new behavior should not affect formatting here.
- The `oxc` security page shows no published advisories at time of review.[^oxc-security]

Assessment:

- Safe to update.
- Main risk is formatting churn, not runtime or build breakage.

### 3. `oxlint` is updateable, but not zero-risk

- Repo usage is limited to `lint` and `lint:fix` scripts in `package.json`.
- The `v1.60.0` release contains a CLI-facing breaking change: `oxlint` now errors when no files match the provided paths.[^oxc-release]
- This repo's main lint command uses existing paths (`src`, `test`, `scripts`), so the checked-in script should remain safe.
- The larger practical risk is future narrow-scope invocations in jobs or local workflows that point at files or directories that no longer exist.
- The `oxc` security page shows no published advisories at time of review.[^oxc-security]

Assessment:

- Safe enough for canary, but rerun lint immediately after bump.
- Treat this as a tooling strictness change, not a pure no-op patch update.

### 4. `fast-xml-parser` is already outside the published vulnerable ranges, so the upgrade is optional rather than urgent

- Repo usage is narrow and explicit in:
  - `src/adapters/docx/ooxml-metadata-parser.ts`
  - `src/adapters/docx/ooxml-part-discovery.ts`
- The current code only uses `XMLParser` and `XMLValidator` with explicit parser options and catches parse failures cleanly.
- The repo processes DOCX-internal OOXML from user-provided files, so parser hardening still matters even though this is not a network service.
- The `fast-xml-parser` security overview lists several 2026 advisories, but the published affected ranges for the entity-expansion DoS issues stop below the current `5.5.11` version (for example, `< 5.3.6` on one advisory).[^fxp-security][^fxp-ghsa-dos]
- The `v5.6.0` release says there is no API, typing, config, or basic-performance change, but it does introduce a new dependency and notes that entity-related error messages may change.[^fxp-release]

Assessment:

- No urgent security reason to move off `5.5.11` today.
- A canary bump to `5.6.0` is reasonable, but this is a runtime dependency, so it should follow the tooling-only bumps and keep focused DOCX verification in the same PR.

### 5. `@duckdb/node-api` is probably safe for canary, but this has the highest operational risk in the outdated list

- Repo usage is broad across production data-query/data-preview flows, fixture generation scripts, and tests.
- The package is a native binding wrapper; upgrading it also upgrades `@duckdb/node-bindings`.
- Registry metadata confirms `@duckdb/node-api@1.5.2-r.1` depends on `@duckdb/node-bindings@1.5.2-r.1`.
- The public repo security page shows no published advisories at time of review.[^duckdb-security]
- I did not find a directly readable upstream release-note page for the `1.5.1-r.2` or `1.5.2-r.1` package tags during this review, so the low-risk conclusion here is partly an inference from semver shape, lock metadata, repo usage, and existing test coverage.

Assessment:

- Reasonable canary candidate, but not in the first wave.
- Because this is a native dependency with real runtime usage, it should be upgraded only with the DuckDB-focused tests in the same verification pass.

### 6. `mammoth` needs follow-up even though it is not currently outdated

- `bun audit` reports a high-severity advisory on `@xmldom/xmldom <0.8.12` through `mammoth`.
- The current lockfile resolves `@xmldom/xmldom@0.8.11`.
- Registry metadata for `mammoth@1.12.0` still declares `@xmldom/xmldom: ^0.8.6`, and `1.12.0` is also the current latest `mammoth` release.
- This means the fix may be achievable by lock refresh if Bun re-resolves the transitive dependency to `0.8.12+`, but there is no newer `mammoth` top-level release to point at today.[^xmldom-ghsa]

Assessment:

- This is a real security follow-up item even though it is outside `bun outdated`.
- Reinstall and re-audit after any dependency pass; if the lockfile still pins `0.8.11`, add an explicit override.

## Local Verification

Commands run during this review:

```sh
bun audit
bun run lint
bun run build
bun test test/adapters-docx-ooxml-metadata.test.ts test/cli-actions-data-parquet-preview.test.ts test/cli-actions-data-query.test.ts test/data-duckdb-extensions.test.ts
```

Results:

- `bun audit` reported 2 high-severity findings in the current lockfile:
  - `mammoth -> @xmldom/xmldom@0.8.11`
  - `tsdown -> defu@6.1.4`
- `bun run lint` passed with `0` warnings and `0` errors.
- `bun run build` passed on `tsdown v0.21.7`.
- Targeted DOCX and DuckDB tests passed: `63` passing, `0` failures.

## Recommendation

Recommended first canary wave:

1. Update `tsdown` to `0.21.8`.
2. Update `oxfmt` to `0.45.0`.
3. Update `oxlint` to `1.60.0`.
4. Reinstall and rerun:
   - `bun audit`
   - `bun run lint`
   - `bun run build`

Recommended second canary wave:

1. Update `fast-xml-parser` to `5.6.0`.
2. Update `@duckdb/node-api` to `1.5.1-r.2` first, or directly to `1.5.2-r.1` if you want to avoid two close-together native-binding bumps.
3. Rerun:
   - `bun test test/adapters-docx-ooxml-metadata.test.ts test/cli-actions-data-parquet-preview.test.ts test/cli-actions-data-query.test.ts test/data-duckdb-extensions.test.ts`
   - `bun run build`
   - `bun audit`

Recommended follow-up outside the outdated list:

1. Confirm whether reinstalling now resolves `mammoth`'s transitive `@xmldom/xmldom` to `0.8.12+`.
2. If not, add a package override and rerun `bun audit`.

Lowest-risk ordering:

1. `tsdown`
2. `oxfmt`
3. `oxlint`
4. `fast-xml-parser`
5. `@duckdb/node-api`
6. `mammoth` transitive fix if still needed after reinstall

## References

[^duckdb-security]: [duckdb-node-neo security overview](https://github.com/duckdb/duckdb-node-neo/security)
[^fxp-release]: [fast-xml-parser v5.6.0 release notes](https://github.com/NaturalIntelligence/fast-xml-parser/releases/tag/v5.6.0)
[^fxp-security]: [fast-xml-parser security overview](https://github.com/NaturalIntelligence/fast-xml-parser/security)
[^fxp-ghsa-dos]: [GHSA-jmr7-xgp7-cmfj: DoS through entity expansion in DOCTYPE](https://github.com/NaturalIntelligence/fast-xml-parser/security/advisories/GHSA-jmr7-xgp7-cmfj)
[^oxc-release]: [oxlint v1.60.0 & oxfmt v0.45.0 release notes](https://github.com/oxc-project/oxc/releases/tag/apps_v1.60.0)
[^oxc-security]: [oxc security overview](https://github.com/oxc-project/oxc/security)
[^tsdown-release]: [tsdown v0.21.8 release notes](https://github.com/rolldown/tsdown/releases/tag/v0.21.8)
[^defu-ghsa]: [GHSA-737v-mqg7-c878: defu prototype pollution](https://github.com/advisories/GHSA-737v-mqg7-c878)
[^xmldom-ghsa]: [GHSA-wh4c-j3r5-mjhp: xmldom XML injection via unsafe CDATA serialization](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp)
