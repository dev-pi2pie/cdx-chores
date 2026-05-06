---
title: "Markdown to PDF with WeasyPrint phases 1-5"
created-date: 2026-05-06
status: completed
agent: codex
---

## Goal

Implement the first deterministic `md to-pdf` slice from the WeasyPrint implementation plan, covering phases 1-4 and the required phase 5 `doctor` capability wiring.

## Completed Work

- Added Markdown PDF option normalization and validation for presets, page size, orientation, margins, ToC depth, ToC page-break behavior, and remote-asset policy.
- Added generated Pandoc HTML template and print CSS recipe defaults for `article`, `report`, `wide-table`, `compact`, and `reader`.
- Added `md pdf-template init` to materialize `template.html` and `style.css`.
- Added `md to-pdf` rendering through Pandoc-generated standalone HTML and WeasyPrint PDF output.
- Added optional `--html-output`, default PDF output derivation, custom template/CSS support, default CSS layering, and renderer warning reporting.
- Added remote asset blocking by default with `--allow-remote-assets` opt-in.
- Added WeasyPrint inspection to `doctor` and the `md.to-pdf` capability.

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

## Follow-Up Fixes

### 2026-05-06 remote inline CSS asset blocking

- Addressed review finding `[P2] Block remote URLs in inline CSS`.
- Extended the default remote-asset guard to scan inline `<style>` blocks and `style="..."` attributes in the generated HTML before invoking WeasyPrint.
- Added regression coverage for remote URLs introduced through raw Markdown HTML inline CSS.

Follow-up validation:

```text
bun test test/cli-actions-md-to-pdf.test.ts
bun run lint
bun run format:check
git diff --check
```

## Follow-Up

- Revisit SVG fixture-level smoke coverage when WeasyPrint availability is stable enough in the local or CI environment.
- Phase 6 public guide, README alignment, and status closeout are tracked in `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phase-6-docs.md`.

## Related Plan

- `docs/plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phase-6-docs.md`

## Related Research

- `docs/researches/research-2026-05-06-markdown-to-pdf-weasyprint.md`
