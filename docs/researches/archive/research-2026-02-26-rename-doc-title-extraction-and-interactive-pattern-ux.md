---
title: "Rename doc-title extraction and interactive pattern UX research"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Define a practical design direction for improving `rename` in two areas:

- Codex-assisted title suggestions for document-like files via content extraction (not image-only)
- Interactive rename UX that reveals the current renaming pattern and lets users choose a preset or custom pattern

## Milestone Goal

Produce an implementation-ready research baseline for a follow-up plan that extends rename analyzers beyond static images and restores/improves pattern-template UX in both CLI and interactive flows.

## Key Findings

### 1. The rename action already has an analyzer abstraction, but only a static-image analyzer is implemented

`src/cli/actions/rename.ts` already contains a generic analyzer shape:

- candidate selection
- eligibility filtering
- suggestion execution
- summary/error reporting

Current implementation only wires one analyzer:

- `codex-static-image` via `createCodexStaticImageTitleAnalyzer(...)`

Implication: the architecture is already close to supporting a document analyzer. We can extend the existing analyzer pattern instead of inventing a separate rename pipeline.

### 2. Codex-assisted title generation is image-specific at the adapter boundary today

`src/adapters/codex/image-rename-titles.ts` is explicitly image-only:

- prompt wording is image-specific
- inputs are sent as `local_image`
- output schema expects filename/title suggestions for image batches

Implication: adding doc rename assistance should not be bolted into the image adapter. A new adapter (or a shared interface with file-type-specific adapters) is the correct boundary.

### 3. The current codebase does not expose rename pattern/template selection in CLI or interactive mode

Current rename surfaces in `src/command.ts` and `src/cli/interactive.ts` support:

- `--prefix`
- batch scope filters (`--profile`, `--ext`, regex, recursion)
- `--codex-images` and related runtime knobs

They do not currently expose a `--pattern`/template option, and interactive mode only asks for:

- target path/directory
- prefix
- dry-run
- Codex image toggle

Implication: the requested UX improvement ("show current renaming pattern" and "choose different/custom pattern") is not a small prompt tweak; it requires restoring or adding actual pattern/template support in the rename planner and command wiring.

### 4. There is a documentation/code drift around rename pattern support

Existing completed docs/job records describe implemented `--pattern <template>` support and interactive template prompts, but the current source code no longer shows that behavior in:

- `src/command.ts`
- `src/cli/interactive.ts`
- `src/cli/fs-utils.ts`

Implication: before new pattern UX work, we should decide whether pattern support was intentionally reverted or accidentally regressed. The new work should explicitly include a docs reconciliation step.

### 5. Existing rename-scope docs already point toward a future document-text analyzer path

Recent docs already establish the core separation needed for this request:

- deterministic rename planner vs semantic analyzers
- current `--codex-images` is static-image-only
- document-text analyzer is a future path

Implication: the proposed "basic codex-doc-assistant" is aligned with current documented direction, but needs a concrete extractor-first design and UX/flag semantics.

## Implications or Recommendations

### A. Add a document-content extractor stage before Codex title suggestion

For doc-like files, the Codex request should be based on extracted evidence, not raw binary files.

Recommended flow:

1. `rename` planner builds candidate list (existing behavior)
2. `document-text` analyzer selects eligible files by extension
3. local extractor produces a compact evidence payload per file
4. Codex suggester proposes concise titles from extracted evidence
5. rename planner re-runs with `titleOverrides` (same pattern as image flow)

This matches the existing `titleOverrides` reuse pattern in `src/cli/actions/rename.ts`.

### B. Start with a minimal "basic codex-doc-assistant" scope

Phase 1 scope should target low-dependency formats first:

- `.md`, `.markdown`, `.txt`
- `.json`, `.yaml`, `.yml`, `.toml`
- `.xml`, `.html`, `.htm`
- optionally `.csv`/`.tsv` (header-focused only)

Extractor output should be compact and deterministic, for example:

- basename + extension
- file size
- first non-empty lines (capped)
- detected heading/title candidates
- top-level keys (JSON/TOML/YAML) when easy to parse safely

This avoids blocking on PDF/DOCX extraction toolchain decisions while delivering the requested "extract basic content to Codex" capability.

### C. Keep analyzer naming and flags explicit by file type

Do not overload `--codex-images` to silently include docs.

Recommended direction:

- keep `--codex-images` for current static-image analyzer
- introduce a separate opt-in flag for docs (for example `--codex-docs`)
- later consider a grouped flag only after multiple analyzers are stable

This preserves current user expectations and makes mixed-batch reporting clearer.

### D. Design interactive rename pattern UX around "effective pattern" visibility

Interactive mode should show the currently effective pattern before asking for changes.

Recommended prompt sequence (rename file + rename batch):

1. Show effective pattern summary (default or prior selection)
2. Ask pattern choice:
   - Keep current/default
   - Choose preset
   - Enter custom template
