---
title: "Markdown PDF project Codex phase 4 signal classification"
created-date: 2026-07-04
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implemented Phase 4 of the `md pdf-project codex` plan.

This phase adds project-level signal collection and signal-mode
classification. It does not run profile Codex, run template Codex, validate
project compatibility, write artifacts, or change the public action beyond
exporting reusable project signal helpers.

## Changes

- Added `project-codex/signals.ts` to collect shared Markdown document,
  base-profile, font-hint, recipe, title, and cover-image signals once.
- Added `project-codex/signal-mode.ts` to classify project-level signal mode
  plus profile-native and template-native phase signal modes.
- Reused the existing profile document/font signal collectors.
- Reused the template cover-image, recipe, and title signal logic where it
  matches the project contract.
- Kept plain Markdown input as a profile-Codex signal without forcing template
  Codex unless template-owned document or intent signals are present.
- Exported the project signal collection and classification helpers for later
  phase orchestration.
- Split the expected Phase 5 and Phase 6 job records so profile orchestration
  and template orchestration can be reviewed independently.

## Notes

Project signal mode is conservative:

- no signal is `too-low-signal`.
- base-profile-only, cover-image-only, and base-profile-plus-cover-image are
  deterministic.
- Markdown input, intent, and font hints are `codex-assisted` at the project
  level because the profile phase may need Codex.
- template phase mode becomes `codex-assisted` only for template-owned intent,
  forwarded profile directions, or strong table-layout document signals.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-project-codex/signals.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
bun test
git diff --check
```

Result: passed. Focused signal tests reported 2 passing tests and the full
suite reported 1388 passing tests with no failures.

## Code Review Follow-up

The post-commit Phase 4 review found no material security issue, then requested
stronger regression coverage and a tighter signal contract before Phase 5.

Follow-up changes:

- Added typed table-only direction constants so project template-owned document
  directions use the same source of truth as profile layout policy.
- Split the selected profile basis from base-profile availability so fallback
  default profiles are not exposed as a base-profile payload.
- Added one full signal-mode classifier entry point for the typed project facts.
- Added tests for base-profile plus intent/font-hint cross-products.
- Added assertions for `requiresCodex` and the full forwarded table-only
  direction list.

## Artifact Safety

Tests collect and classify signals only. No project bundles, profiles,
templates, CSS files, copied assets, PDFs, or Codex reports were created or
staged as deliverable artifacts.
