---
title: "Markdown to PDF profile phases 4-5"
created-date: 2026-05-07
status: completed
agent: codex
---

## Goal

Implement the next Markdown-to-PDF profile phases from the active profile plan:

- Phase 4: cover page HTML/CSS recipe support
- Phase 5: profile font normalization, fallback stacks, and mixed-language CSS

## Scope

This job covers cover pages and generated font CSS only. It does not implement shared `src/fonts/` discovery, glyph coverage checks, strict font availability validation, or expanded Phase 7 language fixtures.

## Changes

- Added normalized profile cover settings with `plain` and `report` styles.
- Added generated cover HTML from merged metadata and profile cover fields.
- Added cover page CSS through the Pandoc HTML and WeasyPrint CSS recipe path.
- Added profile font normalization for `body`, `heading`, `code`, and `pageChrome` roles.
- Added generated fallback font stacks while preserving the Latin body font first.
- Added generated `:lang(...)` CSS for configured language-specific body fonts.
- Added `pdf.content-langs` / profile content-language support for ordered mixed-language fallback stacks.
- Kept this slice independent from real system font discovery.

## Verification

- Passed `bun test test/cli-actions-md-to-pdf.test.ts` with 51 tests.
- Passed `bun run lint`.
- Passed `bun run format:check`.
- Passed `bun run build`.
- Passed `git diff --check`.

Implementation evidence:

- Cover HTML/CSS, `plain` cover, `report` cover, and portrait/landscape behavior are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).
- Role-based font normalization, `pageChrome` font CSS, default fallback stacks, full `:lang(...)` fallback chains, Latin-first ordering, duplicate content-language handling, and canonical `pdf.content-langs` behavior are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).
- The span fixture includes a real-Pandoc smoke test for `[日本語]{lang=ja}` and `[繁體中文]{lang=zh-Hant}` when Pandoc is available, plus deterministic action-level language-marked HTML output coverage in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).

## Related Plan

- [Markdown to PDF profiles, fonts, and page chrome implementation](../plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](../../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
