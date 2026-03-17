---
title: "DOCX OOXML review fixes"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Address review findings in the DOCX OOXML metadata helper around XML encoding support and percent-escaped pack URI resolution.

## What Changed

- Updated `src/adapters/docx/ooxml-package.ts`:
  - added XML encoding detection for OOXML parts
  - decodes UTF-8 and UTF-16 metadata parts before validation/parsing instead of assuming UTF-8
- Added `src/adapters/docx/ooxml-part-path.ts`:
  - centralizes DOCX package part-path normalization
  - percent-decodes URI-escaped path segments before POSIX normalization
- Updated `src/adapters/docx/ooxml-part-discovery.ts`:
  - switched relationship and content-type part-path handling to the shared normalizer
- Expanded `test/adapters-docx-ooxml-metadata.test.ts` with regressions for:
  - UTF-16 encoded core-properties XML
  - percent-escaped relationship/content-type metadata part paths

## Verification

- `bun test test/adapters-docx-ooxml-metadata.test.ts`
- `bun test test/adapters-codex-document-rename-titles.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-docs.test.ts`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`
