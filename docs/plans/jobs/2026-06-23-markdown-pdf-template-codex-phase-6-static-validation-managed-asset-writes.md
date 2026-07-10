---
title: "Markdown PDF template Codex phase 6 static validation and managed asset writes"
created-date: 2026-06-23
modified-date: 2026-06-23
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 6 of the direct `md pdf-template codex` plan.

This phase turns validated deterministic synthesis into a written template
bundle. It adds final static validation, safe bundle writes, managed cover
asset copying, and minimal report-only support for `no-usable-template`
decisions. It does not render PDFs, invoke Pandoc or WeasyPrint, or implement
the richer Phase 7 diagnostic report contract.

## Implementation Notes

- Keep validation static and later-render aware.
- Validate synthesized `template.html` and `style.css` before any normal bundle
  writes.
- Keep all recipe files, in-bundle reports, and managed assets inside the
  planned output directory.
- Copy only planned local managed assets, currently the single accepted
  `--cover-image` asset.
- Preserve bundle-relative asset references in generated HTML/CSS.
- Treat `--dry-run` as planning and summary only: no directory creation, recipe
  writes, report writes, or asset copies.
- For `no-usable-template`, write only a requested minimal advisory report and
  no recipe files.

## Changes

- Added `src/cli/markdown-pdf/template-codex/validate-template.ts` for final
  static bundle validation.
- Added `src/cli/markdown-pdf/template-codex/asset-copy.ts` for safe managed
  asset copying.
- Added `src/cli/markdown-pdf/template-codex/write-bundle.ts` for bundle
  materialization and minimal report-only failure handling.
- Exported the Phase 6 helpers from
  `src/cli/markdown-pdf/template-codex/index.ts`.
- Updated `actionMdPdfTemplateCodex` to write validated bundles during normal
  execution instead of stopping at the old Phase 6 boundary.
- Added direct bundle-write coverage for required placeholders, unsafe
  references, managed cover copies, final output-boundary checks, and
  `no-usable-template` report-only behavior.
- Updated command-layer tests to assert successful bundle writes, external
  report output, and managed cover asset copying through `md pdf-template
  codex`.

## Verification

- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts`
  - Passed after Phase 6 implementation: 78 tests.
- `bun test test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts`
  - Passed after command-layer expectation updates: 96 tests.
- `bunx tsc --noEmit`
  - Passed after implementation and after command-layer test updates.
- `bun run format:check`
  - Passed after implementation and after command-layer test updates.
- `bun run lint`
  - Passed after implementation.
- `bun run build`
  - Passed after implementation.
- `git diff --check`
  - Passed after implementation and after command-layer test updates.
- `bun test --timeout 30000`
  - Initially found two stale command-layer tests that still expected the old
    write-boundary failure.
  - Passed after the command-layer test update: 1278 tests.

## Review

- Phase implementation range reviewed as `e9f5c0a..fc564dc`.
- Command-layer test follow-up reviewed as `fc564dc..b2e0cf9`.
- `auto_commit_notification` was used before each meaningful commit boundary.
- Maintainability/code review and test/edge-case review were requested from
  `Plainspoken the 6th` and `Probe the 6th` for the Phase 6 implementation
  range.
- Full-suite validation found the stale command-layer expectations before docs
  closeout; the follow-up test commit updated those assertions to the new
  Phase 6 write behavior.

Phase 6 implementation commits:

- `fc564dc` `feat(template-codex): write validated markdown PDF template bundles`
- `b2e0cf9` `test(cli): update md pdf-template codex command expectations`
