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
4. Added custom-template HTML asset preprocessing for relative asset references
   before Pandoc renders the document.
5. Preserved Markdown-input-relative asset resolution by leaving Markdown body
   references untouched and keeping WeasyPrint's base URL on the input
   directory.
6. Added focused regression coverage for template-local assets and cover CSS
   without `vh` units.
7. Ran focused validation and repository gates.
8. Requested auto-commit notification before committing meaningful progress.
9. Requested code review on the Phase 8.3 commit range.
10. Addressed review findings by moving template asset rewriting from final
    rendered HTML to the custom template passed to Pandoc.
11. Added fail-closed checks for missing template assets, path traversal, and
    symlink escapes before render-time execution.
12. Added landscape inch page-size coverage for cover-media CSS sizing.

## Changes

- Added structured custom-template preprocessing for template-local asset
  references before Pandoc combines the template and Markdown body.
- Kept the rewrite narrow: only relative asset attributes on asset-bearing
  template tags are rewritten to file URLs.
- Left Markdown body image references relative to the Markdown input directory.
- Failed closed when custom-template asset references are missing, escape the
  template directory, or resolve through a symlink outside the template
  directory.
- Changed Template-Codex cover CSS from `vh` sizing to definite page-size
  lengths such as `297mm`, `201.96mm`, and `225.72mm`.
- Updated template synthesis tests that previously locked in `68vh` and
  `76vh`.
- Added render-path coverage proving `assets/cover.png` can resolve from the
  template bundle while a colliding Markdown body asset reference remains
  Markdown-input-relative.
- Added render-path coverage for missing template assets, traversal attempts,
  and symlink escapes.
- Added cover CSS coverage for landscape Letter sizing in inch units.

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
- `bun test test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
  - Passed after review follow-up: 22 tests.
- `bun test test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
  - Passed after integration assertion update: 34 tests.
- `bunx tsc --noEmit`
  - Passed after review follow-up.
- `bun run lint`
  - Passed after review follow-up.
- `bun run format:check`
  - Passed after formatting the touched follow-up files.
- `bun run build`
  - Passed after review follow-up.
- `git diff --check`
  - Passed after review follow-up.
- `bun test --timeout 30000`
  - Passed after review follow-up: 1297 tests.

## Review

- `auto_commit_notification` was requested before the implementation commit;
  the thread limit blocked a fresh advisor, so the existing `Commit Scout the
  9th` thread was reused.
- Initial Phase 8.3 code review range `2065397..84d5e6d` was reviewed by
  `Plainspoken the 6th` and `Probe the 6th`.
- Material findings addressed in the review follow-up:
  - Template asset rewriting must not rewrite Markdown body references in the
    final rendered HTML.
  - Missing, escaping, and symlinked template asset references should fail
    closed instead of silently falling back to Markdown input resolution.
  - Cover page-size CSS should include non-A4 orientation/unit coverage.
- Pending final Phase 8.3 review range after follow-up commit.

Phase 8.3 implementation commit:

- `84d5e6d fix(template-codex): render bundle cover assets safely`

Phase 8.3 review follow-up commit:

- Pending.
