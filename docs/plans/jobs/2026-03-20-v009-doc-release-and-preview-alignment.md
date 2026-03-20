---
title: "Align v0.0.9 release wording and headerless preview example"
created-date: 2026-03-20
status: completed
agent: codex
---

Updated the user-facing docs to match the current `v0.0.9` stable scope and removed one broken headerless preview example path.

What changed:

- updated `README.md` so the stable release framing now refers to `v0.0.9`
- refreshed the top-level stable-scope bullets to reflect the current shipped data-command surface
- replaced the non-existent `examples/playground/tabular-preview/headerless.csv` preview example with the tracked probe fixture `examples/playground/data-query-probe/auto-headerless.csv`

Why:

- `package.json` already reports version `0.0.9`
- the old README framing still described `v0.0.8`
- the preview guide included a copy-paste example path that is not shipped in the repository

Verification:

- confirmed `package.json` version is `0.0.9`
- confirmed `examples/playground/data-query-probe/auto-headerless.csv` exists
