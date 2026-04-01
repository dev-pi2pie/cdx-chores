---
title: "Implement header-mapping artifacts and Codex review"
created-date: 2026-03-18
modified-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Land the first reviewed semantic-header workflow so `data query` can suggest, persist, review, reuse, and interactively accept header mappings without introducing hidden state.

## What Changed

- added a shared header-mapping module for:
  - JSON artifact schema handling
  - input-reference normalization
  - filename generation in the `data-header-mapping-<uid>.json` family
  - strict exact-match reuse checks
  - preserve-unknown-fields artifact rewrite behavior
  - Codex header-suggestion prompting and normalization
  - accepted-mapping validation before query re-binding
- updated shared DuckDB source preparation so accepted mappings become part of the same shaped-source state as `--source` and `--range`
- added direct `data query` review flags:
  - `--codex-suggest-headers`
  - `--write-header-mapping <path>`
  - `--header-mapping <path>`
- kept the first direct CLI flow explicitly two-step:
  - suggestion run writes the artifact and stops
  - follow-up run reuses the accepted artifact plus `--sql`
- added interactive header review when generated placeholder columns are present:
  - `Accept all`
  - `Edit one`
  - `Keep generated names`
- added the shared schema-and-mapping guide and linked the query guides back to it
- completed the checklist in `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/data-query-header-mapping.test.ts test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts`

## Follow-up Fixes

- adjusted `writeDataHeaderMappingArtifact` so `--overwrite` replaces an existing non-artifact file instead of failing artifact parsing first
- added regression coverage for overwriting invalid JSON at a header-mapping output path

## Notes

- public docs stay behavior-oriented and do not disclose private repro files under `examples/playground/issue-data/`
- first-pass reuse is strict exact input-context matching only; file fingerprints and stale-file detection remain deferred
- interactive review is in-memory for now; persisted artifact review is the direct CLI path

## Related Plans

- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/archive/plan-2026-03-18-data-extract-shaped-table-materialization.md`

## Related Research

- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
