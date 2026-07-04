---
title: "Markdown PDF project Codex phase 1 profile service extraction"
created-date: 2026-07-04
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implemented Phase 1 of the `md pdf-project codex` plan.

This phase extracts the direct `md pdf-profile codex` implementation behind a
reusable profile-Codex service boundary before the project helper starts
composing profile and template phases.

## Changes

- Moved the direct profile-Codex implementation into
  `src/cli/markdown-pdf/profile-codex/run.ts`.
- Replaced `src/cli/actions/markdown/pdf-profile-codex.ts` with a thin action
  export that routes through the profile-Codex service.
- Added `src/cli/markdown-pdf/profile-codex/index.ts` and shared option types.
- Extracted profile signal-mode classification into
  `src/cli/markdown-pdf/profile-codex/signal-mode.ts`.
- Added `src/cli/markdown-pdf/profile-codex/synthesis.ts` so profile identity
  materialization and validation can happen in memory before a caller writes
  artifacts.
- Added `src/cli/markdown-pdf/profile-codex/write-profile.ts` so output-path
  format inference and profile serialization stay in the write boundary.
- Preserved existing direct helper behavior for deterministic fallback,
  Codex-assisted decisions, report writing, source/sink collision checks, and
  Codex progress output.
- Marked the project-helper plan `active` now that Phase 1 implementation has
  started.

## Review Follow-up

Phase 1 commit review found two useful gaps:

- The extracted synthesis seam still coupled profile materialization to output
  format inference and serialization.
- The focused tests did not pin JSON output serialization or the mixed
  `input` plus `fontHint` signal-mode precedence.

Follow-up changes split write serialization into `write-profile.ts`, kept
`synthesis.ts` focused on validated in-memory profile materialization, and
added regression coverage for both JSON output and document-informed precedence
when input and font hints are supplied together.

## Notes

The service boundary is intentionally behavior-preserving. Some recommended
future file splits, such as fully separate profile-Codex output-plan, report,
and write modules, remain inside the service runner until project orchestration
needs a narrower seam.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts test/adapters-codex-markdown-pdf-profile.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
bun test
git diff --check
```

Result: all commands passed. The full suite reported 1347 tests passed and 0
failed.

## Artifact Safety

No generated profiles, Codex reports, PDFs, template bundles, project bundles,
or local resource artifacts were created or staged.
