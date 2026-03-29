---
title: "Finalize Route A Phase 1 contract"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Finalize the Phase 1 contract decisions for the Route A rename timestamp-format plan before formatter and CLI implementation begins.

## What Changed

- Updated `docs/plans/archive/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`:
  - set plan status to `active`
  - renamed the placeholder section from candidate wording to final Route A wording
  - marked all Phase 1 checklist items complete
- Reconciled `docs/researches/archive/research-2026-03-01-rename-timestamp-format-and-template-ux.md` with the current decisions:
  - local ISO now explicitly includes numeric offset in the preferred Route A direction
  - Route A remains additive while preserving current behavior

## Finalized Phase 1 Decisions

- Route A ships these four new explicit placeholders:
  - `{timestamp_utc_iso}`
  - `{timestamp_local_iso}`
  - `{timestamp_local_12h}`
  - `{timestamp_utc_12h}`
- `{timestamp_local_iso}` uses numeric offset form such as `+0800`.
- `Z` remains UTC-only.
- 12-hour output remains compact and uses `AM` / `PM` without `:` separators.
- 24-hour output remains the default time style.
- `date` remains unchanged in this phase.
- Interactive UX should keep current behavior as the top/default path and keep the new formats opt-in.

## Why

Phase 2 implementation depends on the placeholder set and output contracts being stable. Closing Phase 1 first reduces ambiguity in formatter helpers, tests, CLI help text, and docs updates.

## Verification

- Reviewed for consistency across:
  - `docs/plans/archive/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`
  - `docs/researches/archive/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
  - `docs/guides/rename-timestamp-format-matrix.md`

## Related Plans

- `docs/plans/archive/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Related Research

- `docs/researches/archive/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
