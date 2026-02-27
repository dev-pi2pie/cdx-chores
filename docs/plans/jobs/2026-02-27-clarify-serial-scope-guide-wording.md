---
title: "Clarify serial scope guide wording"
created-date: 2026-02-27
status: completed
agent: codex
---

Clarified the rename guide wording for serial scope behavior.

Why:
- The previous phrasing mentioned per-directory reset but did not state the default behavior clearly.
- Users could reasonably read it without realizing that serial numbering is global by default.

What changed:
- Updated `docs/guides/rename-scope-and-codex-capability-guide.md` to state that the default serial scope is one global sequence across all matched files.
- Added explicit wording that `--serial-scope directory` works with `--recursive` to restart numbering in each directory.
