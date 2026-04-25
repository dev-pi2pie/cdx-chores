---
title: "Implement data stack diagnostics, dry-run, and replay"
created-date: 2026-04-26
status: completed
agent: codex
---

## Goal

Implement Phases 2, 3, and 4 of the data stack replay and Codex assist plan.

## What Changed

- added deterministic stack diagnostics in `src/cli/data-stack/diagnostics.ts`:
  - exact duplicate-row counts from normalized output rows
  - duplicate-key conflict counts for selected `--unique-by` columns
  - null-key row tracking without treating null keys as duplicate conflicts
  - single-column and bounded two-column candidate unique keys
  - bounded column summaries for future Codex assist payloads, including samples, null counts, uniqueness counts, and enum-like value lists
- computed bounded advisory column summaries for future Codex assist payloads without adding them to the replay-critical stack-plan JSON
- added direct dry-run and duplicate controls:
  - `data stack --dry-run`
  - `--plan-output <path>`
  - `--unique-by <name[,name...]>`
  - `--on-duplicate preserve|report|reject`
  - dry-run writes a stack plan and does not write materialized output
  - direct non-dry-run `reject` fails before materialized output is written
- added replay execution:
  - `data stack replay <record>`
  - stack-plan JSON validation before execution
  - replay of accepted resolved sources and deterministic stack options
  - source fingerprint drift warnings
  - `--output <path>` override
  - missing-output-path failure
  - stored duplicate-policy enforcement
  - `--auto-clean` that removes only the stack-plan JSON after successful replay
- marked Phases 2, 3, and 4 complete in the implementation plan

## Verification

- `bun test test/data-stack-diagnostics.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts`
- `bun test test/data-stack-diagnostics.test.ts test/data-stack-plan.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts`
- `bun run lint`
- `bun run format:check`

Result: passed after review fixes. The final focused test pass ran 88 tests covering dry-run plan writing without stack output, duplicate controls, replay output override, replay auto-clean, replay self-overwrite refusal, replay fingerprint warnings, replay duplicate-policy enforcement, composite unique keys, and bounded diagnostics.

## Related Plan

- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
