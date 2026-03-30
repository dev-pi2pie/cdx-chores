---
title: "Interactive contextual tip usage for data query and data extract"
created-date: 2026-03-30
modified-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Evaluate how interactive `data query` and interactive `data extract` should expand beyond one abort tip into a small tip channel, including whether the product should prefer one shared randomized tip slot or a deterministic checkpoint-driven layer.

This research is now complete because the preferred follow-up direction has been implemented:

- one visible tip at a time
- the existing flow-entry tip slot
- a small randomized command-scoped pool
- no later checkpoint tip blocks

## Key Findings

### 1. A tip channel is reasonable, but the product should show only one visible tip at a time

The recent abort-tip follow-up showed that even one short line can materially affect the feel of an interactive flow.

That makes tips worth treating as a real UX surface rather than ad hoc copy.

User review of the first contextual-tip implementation showed that a layered tip model can feel heavier than expected.

That makes one rule more important than the earlier checkpoint-driven draft assumed:

- only one tip should be visible at a time

Implication:

- do not stack the abort tip and a contextual tip
- do not introduce a second tip row later in the same flow
- keep the guidance surface to one small slot

### 2. The current abort-tip position is the right slot for future tips too

The current abort-tip slot already has the right product properties:

- early enough to be seen
- visually separated from the active working section
- small enough to behave like a reusable guidance channel

That makes it a better surface for future tips than adding separate later-checkpoint tip blocks.

Recommendation:

- reuse the current flow-entry tip slot
- show one tip there
- keep later checkpoints free of extra tip lines unless a later research pass proves they are necessary

### 3. Randomized selection is acceptable if the pool is small and command-scoped

The earlier draft preferred deterministic checkpoint mapping because it is easy to test and explain.

After product review, the more important preference is now:

- one tip only
- current abort-tip slot
- some variety across runs

That means bounded random selection is acceptable as long as the pool stays small and relevant.

The real risk is not randomness by itself. The real risks are:

- the most important tip may be hidden by a less relevant one
- low-value or repetitive tips making the product feel noisy
- command-irrelevant tips appearing in the wrong flow

Recommendation:

- use a small randomized tip pool per command
- keep the pool relevant to that command’s real boundaries
- avoid a large global rotating message set

### 4. The abort tip should remain part of the randomized pool, not a separate always-on line

The current `Ctrl+C` guidance is still different from other possible tips:

- it is safety-oriented
- it is valid at every stage of the flow
- it does not depend on schema, mode, or output choices

It should remain available, but it no longer needs to be the only line that can occupy the tip slot.

Recommendation:

- keep `Ctrl+C` abort guidance in the command tip pool
- allow it to appear sometimes instead of always
- keep the slot single-purpose rather than treating abort guidance as a permanently reserved message

### 5. The first randomized tip pools should stay command-scoped, not mode-specific

With a single flow-entry tip slot, command-scoped tips now fit better than checkpoint-only or mode-specific tips.

Examples:

- interactive `data query`
  - `manual` is the better lane for joins or custom SQL
  - SQL `limit` and preview rows are separate concepts
  - `Rows to show` only affects terminal preview
- interactive `data extract`
  - source interpretation is reviewed before output setup
  - `Change destination` keeps the current extraction setup

Recommendation:

- keep the initial pool scoped to the current command
- do not branch by `manual`, `formal-guide`, or `Codex Assistant` in the first randomized pass
- revisit mode-specific tips only if one mode later shows a concrete repeated confusion point

### 6. Session memory is still out of scope

The product still should not track prior user activity just to suppress repeated tips.

Recommendation:

- do not record session history for tip suppression
- let the randomized selection happen independently per run

### 7. Tip volume should stay low

The recent preview rollback showed that even a correctly timed and styled tip can still feel visually heavy in a shorter flow.

That implies a broader rule:

- tips should not appear merely because a flow technically supports them
- longer reviewed flows can justify one stable safety tip and occasional contextual tips
- lightweight flows should stay visually quieter

Recommendation:

- keep the tip surface limited to the longer interactive flows first:
  - `data query`
  - `data extract`
- keep interactive `data preview` out of scope
- do not widen this to lightweight flows until there is evidence the extra line is helpful

## Implications or Recommendations

### Recommended first-pass contract

1. Show only one tip at a time.
2. Reuse the current flow-entry tip slot.
3. Limit the tip channel to interactive `data query` and interactive `data extract`.
4. Use a small randomized command-scoped tip pool.
5. Do not track session history for suppression or rotation.
6. Keep the first randomized pass command-scoped, not mode-specific.

### Recommended implementation shape

- keep one shared tip renderer
- replace the current “always abort tip plus later contextual tips” model with one randomized flow-entry tip choice
- resolve tips from a small per-command pool:
  - `data query`
  - `data extract`
- keep the pool definitions explicit so tests can validate the allowed values

### Suggested first randomized tip pools

- interactive `data query`
  - `Tip: Press Ctrl+C to abort this session.`
  - `Tip: Manual is best for joins or custom SQL.`
  - `Tip: SQL limit and preview rows are separate controls.`
  - `Tip: Rows to show only affects terminal preview.`
- interactive `data extract`
  - `Tip: Press Ctrl+C to abort this session.`
  - `Tip: Source interpretation is reviewed before output setup.`
  - `Tip: Change destination keeps the current extraction setup.`

## Resolved Follow-Up Questions

- Abort tip versus contextual tip surface:
  - use one shared tip surface
  - show one tip at a time in the current abort-tip slot
- Repeated entry into the same checkpoint:
  - do not suppress tips based on prior session activity
  - the current product does not track user activity history for this purpose, and this tip system should not introduce that kind of session memory
- `data query` mode-specific tips versus checkpoint-only tips:
  - recommendation: keep the first randomized pass command-scoped rather than mode-specific
  - why:
    - it keeps the tip system smaller and easier to reason about
    - it avoids multiplying copy across `manual`, `formal-guide`, and `Codex Assistant` before there is evidence that mode-specific tips are necessary
    - it keeps tests, docs, and prompt expectations more stable
  - later expansion into mode-specific tips should happen only if a real repeated confusion point appears within one mode and command-scoped wording is no longer enough

## Related Plans

- `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`

## References

- `src/cli/interactive/notice.ts`
- `src/cli/interactive/data-query/index.ts`
- `src/cli/interactive/data-query/execution.ts`
- `src/cli/interactive/data/extract.ts`
- `docs/plans/jobs/2026-03-30-shared-interactive-ux-first-rollout.md`
- `docs/plans/jobs/2026-03-30-interactive-abort-tip-timing-and-styling-followup.md`
