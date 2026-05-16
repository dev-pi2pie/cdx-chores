---
title: "Markdown PDF Shiki code highlighting implementation"
created-date: 2026-05-17
status: draft
agent: codex
---

## Goal

Implement the first `md to-pdf` Shiki code-highlighting slice: opt-in highlighted code blocks, a fixed light-theme allowlist, profile-controlled line numbers, deterministic HTML transformation through `parse5`, and fixture-backed visual review support.

This plan keeps Pandoc responsible for Markdown-to-HTML conversion and WeasyPrint responsible for PDF rendering. Shiki owns token color and code-block metadata only.

## Why This Plan

The related research settles the first-slice product contract:

- use Shiki as the only public highlighter route
- keep Pandoc-native highlighting out of the public option model
- keep highlighting opt-in
- use Shiki bundled light theme IDs directly
- default to `github-light`
- validate a fixed light-theme allowlist
- keep `fonts.code` as the source of truth for code typography
- use `parse5` for post-Pandoc HTML parsing and serialization
- keep no-language and unsupported-language blocks plain
- support profile-only line numbers for successfully highlighted blocks
- add deterministic Markdown fixtures and playground smoke outputs

The plan turns that contract into an implementation sequence without pulling in deferred transformer notation such as highlighted-line or diff metadata.

## Implementation State

Before this plan started, the repository already had:

- `md to-pdf` rendering through Pandoc standalone HTML and WeasyPrint PDF output.
- `md pdf-template init` materializing `template.html` and `style.css`.
- profile parsing for page, ToC, cover, page chrome, and fonts.
- `fonts.code` profile support that generates `pre, code` font-family CSS.
- `--html-output` for writing the generated HTML artifact.
- remote-asset scanning before WeasyPrint invocation.
- document fixtures under `test/fixtures/docs/`.
- fixture generator scripts under `scripts/`.
- ignored manual smoke workspaces under `examples/playground/`.

Completed in this slice:

- a top-level `code` profile section.
- `--code-highlight` / `--no-code-highlight` CLI flags.
- runtime dependencies on `shiki` and `parse5`.
- a standalone Shiki code-block HTML transform module using `parse5`.
- Shiki code-block CSS hook classes in transform output.
- Markdown PDF code-block fixtures and generator scripts.
- initial Phase 5 render wiring for highlighted code before remote-asset scanning, `--html-output`, and WeasyPrint.

Remaining after this slice:

- line-number markup generation.
- default/template CSS updates for the code hooks.
- broader transform failure cleanup assertions.
- guide documentation and full closeout evidence.

## Scope

### Dependencies

- Runtime dependencies have been added with:

```bash
bun add shiki parse5
```

- Keep both dependencies in `dependencies`, because published `cdx-chores md to-pdf` uses them at runtime.
- Do not add `cheerio`.
- Do not hand-roll an HTML parser.
- Do not add `rehype-pretty-code`.
- Do not add `@shikijs/transformers` in the first slice.

### Profile contract

Add a top-level `code` profile section:

```yaml
code:
  highlight: true
  theme: github-light
  lineNumbers: false
```

Rules:

- `code.highlight` defaults to `false`.
- `code.theme` is optional when highlighting is enabled.
- omitted `code.theme` defaults to `github-light`.
- `code.theme` is validated when present, even if highlighting is disabled.
- `code.theme` is inert when effective highlighting is disabled.
- `code.lineNumbers` defaults to `false`.
- `code.lineNumbers: true` requires effective highlighting to be enabled.
- `--no-code-highlight` explicitly disables highlighting and line numbers for that render.

Fixed first-slice theme allowlist:

- `github-light`
- `light-plus`
- `min-light`
- `vitesse-light`
- `catppuccin-latte`

Unknown, dark, custom-file, or non-allowlisted theme values fail profile validation with a clear message.

### CLI contract

Add:

