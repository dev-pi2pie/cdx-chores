---
title: "DOCX/PDF rename analyzer implementation (PDF-first, DOCX-gated)"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Implement the next rename analyzer expansion for binary document formats under the existing doc-scoped semantic naming workflow, using a staged rollout:

- PDF analyzer first (ship-ready path) via `pdfjs-dist`
- DOCX analyzer second (gated/experimental path) via `mammoth`, with known metadata/title-ranking limitations

This plan converts the completed DOCX/PDF extractor spike findings into a concrete implementation path for `rename file` / `rename batch`.

## Why This Plan

The completed DOCX/PDF spike established that:

- `pdfjs-dist` can extract strong rename-title evidence (metadata title/author, outline, page count, first-page text)
- `mammoth` can extract useful DOCX heading/text structure, but DOCX metadata and title-ranking quality need a supplement for stronger reliability

This creates a clear implementation strategy:

- do not block PDF support on DOCX metadata work
- implement PDF first under `--codex-docs`
- add DOCX behind explicit gating/experimental messaging

## Background / Inputs

Primary references:

- `docs/plans/archive/plan-2026-02-26-document-text-rename-analyzer-milestone.md`
- `docs/plans/archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md` (completed)
- `docs/researches/archive/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md` (completed)
- `docs/researches/archive/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`

Current implementation baseline (already in progress/completed separately):

- `--codex-docs` exists for text-like docs
- text-like extraction supports markdown/plain text + structured text formats
- doc analyzer summaries and reason-code plumbing exist in rename flows

This plan extends that doc analyzer work to binary docs (PDF and DOCX).

## Scope

### In Scope

- PDF title-evidence extraction integration using `pdfjs-dist`
- DOCX title-evidence extraction integration using `mammoth` (gated/experimental)
- analyzer eligibility checks and fallback reason codes for PDF/DOCX
- rename summary/CSV reason reporting updates for binary doc analyzers
- tests and fixture coverage for supported/weak/failure cases
- docs updates for support boundaries and rollout status

### Out of Scope

- OCR support / scanned-document OCR pipelines
- Office-family expansion (`pptx`, `xlsx`, `odt`, `odp`, `ods`)
- DOCX metadata supplement implementation (OOXML core props) unless scoped as a separate follow-up job
- replacing `--codex-docs` with a new top-level flag family
- interactive pattern/template UX work

## Rollout Strategy (Key Decision)

### 1. PDF First (Default within `--codex-docs` support scope)

Add PDF support to the existing `--codex-docs` analyzer path using `pdfjs-dist` evidence extraction:

- metadata (`Title`, `Author`)
- outline/bookmarks (`getOutline`)
- page count
- first-page text sample

Why first:

- spike evidence quality was strong on the available PDF fixture
- fallback behavior for weak/no-text PDFs is straightforward
- integration risk is lower than DOCX metadata/ranking quality work

### 2. DOCX Gated / Experimental

Add DOCX support behind an explicit gating mechanism while relying on `mammoth`:

- extract headings / TOC-like candidates
- extract raw text / lead text
- accept weaker title ranking initially

Recommended gating options (choose one in implementation phase):

- option A: always enabled under `--codex-docs`, but with clear "best-effort / experimental DOCX title quality" docs note
- option B: additional opt-in flag (for example `--codex-docs-docx-experimental`)
- option C: config/constant gate (developer-only) until metadata supplement lands

Current recommendation:

- start with option A or C depending release risk tolerance
- avoid permanently fragmenting the CLI surface unless needed

## Analyzer Design Direction

### Reuse Existing `--codex-docs` Path (Preferred)

Do not add a separate top-level `--codex-pdf` or `--codex-docx` flag yet.

Instead:

- extend the existing doc analyzer selector to include `.pdf` and `.docx`
- route each file type to its own evidence extractor strategy
- preserve one doc analyzer summary line, with richer reason reporting

This keeps UX simple while support expands incrementally.

### Internal Strategy Split (Implementation Detail)

Recommended internal extractor/evidence strategies:

- `document-text` (already implemented for text-like docs)
- `pdf-document` (`pdfjs-dist`)
- `document-word` (`mammoth`, gated)

All normalize into a shared doc title-evidence contract before Codex prompting.

## Eligibility Checks and Fallback Policy

### PDF Eligibility (Draft)

- readable file
- `.pdf` extension
- file size under conservative cap (for example 20-50 MiB)
- extraction timeout enforced
- page count extraction allowed; content extraction limited to metadata + outline + page 1 text only

Fallback policy:

- any extraction issue degrades to deterministic rename + reason code
- command never hard-fails because one PDF extraction fails

### DOCX Eligibility (Draft)

- readable file
- `.docx` extension
- file size under conservative cap (for example 10-20 MiB)
- extraction timeout enforced

Fallback policy:

