---
title: "Interactive large rename preview UX implementation"
created-date: 2026-02-28
modified-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Implement a safer and more usable dry-run preview flow for large rename batches in `cdx-chores`, so interactive and terminal-driven rename previews remain readable even when the result set is very large.

Primary target:

- bounded dry-run preview output for rename workflows
- head-and-tail truncation instead of dumping every row
- compact default output with skipped-item summary
- reusable preview-row composition that can support a later inspect-preview mode

## Why This Plan

`rename batch` currently prints one preview line per planned rename and one line per skipped item. That works for small batches, but it becomes noisy and potentially sluggish when a directory produces hundreds or thousands of rows.

The research for this topic has already narrowed the near-term solution:

- preview budget should use both terminal height and a fixed cap
- truncation should show head and tail slices
- default terminal shape should follow Option C
- detailed skipped-item inspection should remain available via an Option B-style path
- the generated `rename-*.csv` file remains the authoritative review artifact
- inspect-preview should be planned, but it should not block the first bounded-preview implementation

This plan turns those decisions into an implementation sequence with minimal churn to existing rename logic.

## Current State (Baseline)

- `src/cli/actions/rename.ts` prints every preview row directly to `stdout`.
- `rename batch --dry-run` and `rename file --dry-run` already generate replayable plan CSV files.
- The current rename plan CSV naming rule is stable:
  - `rename-<timecode>-<uid>.csv`
- The CSV is already the input artifact for `rename apply`.
- There is no current preview-window abstraction, inspect-preview mode, or bounded rename preview renderer.

## User Experience Targets

- Large rename dry runs should remain fast to scan in a normal terminal.
- The first visible output should prioritize summary counts and changed rename intent.
- The default preview should stay compact even for very large result sets.
- Truncation should be obvious and explicit.
- Users should be pointed to the generated plan CSV for complete inspection.
- Skipped items should not overwhelm the main rename preview by default.
- The implementation should leave room for a later inspect-preview mode without forcing a terminal UI framework migration now.

## Reviewed Decisions (2026-02-28)

1. Preview budget should be derived from both terminal height and a fixed cap.
2. Truncated previews should show head and tail slices instead of only the first rows.
3. Default rename preview shape should follow Option C:
   - rename rows previewed
   - skipped items summarized by reason
4. Option B should remain available as an explicit detailed skipped-item inspection path.
5. The generated `rename-*.csv` file is the full review artifact for dry-run output.
6. Inspect-preview should be kept in the current planning backlog, but it should not block the first bounded-preview pass.
7. Inspect-preview should reuse the existing `rename-*.csv` as input rather than creating a second same-looking artifact.

## In Scope

### Rename preview shaping

- Introduce preview-row composition helpers for rename dry-run output
- Derive a visible preview budget from terminal height and a fixed cap
- Build head-and-tail truncation behavior for large result sets
- Produce explicit truncation messaging

### Default terminal preview behavior

- Show summary counts first
- Show changed rename rows using a bounded preview
- Show skipped items as a summary grouped by reason (Option C)
- Emphasize the generated plan CSV path when dry-run output is truncated

### Detailed skipped-item inspection path

- Define an explicit Option B-style rendering path for skipped rows
- Keep detailed skipped rows separate from the main rename preview budget
- Keep this path narrow and rename-specific for now

### Reusable composition boundary

- Keep preview-data assembly separate from line rendering
- Favor reusable list assembly helpers where helpful (for example, `src/utils/append-all.ts`)
- Preserve a path for a future inspect-preview mode to reuse the same composed data

### Docs and smoke-test readiness

- Update rename-related docs/help notes if preview output semantics change materially
- Support manual smoke testing against large synthetic fixture sets under `examples/playground/`

## Out of Scope (This Plan)

- Full terminal pager/window infrastructure
- Generic table renderer for arbitrary data
- A new `data preview` subcommand
- Reworking interactive path ghost-hint navigation
- Changing rename plan CSV schema unless preview requirements prove that necessary
- Changing the `rename apply` replay contract
- Ink adoption as part of the initial implementation

## Phases

## Phase 1: Define Preview Composition Primitives

### Task Items

- [x] Define a preview data shape for:
  - rename rows
  - skipped summary rows
  - optional detailed skipped rows
  - truncation metadata
- [x] Add helper utilities to compose head slices, tail slices, separators, and summary rows
- [x] Keep list composition separate from direct `stdout` printing
- [x] Decide where these helpers should live (`src/cli/actions/rename.ts` extraction vs dedicated helper module)

### Phase Deliverable

- [x] Testable preview composition primitives exist independent of terminal output

## Phase 2: Implement Bounded Rename Dry-Run Preview (Option C Default)

### Task Items

