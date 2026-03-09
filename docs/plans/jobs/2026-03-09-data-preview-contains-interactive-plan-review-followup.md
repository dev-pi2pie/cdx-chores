---
title: "Clarify interactive contains and hidden-highlight behavior in follow-up plan"
created-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Address review findings on the `data preview` contains interactive/highlight follow-up plan so the interactive validation contract and hidden-column highlight behavior are explicit before implementation begins.

## What Changed

- added `modified-date` to the draft follow-up plan
- defined prompt-time validation for interactive contains entry so malformed syntax and unknown columns are handled with local re-prompts instead of post-submit action errors
- kept the interactive contract aligned with the existing direct CLI parser rules
- defined hidden-column highlight behavior so matching columns are not forced visible and instead produce a compact summary note when highlight cues are off-screen
- expanded the test, docs, and manual-verification checklist to cover malformed-input re-prompts, unknown-column re-prompts, and hidden matching-column summary messaging

## Files

- `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`

## Verification

- reviewed current interactive prompt validation behavior in `src/cli/interactive/data.ts`
- reviewed current preview rendering and visible-column budgeting behavior in `src/cli/data-preview/render.ts`

## Related Plans

- `docs/plans/plan-2026-03-09-data-preview-contains-interactive-and-highlight.md`
- `docs/plans/plan-2026-03-09-data-preview-contains-filter.md`
