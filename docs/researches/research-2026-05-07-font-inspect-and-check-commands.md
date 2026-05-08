---
title: "Font Inspect and Check Commands"
created-date: 2026-05-07
modified-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Record the research trail for adding `font inspect` and `font check` after the completed Markdown-to-PDF profile, font discovery, and diagnostics work.

The related implementation plan delivered `font list` as the first public discovery slice. This research narrows the remaining command surfaces so follow-up work can avoid mixing three separate jobs:

- discovering installed font candidates
- inspecting discovered font metadata
- checking glyph coverage for specific text or special symbol requirements

The related implementation plans now cover `font inspect`, the coverage-provider spike, and the public `font check` command. This research records the command contracts and the limits that should remain visible to future Codex Helper orchestration.

## Current State

The completed font command surface exposes candidate discovery, family inspection, and text-specific coverage checks through:

```bash
cdx-chores font list
cdx-chores font list --family "Noto Sans CJK TC"
cdx-chores font list --discovery native
cdx-chores font list --json --debug
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
```

`fonts` is accepted as an alias, but public docs prefer the singular `font` command group.

The current commands can answer:

- which candidate font faces were discovered
- which discovery mode was requested
- which adapter was selected
- which adapters were attempted when `--debug` is used
- which discovered family metadata is available for a selected family
- whether one selected discovered face advertises required codepoint coverage for specific text

They still cannot answer:

- whether a selected font will render a text sample correctly in every renderer
- whether shaping, fallback, emoji presentation, or PDF output will match a user's final document
- whether app-bundled or CSS `@font-face` fonts are available outside system discovery

## Key Findings

1. The completed Markdown-to-PDF plan established the discovery and coverage boundary, and the public font commands now cover discovery, inspection, and selected-file coverage checks.
2. `font inspect` builds directly on `font list` discovery output, adapter selection, and debug behavior without claiming glyph coverage.
3. `font check` has landed as an optional `fontconfig`-backed coverage slice with mocked `fc-query` fixtures and explicit inconclusive states.
4. Codex Helper should depend on the shared font commands or modules later. It should not introduce separate font inspection or coverage logic.

## Sequencing Recommendation

`font inspect` and `font check` should be designed as stable CLI/module surfaces before Codex Helper font assistance grows beyond orchestration.

Codex Helper should consume these commands later. It should not be the first place where font inspection, glyph coverage, or Nerd Font detection is designed, and it should not grow a parallel font-coverage implementation that can drift from the CLI.

Recommended order:

1. Implement `font inspect` after discovery output and adapter controls are stable.
2. Implement `font check` after the coverage module has deterministic fixtures and a selected coverage-provider strategy.
3. Let Codex Helper orchestrate `font list`, `font inspect`, and `font check` later.

## Command Direction

### `font inspect`

`font inspect` should explain what the tool knows about a selected family. It should not claim glyph coverage.

First-slice scope:

- selector: `--family` only
- output: discovered face metadata for matching families
- non-goal: coverage, required glyph checks, or coverage-provider proof

Suggested command:

```bash
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font inspect --family "Noto Sans CJK TC" --json
cdx-chores font inspect --family "Noto Sans CJK TC" --discovery native --debug
```

Recommended first-slice responsibilities:

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

`font inspect` should return no matches as a normal empty discovery result with exit `0`, not as proof that the font is missing from every renderer. Discovery adapters can miss disabled fonts, app-bundled fonts, or fonts available only through CSS `@font-face`.

Suggested no-match text output:

```text
cdx-chores font inspect
Family: Example Missing Family
Discovery: auto
Adapter: macos-fontconfig

Faces: 0
Coverage: not checked.
```

In JSON mode, no matches should use an empty `matches` array and preserve any discovery warnings:

```json
{
  "command": "font inspect",
  "family": "Example Missing Family",
  "discovery": "auto",
  "adapter": "macos-fontconfig",
  "matches": [],
  "warnings": []
}
```

Do not add `--full-name` in the first slice. It would behave like a stricter selector, but the more useful first command is a family-oriented view that shows the discovered full names back to the user. Add a stricter selector later only if ambiguous family matches become painful in real usage.

### `font check`

`font check` should answer whether a selected family appears to cover a specific sample. It should come after `font inspect` and after the coverage-provider strategy has proof behind it.

Provisional command shape:

```bash
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
cdx-chores font check --family "JetBrainsMono Nerd Font" --text "git  main " --require nerd
cdx-chores font check --family "Noto Sans Arabic" --text "مرحبا" --lang ar
cdx-chores font check --family "Noto Sans CJK JP" --text-file ./samples/japanese.txt --json
```

