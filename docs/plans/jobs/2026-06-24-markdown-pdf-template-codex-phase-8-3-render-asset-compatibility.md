---
title: "Markdown PDF template Codex phase 8.3 render asset compatibility"
created-date: 2026-06-24
modified-date: 2026-06-24
status: active
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.3 of the direct `md pdf-template codex` plan.

This phase fixes two render-time compatibility gaps found by rendering a
generated cover-media template bundle through `md to-pdf`:

- Template-Codex cover CSS emitted viewport units that WeasyPrint rejects in
  this paged-media path.
- Bundle-relative cover assets such as `assets/cover.png` resolved against the
  Markdown input directory instead of the custom template bundle directory.

## Sequence

1. Reproduced the cause from the generated bundle artifacts and render path.
2. Replaced Template-Codex cover-media viewport units with definite page-size
   units derived from normalized page size and orientation.
3. Kept cover `contain` and `cover` image-fit behavior bounded by page-size
   rules instead of source pixel dimensions.
4. Added custom-template HTML asset rewriting for relative asset references
   that exist inside the custom template directory.
5. Preserved Markdown-input-relative asset resolution by leaving unresolved
   relative references untouched and keeping WeasyPrint's base URL on the input
   directory.
6. Added focused regression coverage for template-local assets and cover CSS
   without `vh` units.
7. Ran focused validation and repository gates.
8. Requested auto-commit notification before committing meaningful progress.
9. Requested code review on the Phase 8.3 commit range.

## Changes

- Added structured final-HTML rewriting for custom-template-local asset
  references.
- Kept the rewrite narrow: only relative HTML asset attributes whose target file
  exists inside the custom template directory are rewritten to file URLs.
- Left Markdown body image references relative to the Markdown input directory.
- Changed Template-Codex cover CSS from `vh` sizing to definite page-size
  lengths such as `297mm`, `201.96mm`, and `225.72mm`.
- Updated template synthesis tests that previously locked in `68vh` and
  `76vh`.
- Added render-path coverage proving `assets/cover.png` can resolve from the
  template bundle while `images/body.png` remains Markdown-input-relative.

## Verification

- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-actions*.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed after implementation and formatting: 132 tests.
- `bunx tsc --noEmit`
  - Passed after implementation and formatting.
- `bun run lint`
  - Passed after implementation and formatting.
- `bun run format:check`
  - Passed after formatting the touched code and test files.
- `git diff --check`
  - Passed after implementation and formatting.
- `bun run build`
  - Passed after implementation.
- `bun test --timeout 30000`
  - Passed after implementation: 1293 tests.

## Review

- `auto_commit_notification` was requested before the implementation commit;
  the thread limit blocked a fresh advisor, so the existing `Commit Scout the
  9th` thread was reused.
- Pending Phase 8.3 code review range.
- Pending review requests to `Plainspoken the 6th` and `Probe the 6th`.

Phase 8.3 implementation commit:

- Pending.
