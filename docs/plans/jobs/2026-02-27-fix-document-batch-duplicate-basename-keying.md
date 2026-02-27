---
title: "Fix document batch duplicate basename keying"
created-date: 2026-02-27
status: completed
agent: codex
---

Adjusted the document Codex rename prompt to use a unique per-item filename key derived from the path relative to the working directory, while preserving the original basename as separate evidence context.

Why:
- Recursive batches can contain multiple files with the same basename.
- The previous prompt and response mapping keyed suggestions by basename only, which made collisions possible and could assign the wrong title to one or more files.

Verification:
- Added a regression test covering duplicate `report.md` files in separate directories and asserting the prompt uses distinct filename keys.
