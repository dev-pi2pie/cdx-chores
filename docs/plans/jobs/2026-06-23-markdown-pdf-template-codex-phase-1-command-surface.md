---
title: "Markdown PDF template Codex phase 1 command surface"
created-date: 2026-06-23
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implemented Phase 1 of the direct `md pdf-template codex` plan.

This phase wires the public command surface, shared option/state types, and early
normalization/validation boundary. It intentionally stops before signal
collection and template synthesis, which start in later phases.

## Changes

- Added `md pdf-template codex [input]` under the existing `md pdf-template`
  command family.
- Added command options for intent, repeatable font hints, base profile, cover
  image, output bundle, dry-run, Codex report output, overwrite, and recipe flag
  parity with `md pdf-template init`.
- Added shared template-Codex types for command options, normalized command
  state, signal modes, decision modes, template families, image fit, orientation
  buckets, and fit pressure.
- Added a reusable command-state normalizer that resolves positional/`--input`
  aliases, trims text hints, validates recipe flags, parses base profiles,
  checks cover image path/extension support, and validates JSON report paths.
- Added an action boundary that validates Phase 1 command state and then fails
  explicitly until Phase 2 signal collection is implemented.
- Added CLI help, command-layer validation, and action-level normalization tests.
- Updated the implementation plan checklist for Phase 1.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-template-codex.test.ts
bun test test/cli-actions-md-to-pdf-commands.test.ts
bun run format:check
bun run lint
bun run build
git diff --check
bun test
```

Result: all commands passed. The full suite reported 1204 tests passed and 0
failed.

## Artifact Safety

No generated template bundles, Codex reports, PDFs, profiles, or local resource
artifacts were created or staged.
