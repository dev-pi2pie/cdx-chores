---
title: "Delimited-text plan review follow-up"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Address review findings on the delimited-text preview and conversion parity plan so the implementation contract is explicit before work starts.

## What Changed

- updated `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`
- added `modified-date` to the plan front matter
- clarified that delimited-to-delimited conversions must stay on a row-array path and preserve blank headers, duplicate headers, and wider-than-header rows
- clarified that delimited-to-JSON conversions intentionally keep the current lossy object contract for blank headers, duplicate headers, and extra trailing cells
- clarified that `data preview` keeps its existing preview-specific header normalization rules instead of inheriting JSON conversion semantics
- expanded the test checklist to cover round-trip delimiter parity, quoted delimiter/newline edge cases, CLI command wiring/help text, and JSON-only `--pretty` exposure
- tightened success criteria and manual smoke guidance so “parity” is defined in terms of preserved row shape rather than vague shared semantics

## Files

- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`

## Verification

- reviewed the revised plan for consistency against current helper behavior in `src/utils/csv.ts`
- reviewed the revised plan for consistency against current preview normalization behavior in `src/cli/data-preview/source.ts`
- reviewed the revised plan for consistency against existing CLI UX coverage expectations in `test/cli-ux.test.ts`

## Related Plans

- `docs/plans/archive/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`
