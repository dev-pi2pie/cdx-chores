---
title: "DOCX metadata helper and flag graduation"
created-date: 2026-03-17
modified-date: 2026-03-17
status: active
agent: codex
---

## Goal

Graduate DOCX semantic rename support from env-gated experimental behavior to default-on support by adding OOXML metadata enrichment, improving title ranking quality, expanding fixture coverage, and removing `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` as part of the graduation rollout.

## Why This Plan

The current DOCX path is functional but intentionally gated:

- `mammoth` provides useful headings and raw text
- DOCX metadata is not yet extracted
- title ranking remains too weak for confident default-on behavior
- the current gate protects rename quality rather than package stability

The repository now has the missing runtime building blocks for a focused follow-up:

- `yauzl` for ZIP entry reading
- `fast-xml-parser` for OOXML metadata parsing
- a deterministic metadata-rich DOCX fixture generator to support implementation and regression work

This plan turns that opening into a concrete execution sequence.

## Background / Inputs

Primary references:

- `docs/researches/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md`
- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
- `docs/plans/plan-2026-02-26-docx-pdf-rename-analyzer-implementation-pdf-first.md`

Current implementation baseline:

- DOCX semantic support exists behind `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`
- DOCX extraction currently relies on `mammoth.convertToHtml()` plus `mammoth.extractRawText()`
- deterministic fallback behavior and DOCX reason codes are already wired into rename flows

## Scope

### In scope

- shared OOXML metadata helper for DOCX package inspection
- offline-safe OOXML relationship/schema identifier handling
- DOCX core metadata extraction from OOXML package parts
- improved DOCX title ranking in rename evidence extraction
- deterministic and real-world DOCX fixture expansion
- tests for metadata extraction, ranking, and fallback behavior
- removal plan for `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL`
- docs updates for supported vs experimental DOCX status
- usage-guide note documenting the older `v0.0.7` env-gated path as deprecated history

### Out of scope

- support for Office-family formats beyond DOCX
- OCR, scanned document support, or image-based text recovery
- replacing `mammoth` as the primary DOCX body-content extractor
- broad general-purpose OOXML document modeling outside the fields needed for rename title evidence
- runtime fetching of OOXML schema/relationship URLs
- schema cache-refresh flows for OOXML reference assets
- vendoring broad ECMA-376 schema bundles for formal XSD validation

## Design Direction

### 1. Keep `mammoth` for body evidence

Continue using `mammoth` to extract:

- headings from HTML output
- raw text and lead-text candidates

### 2. Add a narrow shared OOXML helper

Add a repository-local helper under `src/adapters/docx/` that:

- opens the DOCX ZIP package
- parses package structure from `[Content_Types].xml`
- uses `/_rels/.rels` as root-package guidance without depending on OOXML relationship-type URI matching
- reads `/docProps/core.xml`
- optionally reads `/docProps/app.xml` when useful
- returns a small typed metadata payload and warnings

### 3. Keep OOXML identifier handling local and offline-safe

Keep DOCX metadata discovery free of OOXML relationship-type URI matching in runtime code:

- use package content types plus root relationship targets instead
- remove raw full OOXML relationship-type URI literals from runtime code
- do not fetch them over the network at runtime
- do not add schema cache/update behavior in the current scope

### 4. Keep title ranking in the rename adapter

The helper should expose metadata, not rename policy.

Ranking remains in `src/adapters/codex/document-rename-titles.ts`, where metadata, headings, and lead text can be merged into ordered `titleCandidates`.

## Rollout Strategy

### Phase 1: Implementation groundwork

- [x] Confirm runtime dependencies for OOXML metadata work are present (`yauzl`, `fast-xml-parser`)
- [x] Add deterministic metadata-rich DOCX fixture generation script
- [x] Add generated metadata-rich DOCX fixture to `test/fixtures/docs/`
- [x] Add a baseline extractor smoke test covering the generated metadata-rich DOCX fixture

#### Phase deliverable

- [x] Reproducible fixture groundwork exists for metadata extraction and ranking follow-up work

### Phase 2: OOXML metadata helper

- [x] Add a shared DOCX OOXML helper under `src/adapters/docx/`
- [x] Read and parse `[Content_Types].xml` for metadata-part discovery
- [x] Read and parse `/_rels/.rels` for root-package relationship guidance
- [x] Read and parse `/docProps/core.xml`
- [x] Return typed metadata fields:
  - `title`
  - `creator`
  - `subject`
  - `description`
  - `lastModifiedBy`
  - `created`
  - `modified`
- [x] Decide whether `/docProps/app.xml` should be part of the first implementation or a follow-up
- [x] Add unit tests for:
  - valid core properties
  - missing core properties
  - malformed XML
  - invalid ZIP / broken DOCX

#### Phase deliverable

- [x] DOCX metadata can be extracted independently from rename-specific logic

### Phase 3: Offline-safe OOXML identifier handling

