---
title: "Markdown PDF project Codex phase 2 command surface"
created-date: 2026-07-04
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implemented Phase 2 of the `md pdf-project codex` plan.

This phase registers the public command surface and adds the shared
project-Codex option and report types. It does not implement project output
planning, signal collection, phase orchestration, writes, or render
compatibility validation.

## Changes

- Added `src/cli/markdown-pdf/project-codex/` with shared project-Codex types,
  command-state normalization, and a thin action entry.
- Added `src/cli/actions/markdown/pdf-project-codex.ts` as a thin re-export of
  the project-Codex action boundary.
- Registered `md pdf-project codex [input]` under the Markdown command tree.
- Added public options for `--input`, `--intent`, repeatable `--font-hint`,
  `--base-profile`, `--cover-image`, `--output`, `--dry-run`,
  `--keep-codex-report`, `--codex-report-output`, and `--overwrite`.
- Kept recipe flags off the project command surface so Commander rejects them
  as unknown options.
- Added normalized project signal-mode, decision-mode, identity, phase-summary,
  and report artifact types.
- Added command-state and command-wiring tests for the new project command.

## Notes

The Phase 2 action validates command-state inputs and then fails with
`MARKDOWN_PDF_PROJECT_CODEX_NOT_IMPLEMENTED`. Later phases replace that
placeholder with output planning, signal classification, orchestration,
validation, report writing, and project writes.

## Review Follow-up

Phase 2 commit review found two useful gaps:

- project and template Codex command-state normalization duplicated the same
  optional text, list, path, and dual-input identity handling.
- project phase summaries allowed impossible phase/signal-mode combinations.
- tests covered positional input forwarding but not the explicit `--input`
  command alias or symlink/differently-resolved same-file input aliases.

Follow-up changes added a shared Markdown PDF Codex command-state helper, moved
template and project normalization to that helper, tightened project phase
summaries into a discriminated union, and added explicit alias coverage.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-project-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-project-codex/command-state.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
bun test
git diff --check
```

## Artifact Safety

No generated profiles, templates, CSS files, copied assets, PDFs, project
bundles, or Codex reports were created or staged.
