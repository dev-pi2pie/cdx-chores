---
title: "Markdown PDF Shiki Code Highlighting"
created-date: 2026-05-16
modified-date: 2026-05-17
status: completed
agent: codex
---

## Goal

Explore the preferred direction for styled code blocks in `md to-pdf` when the pipeline continues to use Pandoc for Markdown-to-HTML conversion and WeasyPrint for PDF rendering.

The main question is whether code highlighting should be exposed as multiple highlighter engines, such as Pandoc-native highlighting and Shiki, or whether the product surface should choose one supported highlighting path. This research records the current first-slice contract for the follow-up implementation plan.

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

This research records the preferred product direction before a separate implementation plan is drafted. The first-slice contracts below settle the highlighter choice, profile shape, theme allowlist, parser dependency, fixture strategy, and fallback behavior. Implementation details such as exact helper function names and test file organization belong in the follow-up plan.

Status note: this research is `completed` because the implementation plan, job records, public guide, automated tests, and manual PDF smoke review evidence are linked.

Phase 7 note: the public usage guide and implementation job records now document the Shiki code-highlighting surface. Manual PDF review used existing generated smoke outputs under `examples/playground/markdown-pdf-code/`, with Quick Look previews for highlighted-line, diff, and combined line-number transformer cases.

Bundled-language correction: the implementation now resolves languages through Shiki's bundled language metadata instead of a hand-maintained small language allowlist. Fences without a language, or with names Shiki does not bundle, still remain plain.

## Scope

This research covers:

- the preferred highlighter choice for `md to-pdf`
- the public option shape for enabling and disabling code highlighting
- the relationship between Shiki token output and the repo-owned PDF stylesheet
- how code font settings should continue to work
- a staged path for line numbers, line highlights, and diff blocks
- dependency and pipeline implications
- fixture and example strategy for Markdown code-block visual review

This research does not implement:

- new CLI flags
- profile schema changes
- Shiki integration code
- HTML parsing or serialization
- fixture PDF updates
- public guide updates
- fixture generation scripts

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

The first public surface should be a boolean-style feature, not an engine selector:

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

The first implementation should keep highlighting opt-in.

Reasons:

- highlighted output changes the visual appearance of existing PDFs
- Shiki adds runtime dependency weight
- highlighting adds an HTML transform stage after Pandoc
- technical documents may still prefer plain monochrome code blocks
- print contrast needs fixture evidence across representative languages

After the feature has fixture evidence, the project can reconsider whether specific presets should enable highlighting by default. That should be a later product decision, not part of the first Shiki slice.

### 4. Use Shiki theme IDs with a small light-theme allowlist

PDF output should prefer light themes because PDFs are often printed, shared, or read in document viewers.

The public contract should use Shiki's existing bundled theme IDs instead of introducing a repo-owned alias such as `print-light`. That keeps the profile aligned with Shiki terminology and avoids a second theme naming layer.

First-slice shape:

```yaml
code:
  highlight: true
  theme: github-light
  lineNumbers: false
  transformerNotation: false
```

`github-light` is the first-slice default because it is familiar for Markdown and code documents and is a light theme suitable for PDF review and printing.

`code.theme` should be optional when `code.highlight` is enabled. If omitted, the first slice should default to `github-light`. If present, the value should be one of the supported Shiki bundled light theme IDs. Unknown, dark, or non-allowlisted values should fail validation with a clear message instead of silently falling back to `github-light`.

When `code.highlight` is false or omitted, `code.theme` should be inert because no Shiki token rendering happens. The value should still be validated when present so profile typos do not hide behind a disabled feature and later surprise users when highlighting is enabled.

`md pdf-template init` should emit the stable code-block and Shiki hook CSS regardless of whether highlighting is enabled in a profile at that moment. Those selectors are inert for plain code blocks, but keeping them in the materialized stylesheet means users can later toggle `code.highlight` without regenerating the template only to pick up the default code-block CSS. Users who render with `--no-default-css` or heavily customized template CSS still own those hooks themselves.

The first-slice hook contract should be:

- `pre.cdx-code` for every code block that the Markdown PDF recipe normalizes
- `pre.cdx-code--plain` for plain code blocks
- `pre.cdx-code--highlighted.shiki` for Shiki-highlighted blocks
- `code.cdx-code__content` for the code content element
- `pre.cdx-code--numbered` for highlighted blocks with profile-controlled line numbers
- `.cdx-code-line`, `.cdx-code-line-number`, and `.cdx-code-line-content` for numbered line layout
- `.cdx-code-line--highlighted`, `.cdx-code-line--inserted`, and `.cdx-code-line--deleted` reserved for later line-highlight and diff support

The built-in `md to-pdf` default stylesheet and the generated `md pdf-template init` `style.css` should use the same hook names. Existing materialized templates created before this feature should continue to render, but they are not guaranteed to receive the new Shiki block-layout defaults unless users regenerate the template or add equivalent CSS manually.

The first implementation should keep the legacy bare `pre` and `code` selectors in the built-in stylesheet as fallback styling, while adding the new `cdx-code` hooks for highlighted and future line-aware blocks. The command does not need to warn on older materialized templates in the first slice because the generated HTML hooks are additive and older CSS can still style bare `pre` and `code`.

The migration contract for preexisting materialized templates should be documentation-first in the first slice:

- the public guide should state that templates generated before the Shiki feature will continue to render, but may not include the newer `cdx-code` hook styling
- users who want the built-in Shiki block-layout defaults in an existing template should regenerate the template with `md pdf-template init --overwrite` or copy the code-block CSS from a newly generated template
- `--overwrite` replaces the generated template output; it should not try to merge new code-block CSS into a user-edited template
- no automatic in-place template mutation should happen during `md to-pdf`
- a template-version marker can be considered later if future code-block features require command-time warnings or automated upgrade guidance

The first slice should not accept every Shiki bundled theme or custom theme file. Instead, it should validate this fixed initial allowlist of Shiki bundled light themes:

- `github-light`
- `light-plus`
- `min-light`
- `vitesse-light`
- `catppuccin-latte`

Dark themes, arbitrary bundled theme names, and custom theme JSON files should be deferred until there is a clear user need and a documented validation/error contract. Fixture review should validate this fixed allowlist rather than mutate it during implementation. Any later theme-list change should be a follow-up doc and plan update.

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

Baseline stylesheet direction:

```css
pre.cdx-code {
  background: #f6f8fa;
  border: 0.6pt solid #d8dee4;
  border-radius: 3pt;
  padding: 0.7rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.45;
  font-size: 8.8pt;
}

pre.cdx-code--highlighted.shiki {
  background: #f6f8fa;
}

code.cdx-code__content {
  font-family: "Noto Sans Mono", "SFMono-Regular", "Consolas", monospace;
}
```

When a profile provides `fonts.code`, the generated profile CSS should continue to override the default font stack for `pre` and `code`, including Shiki-rendered blocks.

### 6. Add advanced code-block features in stages

Shiki opens a useful path for richer code-block presentation, but those features should not all land in the first slice.

Recommended planning stages:

1. Highlight fenced code blocks with language classes from Pandoc HTML.
2. Preserve profile-controlled code fonts and light-theme block styling.
3. Add optional profile-controlled line numbers after the basic PDF layout is stable.
4. Add opt-in transformer notation for highlighted lines and diff rows after parser behavior is proven.
5. Defer richer transformer features such as word highlights, focus notation, and custom theme files.

Possible future profile shape:

```yaml
code:
  highlight: true
  theme: github-light
  lineNumbers: false
  transformerNotation: false
  wrap: true
```

The first line-number slice should support profile-level line numbers only. It should not add per-block Markdown metadata overrides until there is evidence that documents need mixed line-number behavior.

First-slice line-number behavior should be tied to highlighted Shiki output:

- `code.lineNumbers: true` requires effective highlighting to be enabled
- if `code.lineNumbers: true` is set while effective highlighting is disabled, profile validation should fail with a clear message, except when `--no-code-highlight` explicitly disables highlighting for that render
- when `--no-code-highlight` is passed, line numbers are explicitly disabled for that render because the user requested plain code output
- numbered output applies only to blocks that Shiki transforms successfully
- no-language blocks and non-bundled-language blocks stay plain and unnumbered
- line numbers should be generated during the same post-Pandoc transform that adds Shiki markup
- wrapping should preserve visual association between a number and its source line, using the repo-owned code-block stylesheet rather than inline Shiki layout styles
- page breaks inside long numbered blocks should remain acceptable; avoiding split code blocks can be considered later if fixture review shows poor output

