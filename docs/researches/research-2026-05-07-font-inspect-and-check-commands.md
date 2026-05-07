---
title: "Font Inspect and Check Commands"
created-date: 2026-05-07
status: draft
agent: codex
---

## Goal

Define the checkpoint for adding `font inspect` and `font check` after the completed `font list` discovery slice, but before any Codex Helper workflow tries to suggest or repair Markdown-to-PDF profile fonts.

This research is a command-contract checkpoint. It should prevent the next implementation from mixing three separate jobs:

- discovering installed font candidates
- inspecting discovered font metadata
- checking glyph coverage for specific text or special symbol requirements

## Current State

The completed font command slice exposes candidate discovery through:

```bash
cdx-chores font list
cdx-chores font list --family "Noto Sans CJK TC"
cdx-chores font list --discovery native
cdx-chores font list --json --debug
```

`fonts` is accepted as an alias, but public docs prefer the singular `font` command group.

The current command can answer:

- which candidate font faces were discovered
- which discovery mode was requested
- which adapter was selected
- which adapters were attempted when `--debug` is used

It cannot yet answer:

- which discovered faces belong to one family in a structured detail view
- which font file should be inspected for coverage
- whether a selected font can render a given text sample
- whether Nerd Font private-use glyphs are present

## Timing Recommendation

`font inspect` and `font check` should be implemented before Codex Helper font assistance.

Codex Helper should consume stable CLI/module behavior. It should not be the first place where font inspection, glyph coverage, or Nerd Font detection is designed.

Recommended order:

1. Implement `font inspect` after discovery output and adapter controls are stable.
2. Implement `font check` after the coverage module has deterministic fixtures and a selected parser or controlled coverage strategy.
3. Let Codex Helper orchestrate `font list`, `font inspect`, and `font check` later.

## Command Split

### `font inspect`

`font inspect` should explain what the tool knows about a selected family or face. It should not claim glyph coverage.

Suggested command:

```bash
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font inspect --family "Noto Sans CJK TC" --json
cdx-chores font inspect --family "Noto Sans CJK TC" --discovery native --debug
```

Suggested responsibilities:

- reuse `font list` discovery modes: `auto`, `native`, and `fontconfig`
- find exact and normalized family-name matches
- group discovered faces by family
- show full name, style, weight, source, format, and path when available
- show selected discovery mode, selected adapter, and warnings
- support JSON output for automation
- support `--debug` with the same sanitized-attempt pattern as `font list`

Suggested text output shape:

```text
cdx-chores font inspect
Family: Noto Sans CJK TC
Discovery: auto
Adapter: macos-fontconfig

Faces:
- Noto Sans CJK TC Regular
  style: normal
  weight: 400
  source: system
  format: otf
  path: /path/to/fonts/NotoSansCJKtc-Regular.otf

Coverage: not checked. Use font check with --text when coverage support is available.
```

`font inspect` should return no matches as a normal empty result, not as proof that the font is missing from every renderer. Discovery adapters can miss disabled fonts, app-bundled fonts, or fonts available only through CSS `@font-face`.

### `font check`

`font check` should answer whether a selected family or font face appears to cover a specific sample.

Suggested command:

```bash
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
cdx-chores font check --family "JetBrainsMono Nerd Font" --text "git  main " --require nerd
cdx-chores font check --family "Noto Sans Arabic" --text "مرحبا" --lang ar
cdx-chores font check --family "Noto Sans CJK JP" --text-file ./samples/japanese.txt --json
```

Suggested responsibilities:

- require an explicit `--family` in the first public slice
- accept exactly one text source: `--text` or `--text-file`
- resolve the family through the same discovery modes as `font list`
- inspect candidate font files when paths are available
- report missing codepoints in a deterministic format
- treat `--lang` as a validation hint, not automatic language detection
- support `--require nerd` for private-use coding glyph samples
- support JSON output for automation and profile-helper use

Suggested text output shape:

```text
cdx-chores font check
Family: JetBrainsMono Nerd Font
Text: git  main 
Requirement: nerd

Result: fail
Missing codepoints:
- U+E0A0
- U+F418
```

`font check` should report failure when required coverage is missing. A later implementation plan should decide whether that failure always maps to process exit code `1` in both text and JSON modes.

## Coverage Boundary

The implementation must keep discovery and coverage separate.

Discovery can produce candidate faces:

```text
family -> full name -> style/weight -> path/source
```

Coverage needs a stronger input:

```text
font file or controlled coverage inventory -> sample text -> missing codepoints
```

Family names alone are not enough. A family can have multiple files, styles, weights, region-specific CJK variants, or app-specific font availability.

