---
title: "Fix data stack review follow-up findings"
created-date: 2026-04-26
status: completed
agent: codex
---

## Goal

Address the branch review findings for data stack dry-run/Codex artifacts and duplicate-key diagnostics.

## What Changed

- rejected direct dry-run requests where `--plan-output` and `--codex-report-output` resolve to the same path
- added regression coverage that the same-path Codex report request fails before writing the stack plan
- replaced delimiter-joined duplicate diagnostic keys with structural tuple encoding
- added regression coverage for distinct composite keys that contain the old delimiter character

## Why

- a same-path dry-run and Codex report request with `--overwrite` could replace the replayable stack-plan JSON with an advisory report
- delimiter-joined composite keys could report false duplicate conflicts when input values contained the delimiter character

## Verification

- `bun test test/data-stack-diagnostics.test.ts test/cli-actions-data-stack.test.ts`
- `bun test test/cli-command-data-stack.test.ts test/data-stack-diagnostics.test.ts test/cli-actions-data-stack.test.ts`
- `bun run lint`
- `bun run format:check`
- `bun run build`

Result: passed. The broader data-stack suite covered 87 command, action, and diagnostics tests after the focused regression pass.

## Related Plan

- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
