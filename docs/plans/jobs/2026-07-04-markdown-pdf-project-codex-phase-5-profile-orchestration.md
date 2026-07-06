---
title: "Markdown PDF project Codex phase 5 profile orchestration"
created-date: 2026-07-04
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implemented Phase 5 of the `md pdf-project codex` plan.

This phase adds the project profile orchestration helper. It does not run the
template phase, perform final project validation, write project artifacts, copy
assets, or connect the helper to the public command action.

## Changes

- Added `project-codex/profile-phase.ts` to run profile selection before
  template synthesis.
- Reused the extracted profile-Codex service for Codex-assisted profile
  recommendations.
- Materialized deterministic base-profile-only and cover-image-only results in
  memory.
- Preserved the project-generated `profile.id` and forced serialization for
  the planned `profile.yml` path.
- Kept cover-image-only requests on the deterministic `basic-default` profile
  path while preserving the cover image as a template-phase signal.
- Forwarded unmatched profile directions for later template-phase handling.
- Added phase-aware profile Codex progress text for project orchestration.
- Added tests for deterministic profile materialization, Codex-assisted
  adaptation, unmatched-direction forwarding, no-usable-profile failure, and no
  partial `profile.yml` writes.

## Notes

The profile phase returns serialized profile text and normalized profile data
for later phases, but deliberately leaves filesystem writes to the final
validated project write step.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts test/cli-actions-md-to-pdf-project-codex/signals.test.ts
bun test test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts test/cli-actions-md-to-pdf-project-codex/signals.test.ts test/adapters-codex-markdown-pdf-profile.test.ts
bun run format:check
bun run lint
bun run build
bunx tsc --noEmit
bun test
git diff --check
```

Result: passed. The initial focused project profile and signal tests reported 5
passing tests with 52 assertions. After review follow-up coverage, the focused
project profile, signal, and profile-adapter tests reported 28 passing tests
with 236 assertions. After the final coverage follow-up, the focused project
profile, signal, and profile-adapter tests reported 29 passing tests with 250
assertions. After the Phase 5 range re-review follow-up, the focused project
profile helper, project profile, signal, and profile-adapter tests reported 36
passing tests with 303 assertions. After the final Phase 5 review fix, the
focused profile helper, project profile, signal, and profile-adapter tests
reported 38 passing tests with 319 assertions. After the shared orchestration
extraction, the focused direct profile, project profile, helper, signal, and
profile-adapter tests reported 82 passing tests with 593 assertions. After the
final direct profile coverage follow-up, the focused direct profile, project
profile, helper, signal, and profile-adapter tests reported 83 passing tests
with 615 assertions. After the final Phase 5 range review fixes, the focused
direct profile, project profile, helper, signal, and profile-adapter tests
reported 83 passing tests with 621 assertions. The full suite reported 1405
passing tests with 6908 assertions and no failures.
After the final direct profile output-safety follow-up, the focused direct
profile, project profile, helper, signal, and profile-adapter tests reported
84 passing tests with 638 assertions. The full suite reported 1406 passing
tests with 6925 assertions and no failures.

## Code Review Follow-up

The post-commit Phase 5 reviews found security, test-coverage, and
maintainability follow-ups before Phase 6.

Follow-up changes:

- Extracted a shared no-write profile Codex orchestration core for candidate
  resolution, request assembly, Codex progress, selected-candidate lookup,
  identity creation, and final profile materialization.
- Switched both the direct `md pdf-profile codex` command and project profile
  phase to the shared orchestration core while keeping direct file/report
  writes outside the shared path.
- Collapsed public profile identity construction into one explicit
  source-discriminated builder.
- Removed unused public candidate lookup helpers now that selected-candidate
  lookup is owned by the shared orchestration core.
- Changed shared profile identity construction to require explicit `basedOn`
  lineage instead of deriving fallback lineage from `source`.
- Resolved usable Codex `selected_candidate_id` values through one checked
  orchestration helper and made `no-usable-profile` use explicit `"none"`
  lineage.
- Moved the shared no-usable profile message into the orchestration result so
  callers only attach command-specific report and error-code behavior.
- Reused the shared Codex planned-file writability policy for direct profile
  and report outputs.
- Passed a write root into direct profile and Codex report writes so parent
  symlink inspection and temp-replace overwrite behavior apply at write time.
- Added direct profile tests for symlinked output/report parent directories
  and hard-linked overwrite targets before Codex is called.
- Kept the shared default profile Codex runner on the caller working directory
  with a read-only sandbox.
- Kept explicit injected runners on the caller working directory so tests and
  deliberate local fake runners retain the same contract.
- Added adapter coverage for default runner timeout forwarding and
  structured-output setup classification.
- Updated direct profile default-runner coverage to assert current read-only
  workspace behavior.
- Added project profile coverage for base-profile refinements through the
  default read-only runner, including selected base summary and font facts.

Focused verification:

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts`:
  22 passing tests with 152 assertions.
- `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts`:
  46 passing tests with 317 assertions.
- `bun test test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts`:
  14 passing tests with 147 assertions.

Full verification:

- `bun run format:check`: passed.
- `bun run lint`: passed.
- `bunx tsc --noEmit`: passed.
- `bun run build`: passed.
- `bun test`: 1409 passing tests with 6953 assertions.
- `git diff --check`: passed.

## Artifact Safety

Tests materialized profiles in memory only. No project bundles, profiles,
templates, CSS files, copied assets, PDFs, or Codex reports were created or
staged as deliverable artifacts.
