---
title: "Font Inspect and Check Commands"
created-date: 2026-05-07
modified-date: 2026-05-08
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
- keep `--family` as the only first-slice selector
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

Do not add `--full-name` in the first slice. It would behave like a stricter selector, but the more useful first command is a fuzzy family-oriented view that shows the discovered full names back to the user. Add a stricter selector later only if ambiguous family matches become painful in real usage.

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
- read `--text-file` as raw UTF-8 text only
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

`font check` should report failure when required coverage is missing. Missing required coverage should exit `1` in both text and JSON modes. Text output can stay concise and summary-oriented, while JSON output carries the structured details.

Recommended exit behavior:

| Result | Exit code | Meaning |
| --- | ---: | --- |
| `pass` | `0` | coverage was checked and all required codepoints were present |
| `fail` | `1` | coverage was checked and required codepoints were missing |
| usage error | `2` | invalid arguments, missing `--family`, missing text source, or conflicting text sources |
| `inconclusive` | `3` | the command could not check coverage reliably |

`inconclusive` is distinct from `fail`. A discovered family with no usable path, an unsupported font format, or unsupported TTC collection behavior should not be reported as a missing-glyph failure.

Text files should be treated as raw text, not parsed documents. The first slice should support plain UTF-8 content from `--text-file`; `.txt` and `.md` are acceptable examples because both can be read as raw text, but Markdown syntax should not be interpreted. Strip a UTF-8 BOM if present and ignore non-rendered control characters when computing required codepoints.

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

`font check` should fail only when all of these are true:

- a matching inspectable font file was found
- required codepoints were extracted from the sample
- the inspected font file lacks one or more required codepoints

Everything else is `pass`, `inconclusive`, or a usage error.

When a family resolves to multiple faces, the first public slice should select the best normal face for checking, typically regular, normal style, weight `400`. The command should report the checked face and path. Do not silently aggregate regular, bold, and italic faces into one synthetic family coverage result unless a later command explicitly labels that mode.

## Parser Checkpoint

`font check` should not start until the coverage parser strategy is chosen and proven with a small spike.

Recommended strategy: use a hybrid coverage provider.

```text
CoverageProvider
  -> parser-backed coverage for real font files
  -> controlled fixture coverage for deterministic tests
```

The first parser candidate should be a Node-compatible font parser that can inspect common TTF and OTF files. `fontkit` is the first candidate to investigate, but the command contract should not depend on direct `fontkit` APIs. Keep the parser behind a small internal interface so another parser can replace it if runtime compatibility, TTC handling, or package health becomes a problem.

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

Use the hybrid path for the first implementation plan. Parser-backed checks make the command useful with real font files; controlled inventories keep tests deterministic and avoid CI dependence on locally installed fonts.

`font check` should document limitations clearly if TTC collections, variable fonts, or color emoji fonts are not fully covered in the first slice.

TTC collections need special handling. If the first parser cannot inspect the selected face inside a TTC collection, do not fake coverage and do not report a missing-glyph failure. Return `inconclusive` with a clear reason:

```text
Result: inconclusive
Reason: matched font is a TTC collection, but this build cannot inspect individual collection faces yet.
Path: /path/to/fonts/SystemFont.ttc
```

JSON should use a stable reason code:

```json
{
  "result": "inconclusive",
  "reason": "unsupported-ttc-collection",
  "path": "/path/to/fonts/SystemFont.ttc"
}
```

If the parser can inspect TTC collections reliably, `font inspect` should expose enough face metadata for `font check` to select the intended normal face. Do not add `--face-index` in the first slice unless TTC support proves impossible without it.

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
  "exitCode": 1,
  "checkedFace": "JetBrainsMono Nerd Font Regular",
  "path": "/path/to/fonts/JetBrainsMonoNerdFont-Regular.ttf",
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
- one TTC collection fixture or mocked TTC discovery result that returns `inconclusive`
- one UTF-8 text-file fixture, including BOM handling if easy to isolate

Suggested test cases:

- `font inspect` groups multiple faces under one family.
- `font inspect --json` returns structured face metadata.
- `font inspect --debug` reuses sanitized discovery attempts.
- `font inspect` no-match output is empty but not a coverage failure.
- `font check` rejects missing `--family`.
- `font check` rejects missing text source.
- `font check` rejects simultaneous `--text` and `--text-file`.
- `font check` reports missing CJK codepoints.
- `font check --require nerd` reports missing private-use glyphs.
- `font check` handles a discovered face with no usable path as an inconclusive check, not a false pass.
- `font check` reports unsupported TTC inspection as `inconclusive`.
- `font check` exits `1` for missing coverage in text and JSON modes.
- `font check` exits `3` for inconclusive coverage.
- `font check --text-file` reads raw UTF-8 text without parsing Markdown.
- `font check --json` is deterministic across platforms with mocked coverage inventory.

## Resolved Decisions

1. Use a hybrid coverage strategy: parser-backed checks for real font files, controlled fixture coverage for deterministic tests.
2. Investigate a Node-compatible parser such as `fontkit` first, but wrap it behind an internal coverage provider interface.
3. Keep `font inspect` to `--family` in the first slice; do not add `--full-name` yet.
4. Missing required coverage exits `1` in both text and JSON modes.
5. Keep text mode concise and summary-oriented; use JSON for full structured details.
6. Support `--text` and `--text-file` only in the first slice.
7. Treat `--text-file` as raw UTF-8 text, not a parsed Markdown/HTML/document input.
8. Return `inconclusive` for unsupported TTC collection inspection instead of a false failure.
9. Use exit code `3` for `inconclusive` in the first slice.
10. Do not add `--face-index` unless the parser spike proves TTC selection needs it immediately.

## Remaining Checkpoints

1. Prove parser viability with TTF and OTF files before implementing `font check`.
2. Decide whether the selected parser can inspect TTC collections reliably enough for the first `font check` slice.
3. Decide in a later slice whether a separate `--strict` mode should map inconclusive checks to exit `1`. The first slice should keep plain inconclusive checks at exit `3`.

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
