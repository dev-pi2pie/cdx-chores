---
title: "Rename timestamp timezone selection and plan CSV naming"
created-date: 2026-03-01
modified-date: 2026-03-01
status: active
agent: "codex, copilot"
---

## Goal

Improve rename timestamp clarity and flexibility by making local-vs-UTC behavior explicit, while preserving backward compatibility for existing rename templates and plan CSV workflows.

## Why This Plan

Current rename behavior is functional but confusing:

- `{timestamp}` currently uses UTC.
- `{date}` currently uses local date.
- the difference is not obvious from the placeholder names alone.
- plan CSV filenames also use UTC-style timestamps, but the current filename format does not make that explicit.

This plan aims to remove ambiguity without breaking existing rename scripts or previously documented behavior.

## Design Principles

- Preserve existing behavior for current users unless they opt into the new explicit forms.
- Prefer explicit placeholder names over implicit timezone assumptions.
- Keep interactive mode simple and conditional rather than multiplying preset variants.
- Keep plan/audit artifacts stable and machine-friendly, even if user-facing rename content becomes timezone-selectable.

## Proposed Design

### Timestamp Placeholders

- Keep `{timestamp}` as a backward-compatible alias for UTC.
- Add `{timestamp_local}` for local timestamp formatting.
- Add `{timestamp_utc}` for explicit UTC timestamp formatting.
- Keep `{date}` as the current local-date alias.
- Keep `{date_local}` and `{date_utc}` unchanged.

### Interactive Rename Flow

- Keep the current preset list:
  - `default`
  - `timestamp-first`
  - `stem-first`
  - `custom`
- After resolving the chosen preset/template:
  - if the template contains explicit `{timestamp_local}` or `{timestamp_utc}`, do not ask for timezone basis.
  - if the template contains legacy `{timestamp}`, ask the user to choose timestamp basis:
    - `local`
    - `utc`
- Internally rewrite the resolved template to the explicit placeholder chosen by the user.
- Do not add duplicated preset variants such as `default-local` or `default-utc`.

### Non-Interactive CLI Behavior

- Add a narrow CLI override:
  - `--timestamp-timezone local|utc`
- Precedence rules:
  - explicit template placeholders win over everything else
  - CLI `--timestamp-timezone` only affects legacy `{timestamp}`
  - interactive prompt selection only affects legacy `{timestamp}`
  - when nothing is specified, legacy `{timestamp}` remains UTC

### Plan Dry-Run CSV Naming

- Keep plan CSV filenames UTC-based.
- Make UTC explicit in the filename shape.
- Proposed new filename format:
  - `rename-plan-20260301T091530Z-ab12cd34.csv`
- Continue using UTC for plan/audit artifact naming even when rename output uses local timestamps.

### Plan CSV Metadata

- Add plan metadata fields that record timestamp-basis decisions used by the planned rename:
  - whether legacy `{timestamp}` was present
  - effective timestamp timezone mode for rendered rename output
- Keep metadata additive so older CSV readers remain compatible where possible.

### Apply Validation and CSV Contract Hardening

- Treat `rename apply <csv>` input as strict executable input, not as a loosely parsed report artifact.
- Keep compatibility permissive for unknown/additive columns.
- Keep compatibility strict for required replay fields and executable row validation.
- Perform CSV validation and cross-row preflight checks before any rename is executed.
- Keep replay semantics unchanged:
  - apply uses `old_path` -> `new_path` as the source of truth
  - apply does not recompute rename targets
  - invalid CSV structure should fail before partial execution begins

## Out Of Scope

- Changing the existing meaning of `{timestamp}` from UTC to local time.
- Adding per-placeholder timezone options beyond `local` and `utc`.
- Adding config-file based defaults in this phase.
- Changing `rename apply <csv>` replay semantics.

## Execution Checklist By Phase

### Phase 1: Contract and Naming Decisions

- [x] Define canonical placeholder set for timestamp timezone support:
  - `{timestamp}`
  - `{timestamp_local}`
  - `{timestamp_utc}`
- [x] Define formatting contract for local and UTC timestamp tokens.
- [x] Define final CLI option contract for `--timestamp-timezone local|utc`.
- [x] Define exact precedence rules across:
  - explicit placeholders
  - interactive selection
  - CLI override
  - legacy default behavior
- [x] Define final UTC-explicit plan CSV filename format.
- [x] Define additive CSV metadata fields for effective timestamp timezone mode.

### Phase 2: Template Engine and Rename Planner

