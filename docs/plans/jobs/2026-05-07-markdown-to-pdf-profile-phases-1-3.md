---
title: "Markdown to PDF profile phases 1-3"
created-date: 2026-05-07
status: completed
agent: codex
---

## Goal

Implement the first Markdown-to-PDF profile phases from the active profile plan:

- Phase 1: profile model, parsing, serialization, validation, metadata merge
- Phase 2: `--profile` and `md pdf-profile init` command surface
- Phase 3: page chrome, metadata placeholders, and opt-in page numbers

## Scope

This job covers the first implementation slice only. It does not implement cover pages, profile font stacks, mixed-language CSS, shared `src/fonts/` discovery, or expanded language fixtures.

## Changes

- Added `src/cli/markdown-pdf/profile/` for profile defaults, schema checks, YAML/JSON parsing, serialization, and normalization.
- Added profile metadata merging from profile defaults, Markdown frontmatter, and repeatable `--meta key=value` overrides.
- Added `--profile <path>` to `md to-pdf`.
- Added `md pdf-profile init --output <path>` with `.yml`, `.yaml`, and `.json` output support.
- Added page chrome CSS generation for profile `header`, `footer`, and opt-in `pageNumbers`.
- Kept page numbers disabled by default and defaulted enabled page numbers to `{page}`.
- Kept ToC page chrome empty by assigning ToC content to a separate paged-media page.

## Verification

- Passed `bun test test/cli-actions-md-to-pdf.test.ts` with 43 tests.
- Passed `bun run lint`.
- Passed `bun run format:check`.
- Passed `bun run build`.

Implementation evidence:

- Profile parsing, JSON/YAML support, strict unknown-key rejection, and metadata merge are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).
- `--profile` action loading and command forwarding are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).
- `md pdf-profile init` YAML/JSON output, unknown extension rejection, and overwrite protection are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).
- Header/footer page chrome, default disabled page numbers, explicit page-number placement, and ToC page isolation are covered in [cli-actions-md-to-pdf.test.ts](../../../test/cli-actions-md-to-pdf.test.ts).

## Related Plan

- [Markdown to PDF profiles, fonts, and page chrome implementation](../plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](../../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
