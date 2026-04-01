---
title: "Archive approved v0.1.0 historical docs"
created-date: 2026-04-01
status: completed
agent: codex
---

## Goal

Archive the approved completed top-level plans and research docs for the `v0.1.0` release pass, update affected repository-relative links, and avoid creating a new top-level archive plan document for the move itself.

## What Changed

Moved these completed top-level plans into `docs/plans/archive/`:

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/archive/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`
- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`
- `docs/plans/archive/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/archive/plan-2026-03-29-inline-ghost-prompt-wrap-fix.md`

Moved these completed research docs into `docs/researches/archive/`:

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/archive/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/archive/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
- `docs/researches/archive/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

Also:

- updated repository-relative links that pointed at the moved plan and research docs
- removed the temporary top-level archive-scope draft created during release prep

## Why

- these docs describe already-shipped work and no longer need to stay in the primary top-level plan/research folders
- the active and draft docs remain easier to scan when completed historical references move to the archive location
- the archive move was approved directly, so a separate new top-level plan doc for the move was unnecessary

## Verification

- confirmed the approved files now exist under `docs/plans/archive/` and `docs/researches/archive/`
- checked repository-relative references for the moved docs and updated them to the archive paths
