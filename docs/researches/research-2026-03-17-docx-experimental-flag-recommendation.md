---
title: "Deprecate DOCX experimental rename flag after quality graduation"
created-date: 2026-03-17
modified-date: 2026-03-17
status: in-progress
agent: codex
---

## Goal

Define how to deprecate legacy `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` usage by first raising DOCX semantic rename quality to a default-on standard and then removing the env gate entirely.

## Milestone Goal

Make DOCX support under `rename --codex-docs` reliable enough to enable by default, then remove the env gate without reducing rename quality or fallback safety, while keeping only a legacy usage note for older `v0.0.7` guidance.

## Key Findings

- The gate is still active in `src/cli/actions/rename/codex.ts` and disables DOCX semantic analysis by default unless `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`.
- User-facing output and CSV reason handling still explicitly model DOCX as experimental-disabled via `docx_experimental_disabled`.
- Repository guidance still documents DOCX semantic support as experimental and env-gated in `docs/guides/rename-scope-and-codex-capability-guide.md`.
- The reason for the gate is still quality, not package instability:
  - earlier research concluded `mammoth` heading extraction was useful, but title selection quality was only "usable"
  - earlier plans called out missing DOCX metadata extraction and missing title-ranking improvements as the main blockers to default-on support
- The current extractor in `src/adapters/codex/document-rename-titles.ts` still shows those limits:
  - title candidates come mainly from H1 headings and the first raw-text line
  - warnings always include `docx_metadata_unavailable`
  - no OOXML core-properties parsing is present
  - no stronger ranking heuristic is present beyond simple candidate ordering
- Current tests prove the gate behavior and one heading-rich happy path, but they do not yet prove broad DOCX reliability across mixed real-world inputs.

## Implications or Recommendations

### Deprecation Strategy

1. Improve DOCX evidence quality while the env gate remains in place.
2. Prove default-on quality with a broader fixture and manual validation set.
3. Enable DOCX by default and remove the env gate as part of the same graduation work.
4. Keep only a guide-level deprecation note that older `v0.0.7` usage required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`.
5. Do not add a runtime compatibility no-op phase unless implementation evidence later shows it is necessary.

### Quality Work Required Before Deprecation

- Add DOCX metadata supplementation.
  - Parse OOXML core properties for fields like document title and creator.
  - Feed metadata title into `titleCandidates` with stronger priority than weak generic headings.
- Improve DOCX title ranking.
  - Rank metadata title, H1 headings, other strong headings, and first meaningful lead text.
  - Filter or down-rank weak generic headings such as `Goal`, `Agenda`, `Notes`, or `Draft` when a stronger candidate exists.
  - Avoid over-trusting the first raw-text line when it looks structural rather than titular.
- Expand fixture coverage.
  - Add a heading-rich DOCX fixture beyond the current one.
  - Add weak-heading and no-heading fixtures.
  - Add a metadata-rich fixture.
  - Add hyperlink-heavy and table-heavy fixtures.
  - Add documents exported from at least Word and another common editor if available.
- Strengthen regression tests.
  - Assert extracted `titleCandidates` order for representative DOCX fixtures.
  - Assert fallback reasons remain stable for broken or weak-signal inputs.
  - Replace gate-specific default-disabled assertions once the feature is ready to graduate.

### Custom OOXML Helper Design

- Use a small repository-local helper instead of a broad DOCX authoring library.
- Keep `mammoth` as the primary content extractor for headings and raw text.
- Use `yauzl` only for ZIP/package entry access and `fast-xml-parser` only for XML parsing.
- Limit the first implementation to metadata enrichment needed by rename title evidence, not general OOXML support.

#### Proposed Responsibility Split

- `mammoth`
  - extract HTML headings
  - extract raw text
- custom OOXML helper
  - open the DOCX ZIP container
  - locate and read metadata parts
  - parse OOXML metadata into a small typed result
  - return warnings/reasons that can be merged into rename evidence

#### Proposed First-Scope Files

- `/_rels/.rels`
  - resolve package relationships when locating core properties
- `/docProps/core.xml`
  - read document title, creator, subject, description, created/modified timestamps
- optional follow-up: `/docProps/app.xml`
  - read application-level weak signals only if useful

#### Proposed Helper API

- Add a narrow helper under `src/adapters/docx/` or similar.
- Example shape:
  - `readDocxCoreMetadata(path: string): Promise<{ metadata?: DocxCoreMetadata; warnings: string[] } | { reason: "docx_extract_error" }>`
- Suggested `DocxCoreMetadata` fields:
  - `title?: string`
  - `creator?: string`
  - `subject?: string`
  - `description?: string`
  - `lastModifiedBy?: string`
  - `created?: string`
  - `modified?: string`
  - `application?: string`

#### Proposed Ranking Integration

- Build DOCX `titleCandidates` in this order:
  1. metadata title when present and non-generic
  2. strong H1 heading
  3. strong early heading
  4. first meaningful lead-text line
- Down-rank or skip generic titles such as:
  - `Goal`
  - `Agenda`
  - `Notes`
  - `Draft`
  - `Untitled`
- Keep warnings explicit:
  - `docx_metadata_unavailable`
  - `docx_metadata_missing_title`
  - `docx_no_lead_text`

#### ZIP/XML Implementation Notes

- Prefer relationship resolution through `/_rels/.rels` rather than assuming `docProps/core.xml` is always the only valid location.
- Keep ZIP reading entry-based and bounded; do not inflate the full archive into memory unless needed.
- Treat malformed ZIP, missing metadata parts, and XML parse failures as non-fatal metadata misses when body extraction still works.
- Reserve `docx_extract_error` for cases where the document cannot be meaningfully processed at all.

#### Suggested Verification for the Helper

- Unit-test metadata extraction directly from DOCX fixtures with:
  - valid core properties
  - missing core properties
  - malformed XML
  - invalid ZIP / broken DOCX
- Integration-test merged DOCX evidence so metadata title outranks weak headings when appropriate.
- Confirm build output still works in both ESM and CJS targets after adding `yauzl`.

### Suggested Acceptance Bar

- DOCX extraction remains fallback-safe:
  - invalid files still degrade to `docx_extract_error`
  - weak-signal files still degrade to deterministic rename without breaking the command
- Representative DOCX fixtures produce plausible top-ranked title candidates without relying on the env gate.
- DOCX output quality is comparable to current PDF/text document support for the intended rename workflow.
- Repository docs can honestly describe DOCX support as supported rather than experimental.

### Rollout Plan

#### Phase 1: Quality Upgrade Under Gate

- Implement metadata extraction and ranking improvements.
- Expand fixture coverage and tighten extractor tests.
- Keep `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` as the only path to live DOCX semantic support.

#### Phase 2: Default-On Graduation

- Remove the default-disabled path in `src/cli/actions/rename/codex.ts`.
- Make DOCX semantic support participate automatically under `--codex-docs`.
- Remove parsing and references to `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` as part of the graduation implementation.
- Update docs and release notes so DOCX is listed as supported, best-effort, fallback-safe, and no longer env-gated.
- Add a legacy guide note that older `v0.0.7` usage required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` and that this path is deprecated.

