---
title: "Align core data guides for v0.0.9"
created-date: 2026-03-20
status: completed
agent: codex
---

Updated the core data-command guides so their wording reflects the shipped `v0.0.9` product split more directly.

What changed:

- clarified in `docs/guides/data-query-usage.md` that direct `data query` owns SQL execution plus accepted source-shape replay, while reviewed source-shape generation still starts on `data extract`
- clarified in `docs/guides/data-extract-usage.md` that `data extract` is both the shaped-table materialization lane and the reviewed source-shape producer in the current direct-CLI split
- clarified in `docs/guides/data-source-shape-usage.md` that `data extract` produces reviewed shape artifacts, `data query` replays them, and `data query codex` still stays on explicit shape flags
- clarified in `docs/guides/data-schema-and-mapping-usage.md` that header mappings remain a separate semantic-renaming layer rather than a source-shape artifact
- clarified in `docs/guides/data-query-codex-usage.md` and `docs/guides/data-query-interactive-usage.md` that persisted reviewed artifact generation still belongs to the direct CLI reviewed flows
- updated headerless query/extract examples to use the tracked probe fixture `examples/playground/data-query-probe/auto-headerless.csv`

Why:

- the shipped `v0.0.9` data-command surface is broader than the earlier `v0.0.8` framing
- the guides were mostly accurate already, but several boundaries were still implied rather than stated directly
- a release-alignment pass is a good time to make the product split easier to read without changing command behavior

Verification:

- reviewed the current CLI help for `data query`, `data extract`, `data query codex`, and `data preview`
- confirmed the tracked probe example `examples/playground/data-query-probe/auto-headerless.csv` exists
