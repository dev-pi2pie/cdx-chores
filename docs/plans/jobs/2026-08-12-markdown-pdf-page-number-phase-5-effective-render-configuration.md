---
title: "Markdown PDF page-number Phase 5 effective render configuration"
created-date: 2026-08-12
status: active
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Add the direct `md to-pdf` page-number enablement override and carry its
omitted/inherit, explicit-enable, and explicit-disable states into one
effective render configuration. Preserve the loaded Profile, keep
`--no-default-css` authoritative, and leave deliberate custom-CSS counters
available when Profile page numbers are disabled.

## Starting Boundary

- Starting commit: `ccf83fe8`.
- Phase 4 is completed; the parent plan remains `active`.
- The related research remains `in-progress` while later phases continue.
- The worktree was clean at the recorded starting commit. Phase 5 activation
  documentation and the first 5A implementation slice began together and are
  checkpointed from that same boundary.

## Permanent File Boundary

- Production changes remain in the existing direct `md to-pdf` command,
  action, preparation, and render-configuration seams.
- Tests extend the existing command, action, Profile, bundle, and Markdown PDF
  regression coverage.
- No generated HTML, CSS, PDF, PNG, renderer environment, or raw report is
  committed by this phase.
- Local activation commands, environment names, and resolved temporary paths
  remain private and are not recorded here.

## Checkpoints

- [x] Activate Phase 5 and record the clean starting boundary.
- [ ] 5A: Register the optional boolean flags and preserve tri-state
      precedence through effective render configuration.
- [ ] 5B: Enforce the `--no-default-css` incompatibility before intermediate or
      PDF output while preserving deliberate custom-CSS counters.
- [ ] Add command help and compatibility tests for Profile, bundle, and
      no-Profile inputs.
- [ ] Run focused validation, the Markdown PDF regression slice, and the full
      repository suite.
- [ ] Record static/build/format and `git diff --check` results.
- [ ] Review the exact Phase 5 implementation and evidence range, resolve all
      actionable findings, and record the widened range and final verdict.

## Evidence Requirements

- Prove omission remains distinct from explicit `true` and `false` at command,
  action, preparation, and render layers.
- Prove the loaded Profile is not mutated or rewritten by a direct override.
- Prove an effectively enabled page-number contract with `--no-default-css`
  fails before intermediate HTML, PDF, or other render output is written.
- Prove Profile-disabled rendering continues to permit deliberate user-authored
  CSS counters without claiming ownership of those counters.
- Preserve the effective page-number snapshot, Profile/override precedence,
  and `--no-default-css` incompatibility reason as internal preparation context
  that Phase 6 can route into its shared diagnostic contract. Do not define a
  public diagnostic payload, add a direct `md to-pdf --json` mode, or introduce
  a second schema in this phase.

## Validation Record

To be completed during implementation with focused test names and passing
counts, the Markdown PDF regression result, the full repository result, and
static/build checks. Record only repository-relative, public-safe evidence.

## Exact-Range Review

To be completed after implementation and evidence commits. The review must use
the named Phase 5 starting boundary through the final evidence tip, resolve
every actionable finding, and record the widened range before Phase 6 begins.

## Final Verdict

Pending Phase 5A/5B implementation, validation, and exact-range review.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
