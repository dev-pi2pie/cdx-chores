---
title: "Revise AGENTS doc lifecycle and archive policy"
created-date: 2026-03-29
status: completed
agent: codex
---

## Goal

Update `AGENTS.md` so documentation lifecycle, archive scope, and status selection rules match the current discussion about research, plans, and job records.

## What Changed

- added a documentation lifecycle policy that separates status from archive location
- documented the recommended `docs/` structure with `researches/archive/` and `plans/archive/`
- clarified that only research docs and top-level plans should be archived in the first reorganization pass
- kept job records in `docs/plans/jobs/` and documented that they should not be archived yet
- expanded plan, research, and job status sets to cover `blocked`, `cancelled`, and `superseded` where appropriate
- clarified that new research docs should default to `draft` unless they backfill already-finished research
- clarified that research `completed` means the research is finished, not necessarily implemented
- preserved the existing `Writing Guidelines` and `Philosophy` sections

## Files

- `AGENTS.md`

## Verification

- reviewed the existing `AGENTS.md` structure before patching
- updated only the documentation-convention area and left the later guidance sections intact