```bash
cdx-chores md to-pdf --input report.md --code-highlight
cdx-chores md to-pdf --input report.md --no-code-highlight
```

Rules:

- CLI flags override profile settings.
- `--code-highlight` enables Shiki highlighting for the render.
- `--no-code-highlight` disables Shiki highlighting and line numbers for the render.
- Do not expose `--code-highlight none|pandoc|shiki`.
- Do not expose a dedicated CLI theme flag in the first slice.

### HTML transform

Add a post-Pandoc transform between generated HTML read and remote-asset scanning:

```text
Pandoc HTML
  -> parse5 parse
  -> find pre > code blocks
  -> extract and normalize language
  -> render supported blocks through Shiki
  -> add cdx-code hooks
  -> serialize HTML
  -> remote-asset guard
  -> optional --html-output
  -> WeasyPrint
```

Language extraction rules:

1. Find `code` elements inside `pre`.
2. Read language candidates from the `code` class list first, then the parent `pre` class list.
3. Prefer `language-<id>` classes.
4. Ignore structural classes such as `sourceCode`.
5. Use the first remaining language-like class.
6. Normalize aliases:
   - `js -> javascript`
   - `ts -> typescript`
   - `jsx -> jsx`
   - `tsx -> tsx`
   - `sh -> shellscript`
   - `bash -> shellscript`
   - `zsh -> shellscript`
   - `yml -> yaml`
   - `md -> markdown`
   - `py -> python`
7. No resolved language stays plain.
8. Unsupported Shiki language stays plain.

### Code-block hooks and CSS

Generated code blocks should use:

- `pre.cdx-code`
- `pre.cdx-code--plain`
- `pre.cdx-code--highlighted.shiki`
- `code.cdx-code__content`
- `pre.cdx-code--numbered`
- `.cdx-code-line`
- `.cdx-code-line-number`
- `.cdx-code-line-content`

Reserved for deferred transformer work:

- `.cdx-code-line--highlighted`
- `.cdx-code-line--inserted`
- `.cdx-code-line--deleted`

The built-in default CSS and `md pdf-template init` `style.css` must include both:

- legacy `pre` / `code` fallback selectors
- new `cdx-code` hook selectors

Shiki output must not override profile code fonts. If Shiki output includes `font-family` on `pre`, `code`, line wrappers, or token spans, strip it before writing final HTML.

### Line numbers

First-slice line numbers are profile-level only:

```yaml
code:
  highlight: true
  lineNumbers: true
```

Rules:

- line numbers apply only to successfully Shiki-transformed blocks.
- no-language and unsupported-language blocks remain plain and unnumbered.
- line numbers are generated during the post-Pandoc transform.
- wrapped continuation text stays inside `.cdx-code-line-content`.
- the stylesheet aligns wrapped continuation text under the content column, not under the line-number column.

Markup shape:

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

### Fixtures and generator

Add committed fixtures under:

```text
test/fixtures/docs/markdown-pdf-code/
```

Required layout:

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

Add generator:

```text
scripts/generate-markdown-pdf-code-fixtures.mjs
```

Command contract:

```bash
node scripts/generate-markdown-pdf-code-fixtures.mjs seed
node scripts/generate-markdown-pdf-code-fixtures.mjs clean
node scripts/generate-markdown-pdf-code-fixtures.mjs reset
node scripts/generate-markdown-pdf-code-fixtures.mjs smoke
```

Responsibilities:

- `seed`: write or refresh committed Markdown/profile fixtures.
- `clean`: remove generated smoke outputs.
- `reset`: run `clean`, then `seed`.
- `smoke`: render HTML/PDF smoke outputs when local Pandoc and WeasyPrint are available.

Smoke output path:

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

`smoke` should skip with exit `0` and a clear message when Pandoc or WeasyPrint is unavailable. Missing Shiki or `parse5` after implementation should fail because they are package dependencies.

