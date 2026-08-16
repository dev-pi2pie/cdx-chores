---
title: "Doctor output information hierarchy implementation"
created-date: 2026-08-16
status: active
agent: codex
---

## Goal

Implement the three-view `cdx-chores doctor` contract defined by
[Doctor Output Information Hierarchy][doctor-research]:

```text
doctor             -> compact human workflow summary
doctor --details   -> detailed human evidence
doctor --json      -> existing machine-readable evidence

Interactive doctor -> Summary / Details / JSON
```

The implementation must preserve the current probes, JSON field meanings,
health-state exit behavior, and actionable remediation while making the default
human view shorter and easier to scan.

## Planning Boundary

This plan is `active`. Phase 1 recorded and froze the evidence that the research
required without changing production code or public command behavior. Its
`Continue` gate now permits Phase 2 production work.

The Phase 1 decision gate recorded `Continue` after the evidence contract and
exact committed range passed focused documentation review. Later unresolved
JSON, safety, or workflow-composition findings must still constrain or stop the
affected phase rather than being deferred silently.

## Execution Record Strategy

Use one plan-level execution record for this work:

```text
docs/plans/jobs/YYYY-MM-DD-doctor-output-information-hierarchy.md
```

The record should contain a concise section for each phase, including its
execution status, relevant commit or review range, validation evidence,
accepted constraints, and Continue/Constrain/Stop outcome. This plan remains
authoritative for tasks and acceptance criteria; the execution record links to
the relevant phase instead of duplicating its checklist.

Phase 1 may activate the record while this plan remains `draft`. A `Continue`
verdict activates the plan for Phase 2 and later production work, and the same
record continues through lifecycle closeout. Create a separate job record only
if later work materially leaves this plan's scope or becomes a distinct
follow-up.

## Why This Plan

The current `doctor` action owns several responsibilities in one path:

- concurrent dependency and environment inspection
- Markdown PDF requirement and renderer-capability assessment
- data-query format and Codex readiness composition
- font capability composition
- the flat capability map
- JSON payload construction
- detailed human rendering and remediation

The same detected condition can consequently appear in the tool list, flat
capabilities, and detailed capability sections. The redesign needs a shared
evidence report plus separate projections; it must not solve the presentation
problem by duplicating probes or parsing already-rendered text.

## Starting State

Current implementation seams:

- `src/cli/actions/doctor.ts` runs the probes, constructs every report shape,
  and renders both JSON and human output.
- `src/cli/commands/index.ts` registers only `--json`; there is no shared root
  convention for a detailed human view.
- `test/cli-actions-doctor-markdown-video-deferred.test.ts` owns the primary
  doctor action, JSON, human-output, renderer-capability, and failure tests.
- `test/cli-ux.test.ts` covers built command help and top-level CLI surfaces.
- the default human view is the full evidence report.
- `doctor --json` is the intended automation surface and has no top-level schema
  version.
- detected unavailable, unsupported, and unverified health states still exit
  `0`; command-level probe failures exit `2`.
- the human renderer returns early when DuckDB is unavailable, so the already-
  computed data-query Codex section is omitted from that view.
- raw details can flow through `query.detail`, extension-format details, and
  `queryCodex.detail`; the compact view does not yet have a typed sanitization
  boundary.
- Interactive `doctor` invokes the same default action and will therefore adopt
  the compact human view when the default changes. Phase 4 implemented that
  baseline; Phase 4.5 will replace its legacy JSON confirmation with one
  three-view selector.

## Product Contract

### View selection

```text
cdx-chores doctor
      |
      v
validate requested view
      |
      |-- --details + --json ------> parser error + help
      |                              no probes, exit 1
      |
      `-- no flag / --details / --json
                    |
                    v
             run inspection once
                    |
                    |-- operational failure --> command error, exit 2
                    |
                    `-- inspection complete
                              |
                              |-- no flag ----> compact human output
                              |-- --details --> detailed human output
                              `-- --json -----> structured JSON output

Health findings remain report data; completed inspection exits 0.
```

`--details` help text is:

```text
--details  Output detailed human-readable evidence
```

`--details` and `--json` are mutually exclusive. Their conflict must be rejected
by the Commander command-registration layer before `actionDoctor` or any
inspector runs, using the existing parser-error behavior on stderr with exit
`1`. The action therefore receives only one valid selected view.

Interactive mode presents the same view contract through one exclusive
selection made before the action runs:

```text
Choose doctor output
  Summary            -> compact human output
  Details            -> detailed human output
  JSON                -> structured JSON output
