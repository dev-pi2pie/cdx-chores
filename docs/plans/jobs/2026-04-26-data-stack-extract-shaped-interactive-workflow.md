---
title: "Data stack extract-shaped interactive workflow"
created-date: 2026-04-26
modified-date: 2026-04-26
status: completed
agent: codex
---

## Scope

Completed Phase 12 of `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`.

This job closes the follow-up that reopened the interactive `data stack` workflow after Phase 11. The goal was to make the flow closer to `data extract`: review sources and shape first, explain dry-run early, then preview deterministic work before write or plan save.

## Changes

- Added a source-discovery preview before schema setup.
- Made directory patterns reviewable before schema prompts, with a revise-pattern branch.
- Skipped pattern and traversal prompts for explicit file sources.
- Added early dry-run/replay copy: "save a replayable stack plan without writing output".
- Grouped stack review output into input discovery, schema analysis, duplicate/key diagnostics, and output target sections.
- Renamed the final action prompt to `Stack plan action`.
- Renamed the Codex checkpoint to `Codex-powered analysis checkpoint`.
- Labeled the Codex-backed action as `Analyze with Codex (powered by Codex)`.
- Renamed the deterministic schema option to `Automatic schema check` so it does not imply Codex.
- Updated interactive routing coverage for pattern revision, explicit-file pattern skipping, dry-run copy, review grouping, and Codex-powered labels.
- Updated the data stack guide, research, and implementation plan.

## Evidence

```bash
bun test test/cli-interactive-routing.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-command-data-stack.test.ts test/cli-interactive-routing.test.ts test/data-stack-fixture-generator.test.ts
bun run lint
bun run format:check
```

Result: passed.

The interactive routing coverage verifies source discovery before schema setup, pattern preview revision after a failed match, recovery-only actions for failed previews, explicit-file pattern skipping, early dry-run/replay copy, grouped stack review output, `Stack plan action`, and `Analyze with Codex (powered by Codex)` labeling.

The guide, research, and implementation plan were updated with the completed Phase 12 flow and status.

## Notes

- Direct CLI `--schema-mode auto` remains deterministic and does not require Codex.
- Codex-powered analysis remains an optional reviewed checkpoint after deterministic preview signals show likely value.
- Replay remains independent from Codex availability because accepted recommendations are materialized into deterministic stack-plan fields before write or dry-run save.