The parent `examples/playground/.gitignore` already ignores `examples/playground/markdown-pdf-code/`, so do not add a nested `.gitignore` for this smoke workspace.

## Non-Goals

- no Pandoc-native highlighting public mode
- no `--code-highlight none|pandoc|shiki`
- no CLI theme flag
- no arbitrary Shiki theme names
- no custom Shiki theme JSON files
- no dark-theme support in the first slice
- no `rehype-pretty-code`
- no `@shikijs/transformers`
- no diff/highlight-line transformer notation in the first slice
- no per-block line-number overrides
- no default language for no-language fences
- no mutation of existing materialized templates during `md to-pdf`
- no PDF golden tests as the stable test gate

## Implementation Phases

### Phase 1: Dependencies And Fixture Foundation

- [x] Add `shiki` and `parse5` to runtime dependencies.
- [x] Add `scripts/generate-markdown-pdf-code-fixtures.mjs`.
- [x] Implement `seed`, `clean`, `reset`, and `smoke`.
- [x] Add required committed Markdown/profile fixtures.
- [x] Ensure smoke outputs live under `examples/playground/markdown-pdf-code/`.
- [x] Verify `clean` only removes the code smoke output directory.
- [x] Verify `smoke` skips cleanly when Pandoc or WeasyPrint is missing.

Verification:

```bash
node scripts/generate-markdown-pdf-code-fixtures.mjs reset
node scripts/generate-markdown-pdf-code-fixtures.mjs smoke
```

### Phase 2: Profile And CLI Options

- [x] Extend profile schema with top-level `code`.
- [x] Normalize `code.highlight`, `code.theme`, and `code.lineNumbers`.
- [x] Validate the fixed light-theme allowlist.
- [x] Default omitted `code.theme` to `github-light` when highlighting is enabled.
- [x] Validate `code.theme` even when highlighting is disabled.
- [x] Enforce `code.lineNumbers: true` with effective highlighting, except explicit `--no-code-highlight`.
- [x] Add `--code-highlight` and `--no-code-highlight` to `md to-pdf`.
- [x] Implement CLI override precedence.
- [x] Add profile and CLI option tests.

Verification:

```bash
bun test test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-options.test.ts
```

### Phase 3: Shiki Transform Module

- [x] Add a Markdown PDF code-transform module.
- [x] Use `parse5` to parse and serialize Pandoc-generated HTML.
- [x] Find `pre > code` blocks.
- [x] Extract and normalize language classes.
- [x] Initialize Shiki for the fixed theme allowlist and required languages.
- [x] Render supported code blocks through Shiki.
- [x] Preserve plain output for no-language and unsupported-language blocks.
- [x] Add `cdx-code` hook classes.
- [x] Strip any Shiki `font-family` declarations.
- [x] Fail on HTML parse/serialize failures.
- [x] Fail on Shiki initialization or supported-language render failures when highlighting is enabled.

Verification:

```bash
bun test test/cli-actions-md-to-pdf-code-highlight*.test.ts
```

### Phase 4: Line Numbers And CSS Hooks

- [ ] Generate `pre.cdx-code--numbered` markup when `code.lineNumbers` is enabled.
- [ ] Generate `.cdx-code-line`, `.cdx-code-line-number`, and `.cdx-code-line-content`.
- [ ] Keep unsupported and no-language blocks unnumbered.
- [ ] Add default CSS for `cdx-code` hooks.
- [ ] Keep legacy `pre` and `code` selectors.
- [ ] Ensure profile `fonts.code` still controls highlighted and numbered blocks.
- [ ] Update `md pdf-template init` generated CSS with the same hook selectors.

Verification:

```bash
bun test test/cli-actions-md-to-pdf-recipe*.test.ts test/cli-actions-md-to-pdf-code-highlight*.test.ts
```

### Phase 5: Render Integration And Failure Semantics

