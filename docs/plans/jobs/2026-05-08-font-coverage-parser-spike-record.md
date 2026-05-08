---
title: "Font coverage-provider follow-up record"
created-date: 2026-05-08
status: draft
agent: codex
---

## Goal

Record the evidence target for the coverage-provider spike that should happen before a full `font check` implementation plan is drafted.

## Scope

This record is a follow-up target, not a completed coverage-provider evaluation. The `font inspect` implementation remains discovery-only and does not add coverage logic.

The spike should answer:

- whether optional `fontconfig` support can reliably check selected font-file charset coverage through `fc-query`
- how to handle missing `fc-query`, failed queries, and missing charset output as `inconclusive`
- whether TTC face-level inspection is usable or should remain `inconclusive` with `unsupported-ttc-collection`
- what mocked `fc-query` output and controlled coverage inventories should back deterministic tests
- whether the initial JSON reason-code set is sufficient

## Recommended Spike Contract

- Keep provider-specific process output and errors behind an internal `CoverageProvider` interface.
- Use `fc-query` against the selected font file path as the first real-file coverage candidate.
- Do not use `fc-match` fallback matching as coverage proof.
- Do not make TTC support a blocker for the first `font check` slice.
- Keep missing glyphs in `missingCodepoints`; do not model them as reason codes.
- Defer `--strict` until automation needs inconclusive checks to map to failure.

## Initial Reason Codes

- `no-inspectable-font-file`
- `fontconfig-unavailable`
- `fontconfig-query-failed`
- `fontconfig-charset-unavailable`
- `unsupported-font-format`
- `unsupported-ttc-collection`
- `ambiguous-family`
- `empty-required-codepoints`

## Related Plan

- [Font inspect implementation and coverage-provider follow-up](../plan-2026-05-08-font-inspect-and-coverage-parser-spike.md)

## Related Research

- [Font Inspect and Check Commands](../../researches/research-2026-05-07-font-inspect-and-check-commands.md)
