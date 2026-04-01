---
title: "Outdated dependency upgrade pass"
created-date: 2026-04-01
modified-date: 2026-04-01
status: completed
agent: Codex
---

## Goal

Upgrade the currently reviewed outdated dependencies in the approved order:

1. `oxfmt`
2. `tsdown`
3. `yauzl`
4. `pdfjs-dist`
5. `oxlint`

## Scope

- update dependency versions and lockfile entries
- run focused verification after the runtime-sensitive upgrades
- run lint and build verification at the end

## Verification Plan

- `bun test test/adapters-codex-document-rename-titles.test.ts test/adapters-docx-ooxml-metadata.test.ts`
- `bun run lint`
- `bun run build`

## Notes

- Risk review is documented in `docs/researches/research-2026-04-01-dependency-upgrade-safety-check.md`.
- Upgraded in approved order:
  1. `oxfmt` -> `0.43.0`
  2. `tsdown` -> `0.21.7`
  3. `yauzl` -> `3.3.0`
  4. `pdfjs-dist` -> `5.6.205`
  5. `oxlint` -> `1.58.0`
- Final verification passed:
  - `bun run lint`
  - `bun run build`
  - `bun test test/adapters-codex-document-rename-titles.test.ts test/adapters-docx-ooxml-metadata.test.ts`
