---
title: "Font coverage-provider follow-up record"
created-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Record the evidence target for the coverage-provider spike that should happen before a full `font check` implementation plan is drafted.

## Scope

This record captures the completed coverage-provider spike. The `font inspect` implementation remains discovery-only and does not add the public `font check` command.

The spike answered:

- Optional `fontconfig` support can be modeled behind an internal `CoverageProvider` interface.
- The first provider should query a selected font file path with `fc-query --format=%{charset}\n`.
- Missing `fc-query`, failed queries, missing charset output, missing font paths, unsupported formats, and TTC collections should return `inconclusive` with stable reason codes.
- TTC face-level inspection remains unproven and should stay `inconclusive` with `unsupported-ttc-collection` in the first `font check` slice.
- Mocked `fc-query` output plus controlled coverage inventories are enough for deterministic command and provider tests.

## Recommended Spike Contract

- Keep provider-specific process output and errors behind an internal `CoverageProvider` interface.
- Use `fc-query` against the selected font file path as the first real-file coverage candidate.
- Do not use `fc-match` fallback matching as coverage proof.
- Do not make TTC support a blocker for the first `font check` slice.
- Keep missing glyphs in `missingCodepoints`; do not model them as reason codes.
- Defer `--strict` until automation needs inconclusive checks to map to failure.

## Implemented Spike Surface

- Added internal coverage-provider types in `src/fonts/types.ts`.
- Added `parseFontconfigCharset()`, `checkFontconfigCoverage()`, and `fontconfigCoverageProvider` in `src/fonts/coverage.ts`.
- Kept `font check` out of the CLI.
- Kept the provider runnable through an injected command runner so tests do not require installed fonts or a local `fontconfig` binary.

## Initial Reason Codes

- `no-inspectable-font-file`
- `fontconfig-unavailable`
- `fontconfig-query-failed`
- `fontconfig-charset-unavailable`
- `unsupported-font-format`
- `unsupported-ttc-collection`
- `ambiguous-family`
- `empty-required-codepoints`

## Verified Fixture Inventory

- mocked `fc-query --version` success and failure
- mocked selected-file charset output for pass and missing-codepoint checks
- mocked failed selected-file query
- mocked empty charset output
- selected face with no inspectable path
- selected TTC face returning `unsupported-ttc-collection` before command execution
- controlled sample coverage inventories for language and Nerd Font checks

## Verification

- `bun test test/fonts.test.ts` with 50 tests

## Related Plan

- [Font inspect implementation and coverage-provider follow-up](../plan-2026-05-08-font-inspect-and-coverage-provider-follow-up.md)
- [Font check command implementation](../plan-2026-05-08-font-check-command-implementation.md)

## Related Research

- [Font Inspect and Check Commands](../../researches/research-2026-05-07-font-inspect-and-check-commands.md)
