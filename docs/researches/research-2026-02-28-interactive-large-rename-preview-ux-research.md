---
title: "Interactive large rename preview UX research"
created-date: 2026-02-28
modified-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Evaluate how `cdx-chores` should handle very large interactive rename previews (for example 1,000 planned file renames), with a practical focus on dry-run result display, bounded preview windows, and how full review should defer to the generated plan CSV.

## Milestone Goal

Define a practical strategy for long interactive rename result sets without destabilizing the recently added inline ghost-hint path prompt and the existing `@inquirer/prompts` flow.

## Key Findings

### 1. The current bottleneck is preview output volume, not path prompt input

`rename batch` currently prints one preview line per planned rename and one line per skipped item:

- `src/cli/actions/rename.ts`

This means a large batch can flood the terminal even if the prompt layer itself is otherwise working correctly. The likely perceived "stuck" behavior is terminal rendering/backscroll cost, not primarily the current path prompt primitive.

### 2. Ink would be a broad architectural change for a narrow problem

The current interactive stack is split across:

- `@inquirer/prompts` for menu/select/input/confirm flows
- a custom raw TTY inline path prompt in `src/cli/prompts/path-inline.ts`

Introducing `Ink` would not be an isolated UI swap. It would likely require one of these directions:

- replace most prompt surfaces with Ink-native components
- embed or bridge non-Ink prompt behavior into an Ink app shell
- reimplement the inline ghost-hint prompt behavior inside Ink

That is not just a scroll-window feature. It touches prompt ownership, raw-mode keyboard handling, focus/state management, and how the current ghost-hint path input coexists with other prompts.

### 3. Ink does not remove the need for output-windowing

Even with Ink, rendering very large rename lists still needs policy:

- how many rows are visible at once
- how scrolling works
- whether hidden rows remain mounted/rendered
- how skipped items and changed items are grouped

If the app still tries to render all 1,000 rows at once, Ink changes the renderer but does not solve the core information-density problem. A bounded preview strategy is still required.

### 4. The repository already chose a non-list-first prompt direction intentionally

Existing research and implementation work explicitly rejected list-first search prompts as the default path-entry UX and moved to a custom input-first ghost-hint prompt:

- `docs/researches/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
- `docs/plans/jobs/2026-02-25-inline-path-prompt-primitive-choice-phase3-reset.md`
- `docs/plans/jobs/2026-02-25-inline-path-ghost-hint-prompt-phase4-implementation.md`

That means an Ink migration would reopen a decision the repo has already settled for path entry, while the newly raised problem is actually rename preview scale.

### 5. Dry-run preview, reusable preview infrastructure, and a future `data preview` command should be treated as separate layers

The current rename problem is primarily about dry-run output for `rename` commands:

- compute planned changes
- show a safe preview
- avoid overwhelming the terminal

That is narrower than a generic preview system.

A reusable scrollable inner-window viewer would be a broader infrastructure layer:

- terminal table rendering
- scroll/window state
- keyboard navigation
- reusable preview surfaces across commands

A future `data preview` command would be broader again:

- command-level feature design
- table-oriented inspection workflows
- potentially shared use of a reusable preview window

These layers are related, but they should not be implemented as one scope. Solving rename dry-run preview does not require solving a general-purpose viewer or creating a new `data preview` subcommand.

### 6. Reusable list-composition utilities can support preview-window construction without forcing a full UI framework shift

The new utility `src/utils/append-all.ts` is small, but it points in a useful direction for preview assembly:

- compose head slices, tail slices, summary rows, and optional detail rows explicitly
- keep list-building logic separate from rendering
- support reuse later if preview output grows into a more formal inspector surface

This reinforces the idea that current planning can include richer preview composition while still avoiding a premature move to a heavy terminal UI framework.

### 7. Inspect-preview should reuse the existing rename plan CSV artifact instead of inventing a second lookalike artifact

The current dry-run workflow already has a stable, replayable file contract:

- filename pattern: `rename-<timecode>-<uid>.csv`
- semantic role: replayable rename plan artifact
- downstream consumer: `rename apply <csv>`

That means inspect-preview should not create a second artifact that looks like the same plan type unless it is actually the same replayable plan.

Recommended rule:

- if inspect-preview is viewing dry-run results, it should read the existing generated plan CSV
- if inspect-preview ever persists its own derived artifact, it should use a distinct naming pattern so it cannot be confused with an applyable rename plan

This gives the naming pattern a useful type-guard role:

- `rename-*.csv` means replayable rename plan
- inspect-preview output, if any, should use a clearly different prefix or extension

## Implications or Recommendations

### Recommendation A. Solve large-preview UX first without Ink

The safest near-term direction is to keep the current prompt stack and change rename preview output policy.

Recommended baseline behavior:

- Always print the summary counts first.
- Derive the preview budget from both terminal height and a fixed cap.
- When truncated, show a head slice and a tail slice instead of only the first rows.
- Print a truncation note such as "Showing first 20 and last 20 of 1,000 planned renames; 960 items omitted from the middle."
- Emphasize the plan CSV as the authoritative full artifact for large batches and truncated dry runs.

This directly addresses the observed terminal slowdown with minimal architecture churn.

### Recommendation A1. Keep path prompt work out of this scope

Path ghost-hint and sibling-navigation UX should be tracked separately from rename-preview scale work.

The separate draft research for that topic is:

- `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`

### Recommendation B. Include inspect-preview in current planning, but scope it as a follow-up layer

An explicit inspect-preview mode for rename results is now worth tracking in the current planning backlog.

Recommended constraints:

- do not make it a prerequisite for the first bounded dry-run preview implementation
- design the data shape and row composition so that a later inspect-preview mode can reuse them
- treat the existing rename plan CSV as the primary inspect-preview input artifact
- preserve the current CSV naming rule as the replayable-plan type guard
- keep the renderer boundary narrow so future preview surfaces are possible without rewriting rename planning logic

This keeps the feature in active planning while still preserving a sensible implementation order.

### Recommendation C. Introduce a dedicated preview pager only if needed

If truncation is not sufficient, the next step should be a focused preview pager primitive for rename results, not a full interactive framework migration.

That pager could be implemented with the same low-level TTY approach already used for inline path prompts:

- render only the visible window
- support up/down or page navigation
- keep the data model outside the renderer
- exit back to the existing flow cleanly

This would scope the complexity to the exact problem surface.

### Recommendation D. Re-evaluate Ink only for a broader app-shell ambition

Ink becomes more reasonable only if the product direction changes from "prompt-driven CLI with a few custom TTY widgets" to something closer to a full terminal app:

- persistent layout regions
- multiple coordinated panes
- shared keyboard routing across screens
- reusable componentized terminal UI beyond rename preview

If that broader ambition is real, Ink can be reconsidered. If not, it is likely overkill for the current issue.

## Suggested Implementation Order

1. Add preview truncation/windowing rules to rename output.
2. Use both terminal height and a fixed cap to derive the visible row budget.
3. On truncation, show head and tail slices and emphasize the CSV path as the full review artifact.
4. Keep inspect-preview in the current plan as a follow-up item, with reusable row/data boundaries.
5. Add an optional interactive pager only if user testing shows truncation is insufficient or inspect-preview needs it.
6. Defer any Ink adoption decision until there is a wider terminal-app requirement.

## Scope Layers

### 1. Rename dry-run preview as v1

This is the current problem to solve first.

Baseline scope:

- `rename ... --dry-run` remains the primary workflow
- preview stays command-local to rename
- output is bounded and truncated
- default terminal shape stays compact
- CSV remains the full review artifact

This should be considered required for the current issue.

### 2. Reusable preview window as future infrastructure

This is a possible follow-up if bounded output is still insufficient.

Possible future scope:

- scrollable inner window
- reusable keyboard navigation
- generic row/window rendering
- shared use by rename and other commands

This should be considered optional future infrastructure, not a requirement for rename v1.

### 3. `data preview` as a future command-level feature

This is a broader product surface than rename preview.

Possible future scope:

- explicit `data preview` subcommand
- better table rendering for structured data
- optional reuse of the preview window infrastructure
- workflows not limited to rename

This should be considered a separate feature track, not part of the current rename-preview fix.

## Mock Preview Shapes

### Option A. Shared budget for changed and skipped rows

This keeps a single combined preview window.

```text
Directory: ./photos
Files found: 1000
Files to rename: 842
Entries skipped: 158

Preview: showing first 10 and last 10 of 1000 rows; 980 omitted from the middle.

- IMG_0001.JPG -> trip-2026-0001.jpg
- IMG_0002.JPG -> trip-2026-0002.jpg
- notes.txt (skipped: profile_extension_filtered)
- IMG_0003.JPG -> trip-2026-0003.jpg
...
- vacation.mov (skipped: unsupported_for_codex_images)
- IMG_0998.JPG -> trip-2026-0998.jpg
- IMG_0999.JPG -> trip-2026-0999.jpg
- IMG_1000.JPG -> trip-2026-1000.jpg

Plan CSV: ./rename-20260228-123000-ab12cd34.csv
Dry run only. No files were renamed.
```

Pros:

- one simple list
- no extra section logic

Tradeoff:

- skipped rows can consume the same visible budget as actual rename rows

### Option B. Separate budgets for changed and skipped rows

This gives rename rows the main preview area and treats skipped rows as their own section.

```text
Directory: ./photos
Files found: 1000
Files to rename: 842
Entries skipped: 158

Renames: showing first 10 and last 10 of 842 rows; 822 omitted from the middle.

- IMG_0001.JPG -> trip-2026-0001.jpg
- IMG_0002.JPG -> trip-2026-0002.jpg
- IMG_0003.JPG -> trip-2026-0003.jpg
...
- IMG_0998.JPG -> trip-2026-0998.jpg
- IMG_0999.JPG -> trip-2026-0999.jpg
- IMG_1000.JPG -> trip-2026-1000.jpg

Skipped: showing first 3 and last 3 of 158 rows; 152 omitted from the middle.

