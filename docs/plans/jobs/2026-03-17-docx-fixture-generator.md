---
title: "Add deterministic DOCX fixture generator"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Add a reproducible generator for a metadata-rich DOCX fixture to support DOCX metadata extraction and rename-title ranking work.

## What Changed

- Added `scripts/generate-docx-fixtures.mjs` to generate a deterministic `metadata-rich.docx` fixture.
- Kept the implementation self-contained by building a minimal DOCX ZIP package directly from XML parts.
- Targeted the fixture shape needed for upcoming OOXML metadata helper work:
  - weak generic heading in document content
  - stronger title in core metadata
  - deterministic timestamps and document properties

## Verification

- `node scripts/generate-docx-fixtures.mjs reset`
- `bun test test/adapters-codex-document-rename-titles.test.ts`
