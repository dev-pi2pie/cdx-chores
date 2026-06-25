---
title: "Markdown PDF Codex Profile Helper"
created-date: 2026-06-16
modified-date: 2026-06-25
status: completed
agent: codex
---

## Goal

Document the direct `md pdf-profile codex` helper for drafting reusable Markdown
PDF profiles from bounded document signals, user intent, font hints, existing
profiles, and deterministic fallback defaults.

This guide covers the direct profile helper only. Interactive Markdown PDF
flows remain a later workflow layer.

## Command Shape

```bash
cdx-chores md pdf-profile codex [input] [options]
```

Common options:

- `[input]`: Markdown sample for document-informed profile signals.
- `-i, --input <path>`: same as the positional input, useful in scripts.
- `--intent <text>`: rendering direction for the reusable profile.
- `--font-hint <text>`: repeatable font preference hint for the same Codex request.
- `--base-profile <path>`: existing Markdown PDF profile to refine.
- `-o, --output <path>`: output profile file, using `.yml`, `.yaml`, or `.json`.
- `--dry-run`: preview the decision without writing the profile.
- `--keep-codex-report`: write a diagnostic Codex report sidecar.
- `--codex-report-output <path>`: explicit diagnostic report JSON path.
- `--overwrite`: allow selected output artifacts to be replaced.

Example:

```bash
cdx-chores md pdf-profile codex ./report.md \
  --intent "wide internal report with readable code blocks" \
  --output ./report-profile.yml
```

Render with the accepted profile:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-profile.yml \
  --output ./report.pdf
```

The render step is deterministic. Once the profile is written, `md to-pdf` does
not need Codex.

`--font-hint` is intentionally repeatable, but repeated flags are collected into
the same Codex profile request. Use one flag per distinct font preference when a
document needs several font decisions, such as separate body, CJK, code, or
symbol choices. Keep non-font rendering direction in `--intent` instead of
packing layout, cover, or table requests into font hints.

## Common Use Cases

Use a Markdown sample when the document structure should drive the profile:

```bash
cdx-chores md pdf-profile codex ./quarterly-report.md \
  --intent "board report with a table of contents and readable code excerpts" \
  --output ./quarterly-report-profile.yml
```

Use intent without a sample when you want a reusable starter profile from a
direction:

```bash
cdx-chores md pdf-profile codex \
  --intent "compact internal reference with page numbers and light code highlighting" \
  --output ./internal-reference-profile.yml
```

Use repeatable font hints when typography is the main decision. Each
`--font-hint` is one bounded preference signal in the same Codex request; Codex
still validates the result through the supported font role/key contract before
writing the profile:

```bash
cdx-chores md pdf-profile codex ./multilingual-notes.md \
  --intent "mixed-language notes with readable body text and code symbols" \
  --font-hint "use Source Serif 4 for English body text" \
  --font-hint "use Noto Serif JP for Japanese body text" \
  --font-hint "use JetBrains Mono for code" \
  --output ./multilingual-profile.yml
```

Use a base profile when you want to refine an existing reviewed profile without
mutating it:

```bash
cdx-chores md pdf-profile codex ./release-notes.md \
  --base-profile ./profiles/report-profile.yml \
  --intent "adapt this for a shorter public release note" \
  --output ./release-notes-profile.yml
```

## Signal Ladder

The helper decides whether to call Codex from the available signals:

```text
Inputs
  |
  +-- [input] or --input ---- document facts
  +-- --intent ------------- rendering direction
  +-- --font-hint ---------- font preference
  +-- --base-profile ------- starting profile
  |
  v
Decision
  |
  +-- any document, intent, or font target signal
  |     -> Codex receives bounded summaries and returns a profile decision
  |
  +-- --base-profile only
  |     -> validate and write a deterministic derivative, Codex skipped
  |
  +-- no signals
        -> write deterministic basic defaults, Codex skipped
```

The positional input and `--input <path>` are aliases. Passing both is valid only
when they resolve to the same file.

No raw document body, raw remote URLs, absolute input paths, or local font file
paths are sent to Codex. Document and font inputs are reduced to bounded facts
such as heading counts, table pressure, script buckets, code-fence summaries,
declared content languages, font family names, and coverage statuses.

## Preview Then Decide

Use `--dry-run` when you want to inspect the decision before writing a profile:

```bash
cdx-chores md pdf-profile codex ./report.md \
  --intent "landscape table report" \
  --dry-run
```

Dry-run still validates the recommendation path. It does not write the profile
or diagnostic report.

When `--output` is omitted, the helper generates a profile path with a stable
profile UID. With an input file, the generated profile is written next to the
input. Without an input file, it is written in the current working directory.

Use `--overwrite` when the selected profile or report path already exists and
should be replaced. The helper rejects unsafe artifact collisions such as writing
the profile over the Markdown input, base profile, or report path.

## Diagnostic Reports

Codex reports are optional and off by default:

```bash
cdx-chores md pdf-profile codex ./report.md \
  --intent "wide table report" \
  --output ./report-profile.yml \
  --keep-codex-report
```

The report records the bounded request facts, candidate summaries, decision
mode, accepted profile patches, accepted font patches, warnings, unmatched
directions, selected preset, and failure details when applicable.

If `--codex-report-output <path>` is passed, report writing is enabled and the
report is written to that exact JSON path. Otherwise the report sidecar is
derived from the actual profile output path and profile UID.

Reports are diagnostic artifacts. They explain why a profile was proposed, but
the replayable rendering input is the profile itself.

## Generated Profile Identity

Codex-assisted profiles include a `profile` identity section:

```yaml
profile:
  id: md-pdf-profile-20260616T081500Z-a1b2c3d4
  source: codex
  basedOn: wide-table
  preset: wide-table
  createdAt: 2026-06-16T08:15:00Z
