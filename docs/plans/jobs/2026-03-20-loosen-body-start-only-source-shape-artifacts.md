---
title: "Loosen body-start-only source shape artifacts"
created-date: 2026-03-20
modified-date: 2026-03-20
status: completed
agent: Codex
---

## Summary

Aligned the reviewed source-shape contract with the runtime shaping model so persisted Excel shapes may contain only `bodyStartRow` when that is the only deterministic source change. Clarified that source-shape replay and semantic header review are separate stages.

## What Changed

- Restored body-start-only source-shape artifact acceptance during create/read validation.
- Removed the reviewed `data extract --codex-suggest-shape` rejection for `body_start_row`-only suggestions.
- Updated source-shape follow-up guidance to distinguish source replay from downstream semantic header review and to point to `--codex-suggest-headers` when needed.
- Expanded regression coverage for body-start-only source-shape suggestion, artifact reuse, and direct CLI guidance.

## Verification

- `bun test test/data-source-shape.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts`
