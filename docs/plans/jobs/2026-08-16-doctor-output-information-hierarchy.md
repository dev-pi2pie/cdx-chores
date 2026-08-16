---
title: "Doctor output information hierarchy implementation"
created-date: 2026-08-16
status: in-progress
agent: codex
---

## Goal

Execute the phased `doctor` output redesign from evidence closure through
compact, detailed, and JSON view implementation while preserving JSON meanings,
probe behavior, exit behavior, and public-safe remediation.

Related documents:

- [Implementation plan](../plan-2026-08-16-doctor-output-information-hierarchy.md)
- [Research contract](../../researches/research-2026-08-13-doctor-output-information-hierarchy.md)

## Phase 1: Evidence Inventory And Contract Freeze

Status: `completed`

Starting commit: `81c36c47271fecc3fbac283e9e7287172eb2a879`

Evidence boundary:

- current JSON field, omission, nullability, status, order, and meaning inventory
- current human section, remediation, early-return, and exit behavior inventory
- compact, detailed, and JSON visibility mapping
- raw-detail trust-boundary audit
- DuckDB runtime, extension, installability, and remediation matrix
- representative deterministic fixtures
- stable workflow, condition, and action identities and ordering
- minimal inspection, report, projection, rendering, and test boundaries

Recorded evidence:

- The research `Phase 1 Evidence Closure` section owns the settled contract.
- The first documentation review returned `Constrain` because action mapping,
  child-condition precedence, and controlled fixture inputs were not exact
  enough. All three findings were accepted and the evidence contract was
  expanded before production work.
- Production code remains unchanged during this phase.
- The proposed module direction keeps `actionDoctor` as a thin public facade and
  uses focused internal inspection, report, JSON, workflow, and rendering
  modules without exporting internals publicly; Phase 2 maintainability review
  must confirm it.

Baseline validation:

```text
bun test test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts test/cli-interactive-menu.test.ts test/cli-interactive-routing.test.ts
87 pass, 0 fail
```

Pre-commit documentation review:

- The first pass returned `Constrain`; the accepted action-mapping,
  precedence, and fixture-contract revisions closed all material findings.
- The second pass found no material gap and permitted `Continue`.
- The optional condition-ordering clarification was accepted and recorded.

Committed review range:

```text
81c36c47271fecc3fbac283e9e7287172eb2a879..d3bd79a9
```

The exact committed range passed focused documentation review with no material
findings. The global condition-order rule is first affected workflow order,
then condition ID.

Decision gate: `Continue`. The research is `completed`, the plan is `active`,
and Phase 2 production work may begin.

## Phase 2: Shared Evidence Report And JSON Parity

Status: `ready`

## Phase 3: Workflow, Condition, Action, And Safety Projection

Status: `pending Phase 2 Continue`

## Phase 4: Compact And Detailed Human Views

Status: `pending Phase 3 Continue`

## Phase 5: Integrated Validation, Guidance, And Lifecycle Closeout

Status: `pending Phase 4 Continue`
