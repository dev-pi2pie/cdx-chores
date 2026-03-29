---
title: "Archive pre-v0.0.7 completed research and plan docs"
created-date: 2026-03-29
status: completed
agent: codex
---

## Goal

Move selected completed research and top-level plan docs created on or before the `v0.0.7` boundary into archive locations, while keeping current primary-reference docs in place.

## What Changed

- created `docs/researches/archive/` and `docs/plans/archive/`
- moved the agreed historical completed research docs into `docs/researches/archive/`
- moved the agreed historical completed top-level plan docs into `docs/plans/archive/`
- updated repository-relative links to the new archive paths across docs, guides, plans, research docs, and job records
- relabeled affected guide references to archived docs as historical plans or historical research

## Scope

- included only selected completed research docs and top-level plan docs created on or before the `v0.0.7` review boundary
- excluded `docs/plans/jobs/`
- excluded still-current completed contract/reference docs that should remain in their main folders

## Files

- `docs/researches/archive/`
- `docs/plans/archive/`
- affected repo-relative references across `docs/`
- guide updates in `docs/guides/`

## Verification

- confirmed archive folders exist
- confirmed the selected docs were moved to archive locations
- checked that old repository-relative paths for the moved docs no longer remain in the markdown docs set
