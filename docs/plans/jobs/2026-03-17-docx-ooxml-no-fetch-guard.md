---
title: "Add DOCX OOXML no-fetch guard"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Make the offline-safe OOXML identifier strategy concrete in code by documenting the no-fetch contract in the DOCX helper and adding a regression test that fails if metadata reading attempts a runtime fetch.

## What Changed

- Updated `src/adapters/docx/ooxml-metadata.ts`:
  - added a code comment above the OOXML relationship identifiers clarifying that they are specification identifiers, not network fetch targets
- Updated `test/adapters-docx-ooxml-metadata.test.ts`:
  - added a regression test that temporarily traps `globalThis.fetch`
  - verifies `readDocxCoreMetadata()` reads metadata from a DOCX fixture without making any fetch call
- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`:
  - added an explicit Phase 3 checklist item for the no-fetch regression test

## Verification

- `bun test test/adapters-docx-ooxml-metadata.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
