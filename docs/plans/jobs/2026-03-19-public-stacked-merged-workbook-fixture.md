---
title: "Public stacked merged workbook fixture"
created-date: 2026-03-19
status: completed
agent: codex
---

## Summary

Added a public-safe merged-band workbook fixture to replace direct documentation references to the private local repro workbook.

## Changes

- added a dedicated generator route in `scripts/generate-stacked-merged-band-fixture.mjs`
- kept the general `scripts/generate-data-extract-fixtures.mjs` fixture set focused on the smaller representative extract fixtures
- kept the workbook shape intentionally similar to the hard merged-sheet class:
  - decorative merged title area
  - wide merged header bands
  - repeated wide merged body rows
- updated fixture coverage in:
  - `test/stacked-merged-band-fixture-generator.test.ts`
  - `test/data-query-xlsx-sources.test.ts`
- added a dedicated test helper for seeding the stacked merged-band workbook into temporary workspaces
- updated the new research and plan docs to reference `examples/playground/data-extract/stacked-merged-band.xlsx` instead of the private issue-data workbook path

## Verification

- regenerate `examples/playground/data-extract/` with:
  - `node scripts/generate-data-extract-fixtures.mjs reset`
  - `node scripts/generate-stacked-merged-band-fixture.mjs reset`
- run focused fixture and snapshot tests
