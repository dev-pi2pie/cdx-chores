---
title: "Interactive path hints and path autocomplete UX research"
created-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Evaluate how far `cdx-chores` interactive mode should go beyond static path prompts, specifically:

- derived path hints (default output suggestions)
- richer path autocomplete behavior (Copilot/VS Code-like feel)
- hot-key behavior and terminal UX tradeoffs

## Notes

This research topic is not yet executed.

## Open Questions

- Which hot-key should accept a suggestion without submitting the form (`Tab`, Right Arrow, or another binding)?
- Should suggestions appear only after a minimum character count to reduce noise?
- Should hidden files be shown by default?
- Should directory suggestions be visually distinguished (for example, trailing `/`)?
- Do we want a fallback mode when running in terminals that do not support the chosen key-handling behavior cleanly?

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`
