---
title: "Dependency upgrade safety check for April 1 2026 outdated packages"
created-date: 2026-04-01
status: completed
agent: Codex
---

## Goal

Assess whether the currently outdated packages can be updated safely in this repository, using:

- local code-usage analysis
- local verification commands
- official upstream release notes
- official security/advisory pages where available

Packages reviewed:

- `oxfmt` `0.42.0` -> `0.43.0`
- `oxlint` `1.57.0` -> `1.58.0`
- `pdfjs-dist` `5.5.207` -> `5.6.205`
- `tsdown` `0.21.5` -> `0.21.7`
- `yauzl` `3.2.1` -> `3.3.0`

## Key Findings

### 1. `oxfmt` is safe to update with low operational risk

- Repo usage is limited to formatting scripts in `package.json`.
- The upstream `oxfmt v0.43.0` release adds formatting support for object-style booleans plus markdown-in-JS and angular-in-JS substitutions.[^oxc-release]
- No runtime code depends on `oxfmt`.
- Upstream security page shows no published advisories for `oxc` at time of review.[^oxc-security]

Assessment:

- Safe to update.
- Primary risk is formatting churn if the formatter output changes on files already covered by the repo scripts.

### 2. `oxlint` is updateable, but this is not a zero-risk patch bump

- Repo usage is limited to `lint` and `lint:fix` scripts in `package.json`.
- The upstream `oxlint v1.58.0` release explicitly includes a breaking change: unknown builtin rules now report an error.[^oxc-release]
- The same release also adds and promotes rules, and includes bug fixes in lint behavior.[^oxc-release]
- Upstream security page shows no published advisories for `oxc` at time of review.[^oxc-security]

Assessment:

- Conditionally safe to update.
- It is likely safe for this repo because the current lint command passed locally before the upgrade review and the repo appears to use a stable checked-in config.
- The main regression risk is configuration strictness: if `.oxlintrc.json` contains a rule name that became invalid or builtin-rule handling changed, lint will start failing immediately.

### 3. `pdfjs-dist` is likely safe for this repo, with moderate API-watch risk but no active official security blocker for these versions

- Local usage is narrow and explicit:
  - `src/adapters/codex/document-rename/extractors/pdf.ts`
  - `src/adapters/codex/document-rename/extractors/shared.ts`
- The code imports `pdfjs-dist/legacy/build/pdf.mjs` and calls `getDocument` with `data`, `worker: null`, `useWorkerFetch: false`, `standardFontDataUrl`, and a few feature flags.
- The upstream `v5.6.205` release notes list broad improvements and several API changes, including removing the `length` parameter from `getDocument` and simplifications around factory internals.[^pdfjs-release]
- This repo does not pass `length`, does not construct the factory classes mentioned in the release notes, and already manages `standardFontDataUrl` directly, so those listed API changes do not appear to intersect current call sites.
- Mozilla’s official security advisory for `pdfjs-dist` covers versions `<= 4.1.392`, patched in `4.2.67`.[^pdfjs-ghsa]
- Both `5.5.207` and `5.6.205` are above the patched range.
- The archived `pdfjs-dist` repository security page shows no published advisories, while the active `mozilla/pdf.js` security page lists the historical GHSA above.[^pdfjs-dist-security][^pdfjs-security]

Assessment:

- Safe enough to update in this repo, but verify with focused tests.
- Main risk is behavior drift in PDF extraction, not a known active security issue affecting these versions.
- Because this repo processes untrusted PDFs in a CLI context, malformed-file robustness still matters even without an active advisory. The current tests already cover `metadata-rich.pdf`, `no-text-proxy.pdf`, and invalid-PDF failure paths.

### 4. `tsdown` is safe to update with low-to-moderate build risk

- Repo usage is limited to the build pipeline:
  - `package.json` `build`
  - `tsdown.config.ts`
- The upstream `v0.21.7` release is small: one feature and one bug fix around `skipNodeModulesBundle` dep subpath e2e coverage/docs.[^tsdown-release]
- This repo already adopted recent `tsdown` config renames (`deps.onlyBundle`) and the current build passed locally on `0.21.5`.
- Upstream security page shows no published advisories at time of review.[^tsdown-security]