3. If custom, validate placeholders immediately
4. Show one example rendered filename preview before running rename

Presets should be explicit and named, for example:

- `prefix-timestamp-stem` (default)
- `timestamp-stem`
- `prefix-stem`
- `stem-only` (use cautiously, still collision-safe)

### E. Reintroduce planner-level pattern/template support before interactive-only UX work

Pattern selection must be a planner capability (shared by CLI and interactive), not prompt-local formatting.

Recommended implementation order:

1. restore/add planner template rendering in `src/cli/fs-utils.ts`
2. expose `--pattern` in `src/command.ts`
3. add interactive pattern prompts in `src/cli/interactive.ts`
4. update dry-run CSV/audit rows if pattern metadata should be recorded

This avoids duplicating filename formatting logic in interactive mode.

### F. Add analyzer result reporting that distinguishes images vs docs

Once docs are supported, batch summaries should report per analyzer category rather than only "Codex image titles".

Example summary direction:

- `Codex image titles: 8/10 suggested`
- `Codex doc titles: 5/7 suggested`
- `Codex notes: 2 docs skipped (unsupported extractor)`

This will reduce confusion in `--profile docs` and `--profile media` workflows.

### G. Add a docs reconciliation task to prevent repeated drift

Because completed job docs currently describe behavior not present in source, follow-up implementation should include:

- source/CLI verification checklist
- docs updates for changed flag names and interactive prompts
- test coverage for pattern/template CLI + interactive-adjacent action behavior

## Interim Decisions (2026-02-26)

The repository now includes these dependencies (user-added, uncommitted at time of this research update):

- `mammoth` (`^1.11.0`) in `package.json`
- `pdfjs-dist` (`^5.4.624`) in `package.json`

These additions support narrowing the near-term design:

- PDF extraction backend direction: prefer `pdfjs-dist` for the first Node-first PDF analyzer path.
- DOCX extraction backend direction: start with `mammoth` for a pragmatic Word-document baseline.
- Office-family breadth (`pptx`, `xlsx`, etc.) remains a separate expansion decision and should not block the first doc-title analyzer milestone.

Important distinction (to preserve in docs/plans):

- backend choice and analyzer strategy are separate decisions
- we may use one backend across multiple formats while still keeping different title-evidence normalizers by file type/category

Recommended analyzer categories (even if some share a backend):

- `document-text` (md/txt/json/yaml/toml/html)
- `document-word` (docx/odt/rtf narrative docs)
- `presentation` (pptx/odp)
- `spreadsheet` (xlsx/ods)
- `pdf-document`

## What To Do Next (Docs + Design)

1. Keep this research as the active design notes for Phase 4 follow-up (do not overload the completed Phase 1-3 rename-scope plan).
2. Draft a new plan for a `document-text` analyzer milestone (`.md`/`.txt`/structured text first) and include the interactive pattern UX restoration work only if scope remains manageable.
3. Draft a separate extractor-spike plan/job for `docx` + `pdf`:
   - `mammoth` for DOCX evidence prototype
   - `pdfjs-dist` for PDF evidence prototype
   - fixture-based comparison criteria (title/author/headings/tocCandidates/leadText extraction quality, latency, fallback reasons)
4. Add a short docs note (in the future plan/job) that `officeparser` is a candidate for Office-family expansion, but not required for the first DOCX/PDF milestone.

## Open Questions

1. Should we use a hybrid extractor design (shared evidence schema + per-filetype extractors)?
   Current recommendation: yes.
   A shared `DocumentTitleEvidence` shape can keep Codex prompting stable, while each extractor fills the fields it can (for example `title`, `author`, `headings`, `tocCandidates`, `leadText`, `metadata`, `warnings`).
   This avoids forcing every file type into the same low-fidelity "plain text only" path.

2. What should be the first DOCX backend for v1 of doc-title extraction?
   Interim direction: `mammoth` (now added to deps) for the first prototype.
   Remaining question: is `mammoth` sufficient for title-evidence quality once we add metadata/author and heading extraction requirements, or do we need a second DOCX metadata path?

   Candidate A (Node-first, low dependency): `mammoth`
   - Good for semantic heading extraction because it maps heading styles to HTML.
   - Also provides raw text extraction (`extractRawText`), but raw text loses structure.
   - Gap: metadata/author extraction is not the main focus of the library.

   Candidate B (Node-first, broader output): `officeparser`
   - Recent README claims format-agnostic AST output with metadata and content nodes (including headings/tables), and CLI support.
   - Could reduce custom extractor work if output is stable enough for our rename use case.
   - Tradeoff: larger surface area, less control over normalization, and a third-party AST contract we would need to pin/test carefully.

   Candidate C (external CLI, high structure potential): `pandoc` (`docx` -> text/markdown/json)
   - Strong converter and broadly available in developer workflows.
   - Useful for extracting structured headings/text from DOCX when installed.
   - Tradeoff: external dependency and process startup cost; should be optional fallback, not required for v1.

   Candidate D (custom OOXML parsing)
   - Parse DOCX zip/XML directly for targeted fields:
     - `docProps/core.xml` (title/creator/modified)
     - `word/document.xml` + styles (headings / lead paragraphs)
   - Highest control and predictable output for rename evidence.
   - Tradeoff: more implementation effort and edge-case handling.

