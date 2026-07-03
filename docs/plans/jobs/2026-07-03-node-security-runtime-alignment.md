---
title: "Align Node runtime pins with June 2026 security releases"
created-date: 2026-07-03
status: completed
agent: codex
---

## Goal

Align the repository's explicit Node.js runtime references with the June 2026
Node.js security releases so package metadata and publish CI no longer point at
known-affected patch levels.

## Context

The Node.js June 2026 security release made fixes available for the supported
22.x, 24.x, and 26.x lines. The fixed versions relevant to this repository are
Node.js `22.23.0` for the package runtime floor and Node.js `24.17.0` or newer
for the publish workflow's Node 24 runtime.

The repository previously advertised Node.js `>=22.18.0` while both publish
workflows pinned `24.14.1`. Those versions predate the fixed release lines.

## Changes

- Raised `package.json` `engines.node` from `>=22.18.0` to `>=22.23.0`.
- Updated the README runtime requirement from `>=22.18.0` to `>=22.23.0`.
- Updated the npm publish workflow Node pin from `24.14.1` to `24.18.0`.
- Updated the GitHub Packages publish workflow Node pin from `24.14.1` to
  `24.18.0`.

## Notes

- `tsdown.config.ts` still targets `node22`; the build target remains aligned
  with the supported Node major and does not need a patch-level target.
- `@types/node` remains unchanged. Type package major updates are a separate
  type/runtime baseline decision, not a Node runtime security patch.

## Verification

- `rg -n "22\.18\.0|24\.14\.1|22\.23\.0|24\.18\.0" package.json README.md .github/workflows docs/plans/jobs/2026-07-03-node-security-runtime-alignment.md`
- `git diff --check`
- `bun run format:check`
- `bun run build`

## References

- [Node.js June 2026 security releases](https://nodejs.org/en/blog/vulnerability/june-2026-security-releases)
