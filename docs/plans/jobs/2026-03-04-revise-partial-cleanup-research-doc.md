---
title: "Revise partial cleanup research doc"
created-date: 2026-03-04
modified-date: 2026-03-05
status: completed
agent: codex
---

## Goal

Tighten `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md` so the partial-cleanup follow-up contract is clearer and less likely to be misread during implementation.

## What Changed

- added `modified-date` to the research doc
- clarified that the first partial analyzer-scope design remains interactive-only
- reframed `--codex-include-hint` and `--codex-exclude-hint` as provisional names for a possible later CLI surface instead of first-pass commitments
- defined analyzer-family labels as review-layer selectors rather than implicit deterministic cleanup settings
- made the review-to-deterministic handoff explicit in the recommended flow and open questions
- clarified that any later CLI multi-family syntax should align with the existing `--hint` contract: repeatable or comma-separated values
- recorded product-direction decisions for the first follow-up:
  - empty include/exclude selection means full-scope analyzer review
  - first-pass analyzer families stay aligned to `date`, `timestamp`, `serial`, and `uid`
  - analyzer scope selection should prefer interactive multi-select choices
  - deterministic cleanup settings remain one global selection across the chosen groups
- noted a UX follow-up to align the normal interactive `--hint` picker with the same multi-select choice pattern later
- replaced the remaining open questions with concrete recommendations:
  - delay any CLI include/exclude surface until the interactive contract is validated
  - treat null/empty CLI selection as implicit full-scope analysis if a later CLI surface is added
  - start interactive analyzer-family selection with one combined multi-select and all families selected by default
- added a new artifact-lifecycle discussion covering dry-run plan CSV versus analyzer report CSV retention behavior
- added an ASCII workflow sketch for expected interactive retention handling and post-run artifact outcomes
- added a recommendation to separate retention decisions for plan CSV and analysis report CSV in interactive mode
- added concrete example prompt copy and a retention decision matrix for interactive dry-run/apply artifact handling
- removed the now-resolved retention-UI item from residual open questions, leaving only truly unresolved follow-up questions
- added a recommended resolution path for residual questions:
  - readiness gate for any future CLI include/exclude surface
  - phased rule for explicit exclude behavior with include-minus-exclude precedence if both controls are added later
- added a new implementation plan document with phased checklist tracking and an anti-bloat job-record strategy section:
  - `docs/plans/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`

## Verification

- reviewed the revised research doc against the March 3 analyzer-assisted cleanup plan and related research docs

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`

## Related Plans

- `docs/plans/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`