- [x] Implement `{timestamp_local}` rendering.
- [x] Implement `{timestamp_utc}` rendering.
- [x] Keep `{timestamp}` mapped to UTC for backward compatibility.
- [x] Update template validation to allow the new timestamp placeholders.
- [x] Ensure single-file and batch rename paths use the same timezone placeholder behavior.
- [x] Ensure collision handling remains unchanged after timestamp rendering updates.

### Phase 3: Interactive UX

- [x] Add conditional timestamp-basis prompt for templates that contain legacy `{timestamp}`.
- [x] Skip the prompt when the resolved template already uses explicit timestamp placeholders.
- [x] Rewrite preset/custom templates internally to explicit timestamp placeholders after selection.
- [x] Keep the prompt wording concise and clear about tradeoffs:
  - `local` for personal/local clock naming
  - `utc` for stable cross-machine/audit naming
- [x] Preserve existing interactive flow shape outside the new conditional prompt.

### Phase 4: CLI Surface and Replay Metadata

- [x] Add `--timestamp-timezone local|utc` to rename CLI commands that accept `--pattern`.
- [x] Apply the CLI option only to legacy `{timestamp}`.
- [x] Record the effective timestamp timezone mode in generated plan CSV metadata.
- [x] Ensure `rename apply <csv>` continues replaying exact planned paths without recomputation.
- [x] Keep plan CSV filename generation in explicit UTC with `Z`.

### Phase 5: Apply Validation and CSV Contract Hardening

- [ ] Define strict required-field contract for executable apply rows:
  - `old_path`
  - `new_path`
  - `status`
  - `plan_id`
  - `planned_at`
- [ ] Add a dedicated row validator/type guard for rename plan CSV rows.
- [ ] Reject missing `status` for apply input instead of defaulting it to `planned`.
- [ ] Validate executable row path fields before apply:
  - non-empty
  - cwd-relative
  - no cwd escape
- [ ] Add cross-row preflight validation before any rename executes:
  - duplicate `old_path`
  - duplicate `new_path`
  - inconsistent `plan_id`
  - inconsistent `planned_at` when required
- [ ] Define compatibility rule for unknown/additive columns:
  - ignore unknown columns
  - reject missing required replay columns
- [ ] Decide and implement whether basename consistency checks should be enforced for:
  - `old_name` vs `old_path`
  - `new_name` vs `new_path`
- [ ] Ensure apply fails early before partial execution on invalid CSV structure.

### Phase 6: Documentation and Help Text

- [ ] Update CLI help text for rename pattern placeholders.
- [ ] Update `README.md` examples and placeholder descriptions.
- [ ] Update `docs/guides/rename-common-usage.md` with explicit timestamp guidance.
- [ ] Update `docs/guides/rename-scope-and-codex-capability-guide.md` if placeholder behavior is documented there.
- [ ] Review `docs/guides/rename-plan-csv-schema.md` against the final strict apply contract.
- [ ] Review `docs/guides/rename-common-usage.md` for any examples that imply loose apply behavior.
- [ ] Review `README.md` rename examples and wording for plan CSV naming and apply expectations.
- [ ] Document migration guidance:
  - existing `{timestamp}` users keep current UTC behavior
  - new users should prefer `{timestamp_local}` or `{timestamp_utc}`
- [ ] Document malformed CSV failure behavior and required replay fields.
- [ ] Document compatibility policy for future additive columns.
- [ ] Document the new plan CSV filename shape and why it remains UTC-based.

### Phase 7: Tests and Verification

- [x] Add unit tests for placeholder validation and rendering:
  - `{timestamp}`
  - `{timestamp_local}`
  - `{timestamp_utc}`
- [x] Add tests for precedence behavior between explicit placeholders and `--timestamp-timezone`.
- [ ] Add interactive-flow tests for the conditional timezone prompt.
- [x] Add tests for plan CSV filename format with explicit `Z`.
- [x] Add regression tests to confirm existing `{timestamp}` behavior remains UTC.
- [ ] Add malformed-CSV apply tests for:
  - missing required replay fields
  - invalid `status`
  - duplicate executable source paths
  - duplicate executable target paths
  - cwd-escaping paths
  - inconsistent row-level replay metadata where enforced
- [ ] Run verification:
  - `bunx tsc --noEmit`
  - `bun test`
  - focused rename dry-run smoke checks in `examples/playground/`

## Completion Criteria

- Rename templates support explicit local and UTC timestamp placeholders.
- Existing `{timestamp}` behavior remains backward-compatible and documented as UTC.
- Interactive mode can guide users to choose local or UTC without expanding preset count.
- Non-interactive CLI mode can override legacy `{timestamp}` behavior with a narrow flag.
- Plan CSV filenames clearly indicate UTC usage.
- Tests and docs cover the new behavior and migration path.
