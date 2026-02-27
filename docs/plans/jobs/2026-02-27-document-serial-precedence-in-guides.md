---
title: "Document serial precedence in guides"
created-date: 2026-02-27
status: completed
agent: codex
---

Clarified rename guide behavior for serial placeholder precedence when `--pattern` and `--serial-*` flags are used together.

Why:
- The CLI now preserves embedded `{serial...}` values unless an explicit serial override flag is passed.
- The user-facing guides needed to describe that precedence directly to avoid ambiguity.

What changed:
- Updated `docs/guides/rename-common-usage.md` with serial precedence rules and examples.
- Updated `docs/guides/rename-scope-and-codex-capability-guide.md` with the same precedence contract in the pattern/template section.
