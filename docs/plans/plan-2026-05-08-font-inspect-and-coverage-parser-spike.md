---
title: "Font inspect implementation and coverage-provider follow-up"
created-date: 2026-05-08
status: active
agent: codex
---

## Goal

Implement the first `font inspect` command slice and record the coverage-provider follow-up needed before planning `font check`.

This plan follows the completed Markdown-to-PDF profile/font work and the current font command research. It keeps `font inspect` focused on discovery metadata, then records a bounded coverage-provider follow-up for `font check`. It does not implement `font check`.

## Starting State

The repository already has:

- `cdx-chores font list` registered in `src/cli/commands/font.ts`
- `actionFontList()` in `src/cli/actions/font.ts`
- discovery adapters and types in `src/fonts/`
- command and action coverage in `test/fonts.test.ts`
- Markdown-to-PDF profile font warnings that can later point users toward stable font commands

The current command can discover and filter font candidates. It cannot yet show a structured family detail view, normalize matching around a selected family, or provide inspect-oriented JSON output.

## Scope

### In Scope

- Add `cdx-chores font inspect --family <name>`.
- Support `--json`, `--debug`, and `--discovery <auto|native|fontconfig>`.
- Reuse `font list` discovery adapters and sanitized debug attempt output.
- Keep `--family` as the only selector in this slice.
- Group matched faces by family and show face metadata:
  - family
  - full name
  - style
  - weight
  - source
  - format
  - path, when available
- Treat no matches as an empty discovery result with exit `0`.
- Keep coverage out of `font inspect`; output should say coverage was not checked.
- Add focused tests for text output, JSON output, debug output, no-match output, duplicate handling, and invalid discovery mode wiring.
- Record a coverage-provider follow-up job record after the inspect slice is implemented.

### Out of Scope

- No `font check` command.
- No glyph coverage command behavior.
- No `--full-name`, `--face-index`, or multi-selector matching.
- No Codex Helper font assistance.
- No installed-font-dependent CI tests.

## Command Surface

```bash
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font inspect --family "Noto Sans CJK TC" --json
cdx-chores font inspect --family "Noto Sans CJK TC" --discovery native --debug
```

Usage errors should use the existing CLI error path:

- missing `--family`: exit `2`
- invalid `--discovery`: current command-layer behavior

## Output Contract

Text output should include:

```text
cdx-chores font inspect
Family: Noto Sans CJK TC
Discovery: auto
Adapter: macos-fontconfig

Faces:
- Noto Sans CJK TC Regular
  style: normal
  weight: 400
  source: system
  format: otf
  path: /path/to/fonts/NotoSansCJKtc-Regular.otf

Coverage: not checked.
```

No-match text output should still exit `0`:

```text
cdx-chores font inspect
Family: Example Missing Family
Discovery: auto
Adapter: macos-fontconfig

Faces: 0
Coverage: not checked.
```

JSON output should be stable for automation:

```json
{
  "command": "font inspect",
  "family": "Noto Sans CJK TC",
  "discovery": "auto",
  "adapter": "macos-fontconfig",
  "matches": [
    {
      "family": "Noto Sans CJK TC",
      "fullName": "Noto Sans CJK TC Regular",
      "style": "normal",
      "weight": 400,
      "format": "otf",
      "source": "system",
      "path": "/path/to/fonts/NotoSansCJKtc-Regular.otf"
    }
  ],
  "warnings": []
}
```

Debug JSON should follow the completed `font list --debug` shape and include sanitized discovery attempts only when `--debug` is passed.

## Implementation Phases

### Phase 1: Shared Inspect Helpers

- [x] Add a small inspect helper in `src/cli/actions/font.ts` or a local `src/fonts/` helper if reuse is cleaner.
- [x] Reuse existing discovery calls rather than adding a new adapter path.
- [x] Add deterministic family matching:
  - exact normalized family matches first
  - normalized full-name matches as supporting face matches
  - stable output ordering by family, full name, style, weight, and path
- [x] Preserve existing duplicate-removal behavior or extract it for reuse if needed.

### Phase 2: CLI Registration and Action

- [x] Register `font inspect` in `src/cli/commands/font.ts`.
- [x] Add `actionFontInspect()` in `src/cli/actions/font.ts`.
- [x] Require `--family`.
- [x] Wire `--json`, `--debug`, and `--discovery` consistently with `font list`.
- [x] Keep coverage messaging explicit and non-claiming.

### Phase 3: Tests

- [x] Add command help coverage for `font inspect`.
- [x] Test missing `--family` as a usage error.
- [x] Test text output with multiple faces under one family.
- [x] Test JSON output with structured `matches`.
- [x] Test no-match text and JSON output with exit `0` semantics at the action layer.
- [x] Test debug JSON/text output reuses sanitized discovery attempts.
- [x] Test duplicate discovered faces do not produce duplicate inspect rows.

### Phase 4: Docs and Traceability

- [x] Update relevant command docs or guides that mention `font list` so `font inspect` appears as the next discovery-detail command.
- [x] Keep `font check` documented as deferred until coverage-provider evidence exists.
- [x] Add a job record under `docs/plans/jobs/` when the implementation lands.
- [x] Link the job record back to this plan and the related research.

### Phase 5: Font Check Coverage Follow-up

- [x] Create a small coverage-provider follow-up record before drafting `font check`.
- [ ] Spike optional `fontconfig` support behind an internal `CoverageProvider` interface.
- [ ] Prove `fc-query` availability handling, selected-file charset parsing, checked-missing behavior, and inconclusive behavior.
- [ ] Record whether TTC support is usable or should remain `inconclusive` with `unsupported-ttc-collection`.
- [ ] Record the fixture inventory for mocked `fc-query` output and controlled coverage tests.
- [ ] Draft a dedicated `font check` implementation plan after the provider spike records enough evidence.

Status note: the `font inspect` implementation and coverage-provider follow-up record are complete. The provider evaluation tasks remain open in the draft follow-up record because this slice intentionally did not add coverage logic or implement `font check`.

## Validation

Use focused validation while implementing:

```bash
bun test test/fonts.test.ts
bun run lint
bun run format:check
```

Run broader validation if the implementation touches shared CLI registration, exported font types, or Markdown-to-PDF profile helpers.

## Risks

- `font list` currently filters by family or full name using substring matching. `font inspect` should be more family-oriented without surprising users who only know a full face name.
- Platform discovery can return incomplete metadata. The text and JSON contracts should omit unavailable optional fields rather than inventing values.
- No-match behavior must remain discovery-only. It cannot imply the family is unavailable to every renderer.
- Pulling coverage-provider work into `font inspect` would widen the slice and should be avoided.

## Related Research

- [Font Inspect and Check Commands](../researches/research-2026-05-07-font-inspect-and-check-commands.md)
- [Font Command Discovery Options](../researches/research-2026-05-07-font-command-discovery-options.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)

## Related Plans

- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)
