---
title: "Interactive abort tip timing and styling follow-up"
created-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Fix the interactive abort-tip timing so it appears at flow entry, restyle it as a quieter tip instead of a normal status line, and narrow the tip to the longer interactive flows where it adds value.

## What Changed

- moved the shared abort-tip timing earlier in:
  - `src/cli/interactive/data-query/index.ts`
  - `src/cli/interactive/data/extract.ts`
- restyled the shared notice in `src/cli/interactive/notice.ts` so it renders as a spaced tip block:
  - blank line before
  - `Tip:` label
  - subdued body text
  - blank line after
- removed the tip from the lightweight interactive preview flow in:
  - `src/cli/interactive/data/preview.ts`
- updated the preview guide so it no longer documents a preview abort tip:
  - `docs/guides/data-preview-usage.md`
- updated focused interactive routing coverage for:
  - styled tip rendering in longer flows
  - absence of the tip in interactive `data preview`
  - absence of the tip on preview input-format failures

## Why

The first shared rollout proved the helper extraction, but the initial placement still felt off in real terminal use:

- the tip could read like a normal status line instead of guidance
- the lightweight preview flow did not justify the extra visual weight
- preview failures made the tip feel coupled to the error path rather than to the interactive flow itself

The follow-up keeps the tip where it is useful while reducing visual noise in shorter flows.

## Verification

- `bun test test/cli-interactive-notice.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`

## Related Jobs

- `docs/plans/jobs/2026-03-30-shared-interactive-ux-first-rollout.md`