Assessment:

- Safe to update.
- Main risk is build-output drift or a new warning, not likely runtime breakage.

### 5. `yauzl` is safe to update and the new version does not intersect current usage

- Local usage is narrow and explicit in `src/adapters/docx/ooxml-package.ts`.
- The repo uses:
  - `fromBuffer`
  - `lazyEntries: true`
  - `decodeStrings: true`
  - `validateEntrySizes: true`
  - `openReadStream(entry, callback)`
- The upstream `3.3.0` change history adds `entry.canDecodeFileData()` and `decodeFileData` for `openReadStream()`, while deprecating older decompression/decryption options.[^yauzl-history]
- This repo does not use the deprecated options, so the new release does not overlap with the current call pattern.
- Upstream README continues to emphasize filename validation, entry-size validation, controlled memory behavior, and malformed-archive resilience.[^yauzl-readme]
- Upstream security page shows no published advisories at time of review.[^yauzl-security]

Assessment:

- Safe to update.
- Security posture is reasonably good for this use case because the repo is not extracting ZIP contents to arbitrary paths, limits XML-like entry size to `256 KiB`, and keeps `validateEntrySizes: true`.

## Local Verification

Commands run locally before any upgrade:

```sh
bun test test/adapters-codex-document-rename-titles.test.ts test/adapters-docx-ooxml-metadata.test.ts
bun run build
bun run lint
```

Results:

- targeted PDF/DOCX tests passed: `19` passed, `0` failed
- `bun run build` passed on `tsdown v0.21.5`
- `bun run lint` passed on `oxlint v1.57.0`

## Recommendation

Recommended now:

1. Update `oxfmt` to `0.43.0`.
2. Update `tsdown` to `0.21.7`.
3. Update `yauzl` to `3.3.0`.
4. Update `pdfjs-dist` to `5.6.205`, but keep it in the same PR as focused PDF test reruns.

Recommended with one extra check:

1. Update `oxlint` to `1.58.0`.
2. Immediately rerun `bun run lint`.
3. If lint fails, inspect `.oxlintrc.json` first because the upstream breaking change is config-facing.

Suggested verification after bump:

```sh
bun install
bun run lint
bun test test/adapters-codex-document-rename-titles.test.ts test/adapters-docx-ooxml-metadata.test.ts
bun run build
```

If you want the lowest-risk order:

1. `oxfmt`, `tsdown`, `yauzl`
2. `pdfjs-dist`
3. `oxlint`

## References

[^oxc-release]: [oxlint v1.58.0 & oxfmt v0.43.0 release notes](https://github.com/oxc-project/oxc/releases/tag/apps_v1.58.0)
[^oxc-security]: [oxc security overview](https://github.com/oxc-project/oxc/security)
[^pdfjs-release]: [pdf.js v5.6.205 release notes](https://github.com/mozilla/pdf.js/releases/tag/v5.6.205)
[^pdfjs-ghsa]: [GitHub Advisory Database: GHSA-wgrm-67xf-hhpq / CVE-2024-4367](https://github.com/advisories/GHSA-wgrm-67xf-hhpq)
[^pdfjs-dist-security]: [pdfjs-dist security overview](https://github.com/mozilla/pdfjs-dist/security)
[^pdfjs-security]: [pdf.js security overview](https://github.com/mozilla/pdf.js/security)
[^tsdown-release]: [tsdown v0.21.7 release notes](https://github.com/rolldown/tsdown/releases/tag/v0.21.7)
[^tsdown-security]: [tsdown security overview](https://github.com/rolldown/tsdown/security)
[^yauzl-history]: [yauzl change history](https://github.com/thejoshwolfe/yauzl/blob/master/README.md#change-history)
[^yauzl-readme]: [yauzl README](https://github.com/thejoshwolfe/yauzl/blob/master/README.md)
[^yauzl-security]: [yauzl security overview](https://github.com/thejoshwolfe/yauzl/security)
