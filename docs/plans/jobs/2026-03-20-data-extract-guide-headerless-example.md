---
title: "Data extract guide headerless example"
created-date: 2026-03-20
status: completed
agent: codex
---

Updated the `data extract` guide to use the new public headerless CSV playground example for reviewed header-suggestion examples.

What changed:

- replaced the `data extract` header-review examples that pointed at `examples/playground/data-query/generic.csv`
- now the guide uses `examples/playground/data-extract/no-head.csv`
- updated the output example path to `no-head.clean.csv`

Why:

- the new `data-extract/no-head.csv` fixture is a better fit for extract-focused documentation
- it keeps the extract guide anchored to the extract playground set instead of borrowing the query fixture path

