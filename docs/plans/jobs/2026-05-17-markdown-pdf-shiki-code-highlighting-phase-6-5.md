---
title: "Markdown PDF Shiki code highlighting phase 6.5"
created-date: 2026-05-17
status: completed
agent: codex
---

## Goal

Implement opt-in Shiki transformer notation for Markdown PDF code blocks after the base Shiki transform, line-number markup, and fixture generator were in place.

## Scope

This job covers the automated Phase 6.5 implementation and regression coverage for highlighted-line and diff notation. Manual PDF review was later completed during Phase 7 using existing generated smoke outputs under `examples/playground/markdown-pdf-code/`.

## Changes

- Added `@shikijs/transformers` as a runtime dependency.
- Added profile-level `code.transformerNotation`, defaulting to `false`.
- Gated transformer notation on effective `code.highlight: true`, while allowing `--code-highlight` to opt in and `--no-code-highlight` to disable both highlighting and transformer notation for that render.
- Wired Shiki notation transformers for `[!code highlight]`, `[!code ++]`, and `[!code --]`.
- Covered Shiki `:N` range suffixes for highlighted, inserted, and deleted lines.
- Mapped transformer output to repo-owned line classes: `.cdx-code-line--highlighted`, `.cdx-code-line--inserted`, and `.cdx-code-line--deleted`.
- Kept no-language and unsupported-language blocks plain and uninterpreted.
- Extended fixture generation with transformer notation examples, including combined notation and profile-controlled line numbers.
- Adjusted fixture body headings to use scenario-oriented `##` subheadings so smoke outputs do not visually repeat the frontmatter document title.

## Smoke Evidence

- `node scripts/generate-markdown-pdf-code-fixtures.mjs reset` refreshed the committed fixtures.
- `node scripts/generate-markdown-pdf-code-fixtures.mjs smoke` exited successfully and skipped because Pandoc or WeasyPrint was unavailable.

Manual review of the generated transformer PDFs was later recorded in the Phase 7 docs job.

## Verification

- `bun run format`
- `bun test test/cli-actions-md-to-pdf-code-highlight.test.ts test/cli-actions-md-to-pdf-recipe-fonts.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/markdown-pdf-code-fixture-generator.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
- `bun tsc --noEmit`
- `git diff --check`
- Maintainability reviewer: no actionable issues.
- Test reviewer: no material coverage gaps after follow-up fixes.
- Docs reviewer: no actionable issues after the Phase 6.5 job record was added.

## Related Plan

- [Markdown PDF Shiki code highlighting implementation](../plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md)

## Related Research

- [Markdown PDF Shiki Code Highlighting](../../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)
