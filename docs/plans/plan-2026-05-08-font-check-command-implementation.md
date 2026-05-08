---
title: "Font check command implementation"
created-date: 2026-05-08
status: in-progress
agent: codex
---

## Goal

Implement the first public `cdx-chores font check` slice after the completed `font inspect` command and coverage-provider spike.

The command should check whether one deterministic discovered font face appears to cover required sample codepoints. It should use the internal coverage-provider boundary, start with optional `fontconfig` support through `fc-query`, and avoid claiming renderer-perfect output.

## Starting State

The repository already has:

- `cdx-chores font list` for discovery
- `cdx-chores font inspect` for family metadata
- internal controlled coverage inventory helpers
- an internal `fontconfigCoverageProvider` that queries selected font files through injected `fc-query` runner output
- research that defines `font check` text-source, exit-code, TTC, and reason-code behavior

## Scope

### In Scope

- Add `cdx-chores font check --family <name>`.
- Require exactly one text source:
  - `--text <value>`
  - `--text-file <path>`
- Read `--text-file` as raw UTF-8 text only.
- Strip a leading UTF-8 BOM from text files.
- Exclude only Unicode `Cc` control characters from required coverage checks.
- Reuse `font list` discovery modes: `auto`, `native`, and `fontconfig`.
- Select one deterministic discovered face before checking coverage.
- Use the internal `fontconfig` coverage provider when the selected face has an inspectable TTF or OTF path.
- Return `inconclusive` instead of false failure when coverage cannot be checked reliably.
- Support text and JSON output.
- Support `--debug` using the existing sanitized discovery-attempt pattern.
- Add root `doctor` capability reporting for optional fontconfig-backed font discovery and coverage support.

### Out of Scope

- No `--face-index` in the first slice.
- No automatic fallback probing across multiple faces until one passes.
- No document extraction or Markdown parsing for `--text-file`.
- No renderer, shaping, emoji-presentation, or PDF output guarantee.
- No Codex Helper orchestration beyond preserving a stable command/module surface.
- No installed-font-dependent CI tests.
- No automatic fontconfig installation or environment mutation from `doctor`.

## Command Surface

```bash
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
cdx-chores font check --family "JetBrainsMono Nerd Font" --text "git  main " --require nerd
cdx-chores font check --family "Noto Sans CJK JP" --text-file ./samples/japanese.txt --json
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試" --discovery native --debug
```

Usage errors should use exit `2`:

- missing `--family`
- missing text source
- simultaneous `--text` and `--text-file`
- invalid UTF-8 in `--text-file`
- invalid `--discovery`
- unsupported `--require` value

## Output Contract

Text output should stay summary-oriented:

```text
cdx-chores font check
Family: JetBrainsMono Nerd Font
Checked face: JetBrainsMono Nerd Font Regular
Path: /path/to/fonts/JetBrainsMonoNerdFont-Regular.ttf
Requirement: nerd

Result: fail
Missing codepoints:
- U+E0A0
- U+F418
```

Inconclusive output should be explicit:

```text
cdx-chores font check
Family: System Font
Checked face: System Font Regular
Path: /System/Library/Fonts/System.ttc

Result: inconclusive
Reason: matched font is a TTC collection, but this build cannot inspect individual collection faces yet.
```

JSON output should carry the command contract:

```json
{
  "command": "font check",
  "family": "JetBrainsMono Nerd Font",
  "requirements": ["nerd"],
  "result": "fail",
  "exitCode": 1,
  "checkedFace": "JetBrainsMono Nerd Font Regular",
  "path": "/path/to/fonts/JetBrainsMonoNerdFont-Regular.ttf",
  "checkedCodepoints": ["U+0067", "U+0069", "U+0074", "U+E0A0", "U+F418"],
  "missingCodepoints": ["U+E0A0", "U+F418"],
  "warnings": []
}
```

## Exit Behavior

| Result | Exit code | Meaning |
| --- | ---: | --- |
| `pass` | `0` | coverage was checked and all required codepoints were present |
| `fail` | `1` | coverage was checked and required codepoints were missing |
| usage error | `2` | arguments or text input are invalid |
| `inconclusive` | `3` | coverage could not be checked reliably |

## Reason Codes

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

Missing glyphs should remain in `missingCodepoints`; they should not be modeled as reason codes.

## Doctor Capability Contract

The root `doctor` work is in scope only as read-only capability reporting for the optional dependency that powers `font list --discovery fontconfig` and the first `font check` coverage provider. It should not grow into installer logic, font scanning, or profile recommendation behavior.

Text output should add a small font support section:

```text
Font support:
- fontconfig discovery: available|unavailable
- fontconfig coverage: available|unavailable
```

JSON output should add a `font` block and two capability keys while preserving the existing top-level `tools`, `query`, `queryCodex`, and `capabilities` shape:

