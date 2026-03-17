---
title: "DOCX phase 4 and phase 5 progress"
created-date: 2026-03-17
modified-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Implement Phase 4 DOCX ranking/evidence integration and the deterministic portion of Phase 5 fixture expansion and validation.

## What Changed

- Modularized `src/adapters/docx/` into a narrow helper split:
  - `src/adapters/docx/ooxml-package.ts`
  - `src/adapters/docx/ooxml-part-discovery.ts`
  - `src/adapters/docx/ooxml-metadata-parser.ts`
  - slimmed public wrapper in `src/adapters/docx/ooxml-metadata.ts`
- Updated `src/adapters/codex/document-rename-titles.ts`:
  - merged OOXML metadata into DOCX evidence extraction
  - ranked metadata title ahead of weak generic DOCX headings
  - down-ranked weak generic titles such as `Goal`
  - kept weak-signal fallback behavior intact
  - made DOCX warning labels explicit:
    - `docx_metadata_unavailable`
    - `docx_metadata_missing_title`
    - `docx_no_lead_text`
- Expanded deterministic DOCX fixture generation in `scripts/generate-docx-fixtures.mjs` and regenerated fixtures:
  - `test/fixtures/docs/metadata-rich.docx`
  - `test/fixtures/docs/weak-heading.docx`
  - `test/fixtures/docs/no-heading.docx`
  - `test/fixtures/docs/hyperlink-heavy.docx`
  - `test/fixtures/docs/table-heavy.docx`
- Added DOCX ranking/integration assertions in `test/adapters-codex-document-rename-titles.test.ts`.
- Restored OOXML metadata part-path normalization so dotted relationship targets like `./metadata/core/../core/custom-core.xml` still resolve to the packaged metadata parts.
- Added a regression test in `test/adapters-docx-ooxml-metadata.test.ts` covering dotted metadata relationship targets.

## Fixture Notes

Deterministic generator outputs:

- `test/fixtures/docs/metadata-rich.docx`
- `test/fixtures/docs/weak-heading.docx`
- `test/fixtures/docs/no-heading.docx`
- `test/fixtures/docs/hyperlink-heavy.docx`
- `test/fixtures/docs/table-heavy.docx`

Existing externally authored sample still present:

- `test/fixtures/docs/heading-rich.docx`

Still pending from Phase 5:

- alternate-editor exported DOCX validation sample
- targeted manual validation against a small real-world sample pack

## Verification

- `node scripts/generate-docx-fixtures.mjs reset`
- `bun test test/adapters-docx-ooxml-metadata.test.ts test/adapters-codex-document-rename-titles.test.ts`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
