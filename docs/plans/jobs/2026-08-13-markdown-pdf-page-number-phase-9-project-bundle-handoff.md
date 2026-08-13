---
title: "Markdown PDF page-number Phase 9 Project bundle handoff"
created-date: 2026-08-13
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Complete the Project-helper handoff from the final Phase 8 validation result to
human review, the optional Project report, complete-bundle validation, and the
normal `md to-pdf` renderer entry point.

Phase 9 must not persist another page-number configuration object or an
Interactive one-render override. Phase 10 owns selected-source Interactive
rendering; Phase 12 owns renderer-version, extraction, visual, and layout
acceptance.

## Starting Boundary

- Starting commit: `78701f3a`.
- Phase 8 is complete and the parent plan remains `active`.
- Preserved working-tree code from the abandoned execution is candidate work;
  it is not completion evidence until recommitted, validated, and reviewed.

## Implementation Checklist

- [ ] Project reports add one bounded handoff projection containing the final
      Profile identity and canonical `profile.yml` reference, artifact and
      render state, structured diagnostics, and advisory capability
      requirements.
- [ ] Preserve report version `1` additively: historical reports may omit the
      handoff field, and no existing field changes meaning.
- [ ] Derive the follow-up render command from fixed public arguments; never
      trust or persist a raw command or Interactive page-number override.
- [ ] Keep direct and Interactive Project review separated into contained
      Profile behavior, Template presentation, and Project orchestration.
- [ ] Make Project-helper completeness require exactly one valid
      `profile.yml`, `template.html`, and `style.css`, with only recognized
      reports and managed assets optional.
- [ ] Preserve generic resolver support for Profile-only, Template/CSS-only,
      and other ordinary partial bundles.
- [ ] Cover dry-run, report-only, successful write, validation failure,
      missing/duplicate/invalid roles, unrelated files, report exclusion, and
      public-safe terminal/report output.
- [ ] Prove bundle and explicit-role selection of the same canonical Project
      files prepare equivalent Profile, page-number, diagnostic, capability,
      Template, CSS, and renderer inputs.

## Public-Safe Boundary

- Reports and review may contain stable public IDs, canonical bundle-relative
  role paths, finite state values, sanitized messages, and declared minimum
  renderer versions.
- They must not contain resolved private paths, usernames, raw errors or stack
  traces, raw probe output, executable paths, environment details, URLs, or
  terminal control characters.
- Validation failure must not claim usable Project artifacts or a usable
  follow-up command.

## Verification

Run focused tests while implementing, then run these gates at the final Phase 9
implementation tip:

```bash
bun test test/cli-actions-md-to-pdf-project-codex --timeout 30000
bun test test/cli-actions-md-to-pdf-bundle.test.ts --timeout 30000
bun test test/cli-actions-md-to-pdf-prepared-render.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/codex-authoring.test.ts --timeout 30000
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Run one small local handoff smoke under the ignored
`examples/playground/md-pdf/smoke/phase9-project-handoff/<unique-run>/` path.
Cover report-only or dry-run with no Project-role writes, complete Project
output, report exclusion, and bundle-versus-explicit installed-renderer
handoff. Record only sanitized outcomes, the public renderer version,
limitations, and whether cleanup removed the run. Do not commit smoke files or
claim layout or visual acceptance.

## Commit And Review

- [ ] Commit the coherent Phase 9 implementation and tests.
- [ ] Record focused and aggregate verification from that committed tip.
- [ ] Review the exact `78701f3a..<implementation-tip>` range with
      maintainability and test-quality reviewers.
- [ ] Resolve accepted findings, widen the tip, rerun affected gates, and
      re-review when necessary.
- [ ] Have the completed job and parent checklist reviewed as documentation.
- [ ] Commit the documentation-only closeout; use that commit as the Phase 10
      starting boundary.

`@auto_commit_notification` is used only at the implementation and closeout
boundaries, or for a necessary accepted-review correction.

## Evidence

- Implementation commit: pending.
- Final implementation tip: pending.
- Exact reviewed range: pending.
- Smoke result and cleanup: pending.
- Final verdict: pending.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