```

Deterministic fallback profiles use `source: deterministic`. Older profiles
without a `profile` section remain valid for rendering and as `--base-profile`
inputs.

`profile.preset` is replayable. Rendering with `md to-pdf --profile <path>`
consumes the preset identity before renderer defaults. Direct render-time CLI
flags still override matching profile-derived settings.

## Candidate Adaptation

The helper chooses from known profile candidates instead of generating arbitrary
YAML from scratch:

- built-in basic default profile
- preset-derived candidates such as `article`, `report`, `wide-table`,
  `compact`, and `reader`
- one validated `--base-profile <path>`, when provided

A base profile is never mutated in place. The helper writes the adapted profile
to `--output` or a generated profile path.

Decision modes:

- `adapted`: Codex selected a candidate and accepted bounded changes.
- `conservative-fallback`: Codex chose a safe profile because signals were weak
  or ambiguous.
- `no-usable-profile`: Codex could not produce a usable profile decision.

Unavailable Codex, malformed structured output, invalid patch values, and
invalid final profiles fail without silently writing a fake Codex profile.

## Supported Profile Patch Boundary

Codex can only recommend supported profile fields through strict patches. The
normal patch contract covers fixed profile leaves such as:

- page size, orientation, and margins
- ToC enabled/depth/page-break settings
- `pdf.content-langs`
- cover enabled/style/fields
- header and footer slots
- page-number enabled/position/format/scope
- `titleBlock.metadataTitle`
- code highlighting, theme, line numbers, and transformer notation

The helper validates every patch before writing a profile. Unknown paths,
unsupported value types, invalid enum values, deletion, reset, arbitrary object
writes, and raw CSS/template changes are rejected.

## Font Patch Contract

Fonts use a dedicated strict font patch contract because body fonts can be keyed
by language tag while other font roles are single-slot settings.

Supported role/key combinations:

| Role | Supported keys |
| --- | --- |
| `body` | `default` or language tags such as `ja`, `zh-Hant`, `ko` |
| `code` | `default` or `symbols` |
| `heading` | `default` only |
| `pageChrome` | `default` only |

Example generated profile shape:

```yaml
fonts:
  body:
    default: "Source Serif 4"
    ja: "Noto Serif JP"
    zh-Hant: "Noto Serif TC"
  code:
    default: "JetBrains Mono"
    symbols: "Noto Sans Symbols 2"
```

Use `font list`, `font inspect`, and `font check` when you need local evidence
for exact family names or glyph coverage before writing a hint. `--font-hint`
does not install fonts and does not bypass profile validation.

## Title And Cover Deduplication

Profiles support renderer-owned metadata title-block behavior:

```yaml
titleBlock:
  metadataTitle: auto
```

Supported values:

- `auto`: suppress the metadata title block only when frontmatter `title` and
  the first Markdown H1 normalize to the same visible title.
- `show`: preserve metadata title output.
- `hide`: suppress metadata title output.

`auto` is the default. It avoids the common duplicate-title result while keeping
the Markdown H1 and frontmatter unchanged.

Explicit cover or title-page intent can still enable supported cover behavior.
The profile helper does not rewrite Markdown, remove the first H1, mutate
frontmatter, or add unsupported title-suppression fields.

## Table And Layout Signals

When a Markdown sample is available, table pressure influences layout selection.
Strong wide-table signals such as high column count, long table-like lines, or
overflow risk should outweigh generic wording such as "clean" or "professional"
unless the user explicitly asks for portrait output.

The profile helper can choose reusable page shape, margins, ToC, text
cover/title-page fields, page numbers, and table-friendly presets. It does not
tune individual column widths, rotate individual pages, or generate per-table
CSS.

Use a custom template or CSS when table presentation needs exact layout control.

## Profile Versus Template

Use `md pdf-profile init` when you want a deterministic starter profile.

Use `md pdf-profile codex` when you want Codex to select or adapt a reusable
profile from bounded signals and hints.

Prefer `md pdf-profile codex` for reusable render policy: page shape, margins,
ToC, page numbers, page chrome, text cover fields, fonts, and Shiki
code-highlight settings.

Use `md pdf-template init` when you need the low-level HTML/CSS recipe snapshot.
Templates are the right boundary for:

- local cover images or custom cover media
- arbitrary CSS
- custom HTML layout
- exact table styling
- unsupported profile directions
- template-only rendering behavior

The profile helper still does not generate HTML or CSS. It reports these
directions as template-backed work instead of inventing profile fields.

The direct `md pdf-template codex` helper now owns reviewable template artifacts.
Its `--output` remains aligned with `md pdf-template init`: it names the
template bundle directory, not the rendered PDF. Use that helper when Codex
should draft bounded `template.html`, `style.css`, and managed local assets for
later deterministic rendering.

Prefer `md pdf-template codex` for reviewable HTML/CSS/assets: local
cover-image assets, cover composition, custom layout, custom CSS, and
template-only behavior.

## Related Docs

- [Markdown PDF Usage](markdown-pdf-usage.md)
- [Markdown PDF Codex Template Helper](markdown-pdf-codex-template-helper.md)
- [PDF Backend License Guidance](pdf-backend-license-guidance.md)
- [Markdown PDF Codex Helper Roadmap](../researches/research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown PDF Codex profile helper implementation](../plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