Numbered blocks should use this markup shape:

```html
<pre class="cdx-code cdx-code--highlighted cdx-code--numbered shiki">
  <code class="cdx-code__content">
    <span class="cdx-code-line" data-line="1">
      <span class="cdx-code-line-number" aria-hidden="true">1</span>
      <span class="cdx-code-line-content">const input = "report.md";</span>
    </span>
  </code>
</pre>
```

Wrapped continuation text should remain inside `.cdx-code-line-content`; the stylesheet should align wrapped continuation lines under the content column, not under the line-number column. The transform should not create separate continuation-line elements.

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

The first Shiki implementation should use Shiki plus `parse5`:

```bash
bun add shiki parse5
```

Because the published CLI would use Shiki and the HTML transform at runtime, both dependencies would belong in `dependencies`, not `devDependencies`.

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

Use `parse5` for the HTML parse/serialize step. The transform only needs a narrow deterministic pass over Pandoc-generated HTML, not a jQuery-like querying API. `parse5` keeps the dependency purpose explicit and avoids implying a broader Unified, rehype, or browser-DOM pipeline.

Do not hand-roll the HTML parser. Code blocks can contain escaped HTML, angle brackets, quotes, nested spans, and attributes in varying order. String replacement would make the transform fragile before WeasyPrint sees the document.

The implementation plan should also define the language extraction rules explicitly. Candidate first-slice rules:

1. Find fenced-code elements from Pandoc HTML by looking for `code` elements inside `pre`.
2. Read language candidates from the `code` class list first, then the parent `pre` class list.
3. Prefer classes with `language-<id>` when present.
4. Otherwise ignore structural classes such as `sourceCode` and use the first remaining language-like class.
5. Normalize aliases through Shiki's bundled language metadata before calling Shiki.
6. If no language can be resolved, keep the block plain. Do not introduce a default language option in the first slice.
7. If Shiki does not bundle the resolved language, keep the block plain and preserve the normal code-block CSS hooks.

The first slice should not add `rehype-pretty-code` because the current pipeline is not a Unified/remark/rehype pipeline. That package may become relevant only if the project intentionally introduces a rehype transform layer later.

`@shikijs/transformers` should be added when the implementation intentionally enables line highlighting or diff notation. That keeps the base Shiki dependency set small until the notation feature has a profile switch and fixtures.

### 8. Add opt-in Shiki transformer notation for line and diff styles

The first transformer slice should stay opt-in through `code.transformerNotation`. Shiki's common transformer package includes diff notation such as `[!code ++]` / `[!code --]` and highlight notation such as `[!code highlight]`; those transformers apply classes and require project CSS for visual styling.[^shiki-transformers]

The initial transformer notation support should cover:

- diff added and removed lines
- single highlighted lines
- Shiki `:N` range suffixes for highlighted, added, and removed lines
- combinations with profile-controlled line numbers

The first transformer notation support should use committed Markdown examples and smoke outputs instead of testing only hand-written HTML snippets. Required transformer fixture names:

- `code-transformer-diff.md`
- `code-transformer-highlight-line.md`
- `code-transformer-line-numbers-combined.md`

Those examples should reuse the same code-block hook family and should map transformer output into repo-owned classes such as `.cdx-code-line--highlighted`, `.cdx-code-line--inserted`, and `.cdx-code-line--deleted`.

Transformer notation should follow the same effective-highlighting gate as line numbers:

- `code.transformerNotation: true` requires effective highlighting to be enabled
- if `code.transformerNotation: true` is set while effective highlighting is disabled, profile validation should fail with a clear message, except when `--no-code-highlight` explicitly disables highlighting for that render
- when `--no-code-highlight` is passed, transformer notation is explicitly disabled for that render because the user requested plain code output
- no-language blocks and non-bundled-language blocks stay plain and uninterpreted
- transformer marker comments should be removed from rendered highlighted code

Word highlights, focus notation, custom Shiki themes, and per-block line-number overrides remain deferred until the PDF fixture review shows real demand.

### 9. Add deterministic Markdown fixtures and playground examples

