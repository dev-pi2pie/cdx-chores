---
title: "Add oxlint and oxfmt config"
created-date: 2026-03-01
status: completed
agent: codex
---

## Summary

- Added baseline `oxlint` and `oxfmt` config files for the repo.
- Wired package scripts for linting, lint autofix, formatting, and format checks.
- Fixed the small existing `oxlint` warnings that would otherwise make the initial setup noisy or misleading.

## What Changed

- `.oxlintrc.json`
  - added a baseline Oxlint config with builtin env enabled
  - ignored generated or scratch paths such as `dist/**`, `coverage/**`, `examples/playground/**`, and `node_modules/**`
- `.oxfmtrc.json`
  - added matching ignore patterns for formatter runs
- `package.json`
  - added `lint`, `lint:fix`, `format`, and `format:check` scripts
- `src/utils/slug.ts`
  - replaced the non-ASCII stripping regex with a Unicode-property-based ASCII matcher so Oxlint does not flag control characters
- `src/cli/fs-utils.ts`
  - replaced the filename sanitization control-character range with `\p{Cc}` so the intent stays the same without triggering `no-control-regex`
- `test/cli-actions-rename-batch-core.test.ts`
  - removed an unused import and unused `stdout` bindings
- `test/cli-actions-rename-file.test.ts`
  - removed an unused `stdout` binding

## Verification

- `bunx oxlint --tsconfig tsconfig.json src test scripts`
- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-apply.test.ts`

## Notes

- `oxfmt --check src test scripts package.json tsconfig.json .oxlintrc.json .oxfmtrc.json` still reports existing formatting drift across many files. This job adds the formatter configuration and scripts, but does not reformat the full repository.