Tentative first-slice responsibilities:

- require an explicit `--family` in the first public slice
- accept exactly one text source: `--text` or `--text-file`
- read `--text-file` as raw UTF-8 text only, with no encoding detection or document extraction
- resolve the family through the same discovery modes as `font list`
- inspect candidate font files when paths are available
- report missing codepoints in a deterministic format
- treat `--lang` as a validation hint, not automatic language detection
- support `--require nerd` for private-use coding glyph samples
- support JSON output for automation and profile-helper use

Provisional text output shape:

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

Provisional exit behavior:

| Result | Exit code | Meaning |
| --- | ---: | --- |
| `pass` | `0` | coverage was checked and all required codepoints were present |
| `fail` | `1` | coverage was checked and required codepoints were missing |
| usage error | `2` | invalid arguments, missing `--family`, missing text source, or conflicting text sources |
| `inconclusive` | `3` | the command could not check coverage reliably |

`inconclusive` is distinct from `fail`. A discovered family with no usable path, an unsupported font format, or unsupported TTC collection behavior should not be reported as a missing-glyph failure.

Text files should be treated as raw text, not parsed documents. The first slice should support plain UTF-8 content from `--text-file`; `.txt` and `.md` are acceptable examples because both can be read as raw text, but Markdown syntax should not be interpreted. Strip a leading UTF-8 BOM if present. For required coverage, exclude Unicode control characters in category `Cc`, such as tabs and line breaks, because they are layout controls rather than required glyphs. Preserve all other decoded codepoints, including spaces, combining marks, variation selectors, and private-use characters. Invalid UTF-8 should be a usage error, not an inconclusive coverage result.

## Coverage Boundary

Future implementation must keep discovery and coverage separate.

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

All other outcomes must stay out of the false-failure path. They should be classified as `pass`, `inconclusive`, or usage errors according to the exit table above.

When a family resolves to multiple faces, `font check` selects one face deterministically instead of probing faces until one passes. Priority:

1. exact normalized family match before looser family matches
2. inspectable file path before no usable path
3. normal or regular style before italic, oblique, or other styles
4. weight closest to `400`, with the lower weight first on ties
5. stable lexical order by full name, then path

The command should report the checked face and path. If no inspectable face remains after family resolution, return `inconclusive` rather than a missing-glyph failure. Do not silently aggregate regular, bold, and italic faces into one synthetic family coverage result unless a later command explicitly labels that mode.

## Coverage Provider Research

The coverage-provider spike chose optional `fontconfig` support as the first real-file coverage path.

Recommended research direction: use a small internal coverage-provider interface.

```text
CoverageProvider
  -> optional fontconfig provider for real font files
  -> controlled fixture coverage for deterministic tests
```

A parser-backed provider is a fallback-only contingency if a later spike proves that optional fontconfig coverage is not enough for important use cases. It is not the primary first-slice recommendation.

The first real-file coverage candidate should be the system `fontconfig` CLI, specifically `fc-query` against the selected font file path. Do not use `fc-match` as proof of coverage: it can silently choose a fallback face and turn a missing glyph into a false pass. `font check` should first resolve a deterministic discovered face, then ask whether that concrete font file appears to contain the required codepoints.

TTC collections require an additional face-index proof. A `.ttc` path alone identifies the collection, not the selected face inside that collection. Fontconfig can expose an `%{index}` value during discovery and `fc-query` supports `--index <faceIndex>`. A TTC follow-up should preserve that discovered index as provider metadata, query the exact indexed face, and verify the indexed face metadata still matches the selected face before trusting charset coverage.

Proposed runtime flow:

1. Resolve the family through existing discovery.
2. Select one deterministic face and path from the resolved family.
3. Return `inconclusive` with reason code `no-inspectable-font-file` when no selected path is available.
4. Return `inconclusive` with reason code `fontconfig-unavailable` when `fc-query` is unavailable.
5. Return `inconclusive` with reason code `unsupported-ttc-collection` when the selected file is a TTC collection and indexed face-level inspection is not available.
6. For a TTC follow-up, require a discovered face index, query with `fc-query --index <faceIndex>`, and verify the indexed metadata matches the selected face before parsing charset coverage.
7. Run `fc-query` against the selected file path or indexed TTC face and parse its charset output.
8. Compare required sample codepoints against the parsed charset.
9. Exit `1` only when coverage was checked and required codepoints are missing.

Minimum provider requirements:

- Node.js runtime compatibility
- optional runtime dependency handling when `fc-query` is unavailable
- concrete font-file input, not fallback family matching
- codepoint-to-charset coverage checks
- stable behavior through mocked command-runner fixtures
- no CI dependency on the developer machine's installed fonts
- graceful reporting when a discovered face has no usable path

Acceptable implementation paths for `font check`:

| Path | Use when |
| --- | --- |
| optional fontconfig provider | `fc-query` can inspect a selected file path and expose charset coverage without adding a package dependency |
| controlled fixture inventory | command tests need deterministic coverage behavior without relying on locally installed fonts or tools |
| fallback parser provider | later evidence shows fontconfig coverage is insufficient, unavailable on important platforms, or too hard to make deterministic |

The first `font check` plan should carry the optional fontconfig path. `fc-query` makes the command useful with real font files when the user has fontconfig installed; mocked `fc-query` output and controlled inventories keep tests deterministic and avoid CI dependence on local font availability.

This direction has an important limitation: fontconfig charset coverage can show that a font advertises codepoint coverage, but it does not prove final rendering quality, shaping correctness, fallback behavior, emoji presentation, or PDF renderer behavior. `font check` should describe the result as coverage evidence, not as a guarantee that every renderer will draw the text correctly.

`font check` should document limitations clearly if TTC collections, variable fonts, or color emoji fonts are not fully covered in the first slice.

TTC collections need special handling. If the selected face resolves to a TTC collection and the provider cannot confidently inspect the intended face, do not fake coverage and do not report a missing-glyph failure. Return `inconclusive` with a clear reason:

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

The TTC support follow-up should prefer provider-supplied indexes over a public `--face-index` option. This is a cross-plan dependency: discovery must preserve the provider-backed index, `font inspect` must expose it for audit, and `font check` should consume it only after those metadata surfaces exist. The inspect-side ownership is captured in the [Font Inspect TTC Index Metadata Follow-up](../plans/plan-2026-05-08-font-inspect-ttc-index-metadata-follow-up.md).

1. Extend fontconfig discovery to parse `%{index}` and store it on the discovered face as provider metadata.
2. Complete the inspect-side TTC metadata follow-up so the selected TTC face index is visible in text and JSON output.
3. Use `fc-query --index <faceIndex> --format=%{charset}\n <path>` for charset probing.
4. Query identifying metadata with the same index and compare it with the selected `family` and `fullName` before trusting coverage.
5. Return `inconclusive` with `ttc-face-index-unavailable` when the selected TTC face lacks a provider-backed index.
6. Return `inconclusive` with `ttc-face-mismatch` when indexed metadata does not match the selected face.
7. Use the existing `fontconfig-query-failed` reason when indexed `fc-query` fails after a face index is available.

Do not add `--face-index` unless later evidence shows users need manual override and the provider can honor it reliably.

## JSON Direction

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

`font check --json` should eventually return coverage results. The exact field set should be finalized in the command implementation, but the provider spike established the initial reason-code set:

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

Codex Helper can later use the same commands to explain why a profile warning happened and suggest profile edits. That should be orchestration over the shared command/module contract, not separate font logic.

## Fixture Research Direction

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
- one UTF-8 text-file fixture, including BOM and control-character handling if easy to isolate

Evidence implementation should produce:

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
- `font check --text-file` reads raw UTF-8 text without parsing Markdown and excludes only `Cc` controls from required coverage.
- `font check --json` is deterministic across platforms with mocked coverage-provider output.

## Direction for the Inspect Plan

The related `font inspect` implementation plan should cover:

1. Implement `font inspect` before `font check`.
2. Keep `font inspect` to `--family` in the first slice; do not add `--full-name` yet.
3. Reuse `font list` discovery modes, adapter metadata, warnings, and sanitized debug attempts.
4. Treat no matches as an empty discovery result, not as coverage proof.
5. Keep Codex Helper out of this slice except as a later consumer of shared command behavior.

The `font check` direction is ready to move into the dedicated command implementation plan:

1. Require exactly one text source: `--text` or `--text-file`.
2. Treat `--text-file` as raw UTF-8 text, not a parsed Markdown/HTML/document input; strip a leading BOM and exclude only `Cc` control characters from required coverage.
3. Use exit `1` for checked missing required coverage, exit `2` for usage errors, and exit `3` for inconclusive checks.
4. Return `inconclusive` for unsupported TTC collection inspection instead of a false failure.
5. Keep text mode concise and summary-oriented; use JSON for full structured details once reason codes are proven.
6. Keep Codex Helper dependent on the shared CLI/module contract instead of giving it separate font coverage logic.

## Provisional Research Direction

