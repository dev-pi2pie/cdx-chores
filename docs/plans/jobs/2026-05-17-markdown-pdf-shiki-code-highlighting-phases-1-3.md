---
title: "Markdown PDF Shiki code highlighting phases 1-3"
created-date: 2026-05-17
status: completed
agent: codex
---

## Goal

Implement the first three phases of the Markdown PDF Shiki code-highlighting plan and the minimal render wiring required to prove the public flags are not no-ops:

- Phase 1: dependency and fixture foundation
- Phase 2: profile and CLI option contract
- Phase 3: standalone Shiki transform module

## Scope

This job stops before line-number markup generation, CSS/template updates, and broader transform failure cleanup assertions. Those remain in later phases of the implementation plan.

## Changes

- Added committed Markdown/profile fixtures under `test/fixtures/docs/markdown-pdf-code/`.
- Added `scripts/generate-markdown-pdf-code-fixtures.mjs` with `seed`, `clean`, `reset`, and `smoke` commands.
- Added top-level profile `code.highlight`, `code.theme`, and `code.lineNumbers` normalization and validation.
- Added the fixed light-theme allowlist: `github-light`, `light-plus`, `min-light`, `vitesse-light`, and `catppuccin-latte`.
- Added `--code-highlight` and `--no-code-highlight` command options.
- Added a standalone `parse5` + Shiki transform module that classifies `pre > code` blocks, highlights Shiki bundled languages, marks no-language and non-bundled-language blocks as plain, adds `cdx-code` hook classes, and strips `font-family` styles from Shiki output.
- Wired the transform into `md to-pdf` after Pandoc HTML generation and before remote-asset scanning, `--html-output`, and WeasyPrint.
- Added coverage that `--no-code-highlight` bypasses the transform even when the profile enables highlighting.

## Review Follow-Ups

- Made the fixture generator authoritative by clearing the fixture root before seeding.
- Centralized supported code-language aliases in one support table.
- Strengthened CLI flag tests beyond help text.
- Added action-level coverage that highlighted HTML reaches the downstream HTML/PDF render flow.
- Strengthened fixture-generator assertions for representative fixture content and stale-file cleanup.
- Removed brittle assertions against exact Shiki token colors.
- Added transform coverage for multiple code blocks while preserving surrounding HTML.
- Reworded the implementation plan state so completed work and remaining later-phase work are separated.

## Verification

- `node scripts/generate-markdown-pdf-code-fixtures.mjs reset`
- `node scripts/generate-markdown-pdf-code-fixtures.mjs smoke` skipped cleanly because Pandoc or WeasyPrint was unavailable.
- `bun test test/markdown-pdf-code-fixture-generator.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-code-highlight.test.ts test/cli-actions-md-to-pdf-actions.test.ts`
- `bun tsc --noEmit`

## Related Plan

- [Markdown PDF Shiki code highlighting implementation](../plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md)

## Related Research

- [Markdown PDF Shiki Code Highlighting](../../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)
