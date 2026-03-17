---
title: "Follow up DOCX flag graduation plan review"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Address review feedback on the DOCX flag-graduation research and plan documents so the rollout state, compatibility period, and consumer migration story are explicit.

## What Changed

- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`:
  - changed status to `active`
  - added `modified-date`
  - defined the compatibility release behavior for `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` as a no-op with a yellow `stderr` deprecation notice
  - specified that the warning must remain human-facing only and must not alter CSV or other machine-readable outputs
  - tied flag removal to the next shipped release after one release has carried the compatibility notice
- Updated `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`:
  - changed status to `in-progress`
  - aligned the deprecation strategy with the compatibility-release warning behavior
  - made the release-boundary requirement for flag removal explicit

## Verification

- Reviewed both updated documents for consistency of:
  - status and front-matter state
  - one-release compatibility wording
  - machine-readable output safety
  - release-gated flag removal

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
