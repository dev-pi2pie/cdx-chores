---
title: "Implement EXIF-first timestamp precedence and complete Phase 3 decisions"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Complete Phase 3 naming/template decisions by implementing EXIF-first timestamp precedence (with `mtime` fallback) and documenting the EXIF scope for the Node-only launch.

## What Changed

- Added internal EXIF timestamp reader in `src/utils/exif.ts`
  - JPEG APP1/EXIF parsing
  - TIFF parsing
  - PNG `eXIf` chunk parsing
  - WebP `EXIF` chunk parsing
  - tag precedence support:
    - `DateTimeOriginal`
    - `DateTimeDigitized`
    - `DateTime`
- Updated rename planners in `src/cli/fs-utils.ts` to use EXIF-first timestamps for supported image formats (`.jpg`, `.jpeg`, `.tif`, `.tiff`, `.png`, `.webp`) and fall back to `mtime`.
- Preserved current deterministic behavior:
  - filename pattern/template rendering unchanged
  - collision suffix handling unchanged
  - parse failures never block rename flow
- Documented Phase 3 decisions in `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`:
  - default prefix remains `file`
  - EXIF wall-clock timestamps are used as-is in filenames
  - `mtime` fallback keeps current UTC formatting

## Tests Added/Updated

- `test/cli-actions-data-rename.test.ts`
  - single-file JPEG EXIF timestamp precedence over `mtime`
  - existing invalid JPEG `.jpg` tests continue covering `mtime` fallback behavior

## Verification

- `bun test test/cli-actions-data-rename.test.ts`
- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
