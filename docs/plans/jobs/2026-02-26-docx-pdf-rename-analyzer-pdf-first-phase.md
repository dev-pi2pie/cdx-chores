---
title: "Implement PDF-first and DOCX-gated binary document rename analyzers"
created-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Extend `--codex-docs` semantic rename support beyond text-like files with a fallback-safe binary-document path:

- ship PDF support first (`pdfjs-dist`)
- add DOCX support as gated/experimental (`mammoth`)

## Implemented

### PDF-first `--codex-docs` support

- Added PDF evidence extraction in `src/adapters/codex/document-rename-titles.ts` using `pdfjs-dist`:
  - metadata (`Title`, `Author`)
  - outline/bookmarks
  - page count
  - page-1 text sample
- Normalized PDF evidence into the shared document-title evidence payload for Codex prompting.
- Added PDF-specific reasons and warnings (for example `pdf_no_text`, `pdf_extract_error`, metadata/outline unavailable warnings).

### Rename analyzer integration and eligibility

- Extended the doc analyzer candidate selector in `src/cli/actions/rename.ts` to include `.pdf`.
- Added PDF-specific file-size cap and skip reasons:
  - `pdf_skipped_too_large`
  - `pdf_skipped_unreadable`
- Preserved deterministic rename behavior for all unsupported/failed extraction/Codex cases.

### DOCX gated/experimental path

- Added `mammoth`-based DOCX evidence extraction wiring in `src/adapters/codex/document-rename-titles.ts`.
- Chose rollout gating mode **Option C** (config/env gate):
  - `.docx` files are recognized under `--codex-docs`
  - semantic DOCX extraction is disabled by default
  - default CSV/user-facing reason: `docx_experimental_disabled`
  - opt-in env gate: `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`
- Added DOCX eligibility cap and DOCX-specific skip reasons in the rename analyzer selector.

### CLI / UX wording updates

- Updated `--codex-docs` help text in `src/command.ts` to reflect supported docs including `.pdf`.
- Updated interactive prompts in `src/cli/interactive.ts` to refer to “supported docs”.
- Added a DOCX-specific note in `rename file` output when the experimental gate is disabled by default.

### Tests and fixtures

- Added/expanded rename action tests in `test/cli-actions-data-rename.test.ts` for:
  - PDF fallback reason plumbing (`pdf_no_text`)
  - DOCX default experimental-disabled behavior
  - DOCX gate-on extraction error (`docx_extract_error`)
  - DOCX gate-on action-layer routing with a tracked heading-rich fixture
  - DOCX weak-title fallback reason plumbing (`docx_no_title_signal`)
- Added tracked fixture:
  - `test/fixtures/docs/heading-rich.docx`

### Documentation updates

- Updated `docs/guides/rename-scope-and-codex-capability-guide.md` to document:
  - `--codex-docs` support for text-like docs and PDFs
  - PDF-first support status
  - DOCX gated/experimental status and env opt-in
  - updated flag-combination outcomes and recommendations

## Verification

Automated:

- `bun test test/cli-actions-data-rename.test.ts` ✅
- `bunx tsc --noEmit` ✅

Manual smoke checks (local playground fixtures):

- `rename file <pdf> --dry-run --codex-docs` → doc analyzer path reached; fallback-safe on timeout ✅
- weak/no-text PDF proxy fixture → `pdf_no_text` recorded in dry-run CSV ✅
- `rename file <docx> --dry-run --codex-docs` (default env) → `docx_experimental_disabled` note/reason ✅
- `rename file <docx> --dry-run --codex-docs` with `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` → DOCX analyzer path reached; fallback-safe on timeout ✅
- mixed docs batch (`.json`, `.pdf`, `.docx`) → coherent doc summary and per-row fallback reasons ✅

## Remaining Gaps / Follow-up

- PDF test matrix still lacks a tracked metadata-rich PDF fixture and a dedicated PDF extraction-error unit-style test.
- True scanned/image-only PDF behavior is not yet covered by a tracked fixture (only weak/no-text proxy coverage exists).
- DOCX metadata quality is still limited (no OOXML core-props supplement yet), which affects title/author reliability.

Decision on DOCX metadata supplement:

- **Do not schedule immediate implementation in this tranche.**
- Keep it as the next focused follow-up after PDF support stabilizes and DOCX experimental feedback is collected.

## Related Plans

- `docs/plans/plan-2026-02-26-document-text-rename-analyzer-milestone.md`
- `docs/plans/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
- `docs/plans/plan-2026-02-26-docx-pdf-rename-analyzer-implementation-pdf-first.md`

## Related Research

- `docs/researches/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md`
- `docs/researches/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
