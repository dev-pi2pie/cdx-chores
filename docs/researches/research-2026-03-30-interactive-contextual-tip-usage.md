---
title: "Interactive contextual tip usage for data query and data extract"
created-date: 2026-03-30
status: draft
agent: codex
---

## Goal

Evaluate whether interactive `data query` and interactive `data extract` should expand beyond one abort tip into a small tip channel, and determine whether those tips should be random, deterministic, or context-driven.

## Key Findings

### 1. A tip channel is reasonable, but fully random tip selection is the wrong default

The recent abort-tip follow-up showed that even one short line can materially affect the feel of an interactive flow.

That makes tips worth treating as a real UX surface rather than ad hoc copy.

However, fully random tips would create three immediate problems:

- the most important tip may be hidden by a less relevant one
- terminal screenshots and guide wording become less stable
- interactive tests become noisier because the rendered text is no longer predictable

Recommendation:

- do not treat tips as a random rotating message pool
- keep the surface deterministic by checkpoint or flow stage

### 2. The abort tip should remain the only always-on tip

The current `Ctrl+C` guidance is different from other possible tips:

- it is safety-oriented
- it is valid at every stage of the flow
- it does not depend on schema, mode, or output choices

That makes it a better fit for an always-on tip than workflow advice such as SQL-authoring hints or output-boundary reminders.

Recommendation:

- keep `Ctrl+C` abort guidance as the single stable tip that can appear automatically in the longer interactive flows
- avoid mixing multiple always-on lines into the same tip surface

### 3. Future secondary tips should be contextual and stage-specific

Useful non-safety tips in `data query` and `data extract` are usually only correct at a specific stage.

Examples:

- interactive `data query`
  - near mode selection: `manual` is the better lane for joins or custom SQL
  - near output review: `Rows to show` only affects terminal preview
  - near SQL review: SQL `limit` and preview rows are separate concepts
- interactive `data extract`
  - near extraction review: source interpretation is reviewed before output setup
  - near the write boundary: `Change destination` keeps the current extraction setup
  - near header review: semantic header suggestions are optional and conditional

Those tips are more valuable when they match the current checkpoint than when they appear at random.

Recommendation:

- if secondary tips are added later, allow at most one contextual tip at a time
- resolve that tip from the current checkpoint, not from a random pool

### 4. Deterministic checkpoint-based selection fits the current architecture better than a global rotating tip engine

The current interactive flows already have coarse checkpoints:

- `data query`
  - mode selection
  - SQL review
  - output selection
- `data extract`
  - extraction review
  - write boundary

That means the simplest useful tip design is:

1. define a small set of tip ids
2. map those ids to flow checkpoints
3. render the tip only when the checkpoint is active

This fits the current code better than building a session-randomized tip service.

Recommendation:

- start with one lightweight tip registry or resolver local to interactive flows
- prefer checkpoint-level mapping over global rotation

### 5. Tip volume should stay low

The recent preview rollback showed that even a correctly timed and styled tip can still feel visually heavy in a shorter flow.

That implies a broader rule:

- tips should not appear merely because a flow technically supports them
- longer reviewed flows can justify one stable safety tip and occasional contextual tips
- lightweight flows should stay visually quieter

Recommendation:

- keep the tip surface limited to the longer interactive flows first:
  - `data query`
  - `data extract`
- do not widen this to lightweight flows until there is evidence the extra line is helpful

## Implications or Recommendations

### Recommended first-pass contract

1. Keep the abort tip as the only shipped tip in the first implementation.
2. Limit the tip channel to interactive `data query` and interactive `data extract`.
3. Treat contextual tips as a later follow-up, not part of the first implementation.
4. When contextual tips are added later, choose them deterministically from the current checkpoint.
5. Do not use random selection in the first implementation.

### Recommended implementation shape

- keep the current shared abort-tip helper small
- defer any checkpoint-aware contextual tip resolver until after the abort-tip-only baseline is judged sufficient
- if a later contextual resolver is added:
  - scope it to `data query` and `data extract`
  - return zero or one contextual tip for a given checkpoint
- keep rendering stable so tests can assert on plain text without random branches

### Suggested later example tip map

- interactive `data query`
  - mode selection:
    - `Tip: manual is best for joins or custom SQL.`
  - SQL review:
    - `Tip: SQL limit and preview rows are separate controls.`
  - output selection:
    - `Tip: Rows to show only affects terminal preview.`
- interactive `data extract`
  - extraction review:
    - `Tip: source interpretation is reviewed before output setup.`
  - write boundary:
    - `Tip: Change destination keeps the current extraction setup.`

## Resolved Follow-Up Questions

- Abort tip versus contextual tip surface:
  - in a later contextual-tip phase, render the contextual tip only when the abort tip is absent
- Repeated entry into the same checkpoint:
  - do not suppress tips based on prior session activity
  - the current product does not track user activity history for this purpose, and this tip system should not introduce that kind of session memory
- `data query` mode-specific tips versus checkpoint-only tips:
  - recommendation: keep the first pass checkpoint-only
  - why:
    - it keeps the tip system smaller and easier to reason about
    - it avoids multiplying copy across `manual`, `formal-guide`, and `Codex Assistant` before there is evidence that mode-specific tips are necessary
    - it keeps tests, docs, and prompt expectations more stable
  - later expansion into mode-specific tips should happen only if a real repeated confusion point appears within one mode and checkpoint-level wording is no longer enough

## Related Plans

- `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`

## References

- `src/cli/interactive/notice.ts`
- `src/cli/interactive/data-query/index.ts`
- `src/cli/interactive/data-query/execution.ts`
- `src/cli/interactive/data/extract.ts`
- `docs/plans/jobs/2026-03-30-shared-interactive-ux-first-rollout.md`
- `docs/plans/jobs/2026-03-30-interactive-abort-tip-timing-and-styling-followup.md`