```

Summary is the first and default-highlighted choice. The selector replaces the
legacy `Output as JSON?` confirmation; it must not add a second details prompt.
Each choice invokes `actionDoctor` once, and no inspector runs before the
selection is complete.

### Evidence ownership

```text
existing probes
      |
      v
normalized internal doctor report
      |
      |-- inspection facts --------> legacy JSON projection
      |                              existing fields and meanings
      |
      |-- inspection facts --------> detailed human projection
      |                              complete evidence categories
      |
      `-- workflow impacts
          +-- typed conditions
          `-- typed actions -------> compact human projection
                                     states + safe actions
```

The internal report may add workflow, condition, and action types. The JSON
serializer must project only the existing JSON fields and meanings. Human
workflow state must not become an additive JSON change in this plan.

### Compact human view

The compact view:

- renders workflow state as `ready`, `limited`, `unavailable`, or `unknown`
- collapses routine success without hiding non-ready child capabilities
- counts unique visible condition IDs as issues
- deduplicates actions by stable action ID
- renders required actions before recommended actions
- uses typed, sanitized messages and public commands rather than raw detail
- preserves a stable workflow and action order
- uses the same information content for TTY and redirected output, apart from
  terminal-dependent color
- does not claim a global environment-wide `Ready` or `Blocked` state

### Detailed human view

The detailed view semantically preserves the current evidence categories and
ordering without promising byte-for-byte human-output compatibility. It must
render:

- platform and Node.js facts
- individual tools and versions
- the complete flat capability map
- Markdown PDF requirements and renderer capabilities
- font discovery and coverage facts
- DuckDB runtime and every format state
- data-query Codex readiness
- current remediation and existing detail behavior

It must render every already-computed section when DuckDB is unavailable rather
than preserving the current early return.

### Structured JSON view

The first implementation keeps `doctor --json` unchanged:

- no field additions, removals, renames, regrouping, or reinterpretation
- no new workflow, issue, or action fields
- no schema-version field introduced solely for this redesign
- existing optional-field omission and nullability preserved
- existing `generatedAt`, platform, runtime, tool, Markdown PDF, query, Codex,
  font, and flat capability behavior preserved

Any later normalized health or advisory JSON model requires a separate
compatibility review.

Compatibility tests must use controlled inspector fixtures and a fixed
`runtime.now()` value so `generatedAt` and inspected facts are deterministic.
Facts sourced directly from the running process, including `process.version`,
should be asserted against explicit runtime expectations unless Phase 1 selects
an injection boundary. Tests should compare the complete structure and
semantics, including the exact field set, nesting, optional-field omission,
nullability, status values, and serialized key order only where explicitly
asserted. The contract is not literal byte equality between runs with different
timestamps or detected environments.

### Public-safety boundary

The compact projection must never forward raw values from:

- `query.detail`
- `query.formats.sqlite.detail`
- `query.formats.excel.detail`
- `queryCodex.detail`

Detailed and JSON views preserve their current detail behavior in this plan.
Redacting those existing surfaces is a separate compatibility change. Compact
output may expose only approved public install commands and typed, state-derived
guidance.

## Scope

### In scope

- evidence inventory and contract freeze before production work
- one normalized internal doctor evidence report
- injected inspector boundaries for deterministic tests
- legacy JSON projection and controlled structural and semantic compatibility
  tests
- typed workflow, condition, and action models
- deterministic workflow composition, ordering, counting, and deduplication
- sanitized compact messages and public remediation commands
- compact default human renderer
- detailed human renderer
- `--details` registration and conflict behavior
- removal of the detailed-view DuckDB early-return omission
- root and Interactive default-doctor behavior
- focused fixtures for all-ready, limited, unavailable, unknown, shared-
  condition, and multiple-action scenarios
- README, guide, help, research, plan, and job-record traceability

### Out of scope

- changing existing dependency, DuckDB, Codex, font, or renderer probe behavior
- changing dependency-selection or minimum-version policy
- adding workflow or advisory fields to `doctor --json`
- adding a JSON schema version
- redacting existing detailed or JSON fields
- deriving nonzero exit codes from workflow health states
- changing `data duckdb doctor`
- claiming general Codex readiness beyond currently assessed workflows
- installing dependencies or mutating user configuration
- changing information content automatically by TTY state
- introducing a repository-wide notification or health framework

## Implementation Approach

Keep `actionDoctor` as thin orchestration around three boundaries:

```text
inspect once
  -> build normalized evidence report
     -> select JSON, detailed, or compact projection
        -> render once
