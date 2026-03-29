---
title: "Draft rename timestamp format matrix guide"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Create the first dedicated guide for rename timestamp placeholder behavior so the Route A plan has a concrete matrix-style documentation target.

## What Changed

- Added `docs/guides/rename-timestamp-format-matrix.md` as a draft guide.
- Included one compact matrix covering:
  - placeholder
  - status
  - timezone
  - style
  - offset
  - sample output
  - notes
- Clearly separated implemented current behavior from proposed Route A placeholders.
- Captured the current design decisions:
  - local ISO should include numeric offset
  - `Z` is UTC-only
  - `12hr` remains compact with no `:` separators
  - `24hr` remains the default style

## Why

The Route A plan explicitly calls for a dedicated matrix-oriented guide. Drafting that guide early reduces ambiguity in later help-text and README work and gives the remaining doc tasks a concrete source of truth.

## Verification

- Reviewed the new guide for consistency with:
  - `docs/plans/archive/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`
  - `docs/researches/archive/research-2026-03-01-rename-timestamp-format-and-template-ux.md`

## Related Plans

- `docs/plans/archive/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Related Research

- `docs/researches/archive/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
