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

Status: `completed`

Starting commit: `c24e7c13`

Implementation commits:

- `fb02f15b` — added the pure workflow projection, safe remediation evidence,
  frozen matrix tests, and Phase 3 validation records
- `9ff9b30d` — replaced extension-ID casts with typed metadata and strengthened
  isolated dependency plus full condition/action contract coverage

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
78 pass, 0 fail

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

Review range:

```text
c24e7c13..9ff9b30d
```

The first maintainability review found that template-built extension IDs were
cast into closed unions, and the first test review found missing isolated
WeasyPrint coverage plus incomplete typed-record assertions. All findings were
accepted and fixed in `9ff9b30d`. The widened maintainability, test-quality,
and public-safety reviews then passed with no material findings.

Decision gate: `Continue`. The compact-safe projection is deterministic,
actionable, and free of raw environment detail, so Phase 4 may expose it as the
default human view while preserving detailed and JSON views.

## Phase 4: Compact And Detailed Human Views

Status: `completed`

Starting commit: `291f62b7`

Implementation commits:

- `8cbeea89` — added compact and detailed renderers, view selection, parser
  conflict handling, complete routing/safety coverage, and Phase 4 validation
  records
- `9e8bb9e1` — added the accepted Interactive compact integration and compact/
  detailed operational-failure coverage

Implemented view boundary:

- extracted the existing human evidence report into a detailed renderer and
  preserved its section order, versions, capability entries, raw detail, and
  remediation evidence
- removed the detailed DuckDB-unavailable rendering cutoff so the already-
  inspected Codex section remains visible
- added a deterministic compact default with seven workflow states, unique
  issues, headline counts, and one ordered deduplicated Actions section
- added `--details`, retained the legacy `--json` projection, and rejected both
  flags in either order through Commander before the action or inspectors run
- kept TTY-dependent color presentation while proving identical plain-text
  information content for redirected output
- retained the existing Interactive JSON confirmation; its false branch now
  reaches the compact action default without a new view-selection prompt

Validation:

```text
bun test test/cli-command-doctor.test.ts test/cli-action-doctor.test.ts test/cli-doctor-workflow.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts test/cli-interactive-menu.test.ts test/cli-interactive-routing.test.ts
149 pass, 0 fail

bun test
2417 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

The action and built-CLI matrix covers compact, detailed, and JSON routing;
ready, limited, unavailable, and unknown workflow states; safe and unavailable
remediation; action order; TTY/redirection content parity; detailed-section
completeness; parser help and exit `1`; zero action/inspection on conflicts;
health exit `0`; and operational failure exit `2`.

Review range:

```text
291f62b7..9e8bb9e1
```

The first maintainability, CLI-compatibility, and public-safety reviews were
clean. The first test review found missing Interactive compact-default evidence
and missing compact/detailed operational-failure coverage. Both findings were
accepted and fixed in `9e8bb9e1`; the widened maintainability, test-quality,
CLI-compatibility, and public-safety reviews then passed with no material
findings.

Decision gate: `Continue`. Compact, detailed, and JSON views agree on one
inspection pass; view conflicts stop before probes; compact output remains
public-safe; and Phase 4 completed its accepted scope. A later research
refinement inserted Phase 4.5 before lifecycle closeout so Interactive mode can
expose all three existing projections through one selection.

## Phase 4.5: Interactive Doctor View Selection

Status: `completed`

Starting commit: `fb9c1646`

Implementation commit: `5dad5588`

Scope refinement:

- replace the legacy Interactive `Output as JSON?` confirmation with one closed
  Summary, Detailed evidence, or JSON selection
- reuse the compact, detailed, and structured projections completed in Phase 4
- preserve direct CLI behavior and prove one action invocation and one
  inspection pass for every Interactive route
- record focused and full validation plus the exact committed-range review
  before Phase 5 begins

Implemented candidate:

- added one doctor-specific Interactive selector with Summary, Detailed
  evidence, and JSON choices plus an explicit Summary default
- replaced the legacy JSON confirmation with exclusive option mapping into the
  existing doctor action
- preserved runtime prompt streams, one action invocation, one inspection pass,
  and the existing compact, detailed, and structured projections
- retained direct CLI flags, help, conflict handling, and view behavior

Validation:

```text
bun test test/cli-interactive-menu.test.ts test/cli-interactive-routing.test.ts test/cli-action-doctor.test.ts test/cli-command-doctor.test.ts
55 pass, 0 fail

bun test
2420 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

The focused matrix covers exact choice copy and order, the explicit Summary
default, exclusive action options, selector-before-action ordering, prompt
streams, one inspection pass per route, all three rendered projections, and
unchanged direct CLI routing and conflicts.

Review range:

```text
fb9c1646..5dad5588
```

The exact committed range passed maintainability, test-quality, Interactive UX
compatibility, and public-safety review with no material findings. Direct CLI
registration, flags, help, conflicts, actions, and renderers are unchanged in
the range.

Decision gate: `Continue`. Interactive doctor now exposes all three existing
views through one exclusive prompt, Summary is explicitly default-highlighted,
and every route preserves one action invocation and one inspection pass. Phase
5 may proceed with integrated validation, guidance, and lifecycle closeout.

### Follow-up: Concise Details Label

Status: `completed`

Starting commit: `27f76e47`

Implementation commit: `2cac8147`

Scope:

- shorten the Interactive detailed-view label from Detailed evidence to Details
- preserve the `details` route, description, output projection, and direct CLI
  behavior
- update the research and plan contracts plus deterministic choice tests

Validation:

```text
bun test test/cli-interactive-menu.test.ts test/cli-interactive-routing.test.ts test/cli-action-doctor.test.ts test/cli-command-doctor.test.ts
55 pass, 0 fail

bun test
2420 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

Review range:

```text
27f76e47..2cac8147
```

The exact follow-up range passed maintainability, test-quality, Interactive UX
compatibility, and documentation-lifecycle review with no implementation or
test findings. The test review identified the still-open checklist and job
status as the remaining closeout action; this documentation checkpoint closes
them.

Decision gate: `Continue`. Interactive doctor now uses the concise Details
label while preserving the `details` route, description, detailed projection,
and direct CLI behavior. Phase 5 may proceed.

## Phase 5: Integrated Validation, Guidance, And Lifecycle Closeout

Status: `in-progress`

Starting commit: `77ca2f1e`

Candidate commits:

- `51484c23` — extend the frozen Phase 1 fixtures through compact, detailed,
  and exact JSON integration coverage
- `ccda1f8b` — align the README and usage guides with compact, detailed, JSON,
  and Interactive output selection

Integrated candidate:

- every frozen evidence fixture now runs through all three deterministic views
- the built CLI exposes one compact default, one detailed evidence view, one
  machine-readable view, and a pre-inspection conflict failure
- README and guide references use the shipped Summary, Details, and JSON
  hierarchy without duplicating raw diagnostic evidence

Validation:

```text
built CLI structural smoke
compact, detailed, JSON, and flag conflict passed

bun test test/cli-command-doctor.test.ts test/cli-action-doctor.test.ts test/cli-doctor-workflow.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts test/cli-interactive-menu.test.ts test/cli-interactive-routing.test.ts
174 pass, 0 fail

bun test
2442 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

The built-artifact smoke exercised one non-ready environment without recording
machine details. Controlled fixtures provide the complementary all-ready and
missing-dependency evidence.

Whole-plan review: pending an exact committed tip.
