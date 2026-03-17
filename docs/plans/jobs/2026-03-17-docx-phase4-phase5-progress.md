---
title: "DOCX phase 4 and phase 5 progress"
created-date: 2026-03-17
modified-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Implement Phase 4 DOCX ranking/evidence integration and complete Phase 5 fixture expansion and validation.

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
- Added an alternate-editor exported validation fixture:
  - `test/fixtures/docs/textutil-alt-editor.docx`
  - source file retained as `test/fixtures/docs/textutil-alt-editor-source.rtf`
  - exported locally with macOS `textutil`, so the sample is externally authored rather than generator-authored metadata
- Added validation coverage proving the alternate-editor fixture remains usable even when OOXML metadata is unavailable:
  - `test/adapters-docx-ooxml-metadata.test.ts`
  - `test/adapters-codex-document-rename-titles.test.ts`

## Fixture Notes

Deterministic generator outputs:

- `test/fixtures/docs/metadata-rich.docx`
- `test/fixtures/docs/weak-heading.docx`
- `test/fixtures/docs/no-heading.docx`
- `test/fixtures/docs/hyperlink-heavy.docx`
- `test/fixtures/docs/table-heavy.docx`

Existing externally authored sample still present:

- `test/fixtures/docs/heading-rich.docx`
- `test/fixtures/docs/textutil-alt-editor.docx`

Validation pack used to close Phase 5:

- Word-authored:
  - `test/fixtures/docs/heading-rich.docx`
- alternate-editor exported:
  - `test/fixtures/docs/textutil-alt-editor.docx`
- deterministic metadata-rich:
  - `test/fixtures/docs/metadata-rich.docx`
- deterministic weak-heading:
  - `test/fixtures/docs/weak-heading.docx`
- deterministic no-heading:
  - `test/fixtures/docs/no-heading.docx`
- deterministic hyperlink-heavy:
  - `test/fixtures/docs/hyperlink-heavy.docx`
- deterministic table-heavy:
  - `test/fixtures/docs/table-heavy.docx`

## Validation Outcomes

Observed outcomes from extractor-level validation:

| Category | Sample | Top-ranked title candidate | Metadata or body evidence won | Warning set | Fallback acceptable |
| --- | --- | --- | --- | --- | --- |
| Word-authored | `test/fixtures/docs/heading-rich.docx` | `CLI Action Tool Integration Guide` | metadata | none | yes |
| alternate-editor exported | `test/fixtures/docs/textutil-alt-editor.docx` | `Partner Enablement Guide` | body | `docx_metadata_unavailable` | yes |
| metadata-rich | `test/fixtures/docs/metadata-rich.docx` | `Quarterly Operating Plan 2026` | metadata | none | yes |
| weak-heading | `test/fixtures/docs/weak-heading.docx` | `Customer Launch Checklist` | body | `docx_metadata_unavailable` | yes |
| no-heading | `test/fixtures/docs/no-heading.docx` | `Q2 Hiring Plan` | body | `docx_metadata_unavailable` | yes |
| hyperlink-heavy | `test/fixtures/docs/hyperlink-heavy.docx` | `Partner Reference Guide` | body | `docx_metadata_unavailable` | yes |
| table-heavy | `test/fixtures/docs/table-heavy.docx` | `Roadmap Milestones` | body | `docx_metadata_unavailable` | yes |

Phase 5 decision:

- The deterministic generator set plus the existing Word-authored sample and the `textutil` alternate-editor exported sample are sufficient to close Phase 5.
- Broader alternate-editor and manual real-world validation remain useful follow-up work, but they are not required to complete this phase.

## Verification

- `node scripts/generate-docx-fixtures.mjs reset`
- `bun test test/adapters-docx-ooxml-metadata.test.ts test/adapters-codex-document-rename-titles.test.ts`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
