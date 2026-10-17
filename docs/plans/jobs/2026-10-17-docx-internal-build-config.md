---
title: "DOCX internal build configuration"
created-date: 2026-10-17
status: completed
agent: codex
---

## Changes

Extract the internal DOCX runtime build configuration into `scripts/build/docx-runtime.ts` and compose it from `tsdown.config.ts`. Keep entry names, ESM/CJS output paths, and all build options unchanged so the runtime continues finding its child, worker, and parser assets. These assets are emitted into `dist` and shipped with the npm package for internal runtime use; they are not part of the supported public package API. The package's public exports remain unchanged.

Use an explicit `.ts` import extension for native Node configuration loading. No separate package or build command is introduced.

## Verification

- `bun run build` passed; the existing TypeScript 7 experimental API warning remains.
- Resolved configuration values and ordering matched the pre-change configuration. All 91 files in the local `dist` snapshot retained identical paths, SHA-256 hashes, and permissions after rebuilding.
- Focused Oxlint/Oxfmt checks and `bunx tsc --noEmit` passed.
- `env -u NODE_USE_ENV_PROXY node scripts/docx-candidate/package-check.mjs` passed tarball inspection and all eight npm/Bun, primary/minimum Node, ESM/CJS consumer paths; temporary cleanup was confirmed. Initial runs with the inherited proxy flag failed because a Node 22 experimental proxy warning violated the verifier's empty-stderr assertion; no product or verifier changes were needed.
