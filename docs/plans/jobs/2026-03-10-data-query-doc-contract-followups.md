---
title: "Resolve data query doc contract follow-ups"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Resolve the documentation follow-ups from the `data query` review by clarifying the output-flag contract and removing conflicting Codex drafting ownership between related plans.

## What Changed

- updated the research doc to freeze `--json` and `--output <path>` as mutually exclusive in v1
- updated the direct CLI implementation plan to match that output-flag contract explicitly
- updated the CLI Codex drafting plan to own the shared Codex drafting contract
- updated the interactive query plan so `Codex Assistant` reuses the CLI Codex drafting contract instead of redefining it

## Verification

- reviewed the updated research decision sections for output-mode consistency
- reviewed the direct CLI plan output-contract and phase checklist after the change
- reviewed the CLI Codex and interactive plans for sequencing and ownership consistency

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
