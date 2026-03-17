---
title: "DOCX OOXML metadata helper phase 2"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Implement the Phase 2 shared DOCX OOXML metadata helper so DOCX package metadata can be extracted independently from rename-specific ranking logic.

## What Changed

- Added `src/adapters/docx/ooxml-metadata.ts`:
  - reads DOCX ZIP packages with `yauzl`
  - reads bounded XML-like package parts only
  - parses package relationships from `/_rels/.rels`
  - resolves core-properties and extended-properties targets with fallback to standard `docProps` locations
  - extracts typed core metadata fields:
    - `title`
    - `creator`
    - `subject`
    - `description`
    - `lastModifiedBy`
    - `created`
    - `modified`
    - `application`
  - returns `docx_metadata_unavailable` for missing or malformed metadata parts
  - reserves `docx_extract_error` for broken ZIP/package cases
- Added `src/yauzl.d.ts` with the minimal local type surface needed for the helper.
- Added `test/adapters-docx-ooxml-metadata.test.ts` covering:
  - valid metadata extraction from `test/fixtures/docs/metadata-rich.docx`
  - missing core-properties part
  - malformed core-properties XML
  - invalid ZIP bytes

## Verification

- `bun test test/adapters-docx-ooxml-metadata.test.ts test/adapters-codex-document-rename-titles.test.ts`
- `bun run build`

## Notes

- This phase does not yet change rename ranking behavior in `src/adapters/codex/document-rename-titles.ts`.
- Phase 3 should merge helper output into DOCX evidence ranking and warning selection.

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
