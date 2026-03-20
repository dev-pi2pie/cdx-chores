---
title: "Headerless data extract playground example"
created-date: 2026-03-20
status: completed
agent: codex
---

Added a public headerless CSV example under the extract playground and aligned the extract fixture generator with it.

What changed:

- added `examples/playground/data-extract/no-head.csv`
- updated `scripts/generate-data-extract-fixtures.mjs` to generate the same `no-head.csv` fixture
- updated the extract fixture generator test to expect the new representative file

Why:

- a public stable example belongs under the extract playground where the data shaping examples live
- generator parity keeps the checked-in playground set aligned with the documented/manual smoke assets

Verification:

- `bun test test/data-extract-fixture-generator.test.ts`