1. Favor a coverage-provider interface with an optional fontconfig provider for real font files and controlled fixture coverage for deterministic tests.
2. Use `fc-query` against the selected font file path as the first real-file coverage candidate; do not use `fc-match` fallback matching as coverage proof.
3. Keep parser-backed coverage as a later contingency only if fontconfig proves insufficient.
4. Do not add `--face-index` unless the provider spike proves TTC selection needs it immediately.
5. Keep JSON examples as contract direction until the command implementation finalizes output fields.

## Recommended Resolutions

Provider viability:

- Spike an optional fontconfig provider first behind the internal `CoverageProvider` interface.
- Detect `fc-query` availability at runtime and return `inconclusive` with reason code `fontconfig-unavailable` when it is missing.
- Query only the selected font file path. Do not use family fallback matching as coverage evidence.
- Parse `fc-query` charset output into deterministic codepoint ranges before comparing required sample codepoints.
- Return `inconclusive` with stable reason codes when `fc-query` fails, the charset output is unavailable, or the selected file cannot be inspected confidently.
- Keep parser-backed coverage as a later provider option only if fontconfig coverage is too limited for the command's needs.

TTC handling:

- Do not make TTC inspection a blocker for the first `font check` slice.
- If the selected face resolves to a TTC collection and face-level inspection is not proven, return `inconclusive` with reason code `unsupported-ttc-collection`.
- Add a follow-up implementation phase for indexed TTC support through fontconfig metadata:
  - parse `%{index}` during `fc-list` discovery
  - preserve the index on discovered faces and expose it through `font inspect`
  - probe coverage with `fc-query --index <faceIndex>`
  - verify the indexed face identity before trusting charset coverage
- Keep TTC checks inconclusive when no face index is available or the indexed metadata does not match the selected face.
- Do not add `--face-index` until there is evidence that users need it and the provider can honor it reliably.

Fixture strategy:

- Use mocked discovery inventories for command-level tests.
- Use mocked `fc-query` runner output for fontconfig-provider tests.
- Use controlled coverage inventories for deterministic cross-platform command tests.
- Use small real font fixtures only if they are committed intentionally and do not make tests depend on platform-installed fonts.
- Use a mocked TTC discovery result to exercise the `inconclusive` path without requiring platform-installed TTC files.

Initial JSON reason codes:

- `no-matching-family`
- `no-inspectable-font-file`
- `fontconfig-unavailable`
- `fontconfig-query-failed`
- `fontconfig-charset-unavailable`
- `unsupported-font-format`
- `unsupported-ttc-collection`
- `ambiguous-family`
- `empty-required-codepoints`

Indexed TTC follow-up reason codes:

- `ttc-face-index-unavailable`
- `ttc-face-mismatch`

Missing glyphs should remain in `missingCodepoints`; they should not be modeled as reason codes.

Strict mode:

- Defer `--strict`.
- Keep the first `font check` slice at exit `1` for checked missing coverage, exit `2` for usage errors, and exit `3` for inconclusive checks.
- Revisit `--strict` only if automation needs a mode that treats inconclusive checks as a failure.

## Implementation Evidence

This research supported a narrow `font inspect` implementation plan focused on family-based inspection, JSON/text output, discovery-mode reuse, debug output, no-match behavior, and shared metadata formatting from `font list`.

It also supported the dedicated `font check` implementation plan. The completed command covers `fc-query` availability handling, charset parsing, checked-missing behavior, inconclusive behavior, provider-backed TTC indexes, localized TTC metadata aliases, and mocked fixture coverage.

Completed implementation order:

```text
font inspect first
  -> fontconfig coverage-provider spike with a job record (completed)
  -> font check implementation plan
  -> font check command with doctor capability reporting
  -> Codex Helper orchestration
```

Codex Helper should consume the shared command/module contract later. It should not introduce separate font coverage logic that can drift from `font check`.

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md) - parent profile and mixed-language font research.
- [Font Command Discovery Options](research-2026-05-07-font-command-discovery-options.md) - completed `font list` discovery selector and debug-output research.

## Related Plans

- [Font Inspect Implementation and Coverage-Provider Follow-up](../plans/plan-2026-05-08-font-inspect-and-coverage-provider-follow-up.md) - completed implementation plan for the `font inspect` slice and coverage-provider follow-up record.
- [Font Check Command Implementation](../plans/plan-2026-05-08-font-check-command-implementation.md) - completed implementation plan for the public `font check` command and root doctor capability reporting.
- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](../plans/plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md) - completed implementation plan for profiles, initial font discovery, diagnostics, and docs.
