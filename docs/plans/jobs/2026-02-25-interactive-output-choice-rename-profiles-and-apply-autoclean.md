---
title: "Interactive output choice, rename profiles, and apply auto-clean"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement a set of UX/workflow improvements requested during interactive testing:

- optional output-path prompts should offer an explicit choice between default output and custom output
- `rename batch` should support preset file profiles (for example, media/docs) and expose profile selection in interactive mode
- `rename apply` should support auto-cleaning the generated plan CSV after successful apply, with interactive apply flows defaulting to auto-clean enabled

## Implemented

### Optional output path choice (interactive mode)

- Added a shared prompt helper to present:
  - `Use default output`
  - `Custom output path`
- Applied this to interactive optional-output flows:
  - `data json-to-csv`
  - `data csv-to-json`
  - `md to-docx`
  - `video gif`
- Custom output path entry still uses the inline ghost-hint path prompt

### Rename batch profiles

- Added `profile` support in `actionRenameBatch` filter logic with presets:
  - `images`
  - `media`
  - `docs`
  - `all` (or omitted) = no preset restriction
- Added CLI `--profile <name>` for:
  - `rename batch`
  - `batch-rename` alias
- Added interactive `rename batch` profile selection prompt

### Rename apply auto-clean

- Added `autoClean` support to `actionRenameApply(...)`
- Added CLI `rename apply --auto-clean`
- Interactive apply flows now prompt `Auto-clean plan CSV after apply?` with default `yes`:
  - `rename batch` dry-run -> `Apply these renames now?`
  - `rename file` dry-run -> `Apply this rename now?`
  - direct `rename apply` interactive flow

## Verification

- `bunx tsc --noEmit` (passed)
- `bun test test/cli-actions-data-rename.test.ts` (passed)

## Test Coverage Added

- `actionRenameBatch` preset profile filtering
- invalid `--profile` value handling
- `actionRenameApply` auto-clean deletes the plan CSV after successful apply

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
