---
title: "Stacked merged-band docs and regression"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Wired the dedicated stacked merged-band fixture route into the smoke docs and added a command-level regression test for the current failing behavior.

## Changes

- updated `docs/guides/data-extract-usage.md` to document:
  - the dedicated `scripts/generate-stacked-merged-band-fixture.mjs` route
  - the public-safe repro workbook path
  - the current known failing `range + header-row` command shape
- added a command-level regression test in `test/cli-command-data-extract.test.ts` that asserts the public stacked merged-band workbook still fails with the expected parse error
- reused the dedicated fixture seeding helper so the regression test does not depend on the general data-extract fixture generator

## Verification

- `bun test test/cli-command-data-extract.test.ts test/data-extract-fixture-generator.test.ts test/stacked-merged-band-fixture-generator.test.ts test/data-query-xlsx-sources.test.ts`
