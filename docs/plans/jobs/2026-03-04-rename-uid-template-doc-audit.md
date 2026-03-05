---
title: "Rename uid template doc audit"
created-date: 2026-03-04
status: completed
agent: codex
---

## Goal

Review the rename documentation set before the larger refactor and align the docs around one point:

- `rename cleanup` already introduced deterministic `uid-<token>` semantics
- `rename file` / `rename batch` still reject `{uid}` in `--pattern`
- docs should describe that as a current gap to close, not as a preferred permanent boundary

## Scope

- `README.md`
- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## What Changed

- Updated the draft rename pattern/router research note so the intended pattern direction now includes `{uid}`.
- Clarified in `README.md` that `{uid}` exclusion is a current template-system gap, not a desired long-term product rule.
- Updated both rename guides to carry the same framing and to connect general rename templates with cleanup’s existing `uid-<token>` family.
- Added a historical follow-up note to the completed interactive rename/template plan so the older “not yet” wording remains time-accurate without reading like the final design target.

## Notes

- No runtime behavior changed in this pass.
- The current CLI still rejects `{uid}` in `rename file` / `rename batch` template validation.
- This audit was limited to documentation alignment ahead of the upcoming template refactor.

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Related Research

- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
