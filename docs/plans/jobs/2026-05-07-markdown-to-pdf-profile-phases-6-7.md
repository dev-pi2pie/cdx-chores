---
title: "Markdown to PDF profile phases 6-7"
created-date: 2026-05-07
status: completed
agent: codex
---

## Goal

Implement the next Markdown-to-PDF profile phases from the active profile plan:

- Phase 6: shared font discovery and deterministic coverage checks
- Phase 7: expanded mixed-language fixture coverage

## Scope

This job covers the reusable `src/fonts/` boundary, controlled glyph coverage checks, Markdown PDF profile coverage helpers, and expanded fixture tests. It does not add automatic language detection, renderer-specific RTL layout guarantees, or system-font-dependent CI assertions.

## Changes

- Added shared font types, discovery orchestration, and coverage checks under `src/fonts/`.
- Added macOS, Linux/fontconfig, Windows, and direct fontconfig discovery adapters.
- Chose platform-command discovery as the strategy for this slice instead of adding a font parser dependency.
- Kept discovery as candidate discovery only; glyph support is checked through controlled inventories and sample text.
- Added deterministic CJK and Nerd Font private-use glyph coverage checks.
- Added Markdown PDF profile font coverage helpers that consume the shared font module without making the shared module depend on Markdown PDF profile types.
- Expanded mixed-language fixture coverage for Traditional Chinese, Simplified Chinese, Japanese, Korean, Latin-extended Vietnamese and Polish, and Arabic/Hebrew RTL smoke behavior.
- Kept Nerd Font code glyph coverage in a separate controlled code-font path.

## Verification

- Passed `bun test test/fonts.test.ts`.
- Passed `bun test test/cli-actions-md-to-pdf.test.ts` with 53 tests.
- Passed `bun test test/fonts.test.ts test/cli-actions-md-to-pdf.test.ts` with 60 tests.
- Passed `bun run lint`.
- Passed `bun run format:check`.
- Passed `bun run build`.
- Passed `git diff --check`.

Implementation evidence:

- Platform adapter parsing and injected Linux/fontconfig discovery are covered in [fonts.test.ts](../../../test/fonts.test.ts).
- Controlled CJK and Nerd Font coverage checks are covered in [fonts.test.ts](../../../test/fonts.test.ts).
- Markdown PDF profile coverage warnings, expanded language normalization, generated CSS, and RTL smoke scope are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).

## Related Plan

- [Markdown to PDF profiles, fonts, and page chrome implementation](../plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](../../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
