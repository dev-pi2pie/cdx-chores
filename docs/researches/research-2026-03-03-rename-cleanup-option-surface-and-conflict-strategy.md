---
title: "Rename cleanup option surface and conflict strategy"
created-date: 2026-03-03
status: in-progress
agent: codex
---

## Goal

Clarify the cleanup option model after the fragment-removal hot-fix so the next implementation pass can add conflict handling without overloading `--style`.

## Current Option Comparison

| Surface | Current role | Current values / scope | Should own | Should not own |
| ------- | ------------ | ---------------------- | ---------- | -------------- |
| `--hint` | Select cleanup fragment families | `date`, `timestamp`, `serial`, `uid` | What to detect and clean from the existing basename | Text formatting, collision policy, fresh-name generation |
| `--style` | Format surviving basename text after cleanup | `preserve`, `slug` | Text formatting only | Fragment detection, conflict handling, whole-basename replacement |
| `--timestamp-action` | Adjust matched timestamp handling | `keep`, `remove` when `--hint timestamp` is active | Whether matched timestamp text survives cleanup | Non-timestamp hints, general formatting, conflict handling |
| current planner conflict behavior | Keep directory cleanup safe | implicit strict skip with `target conflict` | Same-run and occupied-path collision prevention | User-chosen conflict policy surface |
| future `--conflict-strategy` | Explicit collision policy | proposed: `skip`, `number`, `uid-suffix` | What to do only when cleaned results want the same target | Fragment matching, normal text formatting, analyzer suggestion |
| Codex-assisted cleanup | Future suggestion layer only | planned, not implemented | Suggest likely cleanup hints/settings | Default deterministic cleanup or silent conflict resolution |

## Current Usage Comparison

| User intent | Primary surface today | Example | Notes |
| ----------- | --------------------- | ------- | ----- |
| Remove a matched serial fragment | `--hint serial` | `rename cleanup ./logs --hint serial --dry-run` | Can collapse many names to one basename and therefore conflict |
| Remove a matched uid fragment | `--hint uid` | `rename cleanup ./captures --hint uid --dry-run` | Keeps surrounding prefix/suffix text |
| Keep readable surviving text | `--style preserve` | `rename cleanup ./captures --hint uid --style preserve --dry-run` | Default style |
| Slugify surviving text | `--style slug` | `rename cleanup ./captures --hint serial --style slug --dry-run` | Formatting only; not collision handling |
| Remove timestamp text entirely | `--hint timestamp --timestamp-action remove` | `rename cleanup ./captures --hint timestamp --timestamp-action remove --dry-run` | Timestamp-specific behavior |
| Handle cleanup collisions differently | future `--conflict-strategy` | proposed future: `--conflict-strategy number` | Current behavior is still strict skip with `target conflict` |
| Ask Codex to infer cleanup settings | not available yet | planned future interactive step | Separate feature track |

## Key Findings

### 1. `--style` should stay narrow

The current cleanup contract is clearer if `--style` is limited to formatting the surviving basename text after cleanup matching has already removed or normalized fragments.

Current practical meaning:

- `preserve` keeps the surviving words close to the source text
- `slug` slugifies the surviving text

Implication:

- `--style` should not be used for whole-basename replacement behaviors
- `uid` should remain a cleanup hint family, not return as a cleanup style under the current model
- collision resolution should not be folded into `--style`

### 2. Cleanup options need separate axes

The cleanup flow is easier to reason about when each option family answers one question:

- `--hint`: which fragment families should be detected and cleaned
- `--style`: how the surviving text should be formatted
- `--timestamp-action`: what to do with matched timestamp fragments when timestamp cleanup is active
- `--conflict-strategy`: what to do when multiple cleanup results want the same target path

Implication:

- future conflict handling should be introduced as its own option instead of expanding `--style`
- conflict strategy should apply only after cleanup matching and style formatting have already produced the preferred target

### 3. Current directory conflict behavior is strict skip

Today, directory cleanup plans skip collisions with reason `target conflict`.

This includes:

- multiple candidates in the same run collapsing to one target
- a candidate colliding with an unchanged file in the same scope
- a candidate colliding with an existing occupied path

Implication:

- the current behavior is safe and audit-friendly
- it is a reasonable default even if a future conflict strategy option is added

### 4. A future `--conflict-strategy` should be collision-only and have real choices

Conflict strategy should activate only when the preferred cleaned target collides.
It should not rewrite every cleaned filename.

Recommended first real strategy set:

- `skip`: preserve the current safe behavior
- `number`: append increasing numeric suffixes such as `-1`, `-2`, `-3`
- `uid-suffix`: append a short uid fragment only when needed, for example `-uid-7k3m9q2x4t`

Recommended behavior rule:

- cleanup hints run first
- style formatting runs second
- conflict strategy runs only when the resulting target path conflicts
- the first non-conflicting winner should keep the clean unsuffixed basename
- later colliding rows should receive conflict resolution only if the chosen strategy is not `skip`

Implication:

- keep `skip` as the default
- treat `number` and `uid-suffix` as explicit opt-in behavior
- do not reuse the bare term `uid` as a conflict strategy name because it already means a cleanup hint family

### 5. Codex-assisted cleanup remains a separate track

Conflict handling and option-surface cleanup are deterministic contract work.
They should stay separate from the planned Codex-assisted cleanup suggestion feature.

Implication:

- do not mix analyzer-assisted suggestion work into the conflict-strategy implementation plan

## Recommendations

- keep `--style` limited to `preserve` and `slug`
- document that `--style` affects only the surviving basename text after cleanup matching
- document current conflict behavior explicitly in user-facing cleanup docs
- revise the active interactive cleanup plan to add a focused conflict-strategy track
- revise the active interactive cleanup plan so `--conflict-strategy` is collision-only and uses a real multi-option strategy set
- avoid surfacing a one-option interactive conflict selector as the intended final UX

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`
- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`
