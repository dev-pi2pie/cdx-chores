---
title: "Markdown PDF page-number Phase 14 reopened Interactive UX"
created-date: 2026-08-15
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Complete the reopened Phase 14 refinement by presenting page numbers and
optional repeating header/footer text as one guided six-position page layout.

The work adds common page-number label choices and ghost-guided placeholder
input without changing the Profile schema, renderer behavior, direct render
override, artifact ownership, or Codex Assistant signal contract.

## Starting Boundary

- Reopened work begins from `0294b4ad`, the first Phase 14 documentation-only
  closeout tip.
- The first Phase 14 implementation/test review range
  `7bbdc140..cdea2b23` remains recorded in the
  [first Phase 14 job record][first-job].
- The worktree was clean before this reopened research and planning update.
- The parent plan remains `active`; Phase 15 stays pending until this reopened
  refinement is implemented, validated, reviewed, and closed.

## Frozen Scope

### User-Facing Model

- Replace terminal and ordinary review uses of `page chrome` with concrete
  page-number and repeating header/footer wording.
- Present one six-position header/footer layout.
- Reserve the selected page-number position when numbering is enabled and make
  all six positions available when it is disabled.
- Choose the page-number position with one single-choice prompt, display the
  resulting ownership, then choose zero or more repeating-content positions
  with a checkbox prompt.
- On revision, preselect occupied non-reserved positions. Preserve content in
  an occupied reserved position and offer an explicit clear action rather than
  making that position authorable for new content.

### Guided Labels And Content

- Offer `Page 1`, `1`, and `Custom...` page-number label routes.
- Compile the presets to `Page {page}` and `{page}` without changing the
  existing Profile contract.
- Use shared ghost-input behavior for custom labels and repeating content.
- Add separate Markdown PDF page-label and repeating-content completion
  contexts; do not reinterpret their tokens through rename-template
  candidates.
- Preserve shared advanced-terminal controls: Tab or Right arrow accepts the
  ghost, Up and Down cycle fragment candidates, typing updates the suggestion,
  and Enter validates only actual input.
- Preserve simple mode by printing equivalent help and using ordinary input
  with the same initial value and validation. Fresh input may show the full
  page-label or slot-aware suggestion; revision uses the stored default and
  relevant token help without showing that fresh suggestion as an alternate
  default.
- Teach `{page}` as the logical number, `{pages}` as the physical PDF total,
  and useful existing metadata placeholders without persisting a ghost value
  automatically.
- Preserve a revision's editable current value separately from its ghost
  suggestion.
- On enablement or re-enablement, collect outcome, label, and position; compile
  `start` and `increment` to `1`. Default representable outcome, label, and
  position choices from retained or persisted values. An accepted guided
  revision replaces advanced sequence values it cannot represent.
- Keep existing metadata placeholders compatible in custom labels while
  teaching only `{page}`, `{pages}`, and literal label text in the common help.
- Thread the existing Interactive path prompt context into fresh and revision
  prompt factories; add no parallel runtime configuration.

### Boundaries

- Keep sequence arithmetic, custom count origin, typography, separators, and
  deliberate collisions in Profile YAML or JSON.
- Keep direct and Interactive render-time choices limited to temporary
  enablement.
- Keep Project preparation Codex Assistant-only and reusable Project policy in
  the contained `profile.yml`.
- Add no Profile schema, renderer, Template, or Codex Assistant signal change.

## Checklist

- [x] Reopen the Phase 14 research and parent plan without deleting the first
      checkpoint or its evidence.
- [ ] Inventory the shared ghost prompt and current formal-guide state and
      revision seams before editing production code.
- [ ] Extend the shared ghost helper and candidate resolver with initial-value,
      Markdown PDF completion-context, advanced-key, and simple-fallback
      regressions while preserving rename behavior.
- [ ] Implement and validate user-facing terminology and the shared
      six-position selection model.
- [ ] Implement and validate page-number label presets plus custom ghost input.
- [ ] Implement and validate repeating-content metadata hints for enabled and
      disabled page-number branches.
- [ ] Preserve revision defaults, inert values, advanced styles, and occupied
      slot diagnostics.
- [ ] Complete focused, broad, full, static, formatting, build, and diff
      validation.
- [ ] Run bounded save-only Interactive smokes for enabled custom-label and
      disabled repeating-content paths, then remove their scoped scratch data.
- [ ] Review the exact reopened implementation range for maintainability and
      test quality, resolve accepted findings, and re-review any widened range.
- [ ] Update the parent checklist and research status only after implementation
      evidence is complete.
- [ ] Record a reviewed documentation closeout and Continue, Constrain, or Stop
      verdict before Phase 15.

## Validation Plan

Focused tests should own shared ghost behavior, formal-guide prompts and
collection, compilation, revision, persistence, review, command boundaries,
and lifecycle behavior. Broader validation covers Interactive Markdown PDF,
the Markdown PDF suite, and then the repository:

```bash
bun test test/cli-text-inline.test.ts \
  test/cli-text-template-candidates.test.ts \
  test/cli-interactive-markdown-pdf/formal-guide.test.ts \
  test/cli-interactive-markdown-pdf/formal-guide-prompts.test.ts \
  test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts \
  test/cli-interactive-markdown-pdf/deterministic-service.test.ts \
  test/cli-interactive-markdown-pdf/lifecycle.test.ts
bun test test/cli-interactive-markdown-pdf/render-page-numbers.test.ts \
  test/cli-interactive-markdown-pdf/page-number-review.test.ts \
  test/cli-actions-md-to-pdf-command-wiring.test.ts \
  test/cli-actions-md-to-pdf-commands.test.ts
rg --files test/cli-interactive-markdown-pdf | xargs bun test
rg --files test | rg 'md-to-pdf|markdown-pdf' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

The live renderer matrix is repeated only if normalized behavior, renderer
CSS, scenario inputs, or evidence acceptance changes.

## Evidence

- Reopened base: `0294b4ad`.
- Research and planning refinement: the activation checkpoint containing this
  job record and its linked research and parent-plan updates.
- Shared ghost interaction: the reviewed documentation checkpoint defining
  completion contexts, advanced and simple behavior, revision defaults,
  runtime-context plumbing, and focused validation ownership.
- Implementation, validation, smoke, review, and closeout evidence: pending.

## Related Research

- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX](../../researches/research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)
- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

[first-job]: 2026-08-14-markdown-pdf-page-number-phase-14-interactive-ux.md