3. What should be the first PDF backend for v1 of doc-title extraction?
   Interim direction: `pdfjs-dist` (now added to deps) for the first prototype.
   Remaining question: how far can we get on title-evidence quality with metadata + outline + first-page text before needing optional CLI fallbacks for difficult PDFs?

   Candidate A (Node-first): `pdfjs-dist` / PDF.js API
   - Gives direct programmatic access to page text (`getTextContent`) plus document metadata (`getMetadata`) and outline/bookmarks (`getOutline`) when present.
   - Good fit when we want a pure JS/Node path and structured signals.
   - Tradeoff: PDF text extraction quality varies by document; some PDFs have poor/empty extractable text without OCR.

   Candidate B (external CLI, pragmatic default on many systems): Poppler tools (`pdftotext` + `pdfinfo`)
   - `pdftotext` provides plain text and optional layout/bbox modes.
   - `pdfinfo` exposes metadata fields and can print structure/structure+text for tagged PDFs (`-struct`, `-struct-text`).
   - Tradeoff: external dependency availability differs by OS; output parsing must be hardened.

   Candidate C (external CLI/JAR): Apache Tika (`tika-app`)
   - Single tool can extract text and metadata across many file types (including DOCX/PDF), reducing per-format integration work.
   - Tradeoff: Java dependency, heavier runtime, larger install footprint, and slower startup.

   Suggested direction:
   - v1 `.pdf` support should prefer one backend only to limit complexity.
   - `pdfjs-dist` is the current preferred Node-first path.
   - Poppler/Tika can be added as opt-in fallback adapters behind capability checks later.

4. Should we extract different "title evidence" by file type (not just raw text)?
   Current recommendation: yes, with a normalized output contract.

   Suggested evidence priorities by type:
   - Markdown: frontmatter `title`/`author`, first `#` heading, first paragraph, H2 list as TOC candidates.
   - Plain text: first non-empty line, first paragraph, filename stem fallback.
   - JSON/YAML/TOML: common keys (`title`, `name`, `description`, `author`) + top-level key summary.
   - HTML: `<title>`, `<h1>`, meta author tags, first meaningful paragraph.
   - DOCX: core metadata (`title`, `creator`), heading nodes, first heading, early body paragraphs.
   - PDF: metadata title/author, outline/bookmarks, first page text sample, page count.

   Important rule:
   - "TOC-like" should be a best-effort extracted field (`tocCandidates`), not a required field, because many files do not contain a real table of contents.

5. How much extracted content should be sent to Codex per file (line count / byte cap) to balance quality vs latency/cost?
   Proposed v1 heuristic (to test):
   - hard byte cap on evidence JSON per file (for example 4-12 KB)
   - keep high-signal fields first (metadata/title/headings/lead text)
   - truncate long body text before truncating headings/metadata
   - record truncation in a `warnings` field so fallback reasoning is auditable

6. Should doc analyzer suggestions include a confidence or evidence-based fallback reason in the rename plan CSV?
   Recommended minimum for v1:
   - keep reason codes first (`doc_no_text`, `doc_no_title_signal`, `doc_extractor_unavailable`, `doc_extract_error`, `doc_truncated`)
   - defer numeric confidence until we have stable evaluator heuristics

7. How should we phase Office-family expansion (`officeparser`) relative to `mammoth` + `pdfjs-dist`?
   Suggested sequencing:
   - ship `document-text` and first `docx`/`pdf` prototypes first
   - evaluate `officeparser` in a separate spike for `pptx`/`xlsx`/OpenDocument breadth
   - only adopt it if its extracted structure maps cleanly into our title-evidence schema

8. Was prior `--pattern` support intentionally removed, or is this a regression that should be restored as part of the same milestone?
   This remains open and affects scope planning:
   - if regression: restore first, then improve interactive pattern UX
   - if intentional removal: write a short decision note before reintroducing templates

9. Should interactive mode remember the last-used pattern within a single session (or via config) when renaming multiple files/batches?
   Suggested default:
   - session-local memory only (low risk, no config migration)
   - persistent config later only if multiple workflows request it

## Related Plans

- `docs/plans/archive/plan-2026-02-26-document-text-rename-analyzer-milestone.md`
- `docs/plans/archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/archive/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`

## Related Research

- `docs/researches/archive/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## References

- `src/cli/actions/rename.ts`
- `src/adapters/codex/image-rename-titles.ts`
- `src/cli/interactive.ts`
- `src/command.ts`
- `src/cli/fs-utils.ts`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/guides/cli-action-tool-integration-guide.md`
- `docs/plans/jobs/2026-02-25-rename-pattern-template-support.md`
