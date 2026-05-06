---
title: "Markdown to PDF with WeasyPrint phase 6 docs"
created-date: 2026-05-06
status: completed
agent: codex
---

## Goal

Complete Phase 6 of the Markdown-to-PDF WeasyPrint implementation plan by adding public usage documentation, aligning README command summaries, and closing the related plan/research lifecycle statuses with implementation evidence.

## Completed Work

- Added `docs/guides/markdown-pdf-usage.md` for the `md to-pdf` and `md pdf-template init` workflow.
- Updated `README.md` command overview, capability checks, Markdown examples, and guide index for the Markdown PDF surface.
- Marked Phase 6 checklist items complete in `docs/plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md`.
- Marked the implementation plan `completed` after phases 1-6 were finished.
- Marked the related research doc `completed` now that the plan and job evidence are linked.

## Validation

```text
bun test test/cli-actions-md-to-pdf.test.ts
bun test test/cli-actions-doctor-markdown-video-deferred.test.ts
bun run lint
bun run format:check
bun run build
git diff --check
```

`bun run build` completed with the existing dynamic-import warning around `src/cli/prompts/path.ts`.

## Related Plan

- `docs/plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phases-1-5.md`

## Related Docs

- `docs/guides/markdown-pdf-usage.md`

## Related Research

- `docs/researches/research-2026-05-06-markdown-to-pdf-weasyprint.md`
