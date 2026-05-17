---
title: "Markdown PDF Shiki code highlighting phase 7 docs"
created-date: 2026-05-17
status: completed
agent: codex
---

## Goal

Complete Phase 7 of the Markdown PDF Shiki code-highlighting plan by updating public usage documentation and reviewing related lifecycle status after the automated implementation evidence was linked.

## Completed Work

- Updated [Markdown PDF Usage](../../guides/markdown-pdf-usage.md) with `--code-highlight`, `--no-code-highlight`, and profile `code` examples.
- Documented the fixed Shiki light-theme allowlist: `github-light`, `light-plus`, `min-light`, `vitesse-light`, and `catppuccin-latte`.
- Documented profile-controlled `code.lineNumbers` and `code.transformerNotation`, including highlighted lines, inserted/deleted lines, and Shiki `:N` range suffixes.
- Documented the old-template migration path: regenerate with `md pdf-template init --overwrite` or copy the new `.cdx-code` hook CSS from a newly generated template.
- Documented the code-highlighting fixture generator commands and the ignored manual smoke output location.
- Marked the Phase 7 checklist items complete in the implementation plan.
- Updated the implementation plan status from `draft` to `completed` after manual PDF smoke review evidence was recorded.
- Marked the related research status `completed` after linking implementation evidence, public guide evidence, and manual PDF smoke review evidence.
- Recorded manual PDF review of existing generated smoke outputs under `examples/playground/markdown-pdf-code/`, using Quick Look previews for highlighted-line, diff, and combined line-number transformer cases.

## Validation

- `bun run lint`
- `bun run format:check`
- `bun run build`
- `git diff --check`
- `node scripts/generate-markdown-pdf-code-fixtures.mjs smoke` skipped cleanly because `weasyprint` is not on `PATH` in this shell.
- Existing generated PDF smoke artifacts were inspected through Quick Look previews:
  - `examples/playground/markdown-pdf-code/pdf/code-transformer-highlight-line.pdf`
  - `examples/playground/markdown-pdf-code/pdf/code-transformer-diff.pdf`
  - `examples/playground/markdown-pdf-code/pdf/code-transformer-line-numbers-combined.pdf`

## Review

- Docs reviewer: found two traceability issues.
- Addressed by first narrowing the research status note to the remaining manual PDF review evidence, then marking the research completed after manual PDF review evidence was recorded.
- Follow-up docs reviewer pass reported no actionable issues.
- Final status/lifecycle re-review reported no actionable issues.
- Post-manual-review lifecycle re-review reported no actionable issues.

## Related Plan

- [Markdown PDF Shiki code highlighting implementation](../plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md)

## Related Research

- [Markdown PDF Shiki Code Highlighting](../../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Guide

- [Markdown PDF Usage](../../guides/markdown-pdf-usage.md)
