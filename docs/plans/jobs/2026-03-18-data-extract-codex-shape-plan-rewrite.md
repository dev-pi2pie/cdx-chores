---
title: "Rewrite extract follow-up plan around Codex source-shape assistance"
created-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Correct the follow-up planning scope after noticing that the earlier improved plan covered interactive extract and semantic header review, but still missed the separate reviewed Codex source-shaping layer expected by the research.

## What Changed

- rewrote the follow-up plan as:
  - `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- promoted reviewed Codex source-shape assistance to the top-level shared contract instead of treating it as an interactive convenience
- defined the missing layered model explicitly:
  - deterministic source shaping
  - optional Codex source-shape assistance
  - optional semantic header review
  - command-specific continuation into query or extract
- added a first-pass direct CLI contract for:
  - `--codex-suggest-shape`
  - `--write-source-shape <path>`
  - `--source-shape <path>`
- added a first-pass JSON source-shape artifact direction:
  - `data-source-shape-<uid>.json`
- updated the rewritten plan so interactive `data extract` depends on accepted source shaping before semantic header review
- kept the prompt-copy polish and public-safe smoke-fixture generator work in scope, but moved them downstream of the shared source-shape contract

## Notes

- the rewrite was driven by the research conclusion that “ask Codex to suggest shaping” is a separate source-interpretation step, not just a variant of semantic header review
- this keeps `--codex-suggest-headers` scoped to semantic header proposals after the source shape is already acceptable

## Related Plans

- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
