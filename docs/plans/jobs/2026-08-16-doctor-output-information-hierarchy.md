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

Status: `completed`

Starting commit: `94e9c944`

Implementation commits:

- `8670a428` — extracted the shared inspector bundle, normalized evidence
  report, explicit legacy JSON projection, controlled fixtures, and canonical
  compatibility tests
- `639747a7` — decoupled the legacy JSON type from future report fields and
  closed the accepted fixture, ordering, human-default, and rejection-path test
  findings

Validation:

```text
bun test test/cli-action-doctor.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts
52 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

Review range:

```text
94e9c944..639747a7
```

The first maintainability and test reviews found an implicit JSON-type coupling
and incomplete frozen-fixture, ordering, and exact-human-output coverage. The
accepted fixes landed in `639747a7`; the widened range then passed both reviews
with no remaining material findings. Inspector overrides remain on the internal
CLI action surface and are not package-root exports.

Decision gate: `Continue`. The shared report preserves one inspection pass,
complete controlled JSON compatibility, the existing human default, and
command failure behavior.

## Phase 3: Workflow, Condition, Action, And Safety Projection

Status: `in-progress`

Starting commit: `c24e7c13`

Implemented projection boundary:

- one pure projection derives the seven frozen leaf workflows from the
  normalized evidence report without parsing rendered text
- closed workflow, state, condition, action, and action-class identities
- base-state precedence, subordinate-condition suppression, shared-condition
  linking, stable ordering, deterministic counts, and action deduplication
- typed compact-safe condition and action copy with existing install hints and
  the closed DuckDB extension command helper as the only public remediation
  sources
- internal fontconfig remediation evidence outside the explicit legacy JSON
  projection

Validation:

```text
bun test test/cli-doctor-workflow.test.ts test/cli-action-doctor.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts
77 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

The frozen fixtures cover ready, limited, unavailable, and unknown states;
shared and deduplicated conditions/actions; base and child precedence; safe and
unavailable remediation; required-before-recommended ordering; hostile raw
detail; and unchanged JSON/detailed evidence paths.

Exact committed-range maintainability, test-quality, and public-safety review
remains pending before this phase can close.

## Phase 4: Compact And Detailed Human Views

Status: `pending Phase 3 Continue`

## Phase 5: Integrated Validation, Guidance, And Lifecycle Closeout

Status: `pending Phase 4 Continue`
