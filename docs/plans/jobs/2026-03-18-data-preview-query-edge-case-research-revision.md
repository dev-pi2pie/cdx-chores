---
title: "Revise data preview/query edge-case research"
created-date: 2026-03-18
modified-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Revise the edge-case research doc so it reflects the current lightweight `data preview` contract, freezes the synthetic header naming recommendation, and clarifies where shared query-side shaping must attach.

## What Changed

- updated the research front matter with `modified-date: 2026-03-18`
- clarified that the current lightweight `data preview` lane now covers `.csv`, `.tsv`, and `.json`, while header-first behavior still applies to the delimited path
- revised the headerless preview recommendation from a CSV-only framing to a lightweight delimited-preview framing
- froze the recommended synthetic header naming as `column_n`
- clarified that `--no-header` should keep `--columns` and `--contains` targeting the generated preview column names
- clarified that Excel `--range` should attach to the shared relation-building layer so direct `data query`, interactive `data query`, and direct `data query codex` can reuse the same shaping seam
- replaced the earlier fuzzy walkthrough with one shared shaping/introspection loop that branches only in the pre-authoring stage
- corrected the ASCII walkthrough so `data preview` branches directly from shaping to rendering, while schema/sample introspection remains query-only
- added conservative Excel-only warning heuristics with concrete suspicious and non-suspicious examples
- clarified the recommended query-side flag progression after `--range`:
  - `--header-row <n>` before query-side `--no-header`
- resolved the prompt-copy direction so interactive shape resolution is framed as source interpretation before SQL authoring
- corrected the earlier deferred wording so shaping stays reusable in-memory across preview/query while `data extract` is the explicit implementation-scope materialization lane
- clarified that future query-side `--no-header` should apply to delimited `data query` inputs as well, not remain Excel-only
- clarified that any later Codex semantic header guesses should stay advisory on top of deterministic `column_n` contract names
- defined `data extract` as the separate materialization lane for shaped sources
- widened the `data extract` recommendation from Excel-only recovery to a broader shaped-table lane that also covers delimited inputs in the first pass
- elevated `--codex-suggest-headers` from a vague future idea to a concrete review-first shaping feature
- expanded the `--codex-suggest-headers` recommendation so it is first-slice scope for both `data extract` and a reviewed direct `data query` path
- added a minimal review UI recommendation for Codex-suggested semantic headers:
  - mapping table
  - `Accept all`
  - `Edit one`
  - `Keep generated names`
- defined the recommended direct-CLI `data query` review pattern around an explicit header-mapping artifact rather than a hidden accept-and-continue step
- separated the shared Codex header-suggestion engine from command-specific review and continuation UX
- froze JSON as the first-pass canonical header-mapping artifact format
- tightened the artifact decision further so header-mapping artifacts are JSON-only in the first implementation slice
- clarified that `version` means the artifact schema-contract version, not app-version history or edit-history snapshot
- added the recommended small `metadata` section plus input-reference direction for the JSON artifact shape
- froze the narrowest required first-pass JSON field set for the mapping artifact
- froze one shared filename convention across `data extract` and `data query`: `data-header-mapping-<uid>.json`
- resolved mapping reuse behavior to strict exact input-context matching in the first pass
- resolved mapping rewrite behavior to preserve unknown JSON fields and fail closed on unsupported schema versions
- revised the research verification notes to keep evidence behavior-oriented while removing over-detailed local repro mechanics
- made the public-doc guidance explicit that private issue-data fixture names and paths must stay undisclosed
- clarified that any later TTY-only accept-in-place shortcut should remain optional and still write the accepted mapping back to an explicit artifact
- decided that this feature family should ship with a dedicated schema-and-mapping guide, with related command guides linking back to it
- closed the remaining open questions for this research pass
- added related research and plan links for the delimited-text and `data query codex` tracks

## Verification

- reviewed the revised research doc against the current lightweight preview guide in `docs/guides/data-preview-usage.md`
- cross-checked the current generated-column behavior in `src/cli/data-preview/source.ts`
- cross-checked the current preview assertion for generated column names in `test/cli-actions-data-preview/rendering.test.ts`
- cross-checked the shared query-introspection seam in `src/cli/duckdb/query.ts`, `src/cli/interactive/data-query.ts`, and `src/cli/actions/data-query-codex.ts`
- reviewed the revised walkthrough, warning examples, and decision updates for consistency with the intended shared-helper architecture
- reviewed the new `data extract` and `--codex-suggest-headers` recommendations for consistency with the command-family split already used elsewhere in the repo
- reviewed the new mapping-artifact recommendation for consistency with the repo’s preference for explicit, reviewable CLI contracts

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`

## Related Research

- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/archive/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
