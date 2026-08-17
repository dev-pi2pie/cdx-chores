---
title: "Markdown PDF page-number Phase 7 Profile authoring"
created-date: 2026-08-12
modified-date: 2026-08-13
status: completed
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Audit and complete durable page-number authoring through direct
`md pdf-profile codex` and Interactive Profile workflows. Reuse the normalized
Profile contract and Phase 6 capability catalog without creating a second
schema or treating authoring as proof that the installed renderer is capable.
Template-only authoring remains free of Profile-owned page-number policy.

## Starting Boundary

- Starting commit: `62d223af`.
- Phase 6 is completed; the parent plan remains `active`.
- The related research remains `in-progress` while later phases continue.
- No implementation evidence is claimed by this activation record.

## Permanent File Boundary

- Production changes, if required by the 7A audit, remain in the existing
  direct Profile-helper and Interactive Markdown PDF Profile-authoring seams.
- Tests extend existing Profile-helper, formal-guide, authoring, persistence,
  reload, and Template-ownership coverage.
- No generated HTML, CSS, PDF, PNG, renderer environment, or raw report is
  committed by this phase.
- Local activation commands, environment names, resolved temporary paths, raw
  errors, and host-specific renderer details remain private.

## Subphase Checkpoints

- [x] Activate Phase 7 and record starting commit `62d223af`.
- [x] 7A: Audit base-Profile loading, candidate construction, bounded patching,
      normalization, serialization, review, write, and optional report output.
- [x] 7A: Prove preservation of omitted fields, `false`, zero, non-default
      arithmetic, valid origins, format, position, and retained page-chrome
      style; implement only gaps demonstrated by the audit.
- [x] 7A: Keep optional direct Profile reports in scope, apply public-safe path
      and error redaction to new fields, and acceptance-test redacted success
      and failure content.
- [x] 7A: Reuse Phase 6 capability IDs and Phase 1 minimum baselines as advisory
      authoring information without probing or gating the installed renderer.
- [x] 7B: Add one formal-guide draft model that compiles to the normalized
      Profile contract and validates every value domain and scope/origin rule.
- [x] 7B: Keep Template-only formal-guide paths free of Profile-owned
      page-number and page-chrome policy.
- [x] 7C: Integrate formal-guide, Codex, existing Profile, and complete-bundle
      authoring with normalized review, revision, persistence, and reload.
- [x] 7C: Preserve accepted candidates across revision without repeating
      unrelated Codex requests.
- [x] 7C: Prove authoring performs no renderer probe and an unsupported local
      renderer does not invalidate a valid reusable Profile.
- [x] Run focused direct-helper and Interactive authoring validation.
- [x] Run the broad Markdown PDF regression slice and full repository suite.
- [x] Run TypeScript, lint, format, build, and `git diff --check` at final
      reviewed implementation tip `992cfdc5`.
- [x] Commit the evidence update as documentation-only after confirming its
      scope and passing `bun run format:check` and `git diff --check`; record
      that commit as the evidence tip.
- [x] Review the exact aggregate implementation/evidence range
      `62d223af..992cfdc5`, including evidence commit `903c94c6` and the fixes
      that widened the tip; resolve all actionable findings and record the
      final verdict before Phase 8 begins.

## Capability Posture

Profile authoring may show one bounded requirement entry per advanced
capability requested by the normalized candidate. Each entry contains only:

- requested capability ID
- requesting Profile field or fields
- Phase 1 minimum proven renderer baseline

The entry contains no installed capability status, renderer version or probe,
condition ID/result, or readiness verdict. This information is advisory and
reusable across direct and Interactive review. Authoring must not invoke the
renderer probe, and an unsupported renderer on the current machine must not
block a valid reusable Profile.

Direct render preparation remains the owner of request-specific installed
capability gates. `doctor` remains the owner of request-neutral installed
capability reporting. Both reuse the Phase 6 evaluator and diagnostic contract.

## Validation Commands

- Direct Profile helper:
  `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts test/adapters-codex-markdown-pdf-profile.test.ts --timeout 30000`.
- Interactive authoring:
  `bun test test/cli-interactive-markdown-pdf test/cli-markdown-pdf-profile-authoring-review.test.ts test/cli-markdown-pdf-renderer-capabilities.test.ts --timeout 30000`.
- Broad Markdown PDF regression:
  `rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000`.
- Full and static validation:
  `bun test --timeout 30000`, `bunx tsc --noEmit`, `bun run lint`,
  `bun run format:check`, `bun run build`, and `git diff --check`.

## Evidence Record

All focused, broad, full-repository, static, format, build, and diff results
reported below ran at final reviewed implementation tip `992cfdc5`.

- 7A audit: the existing base-Profile, bounded-patch, normalization,
  serialization, and write paths already preserve omitted fields, explicit
  `false`, literal zero, non-default arithmetic, both valid origins, position,
  format, and retained page-chrome style. The demonstrated production gap was
  the direct helper's reusable Profile review summary; `1e674295` added that
  summary through the shared normalized authoring-review seam without adding a
  second Profile schema.
