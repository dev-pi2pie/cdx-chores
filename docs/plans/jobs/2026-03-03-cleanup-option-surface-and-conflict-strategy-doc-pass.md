---
title: "Cleanup option surface and conflict strategy doc pass"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Clarify the current `rename cleanup` contract in docs before adding a new conflict-handling feature.

## What Changed

- added a focused research note separating cleanup hint selection, text styling, timestamp handling, and future conflict policy
- revised the active interactive cleanup plan to add a dedicated conflict-strategy contract track
- updated user-facing cleanup docs to state that `--style` formats surviving text only
- documented current directory cleanup conflict behavior as strict skip with reason `target conflict`
- kept Codex-assisted cleanup explicitly deferred and separate from the conflict-handling track

## Files

- `docs/researches/research-2026-03-03-rename-cleanup-option-surface-and-conflict-strategy.md`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`
- `README.md`
- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
