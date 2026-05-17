---
title: "Markdown PDF transformer notation sync implementation"
created-date: 2026-05-17
status: draft
agent: codex
---

## Goal

Complete the Markdown PDF Shiki transformer-notation line-state set so implementation, public docs, fixtures, and stable changelog wording stay synchronized.

The current `v0.1.3` Shiki slice supports highlighted, inserted, and deleted line notation. This follow-up decides and implements the remaining line-state notation that belongs in the same `code.transformerNotation` umbrella before expanding release wording.

## Why This Plan

The first Shiki implementation intentionally shipped a narrow transformer slice:

- `[!code highlight]`
- `[!code ++]`
- `[!code --]`

During release review, `CHANGELOGS/v0.1.3.md` briefly described broader notation support for focus, error, and warning lines even though those transformers were not wired. The immediate release-note fix is to describe only shipped behavior. This plan captures the follow-up work needed before the changelog can honestly claim the fuller line-state set.

The installed `@shikijs/transformers` package exposes the relevant transformer APIs:

- `transformerNotationFocus`
- `transformerNotationErrorLevel`

That keeps this follow-up narrow. It should finish the line-state notation family without introducing word highlights, custom themes, or per-block option parsing.

## Scope

### Transformer wiring

- Extend `src/cli/markdown-pdf/code-highlight.ts` to wire:
  - `transformerNotationFocus`
  - `transformerNotationErrorLevel`
- Keep `transformerNotationHighlight` and `transformerNotationDiff` behavior unchanged.
- Use this exact notation mapping:

| Notation | Transformer API | Repo-owned class |
| -------- | --------------- | ---------------- |
| `[!code highlight]` | `transformerNotationHighlight` | `cdx-code-line--highlighted` |
| `[!code ++]` | `transformerNotationDiff` | `cdx-code-line--inserted` |
| `[!code --]` | `transformerNotationDiff` | `cdx-code-line--deleted` |
| `[!code focus]` | `transformerNotationFocus` | `cdx-code-line--focused` |
| `[!code error]` | `transformerNotationErrorLevel` | `cdx-code-line--error` |
| `[!code warning]` | `transformerNotationErrorLevel` | `cdx-code-line--warning` |

- Treat the `:N` range suffix as in scope for every supported notation in the table:
  - `[!code highlight:2]`
  - `[!code ++:2]`
  - `[!code --:2]`
  - `[!code focus:2]`
  - `[!code error:2]`
  - `[!code warning:2]`
- Keep `code.transformerNotation` as the single opt-in umbrella switch.
- Keep `--no-code-highlight` disabling all Shiki transforms, line numbers, and notation.
- Keep no-language and unsupported-language code blocks plain and uninterpreted.

### CSS hooks

- Extend `MARKDOWN_PDF_CODE_CLASSES` with repo-owned classes:
  - `cdx-code-line--focused`
  - `cdx-code-line--error`
  - `cdx-code-line--warning`
- Add PDF-safe CSS for the new line states in `createMarkdownPdfCodeCss()`.
- Use restrained light backgrounds that stay readable in generated PDFs:
  - focused: `#ddf4ff`
  - error: `#ffd7d5`
  - warning: `#fff1b8`
- Keep these intentionally distinct from the existing generic highlight/delete backgrounds so combined examples are easier to visually inspect.
- Preserve the current classes:
  - `cdx-code-line--highlighted`
  - `cdx-code-line--inserted`
  - `cdx-code-line--deleted`
- Confirm the new classes work when line numbers wrap line content in `cdx-code-line-content`.

### Fixtures and tests

- Add committed fixtures under `test/fixtures/docs/markdown-pdf-code/`:
  - `code-transformer-focus.md`
  - `code-transformer-error-warning.md`
  - `code-transformer-line-numbers-states-combined.md`
- Update `scripts/generate-markdown-pdf-code-fixtures.mjs` so the fixtures are reproducible.
- Extend `test/markdown-pdf-code-fixture-generator.test.ts` for the new fixture names.
- Extend `test/cli-actions-md-to-pdf-code-highlight.test.ts` to verify:
  - `[!code focus]`
  - `[!code error]`
  - `[!code warning]`
  - `:N` range suffixes for focus, error, and warning notation
  - marker comments are removed from rendered output
  - line-number combinations preserve state classes
- Keep existing highlight and diff tests unchanged.

### Fixture generator and smoke output

