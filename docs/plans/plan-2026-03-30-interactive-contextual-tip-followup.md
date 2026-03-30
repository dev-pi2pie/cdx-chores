---
title: "Interactive contextual tip follow-up"
created-date: 2026-03-30
modified-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Implement the contextual-tip direction for interactive `data query` and interactive `data extract`, including the later follow-up that replaces the initial layered checkpoint tips with one randomized flow-entry tip slot.

## Why This Plan

The abort-tip timing and styling follow-up established a stable baseline:

- the tip surface works best in longer interactive flows
- the safety-oriented `Ctrl+C` guidance should remain stable
- lightweight flows such as interactive `data preview` do not justify the extra visual weight

The next useful slice is therefore narrower than “tip system everywhere”:

- keep the current abort tip as the baseline safety message
- add one contextual tip only at selected major checkpoints
- keep the selection deterministic so the interactive surface stays testable and documentation-friendly

This plan now records both slices:

- the earlier first pass that shipped deterministic checkpoint tips
- the completed follow-up that replaced that model after product review

## Current State

- interactive `data query` now shows one randomized flow-entry tip from a small command-scoped pool
- interactive `data extract` now shows one randomized flow-entry tip from a small command-scoped pool
- interactive `data preview` no longer shows the tip
- the randomized flow-entry tip resolver now lives in:
  - `src/cli/interactive/contextual-tip.ts`
- the current research direction is recorded in:
  - `docs/researches/research-2026-03-30-interactive-contextual-tip-usage.md`
- the later follow-up direction is now the shipped direction:
  - one visible tip at a time
  - the current flow-entry tip slot
  - randomized selection from a small command-scoped pool
  - no later checkpoint tip blocks

## Scope

### Initial target commands

Adopt contextual tips only for:

- interactive `data query`
- interactive `data extract`

First-pass exclusions:

- interactive `data preview`
- interactive `data parquet preview`
- interactive `data convert`
- markdown commands
- rename commands
- video commands

### Initial tip model

Freeze the initial model:

- keep the current abort tip as the only flow-entry tip
- add contextual tips later in the flow at selected checkpoints
- do not co-render a contextual tip with the flow-entry abort tip
- render at most one contextual tip at a time
- choose the tip from the active checkpoint deterministically
- do not use session-randomized or per-run randomized selection

### Initial checkpoint candidates

Start with major checkpoints only.

Candidate checkpoints:

- interactive `data query`
  - mode selection
  - SQL review
  - output selection
- interactive `data extract`
  - extraction review
  - write boundary

### Initial wording direction

Keep contextual tips short, action-oriented, and checkpoint-specific.

Examples that fit the current research direction:

- interactive `data query`
  - `Tip: manual is best for joins or custom SQL.`
  - `Tip: SQL limit and preview rows are separate controls.`
  - `Tip: Rows to show only affects terminal preview.`
- interactive `data extract`
  - `Tip: source interpretation is reviewed before output setup.`
  - `Tip: Change destination keeps the current extraction setup.`

Final wording should be frozen during implementation, not invented ad hoc during patching.

## Design Contract

### Abort tip remains the safety baseline

The current `Ctrl+C` tip remains the only always-on tip.

The contextual layer should not replace it or turn it into a rotating message channel.

### Contextual tips are a later-checkpoint layer

The first contextual implementation should appear only after the flow has reached a meaningful checkpoint.

That keeps the flow-entry surface simple while still allowing guidance where confusion is more likely.

Contextual tips should not share the same moment as the flow-entry abort tip:

- the abort tip stays at flow entry
- contextual tips render later at selected checkpoints
- a single checkpoint render should show either the abort tip or one contextual tip, not both

### Checkpoint-driven, not mode-random

The first pass should stay checkpoint-driven.

Do not branch the tip set per `manual`, `formal-guide`, or `Codex Assistant` unless a later usability problem proves checkpoint-level wording is insufficient.

### Stable rendering contract

Keep the rendering deterministic:

- same checkpoint => same tip
- no abort-tip/contextual-tip co-render at the same checkpoint moment
- no randomness
- no session-memory suppression
- no user-activity tracking

