---
title: "Complete Route A docs and smoke checks"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Finish the remaining documentation and verification tasks for the Route A rename timestamp-format plan so the plan can be closed.

## What Changed

- Updated `docs/guides/rename-common-usage.md`:
  - added Route A placeholder entries
  - added Route A example commands
  - added migration wording
  - linked the timestamp matrix guide
- Updated `docs/guides/rename-scope-and-codex-capability-guide.md`:
  - added a compact Route A timestamp summary
  - linked the timestamp matrix guide as the detailed reference
- Updated `README.md`:
  - expanded placeholder list with Route A placeholders
  - added Route A examples
  - added migration wording
  - linked the timestamp matrix guide
- Updated `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`:
  - marked the remaining Phase 4 and Phase 5 items complete
  - set plan status to `completed`

## Smoke Checks

Ran focused dry-run checks in `examples/playground/rename-route-a-smoke` for:

- `{timestamp_utc_iso}`
- `{timestamp_local_iso}`
- `{timestamp_local_12h}`
- `{timestamp_utc_12h}`

Observed outputs confirmed:

- UTC ISO uses `Z`
- local ISO uses numeric offset
- local `12hr` output uses compact `AM` / `PM`
- UTC `12hr` output uses compact `AM` / `PM`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-fs-utils-rename-template.test.ts test/cli-rename-template.test.ts test/utils-datetime.test.ts`
- `bun run src/bin.ts rename file ./examples/playground/rename-route-a-smoke/photo-one.txt --pattern "{timestamp_utc_iso}-{stem}" --dry-run`
- `bun run src/bin.ts rename batch ./examples/playground/rename-route-a-smoke --pattern "{timestamp_local_12h}-{stem}" --dry-run`
- `bun run src/bin.ts rename file ./examples/playground/rename-route-a-smoke/photo-one.txt --pattern "{timestamp_local_iso}-{stem}" --dry-run`
- `bun run src/bin.ts rename file ./examples/playground/rename-route-a-smoke/photo-two.txt --pattern "{timestamp_utc_12h}-{stem}" --dry-run`

## Related Plans

- `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Related Research

- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
