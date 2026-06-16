---
title: "Markdown PDF Codex profile Phase 6.4.1 table signal layout policy"
created-date: 2026-06-16
status: completed
agent: codex
---

## Scope

Complete Phase 6.4.1 of the Markdown PDF Codex profile helper by making bounded Markdown table signals a first-class layout-selection fact in the Codex prompt.

## Failure Cause

Live PDF review showed a command-overview table rendered into a narrow portrait profile even though the document had table-fit risk. The helper already collected bounded table signals, but those counts were buried inside raw document signals and the prompt did not explain how table-fit evidence should interact with generic style wording.

The issue is not template-level table design. Exact column widths, arbitrary table CSS, rotated single pages, and bespoke table beautification remain outside the profile schema and belong to custom templates or later template-Codex research.

## Fix

- Added a derived `tableLayoutSignal` fact to the prompt payload.
- Classified table layout risk as:
  - `strong` when table rows overflow the bounded scan limit, line width is high, or column count is very high
  - `weak` when tables exist but do not show strong fit risk
  - `none` when no table layout signal is present
- Added a signal ladder for Codex:
  - `overflowRows`
  - `maxLineWidth`
  - `maxColumns`
  - `scannedRows`
- Added prompt guidance that strong table layout risk should prefer the `wide-table` candidate or equivalent landscape/table-friendly patches unless the user explicitly requires portrait.
- Added prompt guidance that weak table signals should not force landscape.
- Added template-only boundary facts for:
  - custom table column widths
  - arbitrary table CSS
  - rotated individual pages
  - exact table beautification

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts`
  - 12 pass, 0 fail
- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 47 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `bun run build`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun test`
  - 1173 pass, 0 fail

## Smoke

- `node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with table-friendly layout" --dry-run`
  - used `--dry-run` without report flags, so no profile or report artifact was requested
  - sandboxed smoke reached Codex initialization and stopped at the app-server permission boundary before a live Codex response:

```text
Codex Markdown PDF profile helper is unavailable. Codex Exec exited with code 1: WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Reading prompt from stdin...
Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)
```

## Artifact Safety

- `git status --short --untracked-files=all` after the smoke run showed only source, test, and documentation changes.
- No generated Markdown PDF profile, Codex report, PDF, local resource, or replay artifact was staged or committed.
