---
title: "Font inspect implementation"
created-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Implement the `font inspect` slice from the font inspect implementation and coverage-provider follow-up plan.

## Completed Work

- Added `cdx-chores font inspect`.
- Added `--family`, `--json`, `--debug`, and `--discovery auto|native|fontconfig` support.
- Reused existing font discovery adapters, discovery-mode selection, warning output, and sanitized debug attempts.
- Kept `font inspect` discovery-only; output states that coverage was not checked.
- Added family-oriented matching with stable ordering and duplicate removal.
- Added no-match behavior as an empty discovery result with exit `0`.
- Updated the Markdown PDF usage guide with `font inspect` examples and kept `font check` documented as deferred until coverage-provider evidence exists.

## Verification

- Passed `bun test test/fonts.test.ts` with 40 tests.
- Passed `bun run lint`.
- Passed `bun run format:check`.
- Passed `bun run build`.
- Passed `git diff --check`.

`bun run build` completed with the existing dynamic-import warning around `src/cli/prompts/path.ts`.

## Related Plan

- [Font inspect implementation and coverage-provider follow-up](../plan-2026-05-08-font-inspect-and-coverage-parser-spike.md)

## Related Research

- [Font Inspect and Check Commands](../../researches/research-2026-05-07-font-inspect-and-check-commands.md)
- [Font Command Discovery Options](../../researches/research-2026-05-07-font-command-discovery-options.md)

## Related Guide

- [Markdown PDF Usage](../../guides/markdown-pdf-usage.md)
