---
title: "Apply reviewed dependency bumps"
created-date: 2026-04-11
status: completed
agent: Codex
---

## Goal

Apply the currently reviewed outdated dependency bumps in the working tree after a disposable temp-copy validation pass.

## Scope

- update `package.json`
- update `bun.lock`
- rerun repository verification on the real workspace

## Related Research

- `docs/researches/research-2026-04-01-dependency-upgrade-safety-check.md`

## Verification Plan

- `bun run lint`
- `bun run build`
- `bun test`

## Notes

- Upgraded:
  - `@inquirer/prompts` -> `8.4.1`
  - `@openai/codex-sdk` -> `0.119.0`
  - `fast-xml-parser` -> `5.5.11`
  - `@types/bun` -> `1.3.12`
  - `@types/node` -> `25.6.0`
  - `oxfmt` -> `0.44.0`
  - `oxlint` -> `1.59.0`
- Real-worktree verification passed:
  - `bun run lint`
  - `bun run build`
  - `bun test`
- `bun test` completed with `707` passing tests and `0` failures.
