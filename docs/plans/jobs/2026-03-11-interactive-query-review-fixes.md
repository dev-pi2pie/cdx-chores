---
title: "Fix interactive query review findings"
created-date: 2026-03-11
modified-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Address the review findings in the interactive `data query` flow and shared TUI key parser without regressing the newly added interactive query behavior.

## What Changed

- tightened `formal-guide` aggregate `ORDER BY` validation in `src/cli/interactive/data-query.ts`
- limited aggregate ordering to columns that are actually present in the result set:
  - grouped columns
  - `row_count` for `count`
  - `summary_value` for other aggregate modes
- fixed the shared keypress parser in `src/cli/tui/keys.ts` so a normal typed character is preserved after an unmatched `Esc` prefix
- hardened interactive file-output handling in `src/cli/interactive/data-query.ts`
- kept the prompt-side overwrite rejection path
- added a backend fallback so unexpected `OUTPUT_EXISTS` failures return the user to output selection instead of aborting the session
- extended the interactive harness in `test/helpers/interactive-harness.ts` to simulate existing output paths
- added regression coverage for:
  - invalid aggregate `ORDER BY` choices in `test/cli-interactive-routing.test.ts`
  - re-prompting after an existing output path is rejected in `test/cli-interactive-routing.test.ts`
  - preserving typed characters after `Esc` in `test/cli-tui-keys.test.ts`

## Verification

- `bun test test/cli-interactive-routing.test.ts test/cli-tui-keys.test.ts`
- `bun test test/cli-actions-data-query-codex.test.ts`
