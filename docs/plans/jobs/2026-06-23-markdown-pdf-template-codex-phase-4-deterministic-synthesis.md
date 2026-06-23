---
title: "Markdown PDF template Codex phase 4 deterministic synthesis"
created-date: 2026-06-23
status: active
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 4 of the direct `md pdf-template codex` plan.

This phase adds deterministic template-family selection, semantic slot
resolution, managed asset binding for synthesized HTML, and repo-owned
`template.html` / `style.css` content generation. It does not write bundle
files, copy assets, run Codex, or render PDFs; those remain later phases.

## Implementation Notes

- Keep slot resolution semantic and path-free. Bundle-relative asset paths are
  bound during deterministic synthesis from the output plan.
- Carry `decisionMode: deterministic` in the synthesis result so later Codex
  adapter, report, and summary phases do not need to infer it again.
- Keep source image `fitPressure` as the Phase 2 image-aspect signal and map it
  to bounded `imageFit` slots during synthesis.
- Keep generated cover image CSS page-relative; source pixel dimensions may be
  recorded as signals but must not become rendered CSS width or height.

## Changes

- Pending.

## Verification

Pending.

## Review

Pending.