```json
{
  "font": {
    "discovery": {
      "fontconfig": {
        "command": "fc-list",
        "available": true,
        "version": "2.15.0"
      }
    },
    "coverage": {
      "fontconfig": {
        "command": "fc-query",
        "available": true,
        "version": "2.15.0"
      }
    }
  },
  "capabilities": {
    "font.discovery.fontconfig": true,
    "font.coverage.fontconfig": true
  }
}
```

Missing `fc-list` should make `capabilities["font.discovery.fontconfig"]` false. Missing `fc-query` should make `capabilities["font.coverage.fontconfig"]` false. Both are optional capability gaps: `doctor` should still exit `0`, and missing coverage support should not imply that native font discovery is unavailable.

## Implementation Phases

### Phase 1: Text Source and Required Codepoints

- [x] Add `--text`, `--text-file`, and `--require <kind>` command options.
- [x] Require exactly one text source.
- [x] Read `--text-file` as raw UTF-8 text and strip a leading BOM.
- [x] Reject invalid UTF-8 and unreadable files as usage errors.
- [x] Extract required codepoints while excluding only `Cc` controls.
- [x] Add tests for text source validation, BOM handling, control filtering, and invalid UTF-8.

### Phase 2: Family Resolution and Face Selection

- [x] Reuse the `font inspect` matching helpers where possible.
- [x] Select one deterministic face:
  - exact normalized family before looser matches
  - inspectable path before no path
  - normal or regular style before italic or oblique
  - weight closest to `400`
  - stable lexical order by full name and path
- [x] Return `inconclusive` for no inspectable selected path.
- [x] Add tests for deterministic face selection, no-match behavior, ambiguous matches, and no-path behavior.

### Phase 3: Coverage Provider Wiring

- [x] Wire the selected face into the internal `fontconfigCoverageProvider`.
- [x] Map checked provider results to `pass` or `fail`.
- [x] Map provider inconclusive reasons to exit `3`.
- [x] Preserve TTC inspection as `unsupported-ttc-collection`.
- [x] Add tests for pass, fail, missing `fontconfig`, failed query, empty charset, unsupported format, and TTC paths.

### Phase 4: Output and Debug

- [x] Implement text output for pass, fail, and inconclusive results.
- [x] Implement JSON output with stable fields.
- [x] Include checked face, path, checked codepoints, missing codepoints, warnings, result, and exit code.
- [x] Preserve sanitized discovery debug output when `--debug` is passed.
- [x] Add tests for text, JSON, debug, and warning output.

### Phase 5: Docs and Traceability

- [ ] Update the Markdown PDF usage guide with `font check` examples and limitations.
- [ ] Update related research with completed evidence after implementation.
- [ ] Add a job record under `docs/plans/jobs/`.
- [ ] Keep Codex Helper documented as a later consumer rather than a separate coverage implementation.
- [ ] Run focused and broad validation before marking this plan complete.

### Phase 6: Doctor Capability Reporting

- [ ] Add bounded root `doctor` reporting for optional fontconfig-backed font support.
- [ ] Check `fc-list` for font discovery support.
- [ ] Check `fc-query` for selected-file coverage support.
- [ ] Report missing `fc-list` or `fc-query` as non-fatal optional capability gaps.
- [ ] Include `font.discovery.fontconfig` and `font.coverage.fontconfig` JSON status under the `font` block.
- [ ] Add `capabilities["font.discovery.fontconfig"]` and `capabilities["font.coverage.fontconfig"]`.
- [ ] Add doctor tests for available and missing fontconfig commands.

## Validation

Use focused validation while implementing:

```bash
bun test test/fonts.test.ts
bun run lint
bun run format:check
```

Run broader validation if command registration, shared action helpers, or Markdown-to-PDF profile helpers change.

Phase 1-4 validation on 2026-05-08:

- `bun test test/fonts.test.ts` - 63 pass, 378 expect calls
- `bun run lint` - 0 warnings, 0 errors
- `bun run format:check` - pass
- `bun run build` - pass, with the existing `INEFFECTIVE_DYNAMIC_IMPORT` warning for `src/cli/prompts/path.ts`

## Risks

- `fc-query` availability is platform-dependent. Missing `fontconfig` must be inconclusive, not a false missing-glyph failure.
- `fc-query` charset output proves advertised codepoint coverage only. It does not prove renderer shaping, fallback, emoji presentation, or PDF output.
- TTC face-level inspection is not proven. The first slice should keep TTC checks inconclusive.
- Family fallback matching through `fc-match` can create false passes and should not be used as proof of selected-face coverage.
- `doctor` must stay read-only. It should report optional fontconfig capability status and remediation guidance without installing tools or changing user configuration.

## Related Research

- [Font Inspect and Check Commands](../researches/research-2026-05-07-font-inspect-and-check-commands.md)
- [Font Command Discovery Options](../researches/research-2026-05-07-font-command-discovery-options.md)

## Related Plans

- [Font Inspect Implementation and Coverage-Provider Follow-up](plan-2026-05-08-font-inspect-and-coverage-provider-follow-up.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)