- [x] Insert the Shiki transform after Pandoc HTML generation and before remote-asset scanning.
- [x] Write `--html-output` only after the Shiki transform succeeds.
- [ ] Leave the target PDF untouched when transform fails before WeasyPrint.
- [ ] Clean temporary files on transform/render failure.
- [x] Preserve current behavior when highlighting is disabled.
- [x] Confirm `--no-code-highlight` bypasses the transform.

Verification:

```bash
bun test test/cli-actions-md-to-pdf-actions*.test.ts
```

### Phase 6: Fixture Tests And Smoke Review

- [ ] Add transform-level tests for every required committed fixture.
- [ ] Assert code hooks and Shiki classes in transformed HTML.
- [ ] Assert unsupported/no-language blocks stay plain.
- [ ] Assert line-number markup for `code-line-numbers.md`.
- [ ] Assert profile code fonts override highlighted block typography.
- [ ] Run smoke output generation locally.
- [ ] Manually review smoke PDFs for:
  - default `github-light`
  - one alternate allowlisted light theme
  - long wrapped code lines
  - profile code fonts
  - profile-controlled line numbers

Verification:

```bash
node scripts/generate-markdown-pdf-code-fixtures.mjs reset
node scripts/generate-markdown-pdf-code-fixtures.mjs smoke
bun test test/cli-actions-md-to-pdf*.test.ts
```

### Phase 7: Documentation And Closeout

- [ ] Update `docs/guides/markdown-pdf-usage.md`.
- [ ] Document `--code-highlight`, `--no-code-highlight`, and profile `code`.
- [ ] Document the fixed light-theme allowlist.
- [ ] Document old template migration through `md pdf-template init --overwrite` or manual CSS copy.
- [ ] Document fixture generator usage if relevant to contributor workflows.
- [x] Add a job record under `docs/plans/jobs/`.
- [x] Link the job record to this plan and the research doc.
- [ ] Update the research doc status only after implementation evidence is linked.

Verification:

```bash
bun run lint
bun run format:check
bun run build
git diff --check
```

## Deferred Follow-Up: Transformer Styles

Diff lines, highlighted lines, word highlights, focus, custom themes, and per-block line-number overrides are not part of this implementation.

Create a separate follow-up research or plan before enabling `@shikijs/transformers`. That follow-up should fixture:

- `code-transformer-diff.md`
- `code-transformer-highlight-line.md`
- `code-transformer-highlight-word.md`
- `code-transformer-focus.md`
- `code-transformer-line-numbers-combined.md`

The follow-up should map transformer output into repo-owned classes such as:

- `.cdx-code-line--highlighted`
- `.cdx-code-line--inserted`
- `.cdx-code-line--deleted`

## Acceptance Criteria

- `md to-pdf` renders existing documents unchanged when highlighting is not enabled.
- `--code-highlight` produces Shiki-highlighted HTML before WeasyPrint.
- `--no-code-highlight` disables Shiki and line numbers even when the profile enables them.
- profile `code.highlight`, `code.theme`, and `code.lineNumbers` validate deterministically.
- the fixed theme allowlist is enforced.
- `fonts.code` controls highlighted and numbered block typography.
- no-language and unsupported-language blocks remain plain.
- transform failures do not leave partial target PDFs or premature `--html-output` files.
- required Markdown/profile fixtures exist and are generated by the fixture script.
- smoke output generation is deterministic or skips cleanly when local render dependencies are missing.
- public docs explain usage, limitations, and old-template migration.

## Related Research

- [Markdown PDF Shiki Code Highlighting](../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)
- [Markdown to PDF with WeasyPrint](../researches/research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)

## Related Plans

- [Markdown to PDF with WeasyPrint implementation](plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md)
- [Markdown to PDF profiles, fonts, and page chrome implementation](plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)

## Related Job Records

- [Markdown PDF Shiki code highlighting phases 1-3](jobs/2026-05-17-markdown-pdf-shiki-code-highlighting-phases-1-3.md)
