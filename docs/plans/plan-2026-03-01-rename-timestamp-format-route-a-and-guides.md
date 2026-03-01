---
title: "Rename timestamp format Route A and guide refresh"
created-date: 2026-03-01
modified-date: 2026-03-01
status: draft
agent: codex
---

## Goal

Add a conservative Route A expansion for rename timestamp formatting while preserving all current timestamp behavior and improving user-facing guidance.

## Why This Plan

The current rename template model now supports timezone selection, but timestamp display shape is still fixed:

- `{timestamp}` keeps legacy compact UTC behavior
- `{timestamp_local}` and `{timestamp_utc}` only change timezone basis
- there is no explicit support yet for ISO-style output or 12-hour output

The next step should stay narrow:

- preserve current behavior
- add a small explicit placeholder set rather than redesigning the whole timestamp grammar
- document the new options clearly with a compact matrix-oriented guide

## Scope

- Keep all existing timestamp placeholders and behavior unchanged.
- Add a Route A explicit placeholder family for a small set of new timestamp display shapes.
- Keep `date` placeholders unchanged.
- Keep plan CSV filename behavior unchanged.
- Refresh existing rename docs and add a dedicated timestamp-format guide with a parameter/placeholder matrix.

## Out Of Scope

- Replacing the current timestamp family with a parameterized v2 token grammar.
- Adding config-file defaults for timestamp style.
- Changing the meaning of `{timestamp}`.
- Changing plan CSV artifact naming.
- Expanding `date` into the same format-parameter surface as `timestamp`.

## Proposed Route A Design

### Existing Behavior To Preserve

- `{timestamp}` -> compact UTC 24-hour (`YYYYMMDD-HHMMSS`)
- `{timestamp_local}` -> compact local 24-hour (`YYYYMMDD-HHMMSS`)
- `{timestamp_utc}` -> compact UTC 24-hour (`YYYYMMDD-HHMMSS`)

### New Explicit Placeholder Candidates

- `{timestamp_utc_iso}` -> compact UTC ISO-like output with `Z`
- `{timestamp_local_iso}` -> compact local ISO-like output with numeric offset
- `{timestamp_local_12h}` -> compact local 12-hour output with `AM` / `PM`
- `{timestamp_utc_12h}` -> compact UTC 12-hour output with `AM` / `PM`

### Route A Formatting Decisions

- `Z` remains UTC-only.
- If a placeholder combines `local` and `iso`, append a numeric offset such as `+0800`.
- 12-hour output remains compact and does not use `:`.
- 24-hour output remains the default style.
- `date` remains separate and does not inherit Route A timestamp parameters.

### CLI and Interactive Direction

- Do not add a broad `--timestamp-format` flag in this phase.
- Keep `--timestamp-timezone local|utc` behavior limited to legacy `{timestamp}` only.
- Interactive mode should preserve the current/default path as the top option.
- If the user chooses one of the new Route A formats, interactive mode may ask a small follow-up prompt and emit the matching explicit placeholder.

## Documentation Direction

Documentation should become clearer than the current flat placeholder list.

Preferred docs shape for this phase:

1. Refresh `docs/guides/rename-common-usage.md` with updated examples.
2. Refresh `docs/guides/rename-scope-and-codex-capability-guide.md` where timestamp placeholder behavior is summarized.
3. Add a dedicated guide:
   - `docs/guides/rename-timestamp-format-matrix.md`

The new guide should include a compact matrix table covering:

- placeholder name
- timezone basis
- time style (`24hr`, `12hr`, `iso`)
- offset behavior
- sample output
- whether the placeholder is legacy or explicit

## Phase Checklist

### Phase 1: Contract and Placeholder Decisions

- [ ] Confirm the final Route A placeholder set.
- [ ] Confirm exact output shapes for:
  - `{timestamp_utc_iso}`
  - `{timestamp_local_iso}`
  - `{timestamp_local_12h}`
  - `{timestamp_utc_12h}`
- [ ] Confirm whether Route A should ship all four new placeholders or a smaller first subset.
- [ ] Confirm exact local ISO offset format:
  - `+0800`
  - not `Z`
- [ ] Confirm exact 12-hour suffix shape:
  - `AM`
  - `PM`
- [ ] Confirm that `date` stays unchanged in this phase.
- [ ] Confirm interactive UX rule:
  - current behavior remains the top/default option
  - new formats are opt-in

### Phase 2: Formatter and Template Engine

- [ ] Add formatter helpers for:
  - UTC ISO-like compact timestamp with `Z`
  - local ISO-like compact timestamp with numeric offset
  - compact 12-hour UTC timestamp with `AM` / `PM`
  - compact 12-hour local timestamp with `AM` / `PM`
- [ ] Extend rename template validation to accept the final Route A placeholders.
- [ ] Extend template rendering in the shared rename planner.
- [ ] Ensure single-file and batch rename paths use the same rendering logic.
- [ ] Keep `{timestamp}`, `{timestamp_local}`, and `{timestamp_utc}` behavior unchanged.
- [ ] Ensure collision handling and basename normalization remain unchanged after the new placeholder rendering.

### Phase 3: Interactive and Help Surface

- [ ] Review whether interactive preset/custom flow should expose Route A format selection directly or rely on custom templates only.
- [ ] If interactive prompts are extended, keep the current timestamp path as the first/default choice.
- [ ] Ensure legacy `{timestamp}` rewrite behavior remains limited to timezone selection only.
- [ ] Update CLI help text for `--pattern` placeholder support.
- [ ] Keep help text concise enough to avoid turning the command help into a wall of tokens.

### Phase 4: Guides and Documentation Refresh

- [x] Create `docs/guides/rename-timestamp-format-matrix.md`.
- [x] Add a table matrix that explains:
  - placeholder
  - timezone
  - style
  - offset
  - sample output
  - notes
- [ ] Update `docs/guides/rename-common-usage.md` with Route A examples.
- [ ] Update `docs/guides/rename-scope-and-codex-capability-guide.md` to summarize Route A placeholder behavior without duplicating the full matrix.
- [ ] Update `README.md` placeholder list and one or two practical examples.
- [ ] Add migration wording:
  - existing `{timestamp}` users do not need to change anything
  - Route A placeholders are explicit opt-in formats
- [ ] Cross-link the new matrix guide from `README.md` and the rename guides.

### Phase 5: Tests and Verification

- [ ] Add unit tests for the new formatter helpers.
- [ ] Add rename planner tests for each new Route A placeholder.
- [ ] Add regression tests confirming unchanged behavior for:
  - `{timestamp}`
  - `{timestamp_local}`
  - `{timestamp_utc}`
- [ ] Add tests for local ISO offset formatting.
- [ ] Add tests for 12-hour compact rendering and `AM` / `PM` boundaries.
- [ ] Add or adjust interactive tests if the prompt flow changes.
- [ ] Run verification:
  - `bunx tsc --noEmit`
  - `bun test`
  - focused rename dry-run checks in `examples/playground/`

## Completion Criteria

- Current timestamp behavior remains unchanged and documented.
- Route A placeholders render consistently in both `rename file` and `rename batch`.
- Local ISO output includes numeric offset and never uses `Z`.
- 12-hour output is compact and documented as opt-in.
- The new timestamp guide provides a clear matrix that explains placeholder behavior more clearly than the current flat lists.

## Related Plans

- `docs/plans/plan-2026-03-01-rename-timestamp-timezone-and-plan-csv-naming.md`
- `docs/plans/plan-2026-02-27-rename-pattern-router-and-docs-ux-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
