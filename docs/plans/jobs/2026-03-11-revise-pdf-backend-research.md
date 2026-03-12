---
title: "Revise PDF backend research"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Revise `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md` so it reflects current product decisions for the PDF command group and removes machine-specific environment disclosure.

## What Changed

- added `modified-date: 2026-03-11` and kept the research doc in `draft` status
- removed the environment-status snapshot so the research no longer discloses current local tool availability
- reframed the doc from an open comparison into a decision-oriented launch baseline
- set `pdfcpu` as the default backend for `pdf merge` and `pdf split`
- kept `qpdf` as the structural fallback backend rather than a co-equal default
- changed `pdf to-images` guidance from page rasterization-first to embedded-image extraction-first
- prioritized `mutool` over `magick` as the optional secondary backend for PDF image workflows
- explicitly de-prioritized `pdftoppm` from the current launch path
- clarified that `pdf from-images` should stay simple in v1 with order preservation and minimal layout expectations
- promoted `pymupdf4llm` from a speculative later workflow to an exposed `pdf to-markdown` candidate with progress feedback and configurable external-image-folder behavior
- replaced the old open-questions list with concrete decisions plus deferred revisit triggers
- added a `Related Plans` section linking the initial launch plan already associated with this research

## Verification

- reviewed the revised research doc for front-matter compliance and repository traceability
- confirmed local `pdfcpu` command help for `images extract`, `extract -mode image`, and `import` so the revised recommendations align with actual CLI surface

## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`
