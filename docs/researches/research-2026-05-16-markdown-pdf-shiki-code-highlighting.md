---
title: "Markdown PDF Shiki Code Highlighting"
created-date: 2026-05-16
status: draft
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
- a stable print-light theme instead of web dark-theme defaults
- clear opt-in or opt-out behavior that does not confuse users with too many engine choices

This research records the preferred product direction before a separate implementation plan is drafted. Specific flag names, profile keys, parser choices, and fallback behavior remain provisional until that plan is written.

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

### 4. Use a repo-owned print-light theme contract

PDF output should prefer light themes because PDFs are often printed, shared, or read in document viewers.

The public contract should probably use a repo-owned theme name:

```yaml
code:
  highlight: true
  theme: print-light
```

`print-light` can map internally to a Shiki bundled theme such as `github-light` or `light-plus`, but the public profile should not initially expose every Shiki theme name unless fixture review shows that theme selection is needed. A repo-owned alias gives the project room to adjust the underlying Shiki theme or token mapping after PDF fixture review without changing user profiles.

Arbitrary Shiki theme selection can be deferred until there is a clear user need.

### 5. Let Shiki own token markup, and let the PDF stylesheet own block layout

Shiki can produce highlighted HTML with token colors. Its `codeToHtml` shorthand returns embeddable HTML and can emit inline token styles, which is useful for deterministic PDF output because the generated document does not need a separate token theme stylesheet.[^shiki-install]

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
2. Preserve profile-controlled code fonts and print-light block styling.
3. Add optional line numbers after the basic PDF layout is stable.
4. Add highlighted-line notation, such as fenced code metadata, after parser behavior is proven.
5. Add diff block styling and transformer support.

Possible future profile shape:

```yaml
code:
  highlight: true
  theme: print-light
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

The first slice should not add `rehype-pretty-code` because the current pipeline is not a Unified/remark/rehype pipeline. That package may become relevant only if the project intentionally introduces a rehype transform layer later.

`@shikijs/transformers` should be treated as a follow-up dependency unless the first slice intentionally includes line highlighting or diff notation.

### 8. Define explicit fallback behavior

The implementation plan should define what happens when highlighting cannot be applied. The following behavior is a candidate contract, not a completed command guarantee.

Candidate behavior:

- unknown or unsupported language: render the block without token colors but keep the normal code-block stylesheet
- Shiki initialization failure: fail the command when `--code-highlight` was explicitly requested
- missing optional transformer support: fail validation if the profile requests a feature that is not implemented
- no language on a fenced block: keep the block plain
- `--no-code-highlight`: bypass Shiki entirely

This keeps explicit user requests honest without making unannotated code blocks fragile.

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
  theme: print-light
```

Recommended planning stance:

- keep highlighting opt-in until fixture review supports a default change
- keep Pandoc-native highlighting out of the public option model
- keep `fonts.code` as the source of truth for code font stacks
- use Shiki for token colors and code-block metadata
- use the repo-owned PDF stylesheet for all print layout details
- defer arbitrary theme selection, line numbers, line highlights, and diff notation until the base Shiki path is proven

## Open Questions

1. Should the first profile field be nested under top-level `code`, or should it be nested under the existing `fonts.code` area?
2. Should `print-light` map to `github-light`, `light-plus`, or a custom theme after fixture review?
3. Should `md pdf-template init` emit Shiki-specific CSS selectors even when highlighting is disabled?
4. Should no-language fenced blocks stay plain, or should they use a default language only when explicitly configured?
5. Should line numbers be a global profile option only, or should per-block Markdown metadata also be supported?
6. Which HTML transform dependency is better for this repo after a spike: `parse5` or `cheerio`?

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
