---
title: "Markdown PDF Shiki Code Highlighting"
created-date: 2026-05-16
modified-date: 2026-05-16
status: in-progress
agent: codex
---

## Goal

Explore the preferred direction for styled code blocks in `md to-pdf` when the pipeline continues to use Pandoc for Markdown-to-HTML conversion and WeasyPrint for PDF rendering.

The main question is whether code highlighting should be exposed as multiple highlighter engines, such as Pandoc-native highlighting and Shiki, or whether the product surface should choose one supported highlighting path. This draft records the current recommendation from discussion, but it should still be validated by a small implementation spike and PDF fixture review before becoming a plan contract.

## Why This Research

The existing Markdown-to-PDF implementation already owns the document recipe:

```text
Markdown input
  -> Pandoc standalone HTML using a known template
  -> WeasyPrint PDF using default and/or user CSS
```

The current code-block styling is intentionally simple. The built-in stylesheet handles code block layout, wrapping, border, background, and monospace font fallback. Profile fonts already include a dedicated `fonts.code` role for code block and inline-code typography.

That baseline is useful, but it does not answer the presentation needs for technical documents:

- readable syntax color in printed or screen-read PDFs
- line numbers for longer excerpts
- highlighted lines for walkthroughs
- diff additions and removals
- a small Shiki light-theme allowlist instead of broad theme customization
- clear opt-in or opt-out behavior that does not confuse users with too many engine choices

This research records the preferred product direction before a separate implementation plan is drafted. Specific flag names, profile keys, parser choices, and fallback behavior remain provisional until that plan is written.

Status note: this research is `in-progress` because the Shiki direction is the active recommendation, but it still requires an implementation spike and PDF fixture review before it can be marked completed.

## Scope

This research covers:

- the preferred highlighter choice for `md to-pdf`
- the public option shape for enabling and disabling code highlighting
- the relationship between Shiki token output and the repo-owned PDF stylesheet
- how code font settings should continue to work
- a staged path for line numbers, line highlights, and diff blocks
- dependency and pipeline implications

This research does not implement:

- new CLI flags
- profile schema changes
- Shiki integration code
- HTML parsing or serialization
- fixture PDF updates
- public guide updates

## Current State

`md to-pdf` currently leaves syntax highlighting off and relies on CSS similar to:

```css
pre {
  background: #f5f5f5;
  border: 0.6pt solid #e0e0e0;
  padding: 0.7rem;
  white-space: pre-wrap;
}

code {
  font-family: "Noto Sans Mono", "SFMono-Regular", "Consolas", monospace;
}
```

Profiles already provide a code font role:

```yaml
fonts:
  code:
    default: "JetBrains Mono"
    symbols: "JetBrainsMono Nerd Font"
```

That split should remain. Font selection is typography; syntax highlighting is code presentation. Shiki should not own the code font stack.

## Key Findings

### 1. Prefer Shiki as the single public highlighting route

If the project introduces Shiki, exposing Pandoc-native syntax highlighting as a peer public option would add confusion without much product value.

Pandoc should continue to parse Markdown, build the standalone HTML document, preserve Pandoc Markdown features, and generate the table of contents. Shiki should own styled code presentation when highlighting is enabled. WeasyPrint should continue to render the final HTML and CSS into PDF.

Preferred product model:

```text
Pandoc parses Markdown.
Shiki highlights code blocks.
WeasyPrint renders PDF.
```

Pandoc-native highlighting can remain an internal fallback idea or historical comparison, but the current recommendation is not to make it a first-class public engine choice if Shiki is adopted. Users should not have to understand which highlighter is responsible for final code styling.

### 2. Keep the first public option simple

The first public surface should probably be a boolean-style feature, not an engine selector:

```bash
cdx-chores md to-pdf --input report.md --code-highlight
cdx-chores md to-pdf --input report.md --no-code-highlight
```

Candidate profile shape:

```yaml
code:
  highlight: true
```

CLI flags should override profile settings, matching the existing Markdown PDF model where explicit CLI layout flags override matching profile values. If a profile enables highlighting and the user passes `--no-code-highlight`, the render should stay plain. If a profile disables or omits highlighting and the user passes `--code-highlight`, the render should use Shiki with `code.theme` when configured, otherwise the default theme.

