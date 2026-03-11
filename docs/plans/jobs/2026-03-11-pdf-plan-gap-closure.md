---
title: "Close PDF plan contract gaps"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Resolve the remaining contract gaps in the PDF workflow implementation plan after review findings on render-mode behavior, markdown asset-path defaults, and page-selection semantics.

## What Changed

- froze `pdf to-images --mode render` to use `mutool draw` as the first supported render backend
- defined `render` minimum behavior as one PNG output per rendered page with deterministic naming
- froze `--pages` syntax for `pdf to-images` as 1-based comma-and-range selection such as `1,3-5`
- limited `--pages` support to `--mode render` in v1 and specified that `extract` must reject it clearly
- defined the default `pdf to-markdown` `images/` directory as relative to the markdown output file's parent directory
- clarified that markdown image links should be written relative to the markdown file location
- updated checklist, test, risk, and success-criteria sections to cover the newly frozen behavior

## Verification

- reviewed the updated plan for a complete `render` contract instead of a half-deferred public mode
- reviewed the markdown asset-path wording to ensure the default `images/` location is no longer ambiguous
- reviewed `--pages` wording to ensure syntax and validation rules are explicit

## Related Plans

- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