The Shiki slice should include committed Markdown fixture inputs, not only unit-test strings. The current repo already uses generator scripts under `scripts/` and manual smoke artifacts under `examples/playground/` for data and document workflows, while stable document fixtures live under `test/fixtures/docs/`. Code-block PDF styling should follow the same split:

- committed test fixtures under `test/fixtures/docs/markdown-pdf-code/`
- ignored manual smoke outputs under `examples/playground/markdown-pdf-code/`
- a generator script at `scripts/generate-markdown-pdf-code-fixtures.mjs`

The generator command contract should mirror existing fixture scripts:

```bash
node scripts/generate-markdown-pdf-code-fixtures.mjs seed
node scripts/generate-markdown-pdf-code-fixtures.mjs clean
node scripts/generate-markdown-pdf-code-fixtures.mjs reset
node scripts/generate-markdown-pdf-code-fixtures.mjs smoke
```

Responsibilities:

- `seed` writes or refreshes the committed Markdown/profile fixtures under `test/fixtures/docs/markdown-pdf-code/`
- `clean` removes generated manual smoke outputs under `examples/playground/markdown-pdf-code/`
- `reset` runs `clean` and then `seed`
- `smoke` writes regenerated HTML and PDF outputs under `examples/playground/markdown-pdf-code/` when local Pandoc and WeasyPrint dependencies are available

Manual smoke outputs should be regenerated on demand and should not be committed. The committed source fixtures should stay small enough for review and deterministic unit tests.

The parent `examples/playground/.gitignore` already ignores unlisted playground directories, so the generator does not need to create a nested `.gitignore` inside `examples/playground/markdown-pdf-code/`.

The committed fixture Markdown should be small, deterministic, and useful for both HTML transform tests and PDF fixture review. Required first-slice files:

- `code-basic.md` with TypeScript, JSON, Bash, YAML, Markdown, and Python fences
- `code-plain-and-unsupported.md` with no-language and non-bundled-language fences that should stay plain
- `code-wrapping.md` with long lines, long strings, and indentation-sensitive examples
- `code-line-numbers.md` paired with `profiles/code-line-numbers.yml`, which enables `code.highlight` and `code.lineNumbers`
- `code-mixed-content.md` with prose, lists, tables, inline code, and several code blocks on one page

Required committed layout:

```text
test/fixtures/docs/markdown-pdf-code/
  code-basic.md
  code-plain-and-unsupported.md
  code-wrapping.md
  code-line-numbers.md
  code-mixed-content.md
  profiles/
    code-highlight-default.yml
    code-highlight-alt-theme.yml
    code-line-numbers.yml
```

The generator script should write or refresh those Markdown/profile fixtures and, when local dependencies are available, can also generate playground PDFs and HTML snapshots for manual visual review. Generated playground PDFs should stay out of stable tests unless the repo intentionally adds renderer-backed PDF golden review later.

Required smoke output layout:

```text
examples/playground/markdown-pdf-code/
  html/
    code-basic.html
    code-plain-and-unsupported.html
    code-wrapping.html
    code-line-numbers.html
    code-mixed-content.html
  pdf/
    code-basic.pdf
    code-plain-and-unsupported.pdf
    code-wrapping.pdf
    code-line-numbers.pdf
    code-mixed-content.pdf
```

`smoke` should skip with a clear console message and exit `0` when Pandoc or WeasyPrint is missing, because this is a local visual-review helper rather than the stable test gate. If Shiki or `parse5` is missing after implementation, `smoke` should fail because those are package dependencies.

The first automated tests should assert the intermediate HTML contract rather than depend on local WeasyPrint rendering:

- `pre.cdx-code` and `code.cdx-code__content` hooks are present
- highlighted blocks receive `pre.cdx-code--highlighted.shiki`
- plain and non-bundled-language blocks receive plain hooks and no Shiki token spans
- profile code fonts still generate CSS that targets highlighted blocks
- `code.lineNumbers` creates `pre.cdx-code--numbered`, `.cdx-code-line`, `.cdx-code-line-number`, and `.cdx-code-line-content`
- `--html-output` writes transformed HTML only after the Shiki transform succeeds