Avoid this first-slice shape unless the implementation plan finds a concrete need to name the engine:

```yaml
code:
  highlight: shiki
```

Avoid exposing a public selector such as:

```bash
--code-highlight none|pandoc|shiki
```

That selector would imply long-term support for multiple rendering engines. The simpler model is easier to document and easier to test if the spike confirms Shiki can cover the intended first slice.

### 3. Keep highlighting opt-in until PDF fixtures prove the default

The first implementation should likely keep highlighting opt-in.

Reasons:

- highlighted output changes the visual appearance of existing PDFs
- Shiki adds runtime dependency weight
- highlighting adds an HTML transform stage after Pandoc
- technical documents may still prefer plain monochrome code blocks
- print contrast needs fixture evidence across representative languages

After the feature has fixture evidence, the project can reconsider whether specific presets should enable highlighting by default. That should be a later product decision, not part of the first Shiki slice.

### 4. Use Shiki theme IDs with a small light-theme allowlist

PDF output should prefer light themes because PDFs are often printed, shared, or read in document viewers.

The public contract should probably use Shiki's existing bundled theme IDs instead of introducing a repo-owned alias such as `print-light`. That keeps the profile aligned with Shiki terminology and avoids a second theme naming layer.

Candidate first-slice shape:

```yaml
code:
  highlight: true
  theme: github-light
```

`github-light` is the preferred candidate default because it is familiar for Markdown and code documents and is a light theme suitable for PDF review and printing.

`code.theme` should be optional when `code.highlight` is enabled. If omitted, the first slice should default to `github-light`. If present, the value should be one of the supported Shiki bundled light theme IDs. Unknown, dark, or non-allowlisted values should fail validation with a clear message instead of silently falling back to `github-light`.

When `code.highlight` is false or omitted, `code.theme` should be inert because no Shiki token rendering happens. The value should still be validated when present so profile typos do not hide behind a disabled feature and later surprise users when highlighting is enabled.

`md pdf-template init` should emit the stable code-block and Shiki hook CSS regardless of whether highlighting is enabled in a profile at that moment. Those selectors are inert for plain code blocks, but keeping them in the materialized stylesheet means users can later toggle `code.highlight` without regenerating the template only to pick up the default code-block CSS. Users who render with `--no-default-css` or heavily customized template CSS still own those hooks themselves.

The candidate first-slice hook contract should be:

- `pre.cdx-code` for every code block that the Markdown PDF recipe normalizes
- `pre.cdx-code--plain` for plain code blocks
- `pre.cdx-code--highlighted.shiki` for Shiki-highlighted blocks
- `code.cdx-code__content` for the code content element
- `.cdx-code-line`, `.cdx-code-line-number`, `.cdx-code-line--highlighted`, `.cdx-code-line--inserted`, and `.cdx-code-line--deleted` reserved for later line-number, line-highlight, and diff support

The built-in `md to-pdf` default stylesheet and the generated `md pdf-template init` `style.css` should use the same hook names. Existing materialized templates created before this feature should continue to render, but they are not guaranteed to receive the new Shiki block-layout defaults unless users regenerate the template or add equivalent CSS manually.

The first implementation should keep the legacy bare `pre` and `code` selectors in the built-in stylesheet as fallback styling, while adding the new `cdx-code` hooks for highlighted and future line-aware blocks. The command does not need to warn on older materialized templates in the first slice because the generated HTML hooks are additive and older CSS can still style bare `pre` and `code`.

The migration contract for preexisting materialized templates should be documentation-first in the first slice:

- the public guide should state that templates generated before the Shiki feature will continue to render, but may not include the newer `cdx-code` hook styling
- users who want the built-in Shiki block-layout defaults in an existing template should regenerate the template with `md pdf-template init --overwrite` or copy the code-block CSS from a newly generated template
- `--overwrite` replaces the generated template output; it should not try to merge new code-block CSS into a user-edited template
- no automatic in-place template mutation should happen during `md to-pdf`
- a template-version marker can be considered later if future code-block features require command-time warnings or automated upgrade guidance