#### Phase 3: Flag Removal

- Remove `docx_experimental_disabled` behavior and its tests.
- Remove docs that mention DOCX as a current env-gated requirement.
- Keep only the historical/deprecation note for the older `v0.0.7` usage shape where needed.

## Recommendation

- Short term: keep the env gate while quality work lands.
- Medium term: graduate DOCX support to default-on only after metadata, ranking, and fixture coverage improve.
- Long term: remove the env gate as part of that graduation work and document the old `v0.0.7` usage only as deprecated history.

## Recommended Decisions

### 1. Use a narrow shared OOXML helper

Recommendation:

- implement a small shared OOXML metadata helper under `src/adapters/docx/`
- keep ZIP and XML reading reusable
- keep rename-specific title ranking in `src/adapters/codex/document-rename-titles.ts`

Reason:

- the ZIP/XML work is generic enough to justify reuse
- the ranking policy is specific to rename title evidence and should not leak into a generic OOXML layer
- this avoids over-design while still preventing duplicated package-parsing logic

### 2. Remove the env gate when DOCX graduates

Recommendation:

- when DOCX becomes default-on, remove `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` as part of the same implementation step
- do not add a runtime compatibility no-op period by default
- keep only a usage-guide note explaining that older `v0.0.7` guidance required the env flag and that this path is deprecated

Reason:

- this is a hidden environment flag rather than a public CLI flag
- the repository does not need to carry extra runtime logic once DOCX support is default-on
- a guide-level deprecation note is enough to explain the old behavior without extending code, tests, or machine-facing behavior
- retaining a compatibility path would add maintenance and test surface without clear value if removal is already the chosen direction

### 3. Require broader real-world validation before graduation

Recommendation:

- do not graduate DOCX support to default-on based only on the current synthetic or single-happy-path fixtures
- require a broader validation set including at least:
  - Word-authored DOCX
  - alternate-editor exported DOCX
  - metadata-rich DOCX
  - weak-heading DOCX
  - hyperlink-heavy DOCX
  - table-heavy DOCX

Reason:

- the current risk is title-quality reliability, not extractor reachability
- graduation should be based on mixed real-world document shapes, not only deterministic unit coverage

### 4. Keep the current fixture-generator work as phase-one groundwork

Recommendation:

- treat the new deterministic metadata-rich DOCX fixture generator as part of the quality-upgrade phase, not as the end state
- use it to anchor metadata extraction tests while adding more fixtures over time

Reason:

- it provides a reproducible baseline for OOXML metadata work
- it does not replace the need for broader real-world validation coverage

## Next Step Recommendation

- Create a dedicated implementation plan for DOCX metadata enrichment and flag graduation.
- Phase the work so the shared OOXML helper, ranking changes, fixture expansion, and flag deprecation are tracked explicitly.
- Keep the research doc focused on rationale and rollout guidance rather than turning it into the execution checklist.

## Related Plans

- `docs/plans/plan-2026-02-26-docx-pdf-rename-analyzer-implementation-pdf-first.md`
- `docs/plans/jobs/2026-02-26-docx-pdf-rename-analyzer-pdf-first-phase.md`
- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md`
- `docs/researches/research-2026-03-17-package-upgrade-risk-inquirer-mammoth.md`
