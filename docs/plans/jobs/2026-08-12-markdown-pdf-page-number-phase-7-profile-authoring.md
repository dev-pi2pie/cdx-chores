---
title: "Markdown PDF page-number Phase 7 Profile authoring"
created-date: 2026-08-12
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
- [ ] 7A: Audit base-Profile loading, candidate construction, bounded patching,
      normalization, serialization, review, write, and optional report output.
- [ ] 7A: Prove preservation of omitted fields, `false`, zero, non-default
      arithmetic, valid origins, format, position, and retained page-chrome
      style; implement only gaps demonstrated by the audit.
- [ ] 7A: Keep optional direct Profile reports in scope, apply public-safe path
      and error redaction to new fields, and acceptance-test redacted success
      and failure content.
- [ ] 7A: Reuse Phase 6 capability IDs and Phase 1 minimum baselines as advisory
      authoring information without probing or gating the installed renderer.
- [ ] 7B: Add one formal-guide draft model that compiles to the normalized
      Profile contract and validates every value domain and scope/origin rule.
- [ ] 7B: Keep Template-only formal-guide paths free of Profile-owned
      page-number and page-chrome policy.
- [ ] 7C: Integrate formal-guide, Codex, existing Profile, and complete-bundle
      authoring with normalized review, revision, persistence, and reload.
- [ ] 7C: Preserve accepted candidates across revision without repeating
      unrelated Codex requests.
- [ ] 7C: Prove authoring performs no renderer probe and an unsupported local
      renderer does not invalidate a valid reusable Profile.
- [ ] Run focused direct-helper and Interactive authoring validation.
- [ ] Run the broad Markdown PDF regression slice and full repository suite.
- [ ] Run TypeScript, lint, format, build, and `git diff --check` at the final
      evidence tip.
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

## Planned Focused Validation

- Direct Profile helper:
  `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts test/adapters-codex-markdown-pdf-profile.test.ts --timeout 30000`.
- Interactive authoring:
  `bun test test/cli-interactive-markdown-pdf/formal-guide.test.ts test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts test/cli-interactive-markdown-pdf/codex-authoring.test.ts test/cli-interactive-markdown-pdf/handoff.test.ts --timeout 30000`.
- Broad Markdown PDF regression:
  `rg --files test | rg 'md-to-pdf|markdown-pdf' | xargs bun test --timeout 30000`.
- Full and static validation:
  `bun test --timeout 30000`, `bunx tsc --noEmit`, `bun run lint`,
  `bun run format:check`, `bun run build`, and `git diff --check`.

## Evidence Record

- 7A audit findings and resulting file boundary: pending.
- Direct Profile optional-report redaction acceptance result: pending.
- Capability requirement schema, no-probe, and unsupported-local-renderer
  authoring result: pending.
- 7A focused validation result: pending.
- 7B focused validation result: pending.
- 7C focused validation result: pending.
- Broad Markdown PDF regression result: pending.
- Full repository and static validation result: pending.
- Generated or temporary artifact cleanup state: pending; no artifact is
  assumed to exist at activation.

## Checkpoint Commits

- Activation base: `62d223af`.
- Phase 7A implementation/evidence tip: pending.
- Phase 7B implementation/evidence tip: pending.
- Phase 7C implementation/evidence tip: pending.
- Final validation/review tip: pending.

## Exact-Range Review

- Required aggregate base: `62d223af`.
- Required aggregate tip: pending.
- Reviewed range: pending; record the exact full
  `62d223af..<phase-7-final-tip>` range only after the final evidence tip is
  known.
- Maintainability review: pending.
- Test review: pending.
- Security review: pending.
- Documentation review: pending.
- Actionable-finding resolution and widened-range verdict: pending.

## Final Verdict

Pending completion of 7A, 7B, 7C, final-tip validation, and exact aggregate
review. Do not begin Phase 8 from this record until the exact reviewed range and
verdict are recorded.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
