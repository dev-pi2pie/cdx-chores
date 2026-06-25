---
title: "Markdown PDF template Codex phase 8.2 progress feedback"
created-date: 2026-06-24
modified-date: 2026-06-24
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.2 of the direct `md pdf-template codex` plan.

This phase restores runtime feedback parity with `md pdf-profile codex` for
Codex-assisted template decisions. Deterministic template paths should stay
quiet, while actual Codex-assisted requests should show the same direct-Codex
progress contract used by the profile helper.

## Sequence

1. Compared the existing `md pdf-profile codex` progress behavior with the
   template action.
2. Reused the shared `startDirectCodexProgress` helper in the template action.
3. Scoped progress output to `codex-assisted` template decisions only.
4. Preserved deterministic template generation without Codex progress output.
5. Added non-TTY, TTY success, TTY fallback, TTY no-usable-template, and
   runner-unavailable progress coverage.
6. Ran focused validation and repository gates.
7. Requested auto-commit notification before committing meaningful progress.
8. Requested code review on the Phase 8.2 commit range.

## Changes

- Wrapped `suggestMarkdownPdfTemplateWithCodex` calls in the existing
  direct-Codex progress helper.
- Added a template-specific progress label:
  `Requesting Codex Markdown PDF template recommendation`.
- Mapped adapted decisions to `done`, conservative fallback decisions to
  `fallback`, and no-usable-template decisions to `error`.
- Kept the adapter's existing runner-failure behavior: unavailable Codex
  becomes a no-usable-template decision, and progress still stops as `error`.
- Added action-level tests mirroring the profile helper's progress coverage.
- Added deterministic-path coverage proving no Codex progress line is emitted
  when no Codex request is made.

## Verification

- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed after implementation: 133 tests.
- `bunx tsc --noEmit`
  - Passed after implementation.
- `bun run lint`
  - Passed after implementation.
- `bun run format:check`
  - Passed after formatting the touched integration test.
- `bun run build`
  - Passed after implementation.
- `bun test --timeout 30000`
  - Passed after implementation: 1292 tests.
- `git diff --check`
  - Passed after implementation and after formatting.

## Review

- `auto_commit_notification` was requested before the implementation commit;
  the thread limit blocked a fresh advisor, so the existing `Commit Scout the
  9th` thread was reused.
- Phase 8.2 code review range: `2d9bdd4..a2944fb`.
- Review requests were sent to `Plainspoken the 6th` and `Probe the 6th`.
- `Plainspoken the 6th` returned no material findings.
- `Probe the 6th` returned no material findings.

Phase 8.2 implementation commit:

- `a2944fb` `feat(template-codex): show Codex progress for template decisions`
