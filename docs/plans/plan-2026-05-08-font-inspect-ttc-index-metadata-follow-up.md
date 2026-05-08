---
title: "Font inspect TTC index metadata follow-up"
created-date: 2026-05-08
status: draft
agent: codex
---

## Goal

Define the inspect-side metadata work needed before `font check` can safely support indexed TTC coverage checks.

TTC coverage needs a selected face index, not only a collection path. This follow-up owns the discovery and `font inspect` metadata surface that will let `font check` consume provider-backed TTC indexes without adding a manual `--face-index` option in the first indexed TTC slice.

## Scope

### In Scope

- Preserve a provider-backed TTC face index during font discovery when the discovery provider exposes one.
- Start with fontconfig discovery by parsing `%{index}` from `fc-list`.
- Store the index as optional metadata on discovered `FontFace` records.
- Show the index in `font inspect` text output when present.
- Include the index in `font inspect --json` output when present.
- Keep existing `font list` and `font inspect` behavior unchanged for TTF, OTF, and faces without an index.
- Add deterministic tests with mocked fontconfig discovery output.

### Out of Scope

- No public `--face-index` option.
- No indexed TTC coverage probing in this inspect-side follow-up.
- No parser-backed TTC implementation.
- No installed-font-dependent tests.

## Implementation Phases

### Phase 1: Discovery Metadata

- [ ] Add optional face-index metadata to the internal font face model.
- [ ] Parse `%{index}` from fontconfig discovery output.
- [ ] Preserve missing or unparseable indexes as absent metadata, not a usage error.
- [ ] Add parser tests for indexed TTC rows and non-indexed rows.

### Phase 2: Inspect Output

- [ ] Include face index in `font inspect` text details when present.
- [ ] Include face index in `font inspect --json` matches when present.
- [ ] Add inspect output tests for TTC faces with indexes.

### Phase 3: Handoff To Font Check

- [ ] Update the font check implementation plan once inspect metadata is available.
- [ ] Keep `font check` path-only TTC behavior inconclusive until indexed probing is implemented.
- [ ] Record validation evidence before marking this follow-up complete.

## Related Plans

- [Font check command implementation](plan-2026-05-08-font-check-command-implementation.md)
- [Font inspect implementation and coverage-provider follow-up](plan-2026-05-08-font-inspect-and-coverage-provider-follow-up.md)
