---
title: "Clean up oxlint test unused-vars policy"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: Codex
---

## Goal

Move repeated test-only `no-unused-vars` suppressions into the oxlint config while keeping unused-variable checks active for production code.

## Changes

- Added a schema reference to `.oxlintrc.json` for editor validation.
- Removed stale default plugin settings with `null` values that triggered schema diagnostics in editors.
- Added a `test/**/*.test.ts` override that disables `no-unused-vars` only for test files.
- Removed repeated `/* oxlint-disable no-unused-vars */` headers from split data query and data extract test files.

## Rationale

The repeated file-level suppressions were hiding the same test-structure issue in many files. A scoped override makes the policy explicit and keeps `src` covered by the default unused-variable rule.

## Verification

- `bunx oxlint --print-config` confirmed the test-file override is loaded.
- `rg -n "oxlint-disable[^\n]*no-unused-vars|no-unused-vars" test` found no remaining test-file suppressions after cleanup.
- `bun run lint` passed with `0` warnings and `0` errors.
- `bun run format:check` passed.