That keeps tests, screenshots, and guide wording stable.

### Tip volume stays low

The first pass should keep visual noise down:

- do not stack multiple tips
- do not duplicate information already obvious from the prompt text
- avoid tips on lightweight flows

## Non-Goals

- random tip rotation
- per-session tip memory or suppression tracking
- global tip rollout across all interactive commands
- mode-specific tip variants in the first pass
- replacing prompt copy with large explanatory blocks

## Risks and Mitigations

- Risk: contextual tips repeat information the prompt already makes obvious.
  Mitigation: freeze candidate checkpoints and only keep tips that explain a non-obvious behavior or boundary.

- Risk: adding contextual tips makes the longer flows feel visually noisy.
  Mitigation: render at most one contextual tip at a checkpoint and keep lightweight flows excluded.

- Risk: the implementation accidentally reintroduces unstable or random copy.
  Mitigation: keep tip resolution deterministic and test the exact checkpoint behavior.

- Risk: checkpoint-only tips are too generic for one `data query` mode but not the others.
  Mitigation: keep the first pass checkpoint-only, then revisit mode-specific tips only if concrete confusion remains.

## Implementation Touchpoints

- `src/cli/interactive/notice.ts`
- `src/cli/interactive/contextual-tip.ts`
- interactive `data query` flow modules under `src/cli/interactive/data-query/`
- `src/cli/interactive/data/extract.ts`
- interactive routing tests under `test/`
- interactive usage guides under `docs/guides/`

## Implementation Notes

- the earlier first pass kept the current abort tip as the flow-entry baseline and added deterministic checkpoint tips later in the flow
- the current shipped behavior replaces that layered model with:
  - one shared tip slot at flow entry
  - one visible tip at a time
  - a small randomized pool per command
- interactive `data preview` remains tip-free
- the current tip pools stay command-scoped rather than mode-specific

## Phase Checklist

### Phase 1: Freeze contextual-tip contract

- [x] freeze the target commands:
  - [x] `data:query`
  - [x] `data:extract`
- [x] freeze the first-pass exclusion list
- [x] freeze the checkpoint-only first-pass rule
- [x] freeze the no-randomness and no-session-memory rule
- [x] freeze the candidate contextual-tip wording set

### Phase 2: Tip resolver and rendering boundary

- [x] add a checkpoint-aware contextual-tip resolver
- [x] keep the current abort-tip helper intact as the flow-entry baseline
- [x] define where contextual tips render relative to the active checkpoint prompt
- [x] define the non-overlap rule between the flow-entry abort tip and later contextual tips
- [x] keep rendering deterministic and low-noise

### Phase 3: First command adoption

- [x] adopt contextual tips in interactive `data query`
- [x] adopt contextual tips in interactive `data extract`
- [x] keep the behavior checkpoint-only, not mode-specific
- [x] verify that interactive `data preview` still stays tip-free

### Phase 4: Verification and docs

- [x] add focused tests for checkpoint tip rendering and exclusions
- [x] update affected guides only after behavior lands
- [x] verify that docs describe deterministic checkpoint tips rather than random rotation

### Phase 5: Single-slot randomized tip follow-up

- [x] replace the current layered checkpoint-tip behavior with one shared flow-entry tip slot
- [x] define small randomized tip pools for:
  - [x] `data:query`
  - [x] `data:extract`
- [x] include the abort tip as one possible random tip rather than an always-on line
- [x] remove later checkpoint tip rendering from `data query`
- [x] remove later checkpoint tip rendering from `data extract`
- [x] keep `data preview` tip-free
- [x] update tests for bounded random tip pools and single-slot behavior
- [x] update guides to describe the revised randomized flow-entry tip model

## Related Research

- `docs/researches/research-2026-03-30-interactive-contextual-tip-usage.md`

## Related Jobs

- `docs/plans/jobs/2026-03-30-interactive-abort-tip-timing-and-styling-followup.md`
- `docs/plans/jobs/2026-03-30-shared-interactive-ux-first-rollout.md`
