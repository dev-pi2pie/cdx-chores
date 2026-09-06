---
title: "Test Suite Refactor Implementation Plan"
created-date: 2026-09-05
modified-date: 2026-09-06
status: completed
agent: codex
---

## Goal and Execution Boundary

Implement one aggregate command and four disjoint suites while preserving feature
ownership and regression coverage. The implemented layout uses feature/boundary
folders and `.{unit,app,codex,pandoc}.test.ts` suffixes.

Phase 1 is completed in the [implementation record](jobs/2026-09-05-test-suite-refactor.md).
Phases 2, 3, 3.2, and 4 are completed. The [Testing Guide](../guides/testing.md)
documents the verified contributor workflow.
The inventory, representative
pilots, feature migration, final discovery, and full-range reviews are recorded
in the implementation record.
The research is authoritative for these contracts:

- [Commands](../researches/research-2026-09-05-multi-test-commands.md#contributor-command-model), [structure and before/after comparison](../researches/research-2026-09-05-multi-test-commands.md#proposed-structure-and-beforeafter-comparison), and [unit boundaries](../researches/research-2026-09-05-multi-test-commands.md#what-unit-means-in-this-repository).
- [Discovery](../researches/research-2026-09-05-multi-test-commands.md#proposed-discovery-and-suite-membership), [process completion](../researches/research-2026-09-05-multi-test-commands.md#process-completion-and-failure-semantics), and [reporting/retention](../researches/research-2026-09-05-multi-test-commands.md#shared-reporting-and-artifact-contract).
- [Scope and evidence](../researches/research-2026-09-05-multi-test-commands.md#scope-evidence-and-documentation), including platform limits and excluded work.
- [Live output and terminal presentation](../researches/research-2026-09-05-multi-test-commands.md#live-test-output-and-terminal-experience), the accepted Phase 3.2 follow-up contract.

```text
Prove process ownership
  -> classify and pilot feature migrations
  -> deliver the managed runner
  -> add live test output and terminal presentation (Phase 3.2)
  -> verify the workflow and publish guidance
```

## Phase 1: Implement and Verify the Process Lifecycle

Deliver the smallest working process-ownership mechanism for launcher/native-child,
fixture, and prerequisite-probe patterns. Create the unified job first; record
chosen completion signals, observed identities/states, and bounded preflight,
normal-shutdown, and cleanup allowances. Potentially blocking native/tool probes
need a controllable execution boundary.

Acceptance:

- [x] Verify normal/delayed exit, expected server termination, unexpected surviving
      descendants, resistant termination, launch failure, and unverifiable completion
      against the research's outcome policy.
- [x] Verify a hanging prerequisite probe times out before test launch and terminates
      owned descendants. Exercise cancellation during both preflight and test work;
      preserve original failures and remaining-path diagnostics.
- [x] Check installed Codex in terminal and captured-output execution under a bounded
      repeat protocol. Record every attempt and its actual timings.
- [x] Review the complete phase range and resolve findings before broad adoption.

## Phase 2: Classify and Migrate Existing Coverage

### 2A: Inventory and Selector

Record a fresh execution baseline, including skips/bypasses and unmet prerequisites.
For every test file, record feature/boundary, dependencies, leaf, target path,
support consumers, and disposition: suffix-only, move, split, or pending decision.
Use the existing correspondence to identify residual contracts and resolve target
collisions. Any retained path exception still needs a suite suffix, named owner,
and event-based revisit condition.

Implement suffix-derived discovery without importing tests. Keep repository default
discovery unchanged during partial migration.

Acceptance:

- [x] Account for all Bun filename forms, out-of-tree files, and test-shaped inputs;
      reject unknown/missing suffixes, duplicate owners, and empty selections.
- [x] Review support registration and imports separately; no executable test may
      disappear into support or be imported to share cases across leaves.
- [x] Verify exact paths, ignore-pattern replacement, config drift, new/deleted files,
      and JUnit file-identity reconciliation with bounded synthetic fixtures.

### 2B: Representative Pilots

Pilot Codex information across unit, replay/app, and live Codex boundaries, retaining
the independent protocol client and adding production discovery-adapter coverage.
Pilot Markdown PDF parsing/HTML transformation, fake-process rendering with real
files, and real Pandoc conversion in the proposed feature homes.

Separate import-time prerequisite probes from reusable support, starting with
`test/markdown-pdf/actions/rendering/render-support.ts` and
`test/data-query/commands/support.ts`. Reuse existing helpers and keep committed
input paths fixed.

Acceptance:

- [x] Preserve case names/assertions for moves; reconcile mixed-file splits.
      Verify imports, module URL mocks, `import.meta` paths, subprocess working
      directories, fixture resolution, and combined-selection mock/order behavior.
- [x] Prove prerequisite isolation and explicit missing-tool/capability failures.
      Keep live opt-in gates during partial migration; use bounded pilot config
      and explicit opt-in without writing committed fixtures.
- [x] Review pilot evidence and settle the mapping before extending it. Managed
      named commands remain unpublished until Phase 3.

### 2C: Feature Batches and Final Discovery

Migrate accepted Markdown PDF groups, Data Query residuals, then remaining owners
in bounded batches. Apply suffix and approved location changes together; prefer
suffix-only changes in coherent features. Move executable helper-contract tests
into ordinary ownership. Separate move/import changes from behavioral fixes in
reviewable checkpoints.

Acceptance:

- [x] Reconcile every batch's cases and run affected combined selections. Audit
      availability skips, conditional registration, and native-readiness early
      returns; retain asserted missing-dependency behavior.
- [x] Control application/doctor configuration, homes, native caches, and executable
      paths. Unit selection must neither load nor probe integration prerequisites.
- [x] Update lint/format coverage, links, and terminal correspondence owners while
      preserving historical evidence and committed inputs.
- [x] After full classification, replace pilot configs with the final unit-default
      config and remove live gates in the same checkpoint. Required integration
      cases must run or fail explicitly; automatic fixture writes must be gone.
- [x] Prove bare/feature-unit discovery, exact integration selection with the override,
      disjoint leaves, their complete union, and matching report identities. Record
      final file/case counts and durations without treating counts alone as proof.

## Phase 3: Deliver the Managed Runner

Publish named commands only when selection, bounded preflight, process ownership,
report validation, terminal summaries, and retention work together. Use Phase 2's
exact paths and exclusions; validate arguments/membership before dependency launch.

Implement one owned run per invocation, direct aggregate child launches, immutable
retention context, and suite namespaces. Audit fixture/direct/sibling/session scratch
owners and export ordering, including setup failures and genuine system-temp tests.
Apply the research's JUnit, scheduling, cleanup, and Codex-evidence contracts.

Acceptance:

- [x] Verify selection and preflight: invalid or empty membership never triggers
      broad discovery; missing tools, native packages, caches, and unavailable
      process capabilities fail before tests launch.
- [x] Verify bounded probes: hanging preflight and cancellation stop owned work;
      never invent JUnit reports or counts for tests that were not launched.
- [x] Validate reports: reject malformed, missing, stale, contradictory, empty,
      skipped/TODO reports and selected-file mismatches; passing XML cannot
      override a nonzero exit.
- [x] Verify scheduling: run unit, app, Codex, and Pandoc in order, one attempt
      each; continue after ordinary failures, honor cancellation boundaries, and
      preserve completed states.
- [x] Verify ownership: concurrent invocations use distinct roots without
      overwriting or deleting another owner's files; reject replaced or symlinked
      roots and pre-existing reports.
- [x] Verify failure cleanup: preserve every setup, assertion, export, and cleanup
      failure reason; remove incomplete exports and identify remaining work.
- [x] Verify terminal output in both retention modes: show final states, available
      counts, failure/lifecycle reasons, and the retention location; deleting
      default results must preserve terminal diagnostics.
- [x] Verify retention and evidence: remove scratch, retain only designated safe
      outputs, leave existing runs and inputs unchanged, and sanitize Codex keys
      and values in both retention modes.
- [x] Publish the named commands only after selection, bounded preflight, process
      ownership, report validation, terminal output, and retention pass together.
- [x] Review the complete phase commit range, resolve findings, and record the
      verified evidence and review range in the unified implementation record.

Use bounded fixtures rather than recursively running the full suite. A phase pass
requires all selected leaves and finalization to succeed; cleanup failure cannot
be presented as complete verification.

## Phase 3.2: Live Test Output and Terminal Experience

Status: completed. Streaming, presentation, runtime verification, and full-range
review passed.

Address the manual-run feedback gap after the completed Phase 3 contract. Preserve
its recorded execution/reporting/cleanup evidence and add the research's accepted
live-output contract. Phase 4 retains its number and follows this phase.

### 3.2A: Streaming Output

Connect immediate stdout/stderr delivery from each selected Bun test process to
the existing ownership mechanism. Keep prerequisite/protocol internals private,
diagnostic capture bounded, and the final result dependent on report and lifecycle
validation. Retain the five command names and existing retention option.

Acceptance:

- [x] Map the current imports and modularize `scripts/testing` into shallow folders
      by responsibility, covering orchestration, process/prerequisite handling,
      run/report ownership, and terminal presentation. Keep `scripts/testing/run.ts`
      as the public entry point; update module imports, subprocess-relative URLs,
      Node-consumed helpers, and script/test fixture references. Validate and
      checkpoint the behavior-preserving reorganization before streaming changes.
- [x] Verify output reaches its destination before producer exit, including partial
      lines, split UTF-8 chunks, and order within each stream; do not promise a
      combined ordering across separate stdout/stderr pipes.
- [x] Keep capture and pending writes bounded under sustained output and slow
      destinations. Verify the research's initial 8 MiB output/1 MiB pending-write
      budgets, pause/resume behavior, and four-second stall/final-drain allowances;
      record measurements before revising limits.
- [x] Verify broken output, exceeded drain allowance, timeout, and cancellation
      fail clearly, stop owned work, and preserve all failure/cleanup reasons.
- [x] Avoid duplicate failure replay; flush successful output delivery before the
      final summary and keep raw streams out of retained summary/artifact files.
      Use internal probe/protocol sentinels to prove private JSON and secret-like
      values never reach terminal output or retained artifacts, while sanitized
      status and failure reasons remain visible.

### 3.2B: Terminal Presentation

Combine streamed test lines with immediate invocation feedback, styled suite
boundaries, visible preflight/validation/cleanup stages, and elapsed-time feedback
during quiet work. Use the existing color conventions and the research's final
summary requirements.

Acceptance:

- [x] Show the active suite and preserve completed outcomes during aggregate runs;
      do not infer verified results or completion percentages from console lines.
- [x] Verify Bun color behavior through owned pipes, `NO_COLOR`, and plain redirected
      output, including separately redirected stdout/stderr. Keep interactive
      redraws from overwriting test lines or partial output.
- [x] Make final counts, versions, failure/lifecycle reasons, and retention paths
      readable in both modes, including early argument and prerequisite failures.

### 3.2C: Verification and Closeout

Use bounded fixtures for transport/failure regressions, then inspect actual terminal
and redirected execution of the public commands. Record observations separately
from machine-verifiable results in the unified job.

Acceptance:

- [x] Cover early visibility, quiet/slow work, output floods and budget exhaustion,
      slow/broken destinations, Ctrl+C, timeout, and no duplicate output without
      recursively running the full suite from tests.
- [x] Verify both retention modes, final summary/report agreement, and unchanged
      ownership/cleanup behavior. Exercise actual app and aggregate runs with
      live output in a terminal and redirected logs.
- [x] Record the fixed implementation base at phase start, review its complete
      `base..tip` range, resolve findings, and close this phase only after all
      acceptance evidence passes. Keep Phase 4 pending until then.

## Phase 4: Verify the Workflow and Publish Guidance

Status: completed. All five acceptance items passed.

Verify the finished contributor workflow and publish its current guidance. Keep
this phase as one checklist, with meaningful checkpoint commits as needed.
Reuse applicable Phase 3.2 evidence and record the remaining verification matrix
before execution. Platform expansion and CI/release changes remain outside scope.

Acceptance:

- [x] Reconcile final paths and cases with the accepted migration inventory,
      accounting for newly added runner tests and formerly conditional or bypassed
      coverage. Verify unit-default discovery, integration overrides, and
      prerequisite isolation. Update current ownership/path references while
      preserving dated audit snapshots and historical correspondence.
- [x] Record a bounded verification matrix covering the five public commands in
      both retention modes. Identify fresh runs and reused Phase 3.2 evidence,
      with reasons for reuse; specify terminal/redirected coverage and the fixed
      Codex repetition count before running. Compare Codex request/check coverage
      across retention modes, reconcile reports with final summaries, inspect
      retained outputs, and remove only verified acceptance-owned runs. Record
      every attempt and correction; do not repeat until green without a fixed bound.
- [x] Run separate lint, formatting, types, and build checks. Exercise representative
      built Node CLI behavior and ESM/CJS exports beyond successful loading or help
      output. Record actual platform/tool versions and distinguish source-test
      evidence from built-package evidence.
- [x] Create `docs/guides/testing.md`, add testing entry points and its link to
      README, and update affected current references. Cover suite selection,
      feature placement, suffixes, prerequisites, platform requirements, verified
      environments, current limitations, focused testing, raw Bun limitations,
      live output, failures/cancellation, cleanup, retention, and adding tests.
      Verify command examples; keep execution history in the unified job.
- [x] Review the complete fixed `phase-base..tip` range and final documentation;
      resolve findings and re-review affected changes from the same base. Record
      evidence and review outcomes in the unified job. Close the plan, research,
      job, and guide only when each document's own criteria pass; completion does
      not imply automatic archival.

## Execution Records and Reviews

Use the unified [Test Suite Refactor Implementation Record](jobs/2026-09-05-test-suite-refactor.md),
created when Phase 1 began. Keep it in progress until all implementation phases pass.

The job owns the full mapping, commands/versions, results, failure diagnoses, and
exact phase/batch review ranges. Add accepted change sets to the correspondence and
update current-owner cells to terminal paths; preserve older change-set metadata,
test-quality inventory, and completed job evidence.

Agree on the commit workflow when implementation is authorized. For checkpoint
commits, review the fixed `phase-base..tip` range, commit accepted fixes, and
re-review from the same base. Mark the job complete only after all phases pass.

## Related Research

- [Test Suite Responsibilities and Verification Lifecycle](../researches/research-2026-09-05-multi-test-commands.md)

## Related References

- [Documentation Policy](../../DOCUMENTATION_POLICY.md)
- [Test Catalog Path Correspondence](../references/test-catalog-path-correspondence.md)


## Capability Follow-up

The original phases remain completed. The subsequent portability refinement is
tracked in the [unified job follow-up](jobs/2026-09-05-test-suite-refactor.md#follow-up-capability-based-platform-requirements).
It replaces macOS-name guards with required capability checks while keeping
other-platform execution explicitly unverified.
