---
title: "DOCX/PDF title-evidence extractor spike"
created-date: 2026-02-26
status: draft
agent: codex
---

## Goal

Run a focused implementation spike to validate title-evidence extraction quality for rename-time semantic title suggestions using:

- `mammoth` for DOCX
- `pdfjs-dist` for PDF

The spike should produce a stable `DocumentTitleEvidence` contract proposal, fixture-based findings, and a clear recommendation for what is safe to ship in the first doc analyzer milestone.

## Why This Plan

The rename research and scope redesign work already converge on a document-text analyzer direction, but DOCX/PDF are the hardest common formats because:

- they need more than plain-text extraction to produce good rename titles
- metadata and heading/outline signals matter (title, author, TOC-like structure)
- extractor quality and portability vary significantly across backends

The repository now includes `mammoth` and `pdfjs-dist`, which is enough to begin a concrete Node-first spike without blocking on broader Office-family tooling decisions.

## Background / Inputs

Relevant context already documented:

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
  - Phase 4 follow-up calls out document analyzer planning and DOCX/PDF extractor research
- `docs/researches/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
  - proposes hybrid extractor design and normalized evidence schema
- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
  - separates deterministic rename support from analyzer capability

Current implementation baseline:

- `rename` has analyzer orchestration in `src/cli/actions/rename.ts`
- only static-image Codex analyzer is implemented today
- no document-title analyzer exists yet

## Spike Questions (Must Answer)

1. Can `mammoth` extract enough DOCX structure for rename title evidence?
   - first heading/title-like signal
   - heading list / TOC-like candidates
   - lead paragraphs
   - author/title metadata (directly or with a small supplementary parser)

2. Can `pdfjs-dist` extract enough PDF structure for rename title evidence?
   - metadata (`Title`, `Author`, etc.)
   - outline/bookmarks (when present)
   - first-page text sample
   - page count

3. What normalized evidence shape should rename analyzers produce for Codex prompting across doc types?

4. What fallback reasons should be recorded when extraction succeeds partially or fails?

5. What latency/complexity limits should gate DOCX/PDF analyzer eligibility in rename workflows?

## Proposed Deliverables

### 1. Evidence Contract Draft

Define a shared evidence type (documentation-first, code prototype optional):

- `DocumentTitleEvidence`
- required and optional fields
- truncation rules
- warning/fallback reason conventions

Example fields (draft):

- `sourcePath`
- `fileType`
- `title`
- `author`
- `headings`
- `tocCandidates`
- `leadText`
- `metadata`
- `warnings`
- `extractor`

### 2. Fixture-Based Spike Results

A short research/job-style summary of findings across sample files:

- what signals were extractable
- what signals were noisy/missing
- extraction time (coarse timing is enough)
- known failure/edge cases

### 3. Ship/Defer Recommendation

Recommend immediate next implementation scope, for example:

- ship `document-text` only
- add DOCX behind experimental flag
- add PDF metadata+first-page extraction only
- defer difficult PDFs / metadata-poor DOCX cases

## Scope

### In Scope

- `mammoth` DOCX extraction spike for title-evidence fields
- `pdfjs-dist` PDF extraction spike for title-evidence fields
- fixture-based evaluation for quality and failure modes
- documented `DocumentTitleEvidence` proposal
- fallback reason code proposal for rename CSV / preview messaging

### Out of Scope

- Full rename analyzer implementation in `src/cli/actions/rename.ts`
- Codex prompt integration for docs (separate implementation plan/job)
- Office-family breadth (`pptx`, `xlsx`, `odt`, `odp`, `ods`) beyond noting follow-up needs
- External CLI fallback integration (Poppler/Tika/Pandoc)
- OCR support
- interactive pattern-template UX restoration (tracked separately)

## Fixture Strategy

Use local scratch-space under `examples/playground/` for test artifacts and manual fixtures.

Suggested fixture set (minimum useful coverage):

### DOCX fixtures

- simple heading-first document
- document with metadata title/author set
- document with multiple headings (TOC-like structure)
- document with tables/lists but weak headings
- document with minimal text

### PDF fixtures

- text-based PDF with metadata title/author
- text-based PDF with bookmarks/outline
- text-based PDF without metadata
- scanned/image-only PDF (expected weak/no text)
- PDF with noisy extraction layout (expected partial)

Notes:

- use small files only (fast local spike runs)
- avoid proprietary/sensitive content
- document fixture characteristics, not just filenames

## Evaluation Matrix (Per Fixture)

Record the following for each fixture:

- `fileType` / fixture label
- extractor backend (`mammoth` or `pdfjs-dist`)
- extracted `title` quality (`good` / `usable` / `weak` / `none`)
- extracted `author` presence/quality
- headings / `tocCandidates` usefulness
- `leadText` usefulness
- warnings (`truncated`, `no_metadata`, `no_text`, etc.)
- elapsed time (coarse ms)
- notes / edge cases

This matrix is the main output of the spike.

## Execution Checklist (Draft)

### Phase 1: Evidence Contract Definition

- [ ] Draft `DocumentTitleEvidence` fields and normalization rules in docs
- [ ] Define field priority order for Codex prompt payload truncation
- [ ] Draft fallback reason codes for partial/failed extraction

### Phase 2: DOCX Spike (`mammoth`)

- [ ] Create a small DOCX extraction prototype (script or isolated module)
- [ ] Extract title-like, heading-like, and lead-text signals
- [ ] Verify whether author/title metadata is available directly; if not, document the gap clearly
- [ ] Capture fixture results and edge cases

### Phase 3: PDF Spike (`pdfjs-dist`)

- [ ] Create a small PDF extraction prototype (script or isolated module)
- [ ] Extract metadata, outline/bookmarks, first-page text, page count
- [ ] Capture fixture results including weak/scanned PDF behavior
- [ ] Document practical limits and fallback conditions

### Phase 4: Recommendation and Follow-up Plan Inputs

- [ ] Recommend ship-ready subset for the first doc analyzer milestone
- [ ] Propose capability gating/eligibility checks (size/page-count/timeouts as needed)
- [ ] Record open gaps requiring later backends or external tools
- [ ] Draft follow-up implementation plan/job references

## Success Criteria

This spike is successful if it produces:

1. A documented `DocumentTitleEvidence` contract (or contract draft) usable by a future doc analyzer.
2. Evidence that `mammoth` and `pdfjs-dist` can extract at least one high-signal title path each on representative fixtures.
3. A clear list of partial/failure cases with reason-code recommendations.
4. A scoped recommendation for what to implement first in rename (instead of a broad "support docs" claim).

## Risks / Watchouts

- DOCX metadata may require a supplementary extraction path beyond `mammoth`.
- PDF text extraction quality varies widely; scanned/image-only PDFs will likely produce weak signals without OCR.
- A broad evidence schema can become too verbose; keep it optimized for filename-title generation, not full document indexing.
- Spike code should not accidentally become production API without tests and action-layer integration review.

## Follow-up Candidates (Expected)

- Plan: `document-text` rename analyzer milestone (`.md` / `.txt` / structured text first)
- Job/plan: DOCX/PDF doc analyzer implementation behind explicit doc-scoped flag(s)
- Research/spike: Office-family expansion (`officeparser`) for `pptx` / `xlsx` / OpenDocument formats
- Plan/job: interactive rename pattern/template UX restoration (after resolving `--pattern` docs/code drift)

## Related Research

- `docs/researches/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
