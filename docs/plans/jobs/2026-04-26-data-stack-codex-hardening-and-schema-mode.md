---
title: "Data stack Codex hardening and schema mode follow-up"
created-date: 2026-04-26
status: completed
agent: codex
---

## Scope

Completed Phase 10 and Phase 11 of `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`.

This job closes the interactive Codex hardening and schema-mode product-contract follow-up after the Phase 9 checkpoint work.

## Changes

- Added `--schema-mode <strict|union-by-name|auto>` to direct `data stack`.
- Kept `--union-by-name` as a temporary compatibility alias that prints a concise migration warning to `--schema-mode union-by-name`.
- Implemented deterministic `auto` schema analysis: strict first, then safe union-by-name for schema mismatches, with a concise failure when widening is ambiguous.
- Made interactive schema setup default to `Analyze automatically` while keeping explicit strict and union-by-name choices.
- Fixed the Codex structured-output schema so recommendation patch values have an explicit JSON Schema `type`.
- Added Codex patch support for `/schema/mode`.
- Sanitized interactive Codex/provider failures so raw provider JSON is not printed during normal interactive use.
- Cleared the interactive analyzer status before printing Codex success or failure output.
- Bounded matched-file and input-source previews in interactive stack review.
- Added a `csv-many-files` fixture family and kept the fixture generator snapshot in sync.
- Updated the data-stack guide, research, and implementation plan status/checklist.

## Evidence

Focused validation:

```bash
bun test test/data-stack-codex-report.test.ts test/cli-command-data-stack.test.ts test/cli-interactive-routing.test.ts test/data-stack-fixture-generator.test.ts
bun run lint
```

Reviewer follow-up:

- Maintainability, test, and docs reviews were requested for this implementation slice; findings were addressed before closure.

## Notes

- Direct CLI remains fail-closed with strict matching as the default.
- `--schema-mode auto` does not require Codex and does not silently guess through ambiguous schemas.
- Codex schema recommendations remain advisory until accepted or edited into deterministic stack-plan fields.
