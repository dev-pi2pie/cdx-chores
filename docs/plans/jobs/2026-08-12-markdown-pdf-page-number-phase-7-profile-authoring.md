---
title: "Markdown PDF page-number Phase 7 Profile authoring"
created-date: 2026-08-12
modified-date: 2026-08-13
status: in-progress
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
      implementation tip `1e674295`.
- [ ] Commit this evidence update as documentation-only after confirming its
      scope and passing `bun run format:check` and `git diff --check`; record
      that commit as the evidence tip.
- [ ] Review the exact aggregate `62d223af..<phase-7-final-tip>` range after
      replacing the placeholder with the exact full final commit, resolve all
      actionable findings, widen the tip for any fixes, and record the final
      exact range and verdict before Phase 8 begins.

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
reported below ran at final implementation tip `1e674295`.

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
  passed with 99 tests and 747 assertions.
- Interactive focused validation:
  `bun test test/cli-interactive-markdown-pdf test/cli-markdown-pdf-profile-authoring-review.test.ts test/cli-markdown-pdf-renderer-capabilities.test.ts --timeout 30000`
  passed with 199 tests and 832 assertions.
- Broad Markdown PDF regression:
  `rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000`
  passed with 1,043 tests and 7,630 assertions.
- Full repository validation: `bun test --timeout 30000` passed with 2,063
  tests and 11,857 assertions.
- Static validation at implementation tip `1e674295`: `bunx tsc --noEmit`,
  `bun run lint`, `bun run format:check`, `bun run build`, and
  `git diff --check` passed with Bun `1.3.14`, TypeScript `7.0.2`, Oxlint
  `1.77.0`, Oxfmt `0.62.0`, and Tsdown `0.22.14`.
- Cleanup state: no renderer lab was used, and no generated HTML, CSS, PDF,
  PNG, renderer output, raw report, or temporary validation artifact remains or
  is included in the Phase 7 checkpoints.
- The pending evidence commit is documentation-only. Before it becomes the
  aggregate review tip, its diff must preserve that scope and pass at least
  `bun run format:check` and `git diff --check`.

## Checkpoint Commits

- Activation base: `62d223af`.
- Activation documentation: `fac7df96`.
- Phase 7B formal-guide implementation: `05833dcd`.
- Phase 7C Interactive integration: `d79a5e31`.
- Phase 7A direct-helper audit and review-summary implementation: `1e674295`.
- Implementation and validation tip: `1e674295`.
- Evidence tip: pending this job-record update; no exact aggregate review range
  is claimed before that evidence commit exists.

## Exact-Range Review

- Required aggregate base: `62d223af`.
- Required aggregate tip: pending evidence commit.
- Proposed review range: `62d223af..<evidence-tip>`; replace the placeholder
  with the full evidence commit before review.
- Reviewed range: pending.
- Maintainability review: pending.
- Test review: pending.
- Security review: pending.
- Documentation review: pending.
- Actionable-finding resolution and widened-range verdict: pending.

## Final Verdict

**Provisional: Continue to the exact aggregate Phase 7 range review.** 7A, 7B,
7C, and substantive validation are complete at implementation tip `1e674295`,
but this evidence record is not yet a commit. Continue only after its commit
preserves the documentation-only scope and passes `bun run format:check` and
`git diff --check`. Do not begin Phase 8 until that evidence tip replaces the
placeholder and the exact aggregate range, including the evidence commit, has
been reviewed with its final verdict recorded.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