- Keep the current generator command surface:
  - `seed`
  - `reset`
  - `smoke`
  - `clean`
- Do not redesign the smoke script for this follow-up.
- Add the new fixture cases to the existing generator data model.
- Preserve the current safety behavior:
  - only reset committed fixture roots or generated scratch fixture roots
  - only clean the configured smoke output directory or generated scratch smoke roots
- Preserve clean skip behavior when Pandoc or WeasyPrint is unavailable.
- Keep smoke output under `examples/playground/markdown-pdf-code/`.
- Keep smoke output as manual review output, not a CI-required artifact.
- Keep exact class and marker-removal assertions in unit/action tests rather than adding screenshot or PDF visual assertions to the generator.

### Documentation and release wording

- Update `docs/guides/markdown-pdf-usage.md` with focus, error, and warning examples after implementation lands.
- Update custom CSS guidance to include the full supported line-state class set.
- Update the completed Shiki implementation plan's deferred-follow-up note only if needed to point to this follow-up.
- After implementation and verification pass, expand `CHANGELOGS/v0.1.3.md` from the conservative shipped wording to the fuller supported wording:

```md
transformer notation for highlighted, inserted, deleted, focused, error, and warning lines
```

Until that implementation evidence exists, the changelog should only claim highlighted, inserted, and deleted lines.

## Non-Goals

- No word-highlight notation in this slice.
- No custom Shiki theme files.
- No arbitrary dark-theme support.
- No per-code-block line-number or transformer switches.
- No new public CLI flags beyond the existing `--code-highlight` and `--no-code-highlight`.
- No replacement of the existing `code.transformerNotation` profile switch.

## Implementation Phases

### Phase 1: Transform and CSS

- [ ] Import and wire `transformerNotationFocus`.
- [ ] Import and wire `transformerNotationErrorLevel`.
- [ ] Map focus/error/warning output to repo-owned classes.
- [ ] Add generated CSS for focused, error, and warning line states using the selected light backgrounds.
- [ ] Confirm existing highlighted/inserted/deleted output is unchanged.

### Phase 2: Fixtures

- [ ] Add Markdown fixtures for focus and error/warning notation.
- [ ] Add a combined line-number fixture for multiple line states.
- [ ] Update the fixture generator without changing its command surface.
- [ ] Update generator tests for the new fixture names and profile content.
- [ ] Regenerate committed fixture files through the generator.

### Phase 3: Regression Tests

- [ ] Add transform-level tests for focus notation.
- [ ] Add transform-level tests for error and warning notation.
- [ ] Add range-form tests for focus, error, and warning notation.
- [ ] Add line-number combination tests for the new states.
- [ ] Keep the disabled-transformer tests proving marker comments remain ordinary code text.

### Phase 4: Docs and Final Release Check

- [ ] Update the Markdown PDF usage guide with the supported notation list.
- [ ] Update custom CSS guidance with the new class names.
- [ ] Update `CHANGELOGS/v0.1.3.md` to the fuller wording only after tests pass.
- [ ] Record implementation evidence in `docs/plans/jobs/2026-05-17-markdown-pdf-transformer-notation-sync.md`.

## Acceptance Criteria

- `code.transformerNotation: true` supports highlighted, inserted, deleted, focused, error, and warning line notation.
- All supported notation types remove marker comments from highlighted output.
- All supported notation types support the `:N` range suffix.
- Line-number rendering preserves all supported line-state classes.
- Plain and unsupported-language code blocks remain plain and do not interpret notation comments.
- Focused, error, and warning styles use the selected PDF-safe light backgrounds.
- The fixture generator keeps its existing command surface and smoke output boundaries.
- Public docs list exactly the supported notation types.
- The stable changelog matches the implemented behavior.

## Verification

Run:

```bash
bun test test/cli-actions-md-to-pdf-code-highlight.test.ts test/markdown-pdf-code-fixture-generator.test.ts
bun test test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-commands.test.ts
bun run lint
bun tsc --noEmit
bun run build
git diff --check
```

If Pandoc and WeasyPrint are available locally, also run:

```bash
node scripts/generate-markdown-pdf-code-fixtures.mjs smoke
```

## Related Research

- [Markdown PDF Shiki Code Highlighting](../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Plans

- [Markdown PDF Shiki code highlighting implementation](plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md)

## Related Job Records

- Planned: `docs/plans/jobs/2026-05-17-markdown-pdf-transformer-notation-sync.md`