The first slice should not accept every Shiki bundled theme or custom theme file. Instead, it should validate a small allowlist of light bundled themes after fixture review. Candidate allowlist:

- `github-light`
- `light-plus`
- `min-light`
- `vitesse-light`
- `catppuccin-latte`

Dark themes, arbitrary bundled theme names, and custom theme JSON files should be deferred until there is a clear user need and a documented validation/error contract.

### 5. Let Shiki own token markup, and let the PDF stylesheet own block layout

Shiki can produce highlighted HTML with token colors. Its `codeToHtml` shorthand returns embeddable HTML and can emit inline token styles, which is useful for deterministic PDF output because the generated document does not need a separate token theme stylesheet.[^shiki-install]

The transform should keep Shiki responsible for token color, font weight, font style, and text decoration only. It should not allow Shiki output to override the profile's code font stack. If Shiki emits `font-family` on `pre`, `code`, line wrappers, or token spans, the Markdown PDF transform should strip that declaration before writing the final HTML. The built-in stylesheet and profile-generated CSS remain the source of truth for code typography.

The repo-owned stylesheet should still control:

- code font stack
- font size
- line height
- background
- border
- padding
- wrapping behavior
- page-break behavior
- line number layout
- highlighted-line background
- diff added/removed line background
- print contrast

Candidate baseline stylesheet direction:

```css
pre.shiki {
  background: #f6f8fa;
  border: 0.6pt solid #d8dee4;
  border-radius: 3pt;
  padding: 0.7rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.45;
  font-size: 8.8pt;
}

pre.shiki code {
  font-family: "Noto Sans Mono", "SFMono-Regular", "Consolas", monospace;
}
```

When a profile provides `fonts.code`, the generated profile CSS should continue to override the default font stack for `pre` and `code`, including Shiki-rendered blocks.

### 6. Add advanced code-block features in stages

Shiki opens a useful path for richer code-block presentation, but those features should not all land in the first slice.

Recommended planning stages:

1. Highlight fenced code blocks with language classes from Pandoc HTML.
2. Preserve profile-controlled code fonts and light-theme block styling.
3. Add optional line numbers after the basic PDF layout is stable.
4. Add highlighted-line notation, such as fenced code metadata, after parser behavior is proven.
5. Add diff block styling and transformer support.

Possible future profile shape:

```yaml
code:
  highlight: true
  theme: github-light
  lineNumbers: false
  wrap: true
```

Line-level emphasis should usually live in Markdown, not global profile settings. For example:

````markdown
```ts {2}
const input = "report.md";
const output = await renderPdf(input);
```
````

Diff blocks should use ordinary fenced code language tags:

````markdown
```diff
- code:
-   highlight: false
+ code:
+   highlight: true
```
````

Shiki's transformer package already provides notation-based and metadata-based paths for line highlights, word highlights, focus, and diff-style annotations, but those should be evaluated as a follow-up after the base Shiki transform is stable.[^shiki-transformers]

### 7. Add the minimum dependencies needed for the chosen pipeline

The first Shiki implementation likely needs Shiki as the highlighter dependency:

```bash
bun add shiki
```

Because the published CLI would use Shiki at runtime, this dependency would belong in `dependencies`, not `devDependencies`.

The pipeline also needs a safe way to transform Pandoc HTML:

```text
Pandoc HTML
  -> parse HTML into a tree
  -> find fenced code blocks
  -> replace matching blocks with Shiki-rendered HTML
  -> serialize HTML
  -> remote-asset guard
  -> WeasyPrint
```

`parse5` is a reasonable low-level parser/serializer candidate. `cheerio` is a reasonable ergonomic alternative. This research does not choose between them; the implementation plan should choose one after a small spike against real Pandoc-generated HTML.

The implementation plan should also define the language extraction rules explicitly. Candidate first-slice rules:

1. Find fenced-code elements from Pandoc HTML by looking for `code` elements inside `pre`.
2. Read language candidates from the `code` class list first, then the parent `pre` class list.
3. Prefer classes with `language-<id>` when present.
4. Otherwise ignore structural classes such as `sourceCode` and use the first remaining language-like class.
5. Normalize common aliases before calling Shiki, starting with `js -> javascript`, `ts -> typescript`, `jsx -> jsx`, `tsx -> tsx`, `sh -> shellscript`, `bash -> shellscript`, `zsh -> shellscript`, `yml -> yaml`, `md -> markdown`, and `py -> python`.
6. If no language can be resolved, keep the block plain.
7. If Shiki does not support the resolved language, keep the block plain and preserve the normal code-block CSS hooks.

