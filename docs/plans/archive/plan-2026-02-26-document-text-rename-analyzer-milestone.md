---
title: "Document-text rename analyzer milestone"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Implement the first document-focused rename analyzer milestone for `rename file` and `rename batch`, adding Codex-assisted semantic title suggestions for text-like documents using a Node-only extraction path.

Initial target formats:

- `.md`, `.markdown`
- `.txt`
- `.json`
- `.yaml`, `.yml`
- `.toml`
- `.xml`
- `.html`, `.htm`
- optional in milestone scope if low risk: `.csv`, `.tsv` (header-focused evidence only)

## Why This Plan

The rename analyzer boundary is already in place (`src/cli/actions/rename.ts`) and supports a static-image Codex analyzer today. The next practical expansion is a text-like document analyzer because:

- it does not require binary/media preprocessing
- it can use a Node-only extractor path (no Python/CLI dependency requirement)
- it addresses the immediate user need for "basic content -> Codex -> better title" workflows

This plan intentionally excludes DOCX/PDF extraction implementation, which is now tracked by a separate spike plan using `mammoth` and `pdfjs-dist`.

## Background / Inputs

Key context:

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
  - Phase 4 follow-up explicitly calls for a document-text analyzer plan (`.md`/`.txt` first, no Python dependency)
- `docs/researches/archive/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
  - defines extractor-first approach and normalized evidence ideas
- `docs/plans/archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
  - separates DOCX/PDF complexity from this milestone

Current code baseline:

- rename analyzer orchestration exists in `src/cli/actions/rename.ts`
- image-specific Codex adapter exists in `src/adapters/codex/image-rename-titles.ts`
- no document-text extractor or document-title Codex adapter exists yet
- current flag family is image-scoped (`--codex-images*`)

## Milestone Scope

### In Scope

- Node-only extraction for text-like docs (no Python/external CLI dependency)
- new document-text rename analyzer path (best-effort, fallback-safe)
- explicit doc-scoped flag(s) for enabling Codex document title suggestions
- dry-run/preview summary and CSV reason reporting for doc analyzer outcomes
- tests for extraction normalization + analyzer fallback behavior
- docs updates for capability scope and examples

### Out of Scope

- DOCX/PDF analyzer implementation (covered by extractor spike + follow-up plan)
- Office-family formats (`pptx`, `xlsx`, `odt`, `odp`, `ods`)
- OCR, scanned-document support
- replacing/removing `--codex-images`
- interactive rename pattern/template UX restoration (separate track until `--pattern` docs/code drift is resolved)

## Proposed UX (Draft)

### CLI Flags

Add doc-scoped flags without changing current image flags:

- `--codex-docs`
- `--codex-docs-timeout-ms <ms>` (optional; mirror image analyzer knobs for consistency)
- `--codex-docs-retries <count>` (optional)
- `--codex-docs-batch-size <count>` (optional)

Notes:

- `--codex-docs` should affect only supported text-like document files.
- Unsupported types remain deterministic rename only.
- `--codex-images` and `--codex-docs` may be used together in mixed folders.

### Interactive Mode (Minimal for This Milestone)

Add opt-in prompt(s) after the existing Codex image toggle:

- `Use Codex-assisted document titles for supported text-like docs?`

Keep this milestone minimal:

- no pattern/template UX expansion in this plan
- no advanced per-filetype extractor options in interactive mode

## Design Direction

### 1. Reuse the existing rename analyzer interface

Implement a `document-text` analyzer using the same pattern already used for `codex-static-image`:

- candidate selection
- eligibility checks
- suggestion execution
- reason reporting

This keeps deterministic rename planning independent from analyzer behavior.

### 2. Introduce a normalized text evidence contract (v1)

Use a shared evidence payload for text-like files before sending to Codex.

Suggested v1 evidence fields:

- `filename`
- `extension`
- `detectedType` (for example `markdown`, `json`, `html`, `text`)
- `titleCandidates` (ordered high-signal candidates)
- `authorCandidates` (best-effort)
- `headings` (capped)
- `leadText` (capped)
- `keySummary` (for structured files like JSON/YAML/TOML)
- `warnings` (for example truncation or parse fallback)

Design rules:

- optimize for filename-title generation, not full indexing
- strict size caps per file (to limit prompt/token cost)
- preserve deterministic fallback on any extractor/parser failure

### 3. Prefer format-specific extraction helpers with a shared output shape

Do not use one "plain text only" extractor for all text-like formats.

Suggested extractor split (v1):

- `markdown` extractor (frontmatter title/author, H1/H2, intro paragraph)
- `plain-text` extractor
- `json` extractor
- `yaml/toml` extractor (key-focused; safe parse if available)
- `html/xml` extractor (basic title/headings/text heuristics)
- `csv/tsv` extractor (header row + first rows, optional in scope)

Each extractor normalizes into the same evidence contract.

### 4. Add a document-title Codex adapter parallel to the image adapter

Add a new adapter under `src/adapters/codex/` for doc-title suggestions.

Responsibilities:

- prompt construction from normalized evidence
- structured response parsing
- timeout/retry/batch handling
- normalization/sanitization of returned titles

Do not mix document prompting into `image-rename-titles.ts`.

### 5. Report analyzer outcomes by category

Batch and single-file summaries should clearly distinguish image and doc analyzer results when both are enabled.

Example direction:

- `Codex image titles: 8/10 suggested`
- `Codex doc titles: 6/9 suggested`
- `Codex doc note: 3 files had no strong text/title signal`

## Reason Codes (Draft v1)