- Direct Profile report and output safety: success, dry-run, invalid-decision,
  and failure coverage confirms normalized page-number and capability details
  remain public-safe while existing path and error redaction prevents private
  path disclosure.
- 7B evidence: `05833dcd` added Profile-only page-number and page-chrome
  collection, bounded revision groups, shared-domain validation, and explicit
  compilation to the normalized Profile contract. Template formal-guide
  authoring remains free of Profile-owned policy.
- 7C evidence: `d79a5e31` shares normalized Profile review and bounded advisory
  capability requirements across deterministic and Codex authoring, preserves
  reviewed candidates through rebinding and revision, and proves persisted
  Profiles reload with the same normalized values.
- Capability posture: authoring requirements contain only capability ID,
  requesting fields, and the Phase 1 minimum baseline. The authoring path does
  not probe or gate the installed renderer, so local renderer availability does
  not invalidate a reusable Profile.
- Direct focused validation:
  `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts test/adapters-codex-markdown-pdf-profile.test.ts --timeout 30000`
  passed with 101 tests and 752 assertions.
- Interactive focused validation:
  `bun test test/cli-interactive-markdown-pdf test/cli-markdown-pdf-profile-authoring-review.test.ts test/cli-markdown-pdf-renderer-capabilities.test.ts --timeout 30000`
  passed with 207 tests and 898 assertions.
- Broad Markdown PDF regression:
  `rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000`
  passed with 1,053 tests and 7,701 assertions.
- Full repository validation: `bun test --timeout 30000` passed with 2,073
  tests and 11,928 assertions.
- Static validation at reviewed implementation tip `992cfdc5`:
  `bunx tsc --noEmit`,
  `bun run lint`, `bun run format:check`, `bun run build`, and
  `git diff --check` passed with Bun `1.3.14`, TypeScript `7.0.2`, Oxlint
  `1.77.0`, Oxfmt `0.62.0`, and Tsdown `0.22.14`.
- Cleanup state: no renderer lab was used, and no generated HTML, CSS, PDF,
  PNG, renderer output, raw report, or temporary validation artifact remains or
  is included in the Phase 7 checkpoints.
- Evidence commit `903c94c6` was documentation-only, preserved the intended
  two-file scope, and passed `bun run format:check` and `git diff --check`.

## Review Findings And Dispositions

- Security review: accepted the actionable terminal-control finding. Free-form
  Profile review values could reach terminal output without escaped control
  characters; `992cfdc5` serializes the format value safely and adds direct,
  Interactive, and shared-review regression coverage.
- Maintainability review: accepted the actionable broad-assignment finding.
  Profile initialization now assigns only the four supported optional fields
  explicitly, preserving clone behavior while preventing unexpected runtime
  keys from crossing the typed boundary.
- Test review: accepted the actionable coverage findings. `992cfdc5` adds
  prompt-adapter boundary and conversion tests, an exact revision through
  binding, write, and reload, complete capability aggregation and entry-shape
  assertions, and exact direct/Interactive Profile assertions instead of
  partial matches.
- Documentation review: the evidence and lifecycle boundary was accepted after
  recording `903c94c6` inside the reviewed range and distinguishing this later
  documentation-only closeout from the reviewed implementation/evidence range.
- All accepted actionable findings were resolved in `992cfdc5`; no actionable
  findings remain for the reviewed Phase 7 range.

## Checkpoint Commits

- Activation base: `62d223af`.
- Activation documentation: `fac7df96`.
- Phase 7B formal-guide implementation: `05833dcd`.
- Phase 7C Interactive integration: `d79a5e31`.
- Phase 7A direct-helper audit and review-summary implementation: `1e674295`.
- Evidence documentation: `903c94c6`.
- Review-finding corrections and final implementation/validation tip:
  `992cfdc5`.

## Exact-Range Review

- Required aggregate base: `62d223af`.
- Final reviewed tip: `992cfdc5`.
- Reviewed implementation/evidence range: `62d223af..992cfdc5`. The range
  includes evidence commit `903c94c6` and the review corrections that widened
  the final tip to `992cfdc5`.
- Maintainability review: complete; accepted finding resolved.
- Test review: complete; accepted findings resolved.
- Security review: complete; accepted finding resolved.
- Documentation review: complete; lifecycle and evidence boundary accepted.
- Actionable-finding resolution and widened-range verdict: complete; no
  unresolved actionable findings remain.
- The subsequent documentation-only closeout commit that records this final
  verdict is not part of the reviewed implementation/evidence range. It must
  preserve the two-document scope and pass `bun run format:check` and
  `git diff --check` before commit.

## Final Verdict

**Continue to Phase 8.** Phase 7A, 7B, and 7C are complete, final validation
passed at `992cfdc5`, and the exact implementation/evidence range
`62d223af..992cfdc5` has no unresolved actionable findings. The parent plan
remains `active`, and the related research remains `in-progress` while later
phases continue. The documentation-only commit that records this closeout is
outside the reviewed range and must pass format and diff checks without
expanding scope.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
