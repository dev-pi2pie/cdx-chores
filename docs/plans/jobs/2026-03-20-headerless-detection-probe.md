---
title: "Probe headerless detection edge cases"
created-date: 2026-03-20
modified-date: 2026-03-20
status: completed
agent: codex
---

Added tracked CSV probe fixtures under `examples/playground/data-query-probe/` to inspect the current `data query` and shared query/extract headerless-detection boundary for delimited inputs.

What was added:

- `examples/playground/data-query-probe/auto-headerless.csv`
- `examples/playground/data-query-probe/literal-column-underscore.csv`
- `examples/playground/data-query-probe/mixed-column-underscore.csv`
- `examples/playground/data-query-probe/literal-column-zero.csv`
- `examples/playground/data-query-probe/blank-header.csv`

Why:

- verify the exact current boundary between:
  - truly headerless CSV inputs
  - literal user headers that happen to resemble placeholder names
  - mixed headers where only some columns look placeholder-like
  - blank-header cells that surface generated-looking names without making the whole file headerless

Verification:

- `data query auto-headerless.csv` exposes `column_1`, `column_2`, `column_3`
- `data query literal-column-underscore.csv` preserves literal headers `column_1`, `column_2`, `status`
- `data query mixed-column-underscore.csv` preserves mixed headers `id`, `column_2`, `status`
- `data query literal-column-zero.csv` preserves literal headers `column0`, `column1`
- `data query blank-header.csv` preserves the headered path rather than treating the file as fully headerless
