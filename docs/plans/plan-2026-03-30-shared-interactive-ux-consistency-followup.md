---
title: "Shared interactive UX consistency follow-up"
created-date: 2026-03-30
status: draft
agent: codex
---

## Goal

Extend the completed interactive `data query` UX follow-up into a broader shared/global interactive UX pass so the same navigation, notice, and review patterns are applied consistently across interactive workflows where they make product sense.

## Why This Plan

The completed `data query` follow-up implementation proved out several UX patterns that should not remain one-off behavior:

- width-aware abort notices
- checkpoint-based backtracking at major review stages
- explicit review wording that distinguishes query semantics from output behavior
- shared action ordering for revise, mode change, and cancel decisions

Those patterns now work inside interactive `data query`, but they are still local to that workflow.

The research is therefore still `in-progress` because the original bounded slice is finished while the larger consistency question is still open:

- should the same abort-notice model apply across interactive flows?
- should checkpoint backtracking become a shared convention?
- which interactive commands should adopt review-stage summaries rather than ad hoc prompt chains?
- how should guides describe those shared conventions consistently?

This needs a separate plan rather than reopening the completed local `data query` plan because the remaining work is no longer just a `data query` refinement. It is now a cross-cutting UX consistency track.

## Current State

- interactive `data query` now ships:
  - optional SQL-level `limit` in `formal-guide`
  - richer guided filters
  - width-aware abort notice behavior
  - checkpoint backtracking across:
    - mode selection
    - SQL review
    - output selection
  - review wording that distinguishes SQL-level limit from table-preview bounds
- the corresponding local follow-up plan is complete:
  - `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`
- other interactive surfaces still vary in UX style:
  - some flows have explicit review checkpoints
  - some flows still use linear prompt chains with no structured backtracking
  - some flows already have final write boundaries
  - some flows still rely on one-off copy or local prompt ordering
- the shared/global UX contract has not yet been frozen across commands

## Scope

### First rollout boundary

Freeze the first broader rollout set now:

- width-aware abort notice adoption:
  - `data:extract`
  - `data:preview`
- checkpoint backtracking adoption:
  - `data:extract`
- review-wording adoption:
  - `data:extract`

First-pass exclusions:

- `doctor`
- `data:convert`
- `data:parquet-preview`
- markdown commands
- rename commands
- video commands

Why this boundary:

- `data:extract` already has a meaningful review-before-write rhythm and a final materialization boundary
- `data:preview` is a better candidate for a lightweight shared notice than for checkpoint backtracking
- the excluded commands are either too short, already follow a materially different rhythm, or do not yet justify the extra UX layer

### Shared/global abort notice pattern

- adopt the width-aware abort notice first for:
  - `data:extract`
  - `data:preview`
- promote the current `data query` notice logic into a reusable shared helper contract where appropriate
- keep notice behavior quiet for flows where the extra line would be noise rather than guidance
- document the global rule for when the notice appears and when it does not

### Shared checkpoint-backtracking contract

- define a reusable checkpoint model for interactive flows that already have meaningful review stages
- adopt checkpoint backtracking first for:
  - interactive `data extract`
- keep prompt-by-prompt history restoration out of scope
- keep the action ordering consistent where checkpoint backtracking is adopted:
  - primary revise action
  - secondary mode- or command-specific recovery action when applicable
  - `Change mode` or equivalent route change when applicable
  - `Cancel`

### Shared review wording conventions

- align review-stage wording first for:
  - interactive `data extract`
- define consistent wording rules for:
  - execution review
  - output review
  - final write boundaries
  - separation of semantic choices versus output/rendering choices
- avoid forcing identical wording where the underlying contract differs materially

### Interactive command prioritization

- treat the first rollout set above as frozen for this plan
- only revisit command prioritization if implementation evidence shows the first rollout boundary is wrong

### Documentation consistency

- update current interactive guides so shared UX patterns are described consistently
- keep guides focused on shipped behavior only
- avoid stale version anchoring unless a guide is intentionally version-specific
- keep guide wording aligned with the actual interactive prompts rather than the research-only ideal

## Design Contract

### Shared UX should be selective, not universal

Not every interactive command needs every shared UX pattern.

Freeze this boundary:

- width-aware abort notices may be broadly reusable
- checkpoint backtracking should be adopted only for flows with real review stages
- review-summary wording should appear only where there is a meaningful distinction to explain

