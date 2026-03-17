---
title: "DOCX phase 6 default-on graduation"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Complete Phase 6 of the DOCX graduation plan by removing the runtime env gate, making DOCX support default-on under `--codex-docs`, and updating tests/docs to reflect the new supported behavior while preserving the older `v0.0.7` env-gated path as historical guidance only.

## What Changed

- Updated `src/cli/actions/rename/codex.ts`:
  - removed parsing of `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL`
  - removed the default-disabled DOCX candidate skip path
  - removed the single-file DOCX experimental-disabled summary note
- Updated CLI tests so DOCX is exercised as the normal `--codex-docs` path:
  - `test/cli-actions-rename-file.test.ts`
  - `test/cli-actions-rename-batch-codex-docs.test.ts`
- Updated `docs/guides/rename-scope-and-codex-capability-guide.md`:
  - changed DOCX from experimental/env-gated to supported best-effort `--codex-docs` coverage
  - kept a historical note that older `v0.0.7` guidance required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`
  - clarified that the env-gated path is deprecated history rather than active behavior
- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md` to close Phase 6 items and its deliverable.

## Compatibility Note

- Active runtime behavior no longer emits `docx_experimental_disabled`.
- Downstream consumers that previously keyed off `docx_experimental_disabled` should treat DOCX as participating in the normal `--codex-docs` analyzer flow and expect DOCX fallback reasons such as `docx_extract_error` or `docx_no_title_signal` instead.

## Verification

- `bun test test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/adapters-docx-ooxml-metadata.test.ts test/adapters-codex-document-rename-titles.test.ts`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
