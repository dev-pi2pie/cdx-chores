---
title: "Markdown PDF Usage"
created-date: 2026-05-06
modified-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Document the current `md to-pdf`, `md pdf-profile init`, and `md pdf-template init` workflow for rendering Markdown into PDF through Pandoc-generated HTML and WeasyPrint.

## Requirements

`md to-pdf` requires both external tools:

- `pandoc` for Markdown-to-HTML conversion
- `weasyprint` for HTML/CSS-to-PDF rendering

Check the local environment before using the command in scripts or CI:

```bash
cdx-chores doctor
```

For machine-readable checks:

```bash
cdx-chores doctor --json
```

## Basic Render

Render a Markdown file to a PDF next to the source:

```bash
cdx-chores md to-pdf --input ./docs/report.md
```

Default output:

```text
./docs/report.pdf
```

Use `--output` when the PDF should be written somewhere else:

```bash
cdx-chores md to-pdf --input ./docs/report.md --output ./exports/report.pdf
```

Use `--overwrite` to replace an existing PDF:

```bash
cdx-chores md to-pdf --input ./docs/report.md --output ./exports/report.pdf --overwrite
```

## Layout Options

The default preset is `article`.

Supported presets:

- `article`: general notes and short articles
- `report`: longer documents with ToC-friendly spacing
- `wide-table`: landscape output for wide tables or matrix-style documents
- `compact`: dense internal references
- `reader`: screen-reading oriented PDFs with larger type

Example:

```bash
cdx-chores md to-pdf --input ./table.md --preset wide-table
```

Set page size, orientation, and margins explicitly:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --page-size A4 \
  --orientation portrait \
  --margin 18mm
```

Margin flags accept simple CSS print lengths:

- `mm`
- `cm`
- `in`
- `pt`
- `px`

Use custom CSS for advanced layout expressions instead of putting arbitrary CSS into margin flags.

## Table of Contents

ToC generation is opt-in:

```bash
cdx-chores md to-pdf --input ./report.md --preset report --toc --toc-depth 3
```

The `report` preset inserts a page break after the ToC by default when ToC is enabled. Control that behavior with:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --preset report \
  --toc \
  --toc-page-break none
```

Supported `--toc-page-break` values:

- `auto`
- `none`
- `before`
- `after`
- `both`

## Debug HTML

Use `--html-output` when the rendered PDF needs inspection:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --output ./report.pdf \
  --html-output ./report.render.html
```

The HTML file is written only when `--html-output` is passed.

## Profiles

Profiles capture reusable PDF rendering settings in a declarative file. Use a profile when the same page size, metadata, cover, header/footer, page-number, or font settings should apply across documents:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./pdf-profile.yml
```

Generate a starter profile with the same pattern as `md pdf-template init`:

```bash
cdx-chores md pdf-profile init --output ./pdf-profile.yml
```

The output extension chooses the profile format. YAML is the primary documented format for human-authored profiles, and JSON is accepted for automation:

```bash
cdx-chores md pdf-profile init --output ./pdf-profile.json
cdx-chores md to-pdf --input ./report.md --profile ./pdf-profile.json
```

Use `--preset` to generate a profile from a built-in PDF preset, and `--overwrite` when replacing an existing profile file:

```bash
cdx-chores md pdf-profile init \
  --preset report \
  --output ./report-profile.yml \
  --overwrite
```

Unknown profile keys fail by default so misspelled settings do not silently change the output.

Profile metadata provides reusable defaults. Markdown frontmatter should hold document-specific values, and repeatable `--meta key=value` is the concise CLI override path:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./pdf-profile.yml \
  --meta company="Example Co." \
  --meta author="Noname"
```

Precedence is:

```text
--meta key=value
  -> Markdown frontmatter
  -> profile metadata
  -> derived defaults
```

## Covers And Page Chrome

Cover pages are rendered as part of the generated HTML/CSS recipe. The first built-in profile styles are:

- `plain`
- `report`

Example:

```yaml
cover:
  enabled: true
  style: report
  fields:
    title: "{title}"
    subtitle: "{subtitle}"
    author: "{author}"
    company: "{company}"
    date: "{date}"
```

Headers and footers use deterministic placeholder fields:

```yaml
header:
  left: "{company}"
  right: "{title}"

footer:
  left: "{author}"
  right: "{date}"
```

Page numbers are disabled by default. Enable them explicitly:

```yaml
pageNumbers:
  enabled: true
  position: bottom-center
  format: "{page}"
  scope: body