- missing metadata is non-fatal (record warning/reason)
- weak heading/title evidence degrades to deterministic rename + reason code
- command never hard-fails because one DOCX extraction fails

## Reason Codes (Draft Additions)

Extend doc analyzer reason coverage with PDF/DOCX-specific codes:

### PDF

- `pdf_extract_error`
- `pdf_metadata_unavailable`
- `pdf_outline_unavailable`
- `pdf_no_text`
- `pdf_no_title_signal`
- `pdf_skipped_too_large`
- `pdf_skipped_unreadable`
- `pdf_truncated`

### DOCX

- `docx_extract_error`
- `docx_metadata_unavailable`
- `docx_no_title_signal`
- `docx_skipped_too_large`
- `docx_skipped_unreadable`
- `docx_truncated`
- `docx_experimental_quality` (optional docs-facing/internal note, not necessarily CSV reason)

Notes:

- keep existing text-like `doc_*` reason codes intact for backward compatibility
- decide whether to normalize to `doc_*` umbrella or keep subtype-specific prefixes (`pdf_*`, `docx_*`)
  - current recommendation: keep subtype-specific prefixes for better diagnostics

## Implementation Strategy

### Phase 1: Contracts and Gating Decisions

- [x] Finalize shared binary-doc evidence shape fields for PDF/DOCX integration
- [x] Decide DOCX gating mode (A/B/C from rollout section)
- [x] Finalize PDF/DOCX reason-code naming and CSV reporting semantics
- [x] Define conservative size/time caps for initial rollout

#### Phase Deliverable

- [x] Stable contracts and rollout decisions for binary doc analyzers

### Phase 2: PDF Analyzer Integration (`pdfjs-dist`)

- [x] Extract/normalize PDF title evidence using spike logic (`metadata`, `outline`, `pageCount`, page-1 text)
- [x] Integrate into doc analyzer path used by `--codex-docs`
- [x] Add PDF-specific eligibility checks + reason codes
- [x] Add tests for:
  - metadata-rich PDF
  - weak/no-text PDF fallback
  - extraction error handling

#### Phase Deliverable

- [x] PDF files can participate in `--codex-docs` semantic rename with fallback-safe behavior

### Phase 3: DOCX Analyzer Integration (`mammoth`) (Gated)

- [x] Extract/normalize DOCX title evidence using `mammoth` (`convertToHtml` + `extractRawText`)
- [x] Add DOCX gating/experimental behavior and user-facing note(s) as decided
- [x] Add DOCX-specific eligibility checks + reason codes
- [x] Add tests for:
  - heading-rich DOCX
  - weak-title DOCX fallback behavior
  - extraction error handling

#### Phase Deliverable

- [x] DOCX support is available in gated/experimental mode with explicit limitations documented

### Phase 4: Docs, Verification, and Follow-up Decisions

- [x] Update rename capability docs/guides with PDF-first / DOCX-gated support status
- [x] Add/extend job record(s) documenting implementation + manual checks
- [x] Document remaining gaps (scanned OCR, DOCX metadata supplement)
- [x] Decide whether to schedule a DOCX metadata supplement follow-up immediately

#### Phase Deliverable

- [x] Binary doc analyzer support is documented and operationally clear

## Verification Plan

### Manual Checks

- [x] `rename file <pdf> --dry-run --codex-docs` uses PDF analyzer path and reports doc summary
- [x] weak/no-text PDF fixture falls back safely with PDF-specific reason code
- [x] `rename file <docx> --dry-run --codex-docs` follows DOCX gated behavior and remains fallback-safe
- [x] mixed docs batch (`.json`, `.pdf`, `.docx`) reports coherent summary + fallback reasons
- [x] timeout/error cases continue to produce deterministic plans

### Regression Focus

- [x] Existing text-like `--codex-docs` behavior remains unchanged
- [x] Existing `--codex-images` behavior remains unchanged
- [x] `rename apply <csv>` replay workflow remains unchanged

## Success Criteria

This plan is successful if:

1. PDF support under `--codex-docs` is usable and fallback-safe in rename workflows.
2. DOCX support is integrated with explicit gating/limitations (or intentionally deferred with a tracked job).
3. Reason codes and summaries clearly distinguish PDF/DOCX outcomes from text-like doc outcomes.
4. The implementation preserves deterministic rename behavior as the baseline.

## Follow-up Candidates (Expected)

- Job/plan: DOCX metadata supplement (OOXML core props parsing for title/author)
- Research/spike: scanned/image-only PDF handling and OCR approach
- Plan/job: Office-family expansion (`pptx`, `xlsx`, OpenDocument) after binary-doc baseline stabilizes

## Related Plans

- `docs/plans/archive/plan-2026-02-26-document-text-rename-analyzer-milestone.md`
- `docs/plans/archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`

## Related Research

- `docs/researches/archive/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md`
- `docs/researches/archive/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
- `docs/researches/archive/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
