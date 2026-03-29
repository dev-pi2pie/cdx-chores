---
title: "Complete rename uid research status and guide follow-up"
created-date: 2026-03-04
status: completed
agent: codex
---

## Goal

Close the remaining documentation follow-up after `{uid}` pattern support landed by:

- updating the older rename pattern/router research note from open draft status
- adding an advanced guide example that shows cleanup-first conflict handling followed by a targeted UID-marking rename

## Scope

- `docs/researches/archive/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
- `docs/guides/rename-common-usage.md`

## What Changed

- Marked the rename pattern/router research note as `completed`.
- Added a short outcome section to that research note so readers can see which parts have now landed.
- Added an advanced example to the common rename usage guide:
  - `rename cleanup ... --conflict-strategy uid-suffix`
  - followed by targeted `rename file ... --pattern "{stem}-{uid}"`
- Explicitly documented that the second step should stay on `rename file`, not `rename batch`, unless the user wants to rename the whole cleaned set again.

## Notes

- This pass was documentation-only.
- The user had already reported a green `bun test` run after the `{uid}` implementation work.

## Related Plans

- `docs/plans/archive/plan-2026-03-04-rename-uid-pattern-placeholder.md`

## Related Research

- `docs/researches/archive/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