- [x] Compute preview budget from terminal height and a fixed maximum cap
- [x] Implement head-and-tail truncation for rename rows
- [x] Keep summary counts above the preview body
- [x] Render skipped summary grouped by reason
- [x] Render explicit truncation messaging when rows are omitted
- [x] Emphasize the generated plan CSV path for truncated dry runs
- [x] Preserve clear output for small result sets with no unnecessary truncation

### Phase Deliverable

- [x] `rename ... --dry-run` uses a bounded, compact default preview that remains readable for very large batches

## Phase 3: Add Explicit Detailed Skipped-Item Rendering (Option B Path)

### Task Items

- [x] Define how the user reaches detailed skipped-item output
- [x] Render skipped rows as a separate section with their own budget
- [x] Keep changed rename rows as the primary preview section
- [x] Ensure detailed skipped rendering does not break compact default behavior
- [x] Document the difference between compact default output and detailed skipped inspection

### Phase Deliverable

- [x] A separate detailed skipped-item inspection path exists without changing the default compact preview

## Phase 4: Prepare Inspect-Preview Follow-Up Boundary

### Task Items

- [x] Ensure composed preview data can be reused outside immediate `stdout` printing
- [x] Keep the generated `rename-*.csv` file as the inspect-preview input artifact
- [x] Document the renderer boundary so a future inspect-preview mode can reuse the same data pipeline
- [x] Avoid introducing naming ambiguity with replayable plan CSV artifacts

### Phase Deliverable

- [x] The bounded preview implementation leaves a clean reuse path for a later inspect-preview mode

## Phase 5: Docs, Manual QA, and Smoke Checks

### Task Items

- [x] Update docs or usage notes affected by preview output changes
- [x] Smoke test against a large synthetic fixture set in `examples/playground/huge-logs/`
- [x] Verify small-batch output remains readable and not over-engineered
- [x] Verify large-batch dry-run output truncates predictably
- [x] Verify generated plan CSV remains the authoritative full review artifact

### Phase Deliverable

- [x] The new rename preview UX is documented and manually validated against realistic large-list scenarios

## Technical Design Notes

- Keep rename planning logic separate from preview rendering logic.
- Prefer deterministic preview composition from already computed plan/skipped data.
- Do not make preview output the source of truth; the plan CSV remains the authoritative replayable artifact.
- Preserve the meaning of the current CSV naming contract:
  - `rename-*.csv` means replayable rename plan
- If inspect-preview later persists output, it should not masquerade as the same artifact type.
- Reuse small utilities where they genuinely simplify list assembly, but avoid introducing an oversized abstraction too early.

## Verification Plan

### Manual Checks

- [x] `rename batch <dir> --dry-run` with a small directory shows full rows with no confusing truncation
- [x] `rename batch <dir> --dry-run` with a very large directory shows summary counts, bounded rename preview, skipped summary, and plan CSV path
- [x] Truncation messaging clearly states what was omitted from the middle
- [x] The default compact preview reflects Option C
- [x] The detailed skipped-item path reflects Option B semantics
- [x] `rename file <path> --dry-run` still feels clear and does not regress
- [x] Generated `rename-*.csv` remains valid for `rename apply`

### Smoke-Test Fixture Checks

- [x] Seed large synthetic fixtures under `examples/playground/huge-logs/`
- [x] Run rename dry-run flows against a large fixture set and confirm terminal output remains readable
- [x] Confirm plan CSV generation still works under large-result conditions

## Risks and Mitigations

- Risk: preview composition becomes tangled with direct printing again.
  - Mitigation: separate preview-row assembly from rendering early in Phase 1.
- Risk: terminal-height-derived budgeting behaves inconsistently across environments.
  - Mitigation: combine terminal height with a fixed cap and use clear fallback defaults.
- Risk: skipped summaries hide information users still need.
  - Mitigation: keep an explicit Option B detailed skipped-item path available.
- Risk: inspect-preview planning pulls the scope toward a full pager too early.
  - Mitigation: keep inspect-preview as a follow-up boundary, not a blocker for bounded preview v1.
- Risk: later features blur the meaning of the replayable plan CSV artifact.
  - Mitigation: preserve `rename-*.csv` as the replayable plan type and avoid same-looking derived artifacts.

## Deliverables

- Bounded rename dry-run preview composition primitives
- Terminal-height-aware head-and-tail truncation for rename preview output
- Compact Option C default preview
- Explicit detailed skipped-item path aligned with Option B
- Clear inspect-preview reuse boundary
- Documentation and smoke-test validation notes

## Follow-up Jobs (After Plan Approval)

- [x] Job: extract rename preview composition helpers
- [x] Job: implement bounded Option C dry-run preview
- [x] Job: add detailed skipped-item rendering path
- [x] Job: document inspect-preview artifact/input contract
- [x] Job: run large-fixture manual smoke checks and record findings

## Related Research

- `docs/researches/archive/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
