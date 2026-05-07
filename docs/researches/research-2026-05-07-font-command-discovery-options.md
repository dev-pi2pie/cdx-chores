---
title: "Font Command Discovery Options"
created-date: 2026-05-07
status: draft
agent: codex
---

## Goal

Clarify the command pattern for font discovery diagnostics and adapter selection before adding more `font` subcommand options.

This is a follow-up research note for the Markdown-to-PDF profile font work. It exists because the first `font list` command exposed a useful capability, but the next option layer needs clearer naming and platform behavior before implementation.

## Problem

The current implementation can discover installed font candidates, and on macOS it prefers `fc-list` when available because it is faster than `system_profiler`.

That behavior raises real user questions:

- How can a user know which discovery path was used?
- How can a user force the native platform path?
- How can a user verify behavior when `fc-list` exists on macOS?
- What should happen on Windows, where fontconfig is not normally present?
- Should diagnostics live on `font list --debug`, a separate `font doctor`, or both?

The implementation plan should not lock in ambiguous option wording until these questions are settled.

## Scope

This research covers:

- naming for discovery selection options
- default adapter selection behavior
- debug output shape
- Windows behavior when fontconfig is absent or installed through MSYS2/Cygwin
- fixture and test expectations

This research does not cover:

- glyph coverage implementation
- font file parsing
- PDF profile font fallback generation
- automatic language detection
- installation guidance for third-party font tools

## Current Discovery Paths

The current first slice uses platform commands:

| Platform | Current path |
| --- | --- |
| macOS | prefer `fc-list` when available, then fall back to `system_profiler SPFontsDataType -json` |
| Linux | `fc-list --format ...` through fontconfig |
| Windows | PowerShell registry read |

This is discovery only. It reports candidate font faces; it does not prove that a font can render a specific codepoint.

## Recommended Pattern

### 1. Use `auto` as the default

The default should remain user-friendly and fast:

```bash
cdx-chores font list
```

Equivalent internal mode:

```text
discovery = auto
```

Suggested `auto` behavior:

| Platform | Behavior |
| --- | --- |
| macOS | use `fc-list` when available, otherwise `system_profiler` |
| Linux | use fontconfig / `fc-list` |
| Windows | use native PowerShell registry discovery |

Rationale: most users want useful results quickly, not a pure platform-native proof.

### 2. Add one explicit discovery selector

Prefer one option rather than several boolean flags:

```bash
cdx-chores font list --discovery auto
cdx-chores font list --discovery native
cdx-chores font list --discovery fontconfig
```

`--discovery` is clearer than `--adapter` because it describes the user-visible concern. The internal implementation can still call these adapters.

Suggested values:

| Value | Meaning |
| --- | --- |
| `auto` | best default for the current platform |
| `native` | platform-native discovery path |
| `fontconfig` | force `fc-list` / fontconfig discovery |

Suggested `native` behavior:

| Platform | Native path |
| --- | --- |
| macOS | `system_profiler SPFontsDataType -json` |
| Linux | fontconfig / `fc-list`, because fontconfig is the normal Linux font discovery layer |
| Windows | PowerShell registry discovery |

Windows should not try fontconfig in `auto` or `native`. If a Windows user has MSYS2/Cygwin/fontconfig installed, they can opt into that later with `--discovery fontconfig`.

### 3. Add debug output without changing normal output

Normal text output should stay concise. Diagnostics should be opt-in:

```bash
cdx-chores font list --debug
cdx-chores font list --json --debug
```

Debug output should answer:

- selected discovery mode
- selected adapter
- attempted adapters
- command duration
- whether each attempt succeeded
- failure detail for failed attempts

Suggested JSON shape:

```json
{
  "adapter": "macos-fontconfig",
  "discovery": "auto",
  "warnings": [],
  "debug": {
    "attempts": [
      {
        "adapter": "fontconfig",
        "command": "fc-list",
        "status": "success",
        "durationMs": 42
      }
    ]
  },
  "count": 1,
  "fonts": []
}
```

Text output can include a short debug section:

```text
Discovery: auto
Adapter: macos-fontconfig

Debug:
- fontconfig: success in 42ms
```

### 4. Add `font doctor` only if it has a different job

`font list --debug` explains one command run. `font doctor` should exist only if it checks the environment more broadly:

```bash
cdx-chores font doctor
```

Possible `font doctor` responsibilities:

- report whether `fc-list` is available
- report whether native discovery is available for the current platform
- report command versions when available
- report known limitations for the platform
- avoid listing every installed font

If this is too much for the next slice, start with `font list --debug` and defer `font doctor`.

## Provisional Decision

The clearest next implementation direction is:

1. Add `--discovery auto|native|fontconfig`.
2. Keep `auto` as the default.
3. Add `--debug` to `font list`.
4. Include debug details in JSON only when `--debug` is present.
5. Keep `font doctor` as a separate follow-up unless environment diagnostics become necessary immediately.

This pattern avoids adding many flags while still giving users a way to verify whether `fc-list`, `system_profiler`, or Windows registry discovery was used.

## Fixture Direction

Tests should stay adapter-driven and not depend on the developer machine's installed fonts.

Suggested test cases:

- `auto` on macOS uses fontconfig first when the injected runner succeeds.
- `auto` on macOS falls back to `system_profiler` when fontconfig fails.
- `native` on macOS uses only `system_profiler`.
- `fontconfig` mode uses only `fc-list`.
- Windows `auto` and `native` use registry discovery.
- Windows `fontconfig` is explicit only.
- `--json --debug` includes selected mode, selected adapter, attempts, statuses, and durations.
- normal text output does not show debug details unless `--debug` is present.

## Open Questions

1. Should the user-facing option be named `--discovery`, `--source`, or `--adapter`?
2. Should `font doctor` ship with the same slice as `--debug`, or remain a later diagnostic command?
3. Should failed attempts always appear in text debug output, or only in JSON debug output?
4. Should debug output include raw command stderr, or a sanitized failure message only?

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md) - parent research for PDF profiles, font roles, mixed-language content, and page chrome.

## Related Plan

- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](../plans/plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md) - implementation plan that should consume this follow-up research before adding more font command options.