```

The expected ownership split is:

- inspection orchestration and injected inspectors
- shared evidence types and report construction
- legacy JSON projection
- workflow, condition, and action derivation
- compact rendering
- detailed rendering

Phase 1 should confirm the smallest maintainable module split. New modules may
live under a focused `src/cli/doctor/` boundary, but the plan does not require a
file-per-type decomposition. Preserve public exports and keep Node.js runtime
compatibility; Bun-specific globals must not enter production modules.

## Implementation Phases

### Phase 1: Evidence Inventory And Contract Freeze

Tasks:

- [x] Create and activate the plan-level execution record defined above. In its
      Phase 1 section, record the exact starting commit, evidence boundary,
      review range, and decision gate while this plan remains `draft`.
- [x] Inventory every current `doctor --json` field, nested field, status value,
      optional field, null value, and flat capability key.
- [x] Inventory every current human section, line family, remediation path,
      early return, and health-state versus command-failure exit behavior.
- [x] Map each current human line and JSON field to compact, detailed, and JSON
      visibility.
- [x] Audit `query.detail`, SQLite and Excel detail, and `queryCodex.detail` for
      paths, secrets, raw errors, install commands, and safe compact equivalents.
- [x] Record the exact DuckDB runtime, loadability, installability, and
      remediation states used by the top-level doctor.
- [x] Define representative deterministic fixtures for all-ready, limited,
      unavailable, unknown, one-condition/multiple-workflow, and multiple-action
      environments.
- [x] Complete the condition-to-workflow matrix for Markdown DOCX, Markdown PDF,
      Video, Data query, Codex-assisted data query, font discovery, and font
      coverage.
- [x] Freeze stable workflow, condition, and action IDs; state precedence;
      ordering; deduplication; issue/action counts; and representative compact
      output.
- [x] Confirm `--details` help and command-registration ownership of mutual
      exclusion, parser error, no-action, no-inspector, and exit-`1` behavior
      against current Commander conventions.
- [x] Review the proposed test-injection boundary for dependency, DuckDB, Codex,
      font, and renderer inspection without changing probe semantics.
- [x] Update the research with the completed inventory and evidence. Mark it
      `completed` only if the recorded evidence supports the settled contract.
- [x] Run Markdown formatting, link, and diff checks and obtain a focused
      documentation review of the exact Phase 1 range.

Phase checkpoint:

- The current JSON and human contracts are fully inventoried.
- Every compact issue and action is traceable to typed inspection evidence.
- Representative output exists for every workflow state and deduplication shape.
- The compact safety boundary has explicit safe-copy and forbidden-detail
  coverage.
- Later phases can be implemented without inventing policy from fixtures.

Decision gate:

- **Continue** — the evidence closes the research and supports the three-view
  contract; mark the research `completed` and activate this plan before Phase 2.
- **Constrain** — preserve the supported views but narrow unresolved workflow,
  remediation, or safety behavior explicitly before production work.
- **Stop** — do not begin Phase 2 when JSON compatibility, actionable-condition
  visibility, or public safety cannot be preserved by the proposed model.

### Phase 2: Shared Evidence Report And JSON Parity

Tasks:

- [x] Update the Phase 2 section of the plan-level execution record from the
      accepted Phase 1 checkpoint.
- [x] Extract normalized report construction from `actionDoctor` without
      changing probe order, concurrency, dependency policy, or result meaning.
- [x] Introduce one internal inspector bundle with production defaults and
      deterministic test replacements for every external inspection boundary.
- [x] Preserve a single inspection pass for all three projections.
- [x] Extract a legacy JSON serializer that reproduces the complete Phase 1
      inventory, including optional omission, nullability, ordering where
      asserted, and `generatedAt` behavior.
- [x] Keep the current human output as the active default during this phase.
- [x] Preserve command-level failure behavior, including no partial stdout on a
      failed inspection.
- [x] Add complete JSON compatibility tests for every Phase 1 fixture under
      controlled inspector inputs and a fixed `runtime.now()` value. Compare
      the exact field set, nesting, optional omission, nullability, status
      meanings, and serialized key order only where explicitly asserted. Assert
      direct process facts against explicit runtime expectations unless Phase 1
      selects an injection boundary; also add regression tests proving probes
      execute once.
- [x] Run focused doctor tests, TypeScript, lint, formatting, build, and diff
      checks.
- [x] Review the exact Phase 2 range for maintainability and test quality.

Phase checkpoint:

- `actionDoctor` no longer constructs JSON ad hoc inside the renderer path.
- All current JSON fixtures are structurally and semantically unchanged under
  controlled inputs.
- Inspector injection enables deterministic DuckDB and Codex scenarios without
  changing production inspection behavior.
- No public human-output change has shipped yet.

Decision gate:

- **Continue** — controlled JSON compatibility and single-probe behavior are
  proven.
- **Constrain** — keep extraction smaller if a proposed module boundary adds
  unnecessary abstraction.
- **Stop** — do not add workflow derivation while JSON or probe behavior drifts.

### Phase 3: Workflow, Condition, Action, And Safety Projection

Tasks:

- [x] Update the Phase 3 section of the plan-level execution record from the
      accepted Phase 2 checkpoint.
- [x] Add closed workflow-state, action-class, workflow-ID, condition-ID, and
      action-ID types from the Phase 1 contract.
- [x] Derive workflow state from normalized evidence rather than rendered text.
- [x] Implement parent/child workflow composition without assigning synthetic
      state to display-only group headings.
- [x] Implement shared-condition linking when one upstream fact affects several
      workflows.
- [x] Deduplicate actions by stable action ID and merge affected workflow IDs.
- [x] Implement stable workflow order, required-before-recommended action order,
      and deterministic issue/action counts.
- [x] Map public install commands through existing helpers rather than
      reconstructing command strings.
- [x] Add typed compact messages that never forward raw query, extension, Codex,
      path, secret, or error detail.
- [x] Add table-driven unit tests for every Phase 1 workflow matrix row,
      deduplication case, ordering rule, and no-safe-action state.
- [x] Add trust-boundary tests proving compact projection sanitization while
      JSON and detailed evidence remain unchanged.
- [x] Run focused tests, TypeScript, lint, formatting, build, and diff checks.
- [x] Review the exact Phase 3 range for maintainability, test quality, and
      public-safety risks.

Phase checkpoint:

- One pure projection maps evidence to deterministic workflows, issues, and
  actions.
- Every non-ready fixture retains its actionable or diagnostic information.
- Repeated low-level failures produce one issue/action identity where required.
- Compact projection data contains no forbidden raw details.
- JSON output remains structurally and semantically unchanged under the
  controlled compatibility fixtures.

Decision gate:

- **Continue** — the projection passes the complete deterministic matrix and
  public-safety review.
- **Constrain** — narrow aggregation where evidence does not support a stable
  parent/child workflow claim.
- **Stop** — do not expose compact output if it hides remediation, contradicts
  detailed evidence, or leaks raw environment data.

### Phase 4: Compact And Detailed Human Views

Tasks:

- [x] Update the Phase 4 section of the plan-level execution record from the
      accepted Phase 3 checkpoint.
- [x] Extract the current human report into a detailed renderer that preserves
      its evidence categories and stable order.
- [x] Remove the DuckDB-unavailable early return from detailed rendering so all
      already-computed sections are shown.
- [x] Implement the compact renderer with workflow-first output, collapsed
      routine success, expanded non-ready child states, headline issue/action
      counts, and one ordered Actions section.
- [x] Preserve terminal-dependent color while keeping information content stable
      between TTY and redirected output.
- [x] Add `--details` with the accepted help text and register its conflict with
      `--json` in the Commander command-registration layer.
- [x] Reject `--details --json` before `actionDoctor` is invoked, with parser
      help on stderr and exit `1`; prove that no member of the injected
      inspector bundle runs.
- [x] Route no flag to compact, `--details` to detailed, and `--json` to the
      unchanged legacy projection.
- [x] Confirm Interactive `doctor` uses the compact default without adding a new
      Interactive view-selection prompt.
- [x] Preserve health findings at exit `0` and operational probe failures at
      exit `2`.
- [x] Add action-level and built-CLI tests for view routing, help, conflict,
      no-probe conflict behavior, all workflow states, deterministic redirected
      content, and detailed-section completeness.
- [x] Run focused tests, CLI UX tests, the full suite, TypeScript, lint,
      formatting, build, and diff checks.
- [x] Review the exact Phase 4 range for maintainability, test quality, and
      public-safety regressions.

Phase checkpoint:

- Default doctor output answers what works, what is limited, and what action is
  available without repeating routine evidence.
- `--details` retains the complete human evidence surface.
- `--json` remains unchanged.
- Flag conflicts fail before probes and use the accepted parser behavior.
- TTY and redirected output contain the same information.
- Interactive doctor adopts the compact default without a second contract.

Decision gate:

- **Continue** — all three views agree on the same evidence and every changed
  public surface passes its fixture matrix.
- **Constrain** — retain detailed output as the default if compact coverage is
  incomplete, while keeping the projection work internal and documented.
- **Stop** — do not switch the default if actionable information, JSON parity,
  exit behavior, or safety guarantees regress.

Phase 4 completed its accepted scope. The later Phase 4.5 refinement below
supersedes only the Interactive no-new-selector boundary; it does not reopen the
completed renderer, direct CLI, JSON, or parser-conflict work.

### Phase 4.5: Interactive Doctor View Selection

Tasks:

- [x] Update the Phase 4.5 section of the plan-level execution record from the
      accepted Phase 4 checkpoint and this research refinement.
- [x] Replace the Interactive `Output as JSON?` confirmation with one
      `Choose doctor output` selection.
- [x] Present Summary first with workflow-readiness and action guidance,
      Details second with versions and capability evidence, and JSON third with
      machine-readable evidence.
- [x] Route Summary to compact output, Details to the existing
      detailed projection, and JSON to the unchanged structured projection.
- [x] Keep the selection exclusive by construction, invoke `actionDoctor`
      exactly once after selection, and run one inspection pass with every
      inspector invoked exactly once.
- [x] Preserve Interactive runtime input/output stream wiring and leave direct
      CLI flags, help, conflicts, exit behavior, and view content unchanged.
- [x] Add deterministic Interactive routing tests for all three choices,
      selection copy and order, Summary as the initial default-highlighted
      value, selected action options, prompt streams, and rendered compact,
      detailed, and JSON integration paths.
- [x] Run focused doctor and Interactive tests, the full repository suite,
      TypeScript, lint, formatting, build, and `git diff --check`.
- [x] Review the exact Phase 4.5 range for maintainability, test quality,
      Interactive UX compatibility, and public-safety regressions.

Phase checkpoint:

- Interactive doctor exposes all three existing views through one prompt.
- Summary remains the first and default-highlighted choice.
- Details and JSON reuse their existing projections without a second
  inspection or a new output contract.
- Direct CLI behavior remains unchanged.

Decision gate:

- **Continue** — all three Interactive choices route once to the matching view,
  focused and full validation pass, and the exact committed range is clean.
- **Constrain** — retain the legacy confirmation if the three-choice selector
  cannot preserve prompt streams or deterministic routing.
- **Stop** — do not advance to lifecycle closeout if Interactive routing can
  combine views, duplicate inspection, or change existing projection content.

Follow-up:

- [ ] Shorten the Interactive detailed-view label from Detailed evidence to
      Details, preserve its `details` route and description, and update the
      research contract plus deterministic choice tests.

### Phase 5: Integrated Validation, Guidance, And Lifecycle Closeout

Tasks:

- [ ] Update the Phase 5 section of the plan-level execution record with the
      exact implementation, review, and documentation ranges.
- [ ] Run the complete deterministic view matrix for compact, detailed, and JSON
      output across all Phase 1 fixtures.
- [ ] Run bounded built-CLI smoke checks for default, `--details`, `--json`, flag
      conflict, missing dependencies, and an all-ready environment where the
      current machine can supply it.
- [ ] Verify README command tables and examples, top-level help, Markdown PDF
      guidance, data-query guidance, data-query Codex guidance, and DuckDB
      guidance against the implemented views.
- [ ] Document human-output compatibility: compact is the default, `--details`
      is the evidence view, and `--json` remains the automation surface.
- [ ] Keep public records free of machine-specific paths, secrets, raw errors,
      and local setup commands.
- [ ] Run focused doctor and CLI UX tests, the full repository suite,
      `bunx tsc --noEmit`, lint, format check, build, and `git diff --check`.
- [ ] Review the complete implementation range for maintainability, test
      quality, and trust-boundary findings; resolve accepted findings and rerun
      affected validation.
- [ ] Record exact public-safe validation evidence and the final Continue/
      Constrain/Stop outcome in the Phase 5 section of the plan-level execution
      record.
- [ ] Update the research and this plan with reciprocal implementation evidence.
      Mark this plan `completed` only when all completion criteria are proven;
      perform no archive move as part of this closeout.

Phase checkpoint:

- Current help, README, and guides describe only implemented behavior.
- Every view and exit path is covered by deterministic tests.
- Full validation and exact-range reviews have no unresolved accepted finding.
- Research, plan, and the plan-level execution record contain complete
  public-safe traceability.

Decision gate:

- **Continue** — close the lifecycle with the compact default and all three
  projections validated.
- **Constrain** — document and retain any deliberately narrowed workflow or
  remediation aggregation without overstating support.
- **Stop** — do not mark the plan complete while compatibility, safety, or
  actionable-information findings remain unresolved.

## Validation Matrix

Minimum deterministic scenarios:

| Scenario                                   | Compact expectation                           | Detailed expectation                       | JSON expectation                |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------ | ------------------------------- |
| all inspected workflows ready              | collapsed success lines, no actions           | complete satisfied evidence                | unchanged satisfied facts       |
| required dependency missing                | affected workflow unavailable, install action | complete missing evidence and hint         | unchanged missing facts         |
| supported dependency below minimum         | unavailable or limited per frozen matrix      | exact unsupported version evidence         | unchanged status and minimum    |
| version or compatibility unverified        | unknown or limited with safe diagnostic       | complete unverified evidence               | unchanged unverified facts      |
| optional extension missing and installable | scoped impact and exact install action        | loadability/installability/detail evidence | unchanged extension facts       |
| extension blocked by environment           | scoped impact without unsafe raw detail       | current raw detail behavior                | unchanged raw detail behavior   |
| DuckDB runtime unavailable                 | dependent workflows visible, one safe action  | all sections, including Codex evidence     | unchanged query and Codex facts |
| Codex configuration or session unavailable | only dependent workflow affected              | current booleans and detail                | unchanged Codex facts           |
| one condition affects several workflows    | one issue/action linked to each impact        | every low-level evidence entry             | unchanged individual facts      |
| several independent actions                | stable required/recommended ordering          | every remediation entry                    | unchanged individual facts      |
| `--details --json`                         | no output view; parser error, exit 1          | no probes                                  | no payload                      |
| operational probe failure                  | command failure, exit 2                       | no partial report                          | no partial payload              |

Interactive routing scenarios:

| Interactive choice | Action selection | Expected projection        |
| ------------------ | ---------------- | -------------------------- |
| Summary            | compact          | compact workflow summary   |
| Details            | details          | complete human evidence    |
| JSON               | JSON             | unchanged structured facts |

Focused commands expected during implementation:

```bash
bun test test/cli-interactive-menu.test.ts test/cli-interactive-routing.test.ts
bun test test/cli-actions-doctor-markdown-video-deferred.test.ts
bun test test/cli-ux.test.ts
bun test
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

