---
title: "Rename Timestamp Format Matrix"
created-date: 2026-03-01
modified-date: 2026-04-01
status: completed
agent: codex
---

## Goal

Provide one compact reference for the current rename timestamp placeholders and explicit timestamp-format placeholders.

## Status

This guide documents the stable `v0.1.2` timestamp placeholder contract.

Current behavior is implemented:

- `{timestamp}`
- `{timestamp_local}`
- `{timestamp_utc}`

- `{timestamp_utc_iso}`
- `{timestamp_local_iso}`
- `{timestamp_local_12h}`
- `{timestamp_utc_12h}`

## Timestamp Placeholder Matrix

Assume:

- UTC sample time: `2026-03-01T09:15:30Z`
- local sample time: `2026-03-01T17:15:30+08:00`

| Placeholder | Status | Timezone | Style | Offset | Sample Output | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `{timestamp}` | Legacy, implemented | UTC | compact `24hr` | none | `20260301-091530` | Backward-compatible default |
| `{timestamp_local}` | Explicit, implemented | local | compact `24hr` | none | `20260301-171530` | Explicit local wall-clock time |
| `{timestamp_utc}` | Explicit, implemented | UTC | compact `24hr` | none | `20260301-091530` | Explicit UTC wall-clock time |
| `{timestamp_utc_iso}` | Explicit, implemented | UTC | `iso` | `Z` | `20260301T091530Z` | `Z` is UTC-only |
| `{timestamp_local_iso}` | Explicit, implemented | local | `iso` | `+0800` | `20260301T171530+0800` | Local ISO should include numeric offset |
| `{timestamp_local_12h}` | Explicit, implemented | local | compact `12hr` | none | `20260301-051530PM` | Compact 12-hour form, no `:` |
| `{timestamp_utc_12h}` | Explicit, implemented | UTC | compact `12hr` | none | `20260301-091530AM` | Compact 12-hour form, no `:` |

## Reading Notes

- `Z` should only appear on UTC timestamps.
- Local ISO should use a numeric offset such as `+0800`, not `Z`.
- `24hr` remains the default time style.
- `12hr` output remains compact and does not add `:` separators.
- `date` placeholders are intentionally not part of this Route A expansion.

## Suggested User Guidance

- Existing users can keep `{timestamp}` with no behavior change.
- Users who want explicit timezone control today should prefer `{timestamp_local}` or `{timestamp_utc}`.
- Users who want ISO-like or compact 12-hour output should use the explicit Route A placeholders.

## Related Guides

- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`

## Historical Plans

- `docs/plans/archive/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Historical Research

- `docs/researches/archive/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