```

`{page}` is the current PDF page number. `{pages}` is the document-wide total page count, so it is not part of the recommended default format. Cover and ToC pages do not receive the normal body page chrome by default.

## Profile Fonts And Mixed Language

Most mixed-language documents should start with ordered fallback fonts. Put the Latin/body default first when Latin text should keep the primary body font:

```yaml
fonts:
  body:
    default: "Source Serif 4"
    zh-Hant: "Noto Serif CJK TC"
    zh-Hans: "Noto Serif CJK SC"
    ja: "Noto Serif CJK JP"
    ko: "Noto Serif CJK KR"
  code:
    default: "JetBrains Mono"
    symbols: "JetBrainsMono Nerd Font"
```

Fallback is the basic path. It helps occasional CJK text render without marking every phrase.

For exact mixed-language font assignment, keep document-level `lang` singular and mark language-specific spans or blocks:

```markdown
---
title: Mixed Language Report
lang: en-US
pdf:
  content-langs:
    - zh-Hant
    - ja
    - ko
---

English text with [繁體中文]{lang=zh-Hant}, [日本語]{lang=ja}, and [한국어]{lang=ko}.
```

Raw HTML works as an escape hatch:

```markdown
English text with <span lang="ja">日本語</span>.
```

`pdf.content-langs` declares expected content languages for profile preparation and validation. It does not detect or rewrite language boundaries. Exact font switching still requires language-marked Markdown or HTML.

CJK is the first-class mixed-language target for this profile slice. Latin-extended and RTL content have smoke coverage for profile normalization and generated CSS, but this does not claim renderer-specific RTL shaping quality.

## Font Discovery And Coverage

Use `font list` to discover candidate system font faces:

```bash
cdx-chores font list --family "Noto"
```

Use `font inspect` when you need the discovered metadata for one family:

```bash
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font inspect --family "Noto Sans CJK TC" --json
```

Use `font check` when you need coverage evidence for specific text before choosing profile fonts:

```bash
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
cdx-chores font check --family "JetBrainsMono Nerd Font" --text "git  main " --require nerd
cdx-chores font check --family "Noto Sans CJK JP" --text-file ./samples/japanese.txt --json
```

`font check` requires exactly one of `--text` or `--text-file`. Text files are read as raw UTF-8 text, with no Markdown extraction or document parsing. Missing required glyph coverage exits `1`, usage errors exit `2`, and inconclusive checks exit `3`.

Coverage checks use the selected discovered face and optional fontconfig `fc-query` support. A pass means the selected font file advertises the required codepoints. It does not guarantee shaping behavior, emoji presentation, fallback behavior, or final PDF renderer output. TTC collection checks require provider-backed face-index metadata; otherwise the result is inconclusive instead of a false failure.

Discovery mode defaults to `auto`:

```bash
cdx-chores font list --discovery auto
cdx-chores font list --discovery native
cdx-chores font list --discovery fontconfig
```

On macOS, `auto` uses `fc-list` when available and falls back to `system_profiler`. Linux uses fontconfig. Windows uses native registry discovery unless `fontconfig` is requested explicitly.

Use `--debug` to see the selected path and sanitized adapter attempts:

```bash
cdx-chores font list --debug
cdx-chores font list --json --debug
cdx-chores font inspect --family "Noto Sans CJK TC" --debug
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試" --debug
```

## Custom Template And CSS

Materialize the built-in recipe:

```bash
cdx-chores md pdf-template init --output ./pdf-template
```

This writes:

```text
pdf-template/
  template.html
  style.css
```

Render with the edited recipe:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css
```

When `--css` is provided, default CSS is applied first and user CSS is applied after it.

Use `--no-default-css` to render with only custom CSS:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --css ./pdf-template/style.css \
  --no-default-css
```

## Images And Assets

Relative local image paths are resolved from the Markdown file directory:

```markdown
![Chart](./images/chart.png)
```

For this layout:

```text
docs/report.md
docs/images/chart.png
```

run:

```bash
cdx-chores md to-pdf --input ./docs/report.md
```

Local images should render in the PDF when WeasyPrint can load the file. Missing local images are allowed to render with WeasyPrint warnings, and the CLI surfaces those warnings before the success line.

Non-local asset URL schemes are disabled by default, including URLs in HTML asset attributes, custom CSS, inline `style` attributes, and `<style>` blocks. Relative paths, `file:` URLs, and `data:` URLs are allowed by default. Opt in explicitly when the document should fetch remote assets:

```bash
cdx-chores md to-pdf --input ./report.md --allow-remote-assets
```

## Related Docs

- `docs/guides/md-frontmatter-to-json-output-contract.md`
- `docs/researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md`
- `docs/researches/research-2026-05-07-font-command-discovery-options.md`
- `docs/plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md`
- `docs/plans/plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md`
- `docs/researches/research-2026-05-06-markdown-to-pdf-weasyprint.md`