This avoids turning “consistency” into uniformity for its own sake.

### Checkpoints should stay coarse

The shared/global model should keep checkpoint backtracking at major stages only.

Recommended general checkpoint classes:

- mode or route selection
- review of the to-be-run or to-be-written action
- output or destination selection

Explicitly out of scope:

- prompt-by-prompt history replay
- generic wizard engines for every interactive flow
- arbitrary undo stacks

### Shared wording should describe behavior, not internals

Guides and prompts should explain what the user can do next, not the implementation detail underneath.

Preferred style:

- short action-oriented wording
- clear separation between:
  - query logic
  - preview bounds
  - destination/output choices
- avoid ambiguous words such as `default` when the product really means `bounded preview behavior`

### Completed local slice remains authoritative for `data query`

The already shipped `data query` follow-up remains the authoritative reference for:

- SQL-level `limit`
- guided filters
- the first checkpoint-backtracking implementation
- the first width-aware abort notice behavior

This plan should extend those patterns, not reopen them unless real cross-command inconsistencies force a revision.

### Shared helper acceptance criteria

Treat the shared/global UX helper contract as established for this plan when all of the following are true:

- the shared abort-notice behavior is reused by:
  - `data:query`
  - `data:extract`
  - `data:preview`
- `data:extract` adopts the shared checkpoint-backtracking structure at its major review stages
- `data:extract` guide wording is aligned with the shipped prompt behavior
- completed local `data query` behavior remains unchanged except for intentional helper extraction

## Non-Goals

- reopening the completed `data query` limit/filter decisions without new evidence
- adding pagination
- building a generic prompt-history framework
- forcing every interactive command to adopt checkpoint backtracking
- rewriting unrelated guides that do not touch interactive UX behavior

## Risks and Mitigations

- Risk: “global consistency” becomes a reason to spread heavyweight UX patterns into commands that do not need them.
  Mitigation: freeze adoption criteria and apply the patterns only where the workflow materially benefits.

- Risk: checkpoint backtracking semantics diverge subtly across commands even while using the same labels.
  Mitigation: define checkpoint classes and action-ordering rules up front before wider rollout.

- Risk: guide wording drifts away from real prompts as different commands adopt shared patterns incrementally.
  Mitigation: update guides only after each shipped slice and keep the wording tied to actual prompt text where practical.

- Risk: the shared/global effort reopens already-settled local `data query` decisions.
  Mitigation: treat the completed `data query` follow-up as the baseline and focus this plan on adoption and consistency, not re-decision.

## Implementation Touchpoints

- shared interactive helpers under `src/cli/interactive/`
- candidate interactive flows under `src/cli/interactive/`
- interactive tests under `test/`
- interactive usage guides under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze adoption criteria and target commands

- [ ] freeze the initial abort-notice rollout set:
  - [ ] `data:extract`
  - [ ] `data:preview`
- [ ] freeze the initial checkpoint-backtracking rollout set:
  - [ ] `data:extract`
- [ ] freeze the first-pass exclusion list
- [ ] freeze the shared action-ordering rule for checkpoint review menus
- [ ] freeze the guide-wording rules for shared/global interactive UX descriptions

### Phase 2: Shared/global helper extraction

- [ ] extract or standardize the width-aware abort notice helper for wider reuse
- [ ] document the helper boundary so commands can opt in selectively
- [ ] freeze which review-stage helpers stay `data query`-specific and which become shared

### Phase 3: First non-query command adoption

- [ ] implement `data:extract` adoption using the shared/global UX rules
- [ ] add checkpoint-backtracking to `data:extract`
- [ ] keep `data:extract` prompt wording aligned with the shared action-ordering contract
- [ ] add the shared abort notice to `data:extract`
- [ ] add the shared abort notice to `data:preview`

### Phase 4: Guide consistency pass

- [ ] update affected interactive guides after behavior lands
- [ ] remove stale version-specific framing where the guide is meant to describe current behavior
- [ ] verify that guide wording matches shipped prompt behavior

### Phase 5: Verification

- [ ] add focused tests for shared/global abort notice adoption where applicable
- [ ] add focused tests for `data:extract` checkpoint-backtracking flow
- [ ] verify that completed local `data query` behavior remains unchanged unless explicitly intended
- [ ] verify the shared helper acceptance criteria are met

## Related Research

- `docs/researches/research-2026-03-30-interactive-data-query-followup-ux.md`

## Related Plans

- `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`