Manual PDF review should cover at least the default `github-light` theme, one alternate allowlisted light theme, profile code fonts, long wrapped code lines, and profile-controlled line numbers.

### 10. Define explicit fallback behavior

The first-slice fallback behavior should be:

- unknown or non-bundled language: render the block without token colors but keep the normal code-block stylesheet
- Shiki initialization failure: fail the command whenever highlighting is enabled, whether it was enabled by profile or CLI
- HTML parse or serialize failure: fail the command because the generated document cannot be transformed safely
- per-block Shiki render failure for a resolved supported language: fail the command whenever highlighting is enabled, because silently dropping one block to plain output would hide a renderer bug or theme incompatibility
- missing optional transformer support: fail validation if the profile requests a feature that is not implemented
- no language on a fenced block: keep the block plain
- `--no-code-highlight`: bypass Shiki entirely

This keeps explicit user requests honest without making unannotated or non-bundled-language code blocks fragile. Plain fallback is for normal content limitations, not for broken HTML transformation or unexpected Shiki execution failures.

When a Shiki-enabled transform fails before WeasyPrint runs, `md to-pdf` should leave the target PDF untouched because rendering has not started. If a later implementation moves any PDF write through a temporary output path, failures should clean up that temporary file before reporting the error. The command should not leave a partial Shiki-transformed HTML artifact unless the user explicitly requested `--html-output`; in that case, the HTML output should be written only after the transform succeeds.

## Recommendation

Adopt Shiki as the recommended highlighter direction for `md to-pdf`, with no public Pandoc-highlighting engine selector in the first plan unless the implementation spike discovers a blocker.

First-slice product contract:

```bash
cdx-chores md to-pdf --input report.md --code-highlight
cdx-chores md to-pdf --input report.md --no-code-highlight
```

First-slice profile contract:

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
- use `parse5` for the post-Pandoc HTML parse/serialize transform
- use the repo-owned PDF stylesheet for all print layout details
- expose only a small Shiki light-theme allowlist at first
- support line numbers and basic transformer notation through profile-only opt-ins
- defer arbitrary theme selection, custom theme files, word highlights, focus notation, and per-block line-number overrides until the base Shiki path is proven

## Open Questions

No open questions remain for the first Shiki highlighting slice. Word highlights, focus notation, custom themes, and per-block line-number overrides are deferred follow-up topics.

## Completion Evidence

This research is completed with linked evidence for:

- Shiki, `parse5`, and `@shikijs/transformers` dependency installation
- committed fixture generation under `test/fixtures/docs/markdown-pdf-code/`
- transform-level tests for every required first-slice fixture
- validation tests for the fixed theme allowlist, `github-light` defaulting, and invalid theme failures
- profile and CLI precedence tests for `--code-highlight`, `--no-code-highlight`, `code.highlight`, `code.lineNumbers`, and `code.transformerNotation`
- transform-level tests for highlighted-line and diff transformer notation fixtures
- smoke generator `seed`, `clean`, `reset`, and `smoke` behavior
- `smoke` skip behavior when Pandoc or WeasyPrint is missing
- manual PDF review for the required smoke outputs under `examples/playground/markdown-pdf-code/`

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
- [Markdown PDF Shiki code highlighting phases 1-3](../plans/jobs/2026-05-17-markdown-pdf-shiki-code-highlighting-phases-1-3.md)
- [Markdown PDF Shiki code highlighting phases 4-6](../plans/jobs/2026-05-17-markdown-pdf-shiki-code-highlighting-phases-4-6.md)
- [Markdown PDF Shiki code highlighting phase 6.5](../plans/jobs/2026-05-17-markdown-pdf-shiki-code-highlighting-phase-6-5.md)
- [Markdown PDF Shiki code highlighting phase 7 docs](../plans/jobs/2026-05-17-markdown-pdf-shiki-code-highlighting-phase-7-docs.md)
- [Markdown PDF Shiki bundled language support](../plans/jobs/2026-05-17-markdown-pdf-shiki-bundled-language-support.md)

## Related Guides

- [Markdown PDF Usage](../guides/markdown-pdf-usage.md)

## References

[^shiki-install]: [Shiki Installation and Usage](https://shiki.matsu.io/guide/install)
[^shiki-transformers]: [@shikijs/transformers](https://shiki.style/packages/transformers)
