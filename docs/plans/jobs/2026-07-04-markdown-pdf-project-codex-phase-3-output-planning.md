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

## Verification

```bash
bun test test/cli-actions-md-to-pdf-project-codex/command-state.test.ts test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts test/cli-actions-md-to-pdf-project-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-commands.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
bun test
git diff --check
```

Result: all commands passed. The full suite reported 1373 tests passed and 0
failed.

## Artifact Safety

Tests planned output paths only. No generated project bundles, profiles,
templates, CSS files, copied assets, PDFs, or Codex reports were created or
staged as deliverable artifacts.
