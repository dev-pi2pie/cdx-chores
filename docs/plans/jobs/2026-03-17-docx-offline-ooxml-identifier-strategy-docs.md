---
title: "Document DOCX offline OOXML identifier strategy"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Record the decision that DOCX OOXML relationship/schema URLs are treated as offline-safe specification identifiers rather than live runtime resources, and align the active research and plan docs with that lighter implementation approach.

## What Changed

- Updated `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`:
  - added the finding that `schemas.openxmlformats.org` URLs are not reliable runtime fetch targets
  - clarified the correct extended-properties relationship identifier
  - added a recommendation to keep identifier handling local, offline-safe, and lightweight
- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`:
  - added offline-safe OOXML identifier handling to scope/design
  - added a dedicated rollout phase for implementing and documenting the lightweight approach
  - marked schema bundle download/cache/update work as out of scope for the current plan

## Verification

- Reviewed the research and plan docs for consistent wording around:
  - local identifier handling
  - no runtime fetch dependency
  - no schema cache/bundle work in the current scope

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