- [x] Remove OOXML relationship-type URI matching from the runtime helper implementation
- [x] Keep DOCX metadata discovery based on package content types plus root relationship targets instead
- [x] Confirm the helper does not dereference `schemas.openxmlformats.org` URLs at runtime
- [x] Remove raw full unfetchable OOXML relationship-type URL literals from `src/`
- [x] Document that those identifier strings remain research-only/spec background, not active runtime matching inputs
- [x] Add a regression test that fails if DOCX metadata reading attempts a runtime fetch for OOXML identifiers
- [x] Keep schema bundle download/cache/update behavior out of the current DOCX metadata helper scope

#### Phase deliverable

- [x] DOCX metadata discovery is offline-safe and does not depend on remote schema availability

### Phase 4: DOCX ranking and evidence integration

- [x] Modularize `src/adapters/docx/ooxml-metadata.ts` into a small multi-file pattern that separates:
  - bounded OOXML package reading
  - package-part discovery
  - metadata parsing/public helper shaping
- [x] Keep the modularization narrow and local to `src/adapters/docx/`; do not introduce a broad OOXML framework
- [x] Merge metadata output into `src/adapters/codex/document-rename-titles.ts`
- [x] Rank metadata title above weak generic headings when appropriate
- [x] Add generic-heading down-rank / skip heuristics
- [x] Keep fallback-safe behavior for weak and broken files
- [x] Refine warnings so metadata-missing and lead-text-missing states are explicit
- [x] Add integration tests asserting ordered `titleCandidates` for representative DOCX fixtures

#### Phase deliverable

- [x] DOCX rename evidence quality is materially stronger than the current heading-plus-first-line heuristic, with the underlying DOCX metadata helper kept readable through a small modular split

### Phase 5: Fixture expansion and validation

- [x] Add weak-heading DOCX fixture
- [x] Add no-heading DOCX fixture
- [x] Add hyperlink-heavy DOCX fixture
- [x] Add table-heavy DOCX fixture
- [x] Decide not to add generated metadata-only editor-label variants because a true alternate-editor exported sample is available
- [x] Add at least one alternate-editor exported DOCX fixture if licensing and reproducibility are acceptable
- [x] Verify the alternate-editor exported fixture is truly externally authored, not only generator-authored metadata
- [x] Document which fixtures are deterministic generator outputs versus externally authored validation samples
- [x] Define a small real-world DOCX validation pack with named categories:
  - Word-authored
  - alternate-editor exported
  - metadata-rich
  - weak-heading
  - hyperlink-heavy
  - table-heavy
- [x] Run targeted manual validation against a small real-world sample pack outside the synthetic fixtures
- [x] Record manual validation outcomes per sample:
  - top-ranked title candidate
  - whether metadata or body evidence won
  - warning set
  - whether fallback behavior was still acceptable
- [x] Decide whether the current deterministic fixture set plus existing Word-authored sample is sufficient for pre-graduation confidence if alternate-editor coverage remains unavailable

#### Phase deliverable

- [x] DOCX quality is validated against mixed document shapes rather than a single happy-path fixture

### Phase 6: Default-on graduation and flag removal

- [ ] Remove the default-disabled gating path from `src/cli/actions/rename/codex.ts`
- [ ] Remove `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` parsing and references
- [ ] Remove `docx_experimental_disabled` from active runtime behavior and document its retirement in a compatibility note for downstream reason-code consumers
- [ ] Update tests so default-on DOCX support is the normal path
- [ ] Update docs/guides and release notes to describe DOCX support as supported, best-effort, fallback-safe, and no longer env-gated
- [ ] Add a usage-guide note explaining that older `v0.0.7` guidance required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` and that this path is deprecated

#### Phase deliverable

- [ ] DOCX semantic rename support is enabled by default under `--codex-docs` and the old env gate is removed from active behavior

### Phase 7: Documentation and cleanup closure

- [ ] Remove obsolete gate-specific tests
- [ ] Remove docs that still describe DOCX support as a current env-gated requirement
- [ ] Keep only the intended legacy/deprecation note for the older `v0.0.7` usage shape
- [ ] Add a closing job record for the full graduation/removal work

#### Phase deliverable

- [ ] The experimental DOCX env gate no longer exists in code or active docs, aside from the intentional legacy/deprecation note

## Verification Plan

### Build and automated checks

- [x] `bun run build`
- [ ] `bun test`
- [x] targeted DOCX extractor and rename tests for metadata-rich and weak-signal fixtures
- [ ] confirm the DOCX metadata helper path uses no runtime schema fetch

### Manual checks

- [ ] `rename file <docx> --dry-run --codex-docs` uses improved DOCX evidence without the env gate in the default-on phase
- [ ] weak-signal DOCX files still degrade safely to deterministic rename
- [ ] invalid DOCX files still produce stable fallback reason codes
- [ ] mixed document batches report coherent DOCX summary and fallback behavior

## Success Criteria

This plan is successful if:

1. DOCX metadata is extracted through a narrow, reusable OOXML helper.
2. DOCX metadata discovery remains offline-safe and does not depend on dereferenceable OOXML schema URLs.
3. DOCX title ranking is strong enough that default-on support improves rename quality rather than weakening it.
4. DOCX support is validated on a broader fixture set and a small real-world sample pack.
5. `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` is removed as part of DOCX graduation and the older `v0.0.7` usage is retained only as a deprecated guide note.

## Related Research

- `docs/researches/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md`
- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
