---
title: "Revise data preview/query edge-case research"
created-date: 2026-03-18
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
- updated the research open questions to focus on the remaining unresolved points after the contract discussion
- added related research and plan links for the delimited-text and `data query codex` tracks

## Verification

- reviewed the revised research doc against the current lightweight preview guide in `docs/guides/data-preview-usage.md`
- cross-checked the current generated-column behavior in `src/cli/data-preview/source.ts`
- cross-checked the current preview assertion for generated column names in `test/cli-actions-data-preview/rendering.test.ts`
- cross-checked the shared query-introspection seam in `src/cli/duckdb/query.ts`, `src/cli/interactive/data-query.ts`, and `src/cli/actions/data-query-codex.ts`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
