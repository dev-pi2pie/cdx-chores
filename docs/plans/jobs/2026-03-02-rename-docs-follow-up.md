---
title: "Rename docs follow-up after modularization"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Refresh living documentation after the rename action modularization so current guides point at the folder-based `src/cli/actions/rename/` layout instead of the removed flat `src/cli/actions/rename.ts` file.

## Scope

- `docs/guides/cli-action-tool-integration-guide.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Implemented

- Updated the CLI action integration guide to describe folder-based action modules as the preferred path once a feature grows beyond a single flat file.
- Updated rename-specific guidance to reference `src/cli/actions/rename/` and its current child-module boundaries instead of the removed `src/cli/actions/rename.ts`.
- Updated the rename scope/capability guide reference section to point at the current rename module files.
- Updated the active modularization plan structural check so it validates the actual end state: the old hotspot was replaced by the `rename/` module folder.

## Notes

- Historical research and older implementation/job records were left unchanged when they were accurately describing the codebase state at the time they were written.
- This follow-up was limited to living guidance and the active plan.

## Related Plans

- `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Related Research

- `docs/researches/research-2026-03-02-test-suite-audit.md`
