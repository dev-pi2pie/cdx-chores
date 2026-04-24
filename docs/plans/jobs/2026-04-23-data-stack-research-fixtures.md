---
title: "Add data stack research fixtures and generator"
created-date: 2026-04-23
status: completed
agent: codex
---

Prepared a reproducible public playground fixture set for the new `data stack` research slice and aligned the research examples with the committed path.

What changed:

- introduced `examples/playground/stack-cases/` as the public playground root for the new data stack research examples
- added `scripts/generate-data-stack-fixtures.mjs` with `seed`, `clean`, and `reset` commands plus `--output-dir`
- defined focused subfolders under `examples/playground/stack-cases/` for:
  - matching-header CSV inputs
  - matching-header TSV inputs
  - headerless CSV inputs
  - headerless TSV inputs
  - header-mismatch CSV inputs
  - basic JSONL inputs
  - recursive-depth CSV inputs
- widened `examples/playground/.gitignore` so the new public fixture tree is intentionally tracked
- added `test/data-stack-fixture-generator.test.ts` to keep the generator deterministic

Why:

- the research doc needed a stable public playground path and clearer example folders than one ad hoc `stack-csv-case` directory
- future implementation and docs work will need reproducible stack-focused inputs without inventing local-only scratch layouts
- the fixture tree should expose both likely-success and likely-failure cases without relying on large or private artifacts

Verification:

- `bun test test/data-stack-fixture-generator.test.ts`
- `node scripts/generate-data-stack-fixtures.mjs reset --output-dir examples/playground/.tmp-tests/data-stack-fixture-check`
