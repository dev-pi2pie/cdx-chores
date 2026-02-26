---
title: "Implement document-text Codex rename analyzer milestone"
created-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Implement the first document-focused rename analyzer milestone for `rename file` / `rename batch` with a Node-only, fallback-safe `--codex-docs` path for text-like documents.

## Implemented

### `--codex-docs` analyzer path (text-like docs)

- Added a document-title Codex adapter in `src/adapters/codex/document-rename-titles.ts`.
- Implemented evidence extraction + normalization for text-like docs:
  - Markdown (`.md`, `.markdown`)
  - Plain text (`.txt`)
  - JSON (`.json`)
  - YAML (`.yaml`, `.yml`)
  - TOML (`.toml`)
  - XML (`.xml`)
  - HTML (`.html`, `.htm`)
- Preserved best-effort / fallback-safe behavior for parser and extraction failures with doc-specific reasons.

### Rename action integration

- Added document analyzer support to `src/cli/actions/rename.ts` for:
  - `rename file`
  - `rename batch`
- Added mixed analyzer summary handling for combined `--codex-images` + `--codex-docs` runs.
- Propagated doc analyzer reasons into preview/plan CSV rows.
- Preserved deterministic rename behavior as the baseline on all unsupported/failed cases.

### CLI and interactive wiring

- Added `--codex-docs` flag family in `src/command.ts`:
  - `--codex-docs`
  - `--codex-docs-timeout-ms`
  - `--codex-docs-retries`
  - `--codex-docs-batch-size`
- Added minimal interactive prompts in `src/cli/interactive.ts` for `rename file` and `rename batch`.

### Tests and verification coverage

- Expanded `test/cli-actions-data-rename.test.ts` with action-level coverage for:
  - markdown/txt document title suggestions
  - mixed image/doc analyzer runs
  - docs profile scoping with `--codex-docs`
  - unsupported/gated binary-doc fallback reasons (PDF/DOCX paths remain fallback-safe)
  - parser/extractor failure paths and deterministic fallback behavior
- Added adapter-level extractor tests in `test/adapters-codex-document-rename-titles.test.ts` (shared adapter path coverage, including PDF extraction/fallback behavior)

### Docs updates

- Updated `docs/guides/rename-scope-and-codex-capability-guide.md` to document current `--codex-docs` support scope and expected outcomes.

## Verification

Automated:

- `bun test test/cli-actions-data-rename.test.ts` ✅
- `bun test test/adapters-codex-document-rename-titles.test.ts` ✅
- `bunx tsc --noEmit` ✅

Manual smoke checks (local playground fixtures):

- `rename file <markdown> --dry-run --codex-docs` ✅
- `rename batch <docs-dir> --profile docs --dry-run --codex-docs` ✅
- mixed `--codex-images --codex-docs` batch runs ✅
- unsupported binary docs in docs profile remain deterministic/fallback-safe ✅

## Scope Notes / Boundaries

- DOCX/PDF extractor research and implementation were split into separate follow-up plan/job tracks and are not part of this milestone’s core success criteria.
- Interactive rename pattern/template UX restoration remains a separate track.

## Related Plans

- `docs/plans/plan-2026-02-26-document-text-rename-analyzer-milestone.md`
- `docs/plans/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md`
- `docs/plans/plan-2026-02-26-docx-pdf-rename-analyzer-implementation-pdf-first.md`

## Related Research

- `docs/researches/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`
- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
