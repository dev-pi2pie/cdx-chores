---
title: "MD frontmatter-to-json command implementation"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Implement `md frontmatter-to-json` in both flag mode and interactive mode, using the existing `src/markdown/*` parser utilities and documenting the output contract.

## Scope

- `src/cli/actions/markdown.ts`
- `src/cli/actions/index.ts`
- `src/command.ts`
- `src/cli/interactive.ts`
- `docs/guides/md-frontmatter-to-json-output-contract.md`

## Planned Verification

## Changes Made

- Added `actionMdFrontmatterToJson(...)` in `src/cli/actions/markdown.ts`.
- Reused `parseMarkdown(...)` from `src/markdown/*` and existing fs helpers for file read/write/output path handling.
- Implemented default wrapper output shape:
  - `{ frontmatterType, data }`
- Implemented `--data-only` output mode.
- Implemented `--pretty` formatting support (compact by default in flag mode).
- Added `md frontmatter-to-json` command wiring in `src/command.ts`.
- Added interactive `md -> frontmatter-to-json` submenu entry and prompt flow in `src/cli/interactive.ts`:
  - output destination (`stdout` vs file)
  - output shape (`wrapper` vs `data-only`)
  - pretty-print confirm (default yes)
- Added guide doc: `docs/guides/md-frontmatter-to-json-output-contract.md`.
- Added automated tests in `test/cli-actions-md-frontmatter-to-json.test.ts` covering:
  - action-level wrapper/data-only/file-output/error paths
  - CLI command wrapper/data-only/error paths
- Added README examples for `md frontmatter-to-json` (wrapper + `--data-only`).
- Updated `test/cli-ux.test.ts` version-output assertions to match the current formatted version label contract (`cdx-chores ver.<version>`).

## Verification

- Build/type check: `bun run build` passed.
- CLI smoke tests (using temporary fixtures in `examples/playground/`, then cleaned up):
  - default stdout wrapper output: passed
  - `--data-only` stdout output: passed
  - `--pretty` wrapper output: passed
  - `--output` file write: passed
  - overwrite protection without `--overwrite`: passed (error)
  - overwrite with `--overwrite`: passed
  - missing frontmatter error: passed
  - invalid frontmatter parse error: passed
- Interactive TTY smoke test:
  - `md` submenu shows `frontmatter-to-json`
  - route prompts appear and complete
  - stdout + `data-only` + pretty output path executed successfully
- Automated tests:
  - `bun test test/cli-actions-md-frontmatter-to-json.test.ts` passed
  - `bun test` passed (53 pass / 0 fail)

## Related Plans

- `docs/plans/archive/plan-2026-02-26-md-frontmatter-to-json-command.md`
