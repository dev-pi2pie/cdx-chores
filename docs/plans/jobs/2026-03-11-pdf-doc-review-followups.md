---
title: "Draft and revise PDF docs and plan"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Capture the March 11 PDF documentation work in one consolidated job record, covering the implementation plan draft, license-restriction revisions, and review followups on the current research and plan.

## What Changed

- added `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
- drafted the implementation plan for:
  - `pdf merge`
  - `pdf split`
  - `pdf to-images`
  - `pdf from-images`
  - `pdf to-markdown`
- documented first-pass direct CLI command shapes, flag usage, and interactive prompt flows for the PDF command family
- added `docs/guides/pdf-backend-license-guidance.md`
- aligned the plan with the current backend direction:
  - `pdfcpu` as the launch default
  - no immediate `qpdf` dependency
  - `magick` lower priority than the primary path
- updated the PDF research doc to add a license-focused finding covering:
  - permissive defaults such as `pdfcpu` and `qpdf`
  - commercial-use-permitted positioning for `ImageMagick`
  - AGPL or commercial-license constraints around Artifex-backed tools such as `MuPDF` and `PyMuPDF`
- revised the research and plan so:
  - the launch path is explicitly permissive-first
  - `mutool` is treated as license-sensitive
  - `pymupdf4llm` is treated as license-sensitive
- shifted the sensitive-license handling from CLI permission flags to guide and help wording
- clarified that `cdx-chores` may detect or invoke user-provided third-party tools without bundling or installing them
- clarified that user-installed tools do not automatically eliminate third-party license obligations
- tightened the `pdf to-images` contract so help and interactive copy must explicitly say that v1 extracts embedded images and does not render pages
- adjusted the markdown backend wording from an unconditional default to a planned candidate gated by license approval
- added checklist, doctor-reporting, guide, and test items for clear messaging around license-sensitive user-provided backends

## Verification

- reviewed existing deferred PDF command placeholders in `src/command.ts`
- reviewed nearby implementation-plan structure to match repository conventions
- reviewed the revised research and plan docs for consistency on:
  - license-sensitive user-provided backend wording
  - `pdf to-images` extraction-only wording
  - guide-focused handling of license-sensitive backends
- reviewed official licensing sources for:
  - `pdfcpu`
  - `qpdf`
  - `ImageMagick`
  - `MuPDF`
  - `PyMuPDF` / Artifex licensing

## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

## Related Plans

- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
