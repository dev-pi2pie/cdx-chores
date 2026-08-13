---
title: "Markdown PDF page-number Phase 10 selected-source render workflow"
created-date: 2026-08-13
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Complete the one-render page-number choice for Interactive selected-source
rendering without persisting it into a Profile, Template, bundle, recipe, or
Codex report.

Phase 10 covers built-in, existing Profile, Template/CSS bundle, complete
bundle, and Custom sources. Generated and saved-recipe lifecycle changes remain
Phase 11 work; cross-version rendering, extraction, visual review, and layout
acceptance remain Phase 12 work.

## Starting Boundary

- Starting commit: the Phase 9 documentation closeout commit, to be recorded
  before the Phase 10 implementation commit.
- Preserved working-tree code from the abandoned execution is candidate work;
  every checklist item remains open until the code is recommitted, validated,
  and reviewed in the clean execution.

## Selected-Source Contract

| Choice                 | Shared override | Meaning                                    |
| ---------------------- | --------------- | ------------------------------------------ |
| `Use recipe setting`   | `undefined`     | Resolve the Profile or normalized default. |
| `Enable for this PDF`  | `true`          | Enable for this render only.               |
| `Disable for this PDF` | `false`         | Disable for this render only.              |

- Collect the choice after the Markdown input and source are known and before
  authoritative preparation.
- Show reusable setting, transient override, and effective result separately.
- Preserve the choice through same-context review, output selection, and the
  existing output-planning recovery loop.
- Reuse the prepared result for an unchanged context. Reprepare only after a
  changed page choice or another context-changing input.
- Reset to `Use recipe setting` when the Markdown input, source, selected
  artifact or explicit role set, or preparation mode changes.
- Back before preparation returns to the nearest source decision; Cancel exits
  with no plan, render, or output write.

## Implementation Checklist

- [ ] Implement the exact three-choice prompt and lossless
      `undefined`/`true`/`false` compilation while keeping legacy/generated
      callers free of new required transient state.
- [ ] Integrate the prompt into direct selected-source rendering after source
      selection and before authoritative preparation.
- [ ] Preserve code-highlighting state independently while page-number changes
      reprepare and rebind the same output plan.
- [ ] Cover Back, Cancel, same-choice reuse, changed-choice reprepare,
      same-context retention, output-planning recovery, and source-change
      reset.
- [ ] Review reusable, override, and effective page-number state without
      presenting requested capabilities as installed readiness.
- [ ] Emit diagnostic warnings and actual requested capability assessment only
      from the successful execution result, once per rendered document.
- [ ] Cover built-in, existing Profile, Template/CSS-only bundle, complete
      bundle, Custom explicit roles, and Custom bundle-plus-explicit
      precedence.
- [ ] Cover inherited and explicit `--no-default-css` conflicts before output
      planning or execution.
- [ ] Prove generated and saved-recipe handoff receives no Phase 10 prompt,
      persisted override, materialization, cleanup, or recovery behavior.

## Verification

Run focused tests while implementing, then run these gates at the final Phase
10 implementation tip:

```bash
bun test test/cli-interactive-markdown-pdf/render-page-numbers.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/render-page-number-preparation.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/page-number-review.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/render-sources.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/handoff.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf --timeout 30000
bun test test/cli-actions-md-to-pdf-prepared-render.test.ts --timeout 30000
bun test test/cli-actions-md-to-pdf-diagnostics.test.ts --timeout 30000
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Run one small local selected-source smoke under the ignored
`examples/playground/md-pdf/smoke/phase10-selected-source/<unique-run>/` path.
Cover Back/Cancel with zero output, same-context retention, source-change reset,
and representative built-in, Profile, Template/CSS, complete-bundle, and
Custom paths with inherit, enable, and disable choices. One installed-renderer
case is command and handoff sanity only. Record sanitized outcomes, public
renderer version, limitations, and cleanup state; commit no smoke artifacts.

## Commit And Review

- [ ] Record the concrete Phase 9 closeout commit as the starting boundary.
- [ ] Commit the coherent Phase 10 implementation and tests.
- [ ] Record focused, broad, full, and static verification from the committed
      tip.
- [ ] Review the exact Phase 10 `base..implementation-tip` range with
      maintainability and test-quality reviewers.
- [ ] Resolve accepted findings, widen the tip, rerun affected gates, and
      re-review when necessary.
- [ ] Have the completed job and parent checklist reviewed as documentation.
- [ ] Commit the documentation-only closeout before beginning Phase 11.

`@auto_commit_notification` is used only at the implementation and closeout
boundaries, or for a necessary accepted-review correction.

## Evidence

- Starting commit: pending Phase 9 closeout.
- Implementation commit: pending.
- Final implementation tip: pending.
- Exact reviewed range: pending.
- Smoke result and cleanup: pending.
- Final verdict: pending.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
