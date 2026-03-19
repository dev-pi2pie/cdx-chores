---
title: "Phase 5 Codex document adapter split"
created-date: 2026-03-19
modified-date: 2026-03-19
status: completed
agent: codex
---

## Goal

Execute Phase 5 from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` by converting `src/adapters/codex/document-rename-titles.ts` into a folder-based module while preserving the current public surface and test behavior.

## Scope

- `src/adapters/codex/document-rename-titles.ts`
- new `src/adapters/codex/document-rename/` modules
- minimal import updates required to preserve the current public API

## Constraints

- preserve the public exports for:
  - `suggestDocumentRenameTitlesWithCodex()`
  - `__testOnlyExtractDocumentTitleEvidenceForPath()`
  - `__testOnlyBuildDocumentPrompt()`
- keep the refactor structural rather than semantic
- keep PDF and DOCX behavior stable
- avoid touching unrelated adapter or CLI hotspots during this phase

## Planned Target Shape

```text
src/adapters/codex/document-rename/
  index.ts
  batch.ts
  prompt.ts
  types.ts
  extractors/
    docx.ts
    html.ts
    markdown.ts
    pdf.ts
    structured.ts
    text.ts
    xml.ts
```

## Verification Plan

- `bun test test/adapters-codex-document-rename-titles.test.ts`
- `bun test test/cli-actions-rename-batch-codex-docs.test.ts`
- `bun test test/cli-actions-rename-file.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## What Changed

- Converted the old flat implementation into a folder-based module under `src/adapters/codex/document-rename/`.
- Added:
  - `src/adapters/codex/document-rename/index.ts`
  - `src/adapters/codex/document-rename/types.ts`
  - `src/adapters/codex/document-rename/prompt.ts`
  - `src/adapters/codex/document-rename/batch.ts`
  - `src/adapters/codex/document-rename/extractors/shared.ts`
  - `src/adapters/codex/document-rename/extractors/html.ts`
  - `src/adapters/codex/document-rename/extractors/xml.ts`
  - `src/adapters/codex/document-rename/extractors/markdown.ts`
  - `src/adapters/codex/document-rename/extractors/text.ts`
  - `src/adapters/codex/document-rename/extractors/structured.ts`
  - `src/adapters/codex/document-rename/extractors/pdf.ts`
  - `src/adapters/codex/document-rename/extractors/docx.ts`
- Replaced `src/adapters/codex/document-rename-titles.ts` with a thin compatibility re-export shim.
- Preserved the public surface for:
  - `suggestDocumentRenameTitlesWithCodex()`
  - `__testOnlyExtractDocumentTitleEvidenceForPath()`
  - `__testOnlyBuildDocumentPrompt()`

## Verification

- `bunx tsc --noEmit`
- `bun test test/adapters-codex-document-rename-titles.test.ts`
- `bun test test/cli-actions-rename-batch-codex-docs.test.ts`
- `bun test test/cli-actions-rename-file.test.ts`