- notes.txt (skipped: profile_extension_filtered)
- draft.tmp (skipped: hidden_file)
- .DS_Store (skipped: default_excluded_entry)
...
- vacation.mov (skipped: unsupported_for_codex_images)
- broken.pdf (skipped: unreadable_input)
- huge.tiff (skipped: file_too_large)

Plan CSV: ./rename-20260228-123000-ab12cd34.csv
Dry run only. No files were renamed.
```

Pros:

- rename intent stays primary
- skipped reasons remain visible without overwhelming the main preview

Tradeoff:

- slightly more verbose output structure

### Option C. Renames preview plus skipped summary only

This treats skipped items mostly as metrics unless the user opens the CSV.

```text
Directory: ./photos
Files found: 1000
Files to rename: 842
Entries skipped: 158

Renames: showing first 10 and last 10 of 842 rows; 822 omitted from the middle.

- IMG_0001.JPG -> trip-2026-0001.jpg
- IMG_0002.JPG -> trip-2026-0002.jpg
- IMG_0003.JPG -> trip-2026-0003.jpg
...
- IMG_0998.JPG -> trip-2026-0998.jpg
- IMG_0999.JPG -> trip-2026-0999.jpg
- IMG_1000.JPG -> trip-2026-1000.jpg

Skipped summary:
- 80 profile_extension_filtered
- 41 hidden_file
- 22 unreadable_input
- 15 file_too_large

Plan CSV: ./rename-20260228-123000-ab12cd34.csv
Dry run only. No files were renamed.
```

Pros:

- compact
- keeps the main preview focused on actual rename changes

Tradeoff:

- hides concrete skipped examples from the terminal output

Current leaning:

- Default to Option C for the baseline interactive output.
- Keep Option B available as an explicit detailed skipped-items view when the user wants per-item skip reasons in the terminal.
- This keeps the default output compact while preserving a path to deeper inspection without committing to a full scrolling preview UI yet.

## Preferred Direction

Recommended baseline:

- default preview shape: Option C
- skipped items in default view: summarized by reason
- detailed skipped-item inspection: optional follow-up mode using the Option B structure
- full review artifact: generated plan CSV
- no generic preview-window or `data preview` feature required for the first implementation
- inspect-preview: keep in the current planning to-do list, but not as a blocker for the first bounded preview pass
- inspect-preview artifact policy: reuse `rename-*.csv` as input rather than creating another same-shaped file

Why this direction fits best:

- the common path stays compact and fast
- changed rename rows remain the primary signal
- skipped details are still available without forcing everyone to read them
- this does not require a full inner-window/pager implementation as the first step
- it keeps rename dry-run preview separate from broader terminal-viewer ambitions
- it still respects a reusable design if inspect-preview is added soon after
- it keeps the current plan CSV naming contract meaningful and avoids artifact confusion

## Current Planning To-Do

- Implement bounded rename dry-run preview with terminal-height-aware head-and-tail truncation.
- Use Option C as the default terminal shape.
- Keep Option B available for explicit detailed skipped-item inspection.
- Structure preview-row composition so the same data can later feed an inspect-preview mode.
- Treat the generated `rename-*.csv` file as the inspect-preview input artifact.
- Add inspect-preview as a planned follow-up item after the bounded preview baseline lands.

### Working Answers So Far

- Preview budget should be derived from both terminal height and a fixed cap.
- Truncated dry runs should emphasize the generated plan CSV path as the full review surface.
- Truncation should prefer head-and-tail slices rather than only the first rows.
- Default terminal output should follow Option C.
- Detailed per-item skipped output should remain available as an explicit Option B-style inspection mode.
- The skipped-items question is effectively answered by the Option C default plus Option B detail path.
- Inspect-preview should be kept in the current planning to-do list as a follow-up feature with reusable design boundaries.
- Inspect-preview should follow the current dry-run CSV naming rule only as an input contract; it should not emit a second artifact that pretends to be the same replayable plan type.
- A reusable preview window belongs to a later infrastructure layer, even if inspect-preview is planned earlier.
- A future `data preview` subcommand belongs to a separate feature track, not this rename-preview research scope.
- Path prompt sibling-navigation questions have been moved to `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`.

## Related Plans

- `docs/plans/plan-2026-02-28-interactive-large-rename-preview-ux-implementation.md`
- `docs/plans/jobs/2026-02-28-extract-rename-preview-composition-primitives.md`
- `docs/plans/jobs/2026-02-28-bounded-option-c-rename-dry-run-preview.md`
- `docs/plans/jobs/2026-02-28-detailed-skipped-item-rendering-path.md`
- `docs/plans/jobs/2026-02-28-inspect-preview-reuse-boundary-and-csv-contract.md`
- `docs/plans/jobs/2026-03-01-large-rename-preview-manual-qa-and-smoke-checks.md`
- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
- `docs/plans/plan-2026-02-26-interactive-two-layer-command-menu-refactor.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`

## References

- `src/cli/actions/rename.ts`
- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/path.ts`
- `src/utils/append-all.ts`
- [Ink](https://github.com/vadimdemedes/ink)
