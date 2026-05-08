---
title: "Font check command phases 1-7"
created-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Record the completed `font check` command implementation and the final doctor/docs closeout from the font check command plan.

## Completed Work

- Added `cdx-chores font check --family <name>` with `--text`, `--text-file`, `--require nerd`, `--json`, `--debug`, and `--discovery auto|native|fontconfig`.
- Kept text source handling strict: exactly one source is required, text files are raw UTF-8, a leading BOM is stripped, and invalid input exits as a usage error.
- Reused font discovery and deterministic family/face selection before checking coverage.
- Wired `font check` through the internal fontconfig coverage provider using `fc-query` against the selected font file.
- Preserved inconclusive results for unavailable fontconfig, unsupported formats, missing paths, ambiguous families, empty required codepoints, and path-only TTC checks.
- Added provider-backed indexed TTC checks with metadata verification before trusting `fc-query --index` charset coverage.
- Fixed localized comma-separated TTC metadata matching so faces such as PingFang TC do not become false `ttc-face-mismatch` results when fontconfig reports localized aliases.
- Added root `doctor` font support reporting for optional `fc-list` discovery and `fc-query` coverage capability.
- Updated the Markdown PDF usage guide and related font research with the completed command surface and limitations.

## Verification

- Passed `bun test test/cli-actions-doctor-markdown-video-deferred.test.ts` with 19 tests and 147 assertions.
- Passed `bun test test/fonts.test.ts` with 73 tests and 422 assertions.
- Passed `bun test` with 1023 tests and 4645 assertions.
- Passed `bun run lint`.
- Passed `bun run format:check`.
- Passed `bun run build`.
- Passed `git diff --check`.
- Verified `node dist/esm/bin.mjs font check --family "PingFang TC" --text 繁體中文` returns `Result: pass`.
- Verified `node dist/esm/bin.mjs doctor --json` includes `font.discovery.fontconfig`, `font.coverage.fontconfig`, and matching top-level capability keys.

`bun run build` completed with the existing `INEFFECTIVE_DYNAMIC_IMPORT` warning for `src/cli/prompts/path.ts`.

## Reviewer Notes

- Prism the 2nd reviewed the Phase 5 TTC code slice with no material maintainability concerns.
- Telescope the 2nd reviewed the Phase 5 TTC tests after requested gaps were addressed, with no material test coverage concerns.
- Compass the 2nd reviewed the Phase 5 docs after stale wording was addressed, with no material docs concerns.
- Prism the 2nd reviewed the Phase 6-7 doctor code with no material maintainability concerns.
- Telescope the 2nd requested stronger deterministic doctor assertions; the follow-up added injected dependency-runner tests for fontconfig JSON and text output.
- Compass the 2nd flagged stale completed-state research wording; the follow-up updated the research to distinguish implemented coverage evidence from renderer guarantees.
- Follow-up reviews from Telescope the 2nd and Compass the 2nd reported no material remaining test or docs findings.

## Related Plan

- [Font Check Command Implementation](../plan-2026-05-08-font-check-command-implementation.md)

## Related Research

- [Font Inspect and Check Commands](../../researches/research-2026-05-07-font-inspect-and-check-commands.md)

## Related Guide

- [Markdown PDF Usage](../../guides/markdown-pdf-usage.md)
