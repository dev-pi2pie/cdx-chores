---
title: "Complete codex auto flag routing alignment"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Align non-interactive rename flags with the interactive smart-router model by adding `--codex` as the common CLI auto-routing flag while preserving explicit analyzer controls.

## Implemented

- Added shared CLI Codex routing resolution in `src/cli/rename-interactive-router.ts`:
  - auto resolution from a single path
  - auto resolution from mixed path lists
  - CLI precedence resolution for `--codex`, `--codex-images`, and `--codex-docs`
- Updated command wiring in `src/command.ts`:
  - added `--codex` to `rename file`, `rename batch`, and `batch-rename`
  - updated help text to describe `--codex` as auto-routing by file type
  - clarified `--codex-images` and `--codex-docs` as explicit analyzer-only overrides
- Updated rename action handling in `src/cli/actions/rename.ts`:
  - normalize CLI Codex flags into one effective routing decision before analyzer execution
  - route `--codex` from effective file extension scope
  - preserve explicit-flag precedence when combined with `--codex`
  - preserve deterministic fallback for unsupported analyzer inputs
  - added explicit user-facing note when `--codex` finds no supported analyzer inputs
- Added coverage in tests:
  - `test/cli-rename-interactive-router.test.ts`
  - `test/cli-actions-data-rename.test.ts`
  - `test/cli-ux.test.ts`
- Updated docs:
  - `README.md`
  - `docs/guides/rename-common-usage.md`
  - `docs/guides/rename-scope-and-codex-capability-guide.md`
- Completed plan tracking in `docs/plans/plan-2026-02-27-codex-auto-flag-routing-alignment.md`

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`100 pass`, `0 fail`)

Focused test subset run and passed:

- `bun test test/cli-rename-interactive-router.test.ts test/cli-actions-data-rename.test.ts test/cli-ux.test.ts` ✅ (`54 pass`, `0 fail`)

Focused smoke check run and passed:

- `bun run src/bin.ts rename batch ./examples/playground/codex-auto-smoke --prefix smoke --codex --codex-images-timeout-ms 1 --codex-docs-timeout-ms 1 --dry-run` ✅
- output confirmed mixed-scope auto-routing behavior:
  - `Codex: analyzing 1 image file(s)...`
  - `Codex: analyzing 1 document file(s)...`
  - deterministic fallback remained safe when analyzer operations were force-bounded by low timeout values

## Related Plans

- `docs/plans/plan-2026-02-27-codex-auto-flag-routing-alignment.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`

## Related Research

- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