Add/extend row-level reason codes for document analyzer outcomes:

- `doc_no_text`
- `doc_no_title_signal`
- `doc_extract_error`
- `doc_truncated`
- `doc_unsupported_type`
- `doc_parse_fallback`
- `doc_fallback_error`
- `doc_no_suggestion`

Notes:

- final naming can be normalized later, but establish a consistent prefix early (`doc_`)
- preserve existing Codex image reason codes unchanged

## Implementation Strategy

### Phase 1: Contracts and Wiring Design

- [x] Define `RenameDocTitleSuggestion` / result shapes (parallel to image adapter result)
- [x] Draft `DocumentTitleEvidence` type and normalization caps (code or doc-first)
- [x] Decide exact CLI flag names/defaults for `--codex-docs*`
- [x] Decide whether image/doc analyzer knob defaults are shared internally

#### Phase Deliverable

- [x] Stable internal contracts and CLI UX decisions for the document-text analyzer milestone

Decision note:

- mirror analyzer tuning knob semantics across image/doc analyzers (`timeout`, `retries`, `batch-size`) while keeping analyzer-specific eligibility caps/reasons internal to each analyzer path

### Phase 2: Text-Like Evidence Extraction Helpers

- [x] Add extractor helpers/modules for target text-like formats
- [x] Implement safe truncation and warning tagging
- [x] Add unit tests for evidence extraction normalization on representative inputs
- [x] Ensure parser failures downgrade cleanly to deterministic rename (no hard failure)

#### Phase Deliverable

- [x] Reliable evidence extraction pipeline for supported text-like docs (best-effort, bounded output)

### Phase 3: Codex Document Title Adapter

- [x] Add `src/adapters/codex/*` document-title suggester module
- [x] Implement structured prompt + schema output parsing
- [x] Reuse timeout/retry/batch patterns from image adapter where possible
- [x] Add adapter-level tests (parsing/normalization/fallback handling as practical)

#### Phase Deliverable

- [x] Codex document-title suggestion adapter returning normalized suggestions by source path

### Phase 4: Rename Action Integration

- [x] Add `document-text` analyzer to `src/cli/actions/rename.ts`
- [x] Support `--codex-docs` in `rename file` and `rename batch`
- [x] Combine analyzer summaries when image and doc analyzers are both enabled
- [x] Record doc analyzer reason codes into preview/CSV rows
- [x] Preserve deterministic fallback behavior and current image analyzer behavior

#### Phase Deliverable

- [x] `rename` supports opt-in Codex document titles for text-like docs with fallback-safe behavior

### Phase 5: CLI, Interactive, Tests, Docs

- [x] Wire new flags in `src/command.ts`
- [x] Add minimal interactive prompts in `src/cli/interactive.ts`
- [x] Add/extend tests for:
  - mixed batches with `--codex-images` + `--codex-docs`
  - docs-only profile with `--codex-docs`
  - unsupported file types in scope (fallback + reason codes)
  - extraction/parser failures
- [x] Update docs/guides for rename capability matrix and examples
- [x] Add a job record documenting implementation and verification

#### Phase Deliverable

- [x] Feature is documented, test-covered, and usable in CLI + interactive mode

## Verification Plan

### Manual Checks

- [x] `rename file <markdown> --dry-run --codex-docs` suggests title or records doc fallback reason
- [x] `rename batch <dir> --profile docs --dry-run --codex-docs` shows doc analyzer summary
- [x] Mixed folder run with `--codex-images --codex-docs` reports both categories separately
- [x] Unsupported binary docs in docs profile remain deterministic and do not hard-fail
- [x] Timeouts/retries do not break deterministic rename plan generation

### Regression Focus

- [x] Existing image analyzer behavior (`--codex-images*`) remains unchanged
- [x] `rename apply <csv>` replay behavior remains unchanged
- [x] Existing row reason semantics remain backward-compatible where possible

## Risks / Watchouts

- Text-like parsing across formats can become inconsistent if evidence normalization is not centralized.
- HTML/XML extraction can produce noisy boilerplate without simple signal ranking heuristics.
- Prompt payloads can grow quickly in batch mode; strict caps and batching are required.
- Adding too much scope (CSV heuristics, XML sophistication, interactive UX polish) can delay useful v1 delivery.

## Success Criteria

This milestone is successful if:

1. Text-like docs can receive best-effort Codex title suggestions in `rename` behind an explicit doc-scoped flag.
2. Unsupported/failing cases remain deterministic and produce clear doc-specific reason codes.
3. Mixed batches report image/doc analyzer outcomes separately.
4. The implementation stays Node-only and does not depend on external CLIs or Python.

## Deferred Follow-ups (Expected)

- DOCX/PDF implementation plan informed by `mammoth` + `pdfjs-dist` extractor spike results
- Office-family expansion research/spike (`officeparser`) for `pptx` / `xlsx` / OpenDocument formats
- interactive rename pattern/template UX restoration after `--pattern` docs/code drift is resolved

## Plan Closeout Notes

- This milestone is considered complete based on shipped CLI/interactive behavior, fallback-safe analyzer integration, action-level coverage across supported text-like formats, and documentation updates.
- Additional binary-doc expansion (PDF-first / DOCX-gated) was completed under separate follow-up plan/job documents and is intentionally tracked outside this milestone.

## Related Research

- `docs/researches/archive/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
- `docs/researches/archive/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
- `docs/plans/archive/plan-2026-02-26-docx-pdf-rename-analyzer-implementation-pdf-first.md`
- `docs/plans/archive/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
