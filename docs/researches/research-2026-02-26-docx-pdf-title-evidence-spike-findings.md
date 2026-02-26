---
title: "DOCX/PDF title-evidence spike findings (mammoth + pdfjs-dist)"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Record initial spike findings for DOCX/PDF title-evidence extraction using:

- `mammoth` for DOCX
- `pdfjs-dist` for PDF

This documents the first prototype behavior on local fixtures and provides a ship/defer recommendation for rename-time doc analyzers.

## Milestone Goal

Answer whether `mammoth` and `pdfjs-dist` can provide enough high-signal fields (`title`, `author`, headings/TOC-like structure, lead text, metadata) to support a future DOCX/PDF rename analyzer behind explicit doc-scoped flags.

## Prototype Artifact

Spike script (manual prototype):

- `scripts/spikes/docx-pdf-title-evidence-spike.ts`

Generated artifact outputs (current run):

- `examples/playground/.tmp-tests/docx-pdf-title-evidence-spike-output.json`
- `examples/playground/.tmp-tests/docx-pdf-title-evidence-spike-stderr.log`

## Tested Fixtures (Current Limited Set)

From `examples/playground/docs/`:

- `tt.docx`
- `xxx.pdf`
- `no-text-proxy.pdf` (local no-text PDF fixture used as a weak/scanned behavior proxy)

Note: a no-text PDF proxy fixture was added for weak/no-text behavior. A true scanned/image-only PDF fixture is still not available in this spike pass.

## Draft `DocumentTitleEvidence` Contract (Spike Version)

Prototype evidence shape (cross-format draft used in the spike script):

- `sourcePath`
- `fileType` (`docx` | `pdf`)
- `extractor`
- `title`
- `author`
- `headings`
- `tocCandidates`
- `leadText`
- `metadata`
- `warnings`

### Field Priority Order (Prompt Payload Truncation Proposal)

Recommended priority order when building a future Codex prompt payload:

1. `fileType`, `sourcePath`, `extractor`
2. `title`
3. `author`
4. `tocCandidates`
5. `headings`
6. `leadText`
7. selected `metadata` summary (not full metadata dump)
8. `warnings`

Reason:

- title/author/TOC-like structure are high-signal for filenames
- full metadata can be large/noisy and should be summarized
- `warnings` should survive truncation whenever possible for auditability

### Fallback Reason Code Draft (DOCX/PDF-Oriented)

Proposed reason codes for future rename integration:

- `docx_no_title_signal`
- `docx_metadata_unavailable`
- `docx_extract_error`
- `pdf_no_title_signal`
- `pdf_no_text`
- `pdf_metadata_unavailable`
- `pdf_outline_unavailable`
- `pdf_extract_error`
- `pdf_scanned_or_image_only` (only when we can detect it reliably)

## Key Findings

### 1. `mammoth` is good for DOCX headings/lead text, but not enough alone for metadata

Observed on `examples/playground/docs/tt.docx`:

- `mammoth.convertToHtml(...)` produced rich heading structure
- `mammoth.extractRawText(...)` produced useful lead text
- heading list is strong enough to populate `tocCandidates`
- the first heading (`Goal`) was captured as the current title guess, while the more human-expected document title (`CLI Action Tool Integration Guide`) appeared in lead text

Implication:

- `mammoth` is a viable DOCX content extractor for headings + lead text
- title ranking heuristics need improvement (prefer document title line / title-style heading over first heading in some cases)
- DOCX metadata (`title` / `author`) is not directly extracted by this spike path and likely needs a supplementary path (OOXML core props parsing or another helper)

### 2. `pdfjs-dist` provides strong PDF metadata + outline + first-page text signals

Observed on `examples/playground/docs/xxx.pdf`:

- `getMetadata()` returned rich metadata including `Title`, `Author`, `Creator`, `Producer`, dates
- `getOutline()` returned a useful top-level outline list (`A`, `B`, `C`, ...)
- page count was available (`56`)
- first-page text extraction succeeded and produced a strong lead text sample
- extracted title and author from metadata were immediately usable for rename title prompting

Implication:

- `pdfjs-dist` is a strong first PDF backend candidate for metadata- and text-based title evidence
- a future PDF analyzer can likely ship a useful v1 path without external CLIs for many text PDFs

### 3. `pdfjs-dist` extraction succeeds, but local font-data warnings can still appear in this environment

The spike script sets `standardFontDataUrl`, which is still the correct integration direction, but current runs may still emit PDF.js font-data warnings in this Bun/Node environment for some PDFs.

Implication:

- future integration should set `standardFontDataUrl` explicitly when using `pdfjs-dist` in local CLI contexts
- local font-data warnings should be treated as non-fatal if metadata/text extraction still succeeds

### 4. Weak/no-text PDF behavior is now partially validated via a proxy fixture

Observed on `no-text-proxy.pdf`:

- PDF parsing succeeded
- page count metadata was available
- no usable title/author/text signals were extracted
- warnings correctly reflected weak/no-text evidence:
  - `pdf_no_page1_text`
  - `no_title_signal`
  - `no_lead_text`

Implication:

- the future PDF analyzer can classify and downgrade weak/no-text PDFs to deterministic rename without hard failure
- this still does not fully validate scanned/image-only PDF behavior (image pages can introduce different parser/runtime characteristics)

### 5. The current fixture set is enough to validate feasibility, not robustness

Current fixtures confirm:

- DOCX headings + lead text feasibility (`mammoth`)
- PDF metadata + outline + page text feasibility (`pdfjs-dist`)

Current fixtures do **not** yet confirm:

- scanned/image-only PDF behavior
- metadata-poor DOCX behavior
- malformed/encrypted PDF handling
- DOCX with weak/no heading structure

Implication:

- this spike can support a design decision to proceed
- additional fixtures are still needed before claiming broad DOCX/PDF reliability

## Evaluation Matrix (Current Fixtures)

| Fixture | Backend | Title quality | Author quality | Headings / TOC candidates | Lead text | Elapsed | Warnings | Notes |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| `examples/playground/docs/tt.docx` | `mammoth` | `usable` (picked first heading `Goal`, not ideal doc title) | `none` | `good` (multiple headings extracted) | `good` (`CLI Action Tool Integration Guide`) | ~31ms | `mammoth_messages`, `docx_metadata_not_extracted_in_this_spike` | Good structure extraction; needs title-ranking heuristic + metadata supplement |
| `examples/playground/docs/xxx.pdf` | `pdfjs-dist` | `good` (metadata `Title`) | `good` (metadata `Author`) | `usable` (outline letters A-L) | `good` (first page text sample) | ~91-107ms | none in evidence (runtime may log font-data warnings) | Strong metadata-driven title path |
| `examples/playground/docs/no-text-proxy.pdf` | `pdfjs-dist` | `none` | `none` | `none` | `none` | ~1ms | `pdf_no_page1_text`, `no_title_signal`, `no_lead_text` | Useful weak/no-text proxy; true scanned/image-only PDF still unverified |

## Practical Limits and Fallback Conditions (Initial)

### DOCX (`mammoth`)

Recommend treating these as non-fatal warnings, not hard failures:

- conversion messages from `mammoth`
- missing metadata fields
- weak title ranking (when headings exist but the best title appears in body text)

Suggested fallback behavior:

- if headings exist but title is weak, still emit evidence and let title resolver/Codex decide
- if no headings and no lead text, use deterministic rename with `docx_no_title_signal`

### PDF (`pdfjs-dist`)

Recommend non-fatal warnings for:

- missing metadata
- missing outline/bookmarks
- local font-data configuration issues if text extraction still succeeds

Suggested fallback behavior:

- if metadata missing but page text exists: proceed with text-only evidence
- if no text and no metadata: deterministic rename with `pdf_no_text` or `pdf_no_title_signal`
- if parsing fails entirely: deterministic rename with `pdf_extract_error`

## Ship / Defer Recommendation (Current)

### Ship (after follow-up implementation plan)

- **PDF v1 (experimental or explicit doc flag scope)** using `pdfjs-dist`:
  - metadata title/author
  - outline/bookmarks
  - page count
  - first-page text sample

Reason: this spike shows strong title-evidence quality on the tested PDF fixture.

### Defer or Gate More Carefully

- **DOCX v1 using `mammoth` only** should be gated or marked experimental unless a metadata/title-ranking supplement is added.

Reason: heading extraction is good, but title selection quality is currently only `usable` and metadata is not addressed.

### Recommended Next Follow-up

1. Add one more DOCX fixture with weak headings and one with metadata title/author set.
2. Add a scanned/image-only PDF fixture.
3. Prototype a DOCX metadata supplement (OOXML core props parse) to pair with `mammoth`.

## Capability Gating / Eligibility Checks (Proposal)

For future rename analyzers using these backends:

- DOCX:
  - max file size cap (for example 10-20 MiB initial conservative limit)
  - readable file + `.docx` extension
  - extraction timeout
- PDF:
  - max file size cap (for example 20-50 MiB initial conservative limit)
  - max page count cap for text extraction work (for example extract only metadata + page 1 + outline)
  - extraction timeout

These should degrade to deterministic rename with reason codes, not fail the command.

## Open Gaps / Follow-up Items

- DOCX metadata extraction supplement (`title`, `creator`) not implemented in this spike
- true scanned/image-only PDF behavior not validated (weak/no-text proxy fixture covered)
- encrypted/password-protected PDF behavior not validated
- noisy PDF text extraction heuristics not yet ranked/cleaned beyond basic whitespace normalization
- PDF.js local font-data path should be configured explicitly (`standardFontDataUrl`) in future integration

## Related Plans

- `docs/plans/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
- `docs/plans/plan-2026-02-26-document-text-rename-analyzer-milestone.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`

## Related Research

- `docs/researches/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`

## References

- `scripts/spikes/docx-pdf-title-evidence-spike.ts`
- `examples/playground/.tmp-tests/docx-pdf-title-evidence-spike-output.json`
- `examples/playground/.tmp-tests/docx-pdf-title-evidence-spike-stderr.log`
- `examples/playground/docs/tt.docx`
- `examples/playground/docs/xxx.pdf`
