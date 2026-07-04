---
title: "Markdown PDF project Codex phase 3 output planning"
created-date: 2026-07-04
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implemented Phase 3 of the `md pdf-project codex` plan.

This phase adds project identity, output planning, and collision preflight
helpers. It does not collect project signals, run profile/template synthesis,
write project artifacts, or validate render compatibility.

## Changes

- Added project identity generation for `projectBundleId`, `profile.id`, and
  `templateBundleId` from one timestamp/UID pair.
- Added project output planning for generated default directories and explicit
  `--output` directories.
- Planned fixed project-owned outputs: `profile.yml`, `template.html`,
  `style.css`, optional `assets/cover.*`, and optional
  `project.codex-report.json`.
- Added output directory preflight for non-empty directories, symlink
  directories, and bounded generated-directory retries.
- Added project source/sink collision checks across Markdown input, base
  profile, cover image source, output directory, generated files, managed asset
  targets, and explicit report paths.
- Split project-Codex types by command-state, identity, modes, output, phase,
  and report concerns before the project contracts grow further.
- Added Phase 2 review follow-up coverage for standalone
  `--keep-codex-report` normalization and command-level placeholder wiring.

## Notes

Default output planning is gated by project signal mode. `too-low-signal`
cannot plan generated project directories, matching the research decision that
default project bundles should only be derived after signal classification
allows the command to proceed.

Path planning preserves selected CLI paths for display and replay, while
collision checks use both resolved paths and existing-file identity checks.

## Review Follow-up

Phase 3 commit review found useful maintainability and coverage gaps:

- output-directory retry logic should not build a dummy identity before the
  winning directory is known.
- project output collision checks and writability checks should derive from one
  planned-target inventory.
- project and template output safety checks should share one path-policy helper
  to avoid drift.
- tests should cover actual planned target files, non-directory output paths,
  generated file-name collisions, and more source/sink collision pairs.

Follow-up changes split identity-value derivation from final identity assembly,
centralized planned project path targets, extracted shared Codex output path
policy helpers, and added the missing regression coverage.

A final test-review pass found two remaining coverage gaps:

- explicit report output paths should be checked against generated project
  targets by existing-file identity, not only by exact path.
- project cover asset bundle paths should pin uppercase-extension
  normalization and extensionless-source fallback behavior.

Those final coverage gaps are now covered in the project output-plan tests.

A later test-review pass found two remaining output safety boundaries that were
still implicit:

- generated project directory retry should prove success on the final allowed
  attempt, not only first retry and exhaustion.
- external `--codex-report-output` paths should reject directories and symlinks,
  matching the same path-policy guardrails used for managed project outputs.

Those boundaries are now covered in the project output-plan tests.

A post-commit Phase 3 range review found additional safety and maintainability
follow-ups:

- shared project/template Codex output preflight needed ancestor-symlink checks,
  not only leaf symlink checks.
- overwrite preflight needed to reject pre-planted hardlinks that alias
  unrelated files.
- project planned-target metadata needed one descriptor source for collision,
  inside-output, parent-symlink, and writability validation.
- deterministic project identity UID generation should remain a planner/test
  seam instead of being stored in normalized command state.
- project collision tests needed explicit coverage for output/source collisions
  and base-profile/cover-image aliasing.

Those follow-ups are now implemented in the shared Codex output path policy,
the project output planner, and the project/template output-target tests.

The final range review found two last test/safety refinements:

- symlinked runtime working directories should not be trusted as safe output
  roots.
- source/source and output/source collision tests should include alias-based
  paths, not only literal duplicate path strings.

The shared path policy now inspects the trusted root itself, and the project and
template output tests cover symlinked `cwd` plus alias-based source collision
cases.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts test/cli-actions-md-to-pdf-project-codex/command-state.test.ts test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
bun test
git diff --check
```

Result: all commands passed. The full suite reported 1378 tests passed and 0
failed.

## Artifact Safety

Tests planned output paths only. No generated project bundles, profiles,
templates, CSS files, copied assets, PDFs, or Codex reports were created or
staged as deliverable artifacts.