## Parser Checkpoint

`font check` should not start until the coverage parser strategy is chosen.

Minimum parser requirements:

- Node.js runtime compatibility
- TTF, OTF, and TTC awareness, or an explicit TTC limitation
- codepoint-to-glyph coverage checks
- stable behavior on macOS, Linux, and Windows fixtures
- no CI dependency on the developer machine's installed fonts
- graceful reporting when a discovered face has no usable path

Acceptable first implementation paths:

| Path | Use when |
| --- | --- |
| bundled parser library | it supports the needed font formats without raising the Node.js runtime floor unexpectedly |
| controlled fixture inventory | parser choice is still unsettled, but profile tests need deterministic coverage behavior |
| hybrid path | real parser for direct file checks, controlled inventory for cross-platform command tests |

`font check` should document limitations clearly if TTC collections, variable fonts, or color emoji fonts are not fully covered in the first slice.

## JSON Contract Direction

`font inspect --json` should return discovered metadata:

```json
{
  "command": "font inspect",
  "family": "Noto Sans CJK TC",
  "discovery": "auto",
  "adapter": "macos-fontconfig",
  "matches": [
    {
      "family": "Noto Sans CJK TC",
      "fullName": "Noto Sans CJK TC Regular",
      "style": "normal",
      "weight": 400,
      "format": "otf",
      "source": "system",
      "path": "/path/to/fonts/NotoSansCJKtc-Regular.otf"
    }
  ],
  "warnings": []
}
```

`font check --json` should return coverage results:

```json
{
  "command": "font check",
  "family": "JetBrainsMono Nerd Font",
  "text": "git \uE0A0 main \uF418",
  "requirements": ["nerd"],
  "result": "fail",
  "missingCodepoints": ["U+E0A0", "U+F418"],
  "warnings": []
}
```

Debug details should follow the completed `font list --debug` pattern and appear only when `--debug` is passed.

## Markdown-to-PDF Implications

The Markdown-to-PDF profile renderer can continue using internal coverage helpers for warnings:

```text
Warning: selected body font may not cover zh-Hant text in this document.
Warning: selected code font does not appear to support Nerd Font glyphs: U+E0A0, U+F418.
```

Once `font inspect` and `font check` exist, those warnings can point users to concrete follow-up commands:

```bash
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
```

Codex Helper can later use the same commands to explain why a profile warning happened and suggest profile edits. That should be orchestration, not separate font logic.

## Fixture Direction

Tests should avoid depending on real installed fonts.

Suggested fixtures:

- one Latin family with regular, italic, and bold faces
- one CJK family with separate `zh-Hant`, `zh-Hans`, `ja`, and `ko` coverage samples
- one Latin-extended sample
- one RTL smoke sample
- one code font without Nerd Font glyphs
- one code font with Nerd Font private-use glyph coverage
- one discovered face with no usable file path
- one ambiguous family with multiple candidate faces

Suggested test cases:

- `font inspect` groups multiple faces under one family.
- `font inspect --json` returns structured face metadata.
- `font inspect --debug` reuses sanitized discovery attempts.
- `font inspect` no-match output is empty but not a coverage failure.
- `font check` rejects missing `--family`.
- `font check` rejects simultaneous `--text` and `--text-file`.
- `font check` reports missing CJK codepoints.
- `font check --require nerd` reports missing private-use glyphs.
- `font check` handles a discovered face with no usable path as an inconclusive check, not a false pass.
- `font check --json` is deterministic across platforms with mocked coverage inventory.

## Open Questions

1. Which parser or coverage strategy should be selected before `font check` implementation?
2. Should `font inspect` allow `--full-name` in the first slice, or only `--family`?
3. Should `font check` use exit code `1` for missing required coverage in all text and JSON modes?
4. Should `font check` accept stdin as a later text source, or keep the first slice to `--text` and `--text-file`?
5. How should TTC collection limitations be shown if the first parser cannot inspect every face inside a collection?

## Checkpoint Decision

The next implementation checkpoint should be:

```text
font inspect first
  -> parser/coverage strategy decision
  -> font check
  -> Codex Helper orchestration
```

Do not start Codex Helper font assistance until at least `font inspect` is available and `font check` has either landed or has a documented coverage limitation that Helper can explain honestly.

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md) - parent profile and mixed-language font research.
- [Font Command Discovery Options](research-2026-05-07-font-command-discovery-options.md) - completed `font list` discovery selector and debug-output research.

## Related Plan

- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](../plans/plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md) - completed implementation plan for profiles, initial font discovery, diagnostics, and docs.
