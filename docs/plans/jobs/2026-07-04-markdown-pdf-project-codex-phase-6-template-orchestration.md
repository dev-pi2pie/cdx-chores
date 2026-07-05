---
title: "Markdown PDF project Codex phase 6 template orchestration"
created-date: 2026-07-04
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implemented Phase 6 of the `md pdf-project codex` plan.

This phase adds the project template orchestration helper. It does not perform
final project validation, write project artifacts, copy assets, connect the
helper to the public command action, or implement project reports and summaries.

## Changes

- Added `project-codex/template-phase.ts` to run template synthesis after the
  profile phase.
- Reused the project output plan for the template bundle id, fixed
  `template.html`, fixed `style.css`, managed assets, and report planning.
- Built template signals from the final profile so profile-owned recipe, title,
  and font decisions remain the template compatibility target.
- Kept deterministic template synthesis for base-profile-only,
  cover-image-only, combined deterministic, and profile-assisted plain Markdown
  requests.
- Routed local cover images through the project managed-asset plan under
  `assets/`.
- Escalated template Codex only for template-owned layout signals or forwarded
  unmatched profile directions.
- Used the shared direct read-only workspace Codex runner for default project
  template recommendations.
- Added phase-aware project template Codex progress text.
- Avoided writing template files, CSS files, copied assets, or reports during
  the phase helper.
- Added focused tests for deterministic paths, profile-assisted deterministic
  template synthesis, document table signal escalation, forwarded profile
  directions, current workspace Codex execution, and no partial artifact
  writes.

## Notes

The template phase treats the final profile as the compatibility target. A
strong table signal can still escalate template Codex for template-owned layout,
but recipe preset ownership remains with the final profile when the profile
phase already selected the recipe.

## Verification

Focused verification:

- `bun test test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`:
  6 passing tests with 66 assertions.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts`:
  29 passing tests with 120 assertions.
- `bunx tsc --noEmit`: passed.

Full verification:

- `bun run format:check`: passed.
- `bun run lint`: passed.
- `bunx tsc --noEmit`: passed.
- `bun run build`: passed.
- `bun test`: 1412 passing tests with 7059 assertions.
- `git diff --check`: passed.

## Code Review Follow-up

The Phase 6 commit-range review found one local orchestration alignment issue
and two test-coverage gaps before Phase 7. The final trust-boundary re-review
then found one Codex runner alignment issue and one model-originated free-text
hygiene issue.

Follow-up changes:

- Changed template phase base-profile prompt facts to summarize the final
  project profile identity and fields instead of the pre-adaptation selected
  profile candidate.
- Added focused coverage proving adapted profile recipe ownership is exposed to
  the template phase as the final project profile.
- Added focused coverage for conservative-fallback and no-usable-template
  decisions, including project phase decision mapping and TTY progress status.
- Added direct-runner coverage proving default and injected template runners
  receive the project workspace.
- Kept default template execution on the same current read-only workspace
  contract as the direct template helper.
- Sanitized template Codex model-originated warnings, unsupported directions,
  and fallback reasons to redact local paths and remote URLs before phase
  summaries or reports can persist them.

Deferred maintainability notes:

- The review suggested extracting a separate project-to-template signal
  projector and passing forwarded profile directions as structured data instead
  of appending them to template intent. This is deferred until Phase 7-8 define
  the stable validation/report boundary; the current Phase 6 helper keeps the
  projection local and avoids adding a new public adapter contract before the
  write/report phases exist.
- The review also noted that Codex transport assertions are
  implementation-aware. Those assertions remain intentionally focused here
  because earlier phases found material runner-boundary regressions in the same
  Codex execution path.

Focused verification:

- `bun test test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`:
  8 passing tests with 83 assertions.
- `bun test test/adapters-codex-shared.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`:
  109 passing tests with 717 assertions.
- `bun run format:check`: passed.
- `bun run lint`: passed.
- `bunx tsc --noEmit`: passed.
- `bun run build`: passed.

## Artifact Safety

Tests materialized template synthesis results in memory only. No project
bundles, profiles, templates, CSS files, copied assets, PDFs, or Codex reports
were created or staged as deliverable artifacts.
