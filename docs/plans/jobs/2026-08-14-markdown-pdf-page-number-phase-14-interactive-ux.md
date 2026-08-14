---
title: "Markdown PDF page-number Phase 14 Interactive UX"
created-date: 2026-08-14
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Implement the Phase 14 Interactive page-number and page-chrome UX refinement
without changing the Profile schema, renderer behavior, artifact ownership, or
Codex Assistant signal contract.

The common Profile `formal-guide` path should collect only ordinary numbering
outcomes, position, and explicitly requested repeating header/footer content.
Advanced sequence, label, style, separator, and deliberate-collision settings
remain editable in Profile YAML or JSON.

## Starting Boundary

- Phase review base: `7bbdc140`, the reviewed Phase 14 research and planning
  commit.
- The worktree was clean before this activation record began.
- The parent plan is `active`; Phase 13 is completed and Phase 15 remains
  pending.

## Frozen Scope

### Guided page numbers

- Keep the existing reusable enablement question.
- Replace scope, count-origin, start, increment, and raw-label questions with
  `Body pages, starting at 1` and `Entire document, starting at 1` outcomes.
- Compile those outcomes to the existing normalized Profile fields.
- Keep `format: "{page}"`, `start: 1`, and `increment: 1` in the guided path.
- Keep all six positions with human-readable labels.
- Preserve valid inert values while page numbers are disabled in the same
  authoring session.

### Guided page chrome

- Gate repeating content behind `No`, `Header`, `Footer`, or `Both`.
- Collect only selected areas.
- During fresh enabled authoring, do not prompt the page-number-owned slot.
- When page numbers are disabled, leave all three slots available in each
  selected area.
- Do not silently delete content when page-number revision creates a collision;
  retain the existing diagnostic and independent page-chrome revision path.
- Keep style and separator configuration in Profile YAML or JSON.

### Render and ownership boundaries

- Preserve the Interactive inherit/enable/disable tri-state, placement,
  navigation, retention, reset, and effective review.
- Clarify only the temporary wording in Interactive and direct CLI help.
- Add no detailed direct flags or `md pdf-profile init` page-number options.
- Keep Project reusable policy in its contained `profile.yml`; change no
  Template or Codex Assistant signal contract.

## Implementation Inventory

- Profile and Template formal-guide answers already have separate types and
  collection entry points. The shared layout, margin, and ToC contract remains
  unchanged.
- Fresh collection has no current answers; revision supplies the selected
  current group. This existing distinction is sufficient for fresh target-slot
  omission and revision-time content preservation.
- Full page-number and style-capable page-chrome answer shapes can remain as the
  compile boundary even when the simplified prompt no longer authors advanced
  values.
- Project preparation bypasses deterministic formal-guide collection and can
  remain unchanged. Template formal-guide uses only the shared layout, margin,
  and ToC groups.
- The occupied-slot diagnostic already has the required warning semantics, but
  deterministic recipe review did not expose it before Phase 14. Reuse that
  shared diagnostic during Profile recipe review rather than defining another
  collision rule.

## Checklist

- [x] Activate this job from the reviewed Phase 14 planning boundary.
- [x] Inventory current prompt, collection, compilation, revision, export, and
      regression seams before editing.
- [x] Implement and validate simplified guided page-number authoring.
- [x] Implement and validate gated page-chrome authoring and slot ownership.
- [x] Clarify Interactive and direct render-only wording without changing
      precedence or lifecycle behavior.
- [ ] Complete focused, broad, full, static, format, build, and diff validation.
- [ ] Run a bounded save-only Interactive smoke and record cleanup.
- [ ] Review the exact Phase 14 range for maintainability and test quality,
      resolve accepted findings, and re-review any widened range.
- [ ] Update the parent Phase 14 checklist and research lifecycle only after
      implementation, validation, and review evidence are complete.
- [ ] Record a reviewed documentation closeout and Continue, Constrain, or Stop
      verdict before Phase 15.

## Validation Plan

Focused validation owns formal-guide prompts and compilation, deterministic
authoring/service integration, one-render review, and command help/wiring.
Broader validation covers all Interactive Markdown PDF and Markdown PDF tests,
then the full repository and static gates:

```bash
bun test test/cli-interactive-markdown-pdf/formal-guide.test.ts \
  test/cli-interactive-markdown-pdf/formal-guide-prompts.test.ts \
  test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts \
  test/cli-interactive-markdown-pdf/deterministic-service.test.ts
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

The bounded manual smoke uses the `interactive -> md -> pdf-recipes -> Profile
-> formal-guide -> save only` path so prompt order and serialized YAML can be
checked without renderer setup. The live renderer matrix is not repeated unless
normalized behavior, renderer CSS, scenario inputs, or evidence acceptance
changes.

## Evidence

- Planning and research boundary: `7bbdc140`.
- Phase activation record: `e9811cab`.
- Temporary Interactive/direct override wording: `6c388816`; 47 focused tests
  and 295 assertions passed with TypeScript, scoped formatting, and diff checks.
- Formal-guide page-number/page-chrome implementation: 120 focused and
  diagnostic tests plus all 326 Interactive Markdown PDF tests passed.
  TypeScript, scoped lint and formatting, build, and diff checks also passed.
- Implementation commits, validation results, smoke cleanup, reviewed range,
  and final verdict will be appended as work completes.

## Related Research

- [Markdown PDF Interactive Page-Number And Page-Chrome UX](../../researches/research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)
- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)
