---
title: "Markdown PDF page-number Phase 10 selected-source render workflow"
created-date: 2026-08-13
status: completed
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

- Starting commit: `0460f094`, the Phase 9 documentation closeout.
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

- [x] Implement the exact three-choice prompt and lossless
      `undefined`/`true`/`false` compilation while keeping legacy/generated
      callers free of new required transient state.
- [x] Integrate the prompt into direct selected-source rendering after source
      selection and before authoritative preparation.
- [x] Preserve code-highlighting state independently while page-number changes
      reprepare and rebind the same output plan.
- [x] Cover Back, Cancel, same-choice reuse, changed-choice reprepare,
      same-context retention, output-planning recovery, and source-change
      reset.
- [x] Review reusable, override, and effective page-number state without
      presenting requested capabilities as installed readiness.
- [x] Emit diagnostic warnings and actual requested capability assessment only
      from the successful execution result, once per rendered document.
- [x] Cover built-in, existing Profile, Template/CSS-only bundle, complete
      bundle, Custom explicit roles, and Custom bundle-plus-explicit
      precedence.
- [x] Cover inherited and explicit `--no-default-css` conflicts before output
      planning or execution.
- [x] Prove generated and saved-recipe handoff receives no Phase 10 prompt,
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
Cover Back/Cancel with zero output and one built-in override through preparation
and review. Keep the complete source-family, same-context retention, and
source-reset matrix in deterministic automated tests. One bounded
installed-renderer attempt is command and handoff sanity only; environment
unavailability is recorded rather than expanded into setup work. Record only
sanitized outcomes, limitations, and cleanup state; commit no smoke artifacts.

## Commit And Review

- [x] Record the concrete Phase 9 closeout commit as the starting boundary.
- [x] Commit the coherent Phase 10 implementation and tests.
- [x] Record focused, broad, full, and static verification from the committed
      tip.
- [x] Review the exact Phase 10 `base..implementation-tip` range with
      maintainability and test-quality reviewers.
- [x] Resolve accepted findings, widen the tip, rerun affected gates, and
      re-review when necessary.
- [x] Have the completed job and parent checklist reviewed as documentation.
- [x] Commit this documentation-only closeout before beginning Phase 11.

`@auto_commit_notification` is used only at the implementation and closeout
boundaries, or for a necessary accepted-review correction.

## Evidence

- Starting commit: `0460f094`.
- Implementation commit: `9900b6b0`.
- Accepted review correction: `2df8ecab`, preserving the selected code
  highlighting mode after returning Back from the initial page-number prompt
  and adding final-review Back, Cancel, and unchanged-choice coverage.
- Final implementation tip: `2df8ecab`.
- Exact reviewed range: `0460f094..2df8ecab`.
- Focused validation passed: page-number choices `6` tests / `9` assertions;
  preparation `4` / `14`; page-number review `7` / `26`; selected-source
  rendering `56` / `211`; saved/generated handoff `9` / `32`; prepared render
  `9` / `43`; diagnostics `13` / `29`; Interactive routing `12` / `29`.
- The full Interactive Markdown PDF directory passed `273` tests / `1,179`
  assertions before the review correction; the corrected selected-source and
  lifecycle review passed `91` tests. Final broad Markdown PDF validation
  passed `1,140` tests / `8,292` assertions, and the full repository passed
  `2,160` tests / `12,730` assertions.
- `bunx tsc --noEmit`, lint, format check, build, and `git diff --check` passed
  at the implementation or widened correction tip as applicable.
- Maintainability review found one lifecycle defect: returning Back from the
  initial page-number prompt reset the code-highlighting prompt default. The
  accepted correction preserves that choice. Widened-range maintainability and
  test-quality reviews found no remaining material concern or coverage gap.
- Documentation review found no material contract or evidence gap after the
  final checklist lifecycle was aligned with this closeout commit.
- Real PTY smoke passed Back and Cancel navigation with zero output and a
  built-in `Enable for this PDF` path through preparation, effective-state
  review, and output cancellation. Automated tests cover Profile,
  Template/CSS-only, complete-bundle, and Custom sources; inherit, enable, and
  disable choices; same-context retention; source reset; and capability output.
- A bounded installed-renderer attempt could not start because the task
  environment lacked the required native WeasyPrint libraries. Phase 10 makes
  no renderer-layout claim; Phase 12 retains that acceptance. Marker-validated
  cleanup removed the ignored smoke run and retained nothing.
- Final verdict: **Continue to Phase 11.** The selected-source lifecycle is
  complete, while generated/saved-recipe lifecycle and renderer acceptance
  remain explicitly deferred to Phases 11 and 12.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