## Risks

- JSON extraction can accidentally add derived fields or alter optional-field
  omission even when values appear equivalent.
- JSON comparisons can report false drift unless dynamic `generatedAt` is fixed
  and host-dependent facts are covered by controlled inspector fixtures or
  explicit runtime expectations.
- Broad workflow labels can overstate readiness when only one child capability
  was assessed.
- Deduplicating by rendered text or command string can merge distinct actions or
  split one semantic action unpredictably.
- Compact copy can leak resolved paths, raw errors, or secret-bearing details if
  it reuses existing detail strings.
- Moving the current human view behind `--details` changes scripts that parse
  human output even though JSON is the documented automation surface.
- Test fixtures can become host-dependent unless DuckDB, Codex, font, and
  dependency inspection are injectable together.
- An oversized doctor abstraction can make future capability additions harder;
  module boundaries should follow ownership rather than one file per type.
- The DuckDB early-return correction can change detailed output ordering or
  reveal already-existing detail on a path that previously ended early; tests
  and guidance must describe that deliberate change.

## Completion Criteria

- The Phase 1 evidence gate records a `Continue` verdict before production work.
- `doctor` defaults to deterministic compact human output.
- `doctor --details` renders complete human evidence.
- `doctor --json` preserves every inventoried field and meaning.
- `--details --json` fails before probes with the accepted parser behavior.
- Every workflow state, shared condition, action order, and count is covered by
  deterministic tests.
- Compact output preserves actionable remediation without raw environment
  detail.
- Health states preserve exit `0`; parser conflicts and operational failures
  preserve their accepted nonzero exits.
- TTY and redirected output have the same information content.
- README, help, guides, research, plan, and the plan-level execution record
  agree with shipped behavior.
- Focused, full, static, formatting, build, diff, and exact-range review gates
  pass with no unresolved accepted finding.

## Related Research

- [Doctor Output Information Hierarchy][doctor-research]

[doctor-research]: ../researches/research-2026-08-13-doctor-output-information-hierarchy.md
