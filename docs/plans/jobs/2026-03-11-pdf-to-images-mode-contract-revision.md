---
title: "Revise PDF to-images mode contract"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Revise the active PDF research and implementation plan so `pdf to-images` is documented as a mode-based command and `qpdf` remains outside the current implementation path.

## What Changed

- updated the PDF research doc so `pdf to-images` is framed around explicit `extract` and `render` modes
- kept `extract` as the default mode and `pdfcpu` as its default backend
- clarified that render behavior must be explicit and must not be reached by silent fallback
- tightened `qpdf` wording from later-fallback language to out-of-scope-for-now language for the current implementation path
- revised doctor capability naming in the research to be mode-aware for `pdf to-images`
- updated the implementation plan so the direct CLI, interactive flow, risks, tests, and success criteria all follow the new mode-based contract

## Verification

- reviewed the PDF research and implementation plan for consistent `pdf to-images` mode wording
- confirmed the revised docs still keep `pdfcpu` as the active implementation backend and keep `qpdf` out of the current path

## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

## Related Plans

- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