The first slice should not add `rehype-pretty-code` because the current pipeline is not a Unified/remark/rehype pipeline. That package may become relevant only if the project intentionally introduces a rehype transform layer later.

`@shikijs/transformers` should be treated as a follow-up dependency unless the first slice intentionally includes line highlighting or diff notation.

### 8. Define explicit fallback behavior

The implementation plan should define what happens when highlighting cannot be applied. The following behavior is a candidate contract, not a completed command guarantee.

Candidate behavior:

- unknown or unsupported language: render the block without token colors but keep the normal code-block stylesheet
- Shiki initialization failure: fail the command when `--code-highlight` was explicitly requested
- HTML parse or serialize failure: fail the command because the generated document cannot be transformed safely
- per-block Shiki render failure for a resolved supported language: fail the command when highlighting is enabled, because silently dropping one block to plain output would hide a renderer bug or theme incompatibility
- missing optional transformer support: fail validation if the profile requests a feature that is not implemented
- no language on a fenced block: keep the block plain
- `--no-code-highlight`: bypass Shiki entirely

This keeps explicit user requests honest without making unannotated or unsupported-language code blocks fragile. Plain fallback is for normal content limitations, not for broken HTML transformation or unexpected Shiki execution failures.

When a Shiki-enabled transform fails before WeasyPrint runs, `md to-pdf` should leave the target PDF untouched because rendering has not started. If a later implementation moves any PDF write through a temporary output path, failures should clean up that temporary file before reporting the error. The command should not leave a partial Shiki-transformed HTML artifact unless the user explicitly requested `--html-output`; in that case, the HTML output should be written only after the transform succeeds.

## Recommendation

Adopt Shiki as the recommended highlighter direction for `md to-pdf`, with no public Pandoc-highlighting engine selector in the first plan unless the implementation spike discovers a blocker.

Candidate first-slice product contract:

```bash
cdx-chores md to-pdf --input report.md --code-highlight
cdx-chores md to-pdf --input report.md --no-code-highlight
```

Candidate first-slice profile contract:

```yaml
code:
  highlight: true
  theme: github-light
```

Recommended planning stance:

- keep highlighting opt-in until fixture review supports a default change
- keep Pandoc-native highlighting out of the public option model
- keep `fonts.code` as the source of truth for code font stacks
- use Shiki for token colors and code-block metadata
- use the repo-owned PDF stylesheet for all print layout details
- expose only a small Shiki light-theme allowlist at first
- defer arbitrary theme selection, custom theme files, line numbers, line highlights, and diff notation until the base Shiki path is proven

## Open Questions

1. Which Shiki bundled light themes should be included in the first allowlist after fixture review?
2. Should no-language fenced blocks stay plain, or should they use a default language only when explicitly configured?
3. Should line numbers be a global profile option only, or should per-block Markdown metadata also be supported?
4. Which HTML transform dependency is better for this repo after a spike: `parse5` or `cheerio`?

## Related Research

- [Markdown to PDF with WeasyPrint](research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Font Inspect and Check Commands](research-2026-05-07-font-inspect-and-check-commands.md)

## Related Plans

- [Markdown to PDF with WeasyPrint implementation](../plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md)
- [Markdown to PDF profiles, fonts, and page chrome implementation](../plans/plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)
- [Markdown to PDF with WeasyPrint phases 1-5](../plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phases-1-5.md)
- [Markdown to PDF profile phases 4-5](../plans/jobs/2026-05-07-markdown-to-pdf-profile-phases-4-5.md)
- [Markdown to PDF profile phases 6-7](../plans/jobs/2026-05-07-markdown-to-pdf-profile-phases-6-7.md)

## References

[^shiki-install]: [Shiki Installation and Usage](https://shiki.matsu.io/guide/install)
[^shiki-transformers]: [@shikijs/transformers](https://shiki.style/packages/transformers)
