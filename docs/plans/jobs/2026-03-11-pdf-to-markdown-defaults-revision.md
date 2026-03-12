---
title: "Freeze PDF to-markdown defaults"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Revise the active PDF research and implementation plan so `pdf to-markdown` has explicit default image-export behavior.

## What Changed

- updated the research doc to freeze `pdf to-markdown` default image handling as external assets
- set the default external asset directory to `images/`
- updated the implementation plan so `--images` defaults to `external`
- updated the implementation plan so `--image-dir` defaults to `images` when external asset export is used
- aligned interactive prompt wording, validation notes, checklist items, and success criteria with the new defaults

## Verification

- reviewed the PDF research and implementation plan for consistent `pdf to-markdown` default image-mode wording
- confirmed the new defaults do not change the existing license-sensitive backend position for `pymupdf4llm`

## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

## Related Plans

- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
