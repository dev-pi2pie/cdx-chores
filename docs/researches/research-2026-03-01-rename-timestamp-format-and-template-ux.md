---
title: "Rename timestamp format and template UX research"
created-date: 2026-03-01
modified-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Define the next design direction for `rename` timestamp templates now that timezone selection exists, but timestamp display format is still fixed.

## Milestone Goal

Choose a practical path for supporting additional timestamp presentation styles such as:

- compact UTC with `T...Z`
- local timestamps with offset-aware ISO-like output
- 12-hour clock output with `AM` / `PM`

without destabilizing the current rename template contract.

## Key Findings

### 1. Current rename timestamp support only models timezone, not display shape

The current rename formatter supports:

- `{timestamp}` as legacy UTC compact output
- `{timestamp_local}`
- `{timestamp_utc}`

but all three render through fixed formatter shapes in `src/cli/fs-utils.ts` and `src/utils/datetime.ts`.

Current filename timestamp shape is:

- compact date + 24-hour time
- `YYYYMMDD-HHMMSS`

This means the current design can answer "local or UTC?" but not "compact, ISO, or 12-hour?"

### 2. Plan CSV artifact naming is already separated and should stay separated

Plan CSV filenames already use an explicit UTC machine-oriented shape:

- `rename-plan-20260301T091530Z-ab12cd34.csv`

That shape is implemented independently from rename content formatting and should remain stable even if user-facing rename templates become more flexible.

Implication:

- user-facing rename timestamp formatting and plan/audit artifact naming should remain separate design concerns

### 3. The codebase already has one precedent for parameterized placeholders

`{serial...}` already supports parameterized underscore-separated configuration with validation and normalization.

Implication:

- if timestamp formatting grows beyond one or two extra variants, the timestamp family should probably follow a parameterized-token design instead of multiplying flat placeholder names forever

### 4. Adding only one more flag is likely the wrong abstraction

A narrow flag such as:

- `--timestamp-format iso`
- or `--timestamp-hour-cycle 12`

would immediately create a precedence matrix across:

- legacy `{timestamp}`
- explicit timestamp placeholders
- interactive template rewriting
- future custom templates with mixed timestamp styles

Implication:

- once format becomes a second axis, it should be modeled in the template language itself, not only as a CLI override

### 5. Backward compatibility still matters

Current behavior is now documented and tested:

- `{timestamp}` means compact UTC legacy behavior

Changing that default would create churn in existing scripts, docs, tests, and user expectations.

Implication:

- keep `{timestamp}` unchanged
- any new formatting flexibility should be opt-in through new explicit placeholders or a new parameterized token contract

## Implications or Recommendations

### Route A: Additive explicit placeholder family

Keep the current simple-token model and add more explicit placeholder names for each supported combination.

Example token direction:

- `{timestamp}` -> legacy compact UTC
- `{timestamp_local}` -> compact local 24-hour
- `{timestamp_utc}` -> compact UTC 24-hour
- `{timestamp_local_iso}` -> local ISO-like timestamp
- `{timestamp_utc_iso}` -> UTC ISO compact with `Z`
- `{timestamp_local_12h}` -> local compact 12-hour with `AM` / `PM`
- `{timestamp_utc_12h}` -> UTC compact 12-hour with `AM` / `PM`

Pros:

- smallest implementation delta
- fits the current validator structure
- easy help text and migration story
- low-risk for CLI and interactive mode

Cons:

- token explosion if more styles are added later
- awkward if style dimensions keep growing
- duplicates timezone and style in token names repeatedly

Recommended use:

- choose this route only if the expected format surface is still very small, for example just `iso` and `12h`

### Route B: Parameterized timestamp token v2

Introduce a new timestamp token family that separates timezone from style, similar in spirit to `{serial...}`.

Example direction:

- `{timestamp}` -> legacy compact UTC
- `{timestamp_tz_local}` -> compact local 24-hour
- `{timestamp_tz_utc_style_iso}` -> UTC ISO compact with `Z`
- `{timestamp_tz_local_style_iso}` -> local offset-aware ISO-like output
- `{timestamp_tz_local_hour_12}` -> local compact 12-hour with `AM` / `PM`

Possible parameter vocabulary:

- `tz_local`
- `tz_utc`
- `style_compact`
- `style_iso`
- `style_readable`
- `hour_24`
- `hour_12`

Pros:

- cleaner long-term model
- avoids unbounded placeholder growth
- aligns with the existing serial-token precedent
- gives interactive mode a clearer mapping from prompts to canonical template output

Cons:

- needs new parser and validation rules
- needs a sharper documentation pass
- needs careful guardrails on invalid parameter combinations

Recommended use:

- choose this route if timestamp format flexibility is expected to continue growing after this next step

## Current Preferred Direction

For the next step, keep current behavior unchanged and treat Route A as the primary additive idea to evaluate.

Current preferred posture:

- keep `{timestamp}` as legacy compact UTC
- keep `{timestamp_local}` and `{timestamp_utc}` unchanged
- add a small explicit placeholder set for new display shapes
- when `local` and `iso` are combined, include a numeric offset such as `+0800`

This keeps compatibility stable while still letting the project test whether explicit ISO-style and compact 12-hour placeholders are enough before opening a broader timestamp-parameter design.

## Longer-Term Recommendation

If timestamp output expands beyond a very small additive set, Route B is the cleaner long-term model.

That remains a follow-up design direction, not the immediate default.

## Mock Outputs

Assume source mtime:

- UTC: `2026-03-01T09:15:30Z`
- local example: `2026-03-01T17:15:30+08:00`

Current behavior:

```text
{timestamp}        -> 20260301-091530
{timestamp_local}  -> 20260301-171530
{timestamp_utc}    -> 20260301-091530
```

Route A examples:

```text
{timestamp_utc_iso}    -> 20260301T091530Z
{timestamp_local_iso}  -> 20260301T171530+0800
{timestamp_local_12h}  -> 20260301-051530PM
{timestamp_utc_12h}    -> 20260301-091530AM
```

Route A conservative subset:

```text
{timestamp_utc_iso}   -> 20260301T091530Z
{timestamp_local_iso} -> 20260301T171530+0800
```

Note on `Z` vs local ISO:

- `Z` is a UTC marker and should only appear on UTC timestamps.
- A local timestamp should not use `Z` unless it is first converted to UTC.
- That means `{timestamp_local_iso}` has two plausible design choices:
  - simple local wall-clock ISO-like output, for example `20260301T171530`
  - local timestamp with explicit numeric offset, for example `20260301T171530+0800`
- Current preference: if a timestamp uses both `local` and `iso`, append the numeric offset.
- That makes the local ISO form unambiguous while preserving `Z` as UTC-only.

Route B examples:

```text
{timestamp_tz_utc_style_iso}   -> 20260301T091530Z
{timestamp_tz_local_style_iso} -> 20260301T171530+0800
{timestamp_tz_local_hour_12}   -> 20260301-051530PM
{timestamp_tz_utc_hour_12}     -> 20260301-091530AM
```

Possible interactive flow mock:

```text
Filename template preset
  default         {prefix}-{timestamp}-{stem}
  timestamp-first {timestamp}-{prefix}-{stem}
  stem-first      {stem}-{timestamp}-{prefix}
  custom

This template uses legacy {timestamp}.
Choose timestamp timezone:
  utc
  local

Choose timestamp style:
  compact-24   20260301-171530
  iso          20260301T171530+0800
  compact-12   20260301-051530PM

Canonical template output:
  {prefix}-{timestamp_local_iso}-{stem}
```

## Current Decisions

- Local ISO should include the numeric offset when `local` and `iso` are combined, for example `20260301T171530+0800`.
- 12-hour output should stay compact without `:`, for example `051530PM`.
- 24-hour output remains the default time style.
- `date` should remain simpler than `timestamp`; current `local` / `utc` support is enough and does not need the same parameter expansion.
- Interactive mode should add a follow-up choice when users move beyond legacy `{timestamp}` behavior, while keeping the current behavior as the top/default option.

## Remaining Open Questions

- What is the best canonical naming shape if the project later moves from Route A placeholders to Route B parameterized timestamp tokens?
- Should interactive mode emit Route A explicit placeholders directly first, and only emit Route B tokens in a later design phase?

## Related Plans

- `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`
- `docs/plans/plan-2026-03-01-rename-timestamp-timezone-and-plan-csv-naming.md`
- `docs/plans/plan-2026-02-27-rename-pattern-router-and-docs-ux-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
- `docs/researches/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`

## References

[^1]: `src/cli/fs-utils.ts`
[^2]: `src/utils/datetime.ts`
[^3]: `src/cli/rename-template.ts`
[^4]: `src/command.ts`
[^5]: `src/cli/interactive.ts`
