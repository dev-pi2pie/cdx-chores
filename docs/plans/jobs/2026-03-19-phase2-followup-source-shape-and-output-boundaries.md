---
title: "Phase 2 follow-up for source-shape and output boundaries"
created-date: 2026-03-19
status: draft
agent: codex
---

## Goal

Resolve the two intentionally deferred Phase 2 items from `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md` now that Phase 3 and Phase 4 have stabilized the interactive data-query and DuckDB query boundaries.

## Deferred Items To Reassess

- extract shared source-shape review or artifact-resolution helpers where duplication is real
- isolate reusable output/write-decision helpers

## Why This Follow-up Exists

These items were not completed during the original Phase 2 pass because the abstraction boundaries were still too unstable:

- source-shape logic was split between direct CLI artifact-writing flows and interactive review loops, but those flows were not yet aligned enough to share a module cleanly
- output and write-decision logic still risked collapsing into an unfocused helper bucket rather than a real workflow-owned boundary

After Phase 3 and Phase 4:

- `src/cli/interactive/data-query/` is now folder-based
- `src/cli/duckdb/query/` is now folder-based

That makes it reasonable to do a narrower reassessment without mixing the work into the Codex document adapter split or the later `fs-utils` cleanup.

## Scope

- `src/cli/actions/data-extract.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/interactive/data.ts`
- `src/cli/interactive/data-query/`
- `src/cli/data-workflows/`

## Intended Outcome

### Source-shape boundary

Evaluate whether a clean shared helper now exists for:

- reviewed source-shape suggestion flow
- accepted source-shape artifact reuse
- source-shape follow-up messaging where behavior is genuinely shared

If the abstraction is now clean, introduce:

- `src/cli/data-workflows/source-shape-flow.ts`

If it is still not clean, keep the item deferred and record why.

### Output/write-decision boundary

Evaluate whether a focused shared helper now exists for:

- choosing file output mode
- overwrite decisions
- reusable summary or confirmation behavior

Only introduce a shared helper if the result has clear workflow ownership and does not become a generic dumping ground.

Possible destination if justified:

- `src/cli/data-workflows/output.ts`

## Constraints

- keep the work structural rather than semantic
- do not force an abstraction just to close a checkbox
- prefer leaving an item deferred over introducing a vague shared helper

## Verification Plan

- `bun test test/cli-actions-data-query.test.ts`
- `bun test test/cli-actions-data-extract.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-command-data-extract.test.ts`
- `bun test test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`
