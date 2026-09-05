---
title: "Test Suite Refactor Implementation Plan"
created-date: 2026-09-05
modified-date: 2026-09-05
status: active
agent: codex
---

## Goal and Execution Boundary

Implement one aggregate command and four disjoint suites while preserving feature
ownership and regression coverage. The proposed target uses feature/boundary
folders and `.{unit,app,codex,pandoc}.test.ts` suffixes.

Phase 1 is in progress in the [implementation record](jobs/2026-09-05-test-suite-refactor.md).
The complete structure mapping and representative migration pilots remain pending.
The research is authoritative for these contracts:

- [Commands](../researches/research-2026-09-05-multi-test-commands.md#contributor-command-model), [structure and before/after comparison](../researches/research-2026-09-05-multi-test-commands.md#proposed-structure-and-beforeafter-comparison), and [unit boundaries](../researches/research-2026-09-05-multi-test-commands.md#what-unit-means-in-this-repository).
- [Discovery](../researches/research-2026-09-05-multi-test-commands.md#proposed-discovery-and-suite-membership), [process completion](../researches/research-2026-09-05-multi-test-commands.md#process-completion-and-failure-semantics), and [reporting/retention](../researches/research-2026-09-05-multi-test-commands.md#shared-reporting-and-artifact-contract).
- [Scope and evidence](../researches/research-2026-09-05-multi-test-commands.md#scope-evidence-and-documentation), including platform limits and excluded work.

```text
Prove process ownership
  -> classify and pilot feature migrations
  -> deliver the managed runner
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
- [ ] Review the complete phase range and resolve findings before broad adoption.

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

- [ ] Account for all Bun filename forms, out-of-tree files, and test-shaped inputs;
      reject unknown/missing suffixes, duplicate owners, and empty selections.
- [ ] Review support registration and imports separately; no executable test may
      disappear into support or be imported to share cases across leaves.
- [ ] Verify exact paths, ignore-pattern replacement, config drift, new/deleted files,
      and JUnit file-identity reconciliation with bounded synthetic fixtures.

### 2B: Representative Pilots

Pilot Codex information across unit, replay/app, and live Codex boundaries, retaining
the independent protocol client and adding production discovery-adapter coverage.
Pilot Markdown PDF parsing/HTML transformation, fake-process rendering with real
files, and real Pandoc conversion in the proposed feature homes.

Separate import-time prerequisite probes from reusable support, starting with
`test/markdown-pdf/actions/render-support.ts` and
`test/data-query/commands/support.ts`. Reuse existing helpers and keep committed
input paths fixed.

Acceptance:

- [ ] Preserve case names/assertions for moves; reconcile mixed-file splits.
      Verify imports, module URL mocks, `import.meta` paths, subprocess working
      directories, fixture resolution, and combined-selection mock/order behavior.
- [ ] Prove prerequisite isolation and explicit missing-tool/platform failures.
      Keep live opt-in gates during partial migration; use bounded pilot config
      and explicit opt-in without writing committed fixtures.
- [ ] Review pilot evidence and settle the mapping before extending it. Managed
      named commands remain unpublished until Phase 3.

### 2C: Feature Batches and Final Discovery

Migrate accepted Markdown PDF groups, Data Query residuals, then remaining owners
in bounded batches. Apply suffix and approved location changes together; prefer
suffix-only changes in coherent features. Move executable helper-contract tests
into ordinary ownership. Separate move/import changes from behavioral fixes in
reviewable checkpoints.

Acceptance:

- [ ] Reconcile every batch's cases and run affected combined selections. Audit
      availability skips, conditional registration, and native-readiness early
      returns; retain asserted missing-dependency behavior.
- [ ] Control application/doctor configuration, homes, native caches, and executable
      paths. Unit selection must neither load nor probe integration prerequisites.
- [ ] Update lint/format coverage, links, and terminal correspondence owners while
      preserving historical evidence and committed inputs.
- [ ] After full classification, replace pilot configs with the final unit-default
      config and remove live gates in the same checkpoint. Required integration
      cases must run or fail explicitly; automatic fixture writes must be gone.
- [ ] Prove bare/feature-unit discovery, exact integration selection with the override,
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

| Check                   | Required evidence                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection and preflight | Invalid/empty membership never triggers broad discovery; missing tools/native packages/caches and unsupported platforms fail before tests                      |
| Bounded probes          | Hanging preflight and cancellation stop owned work; no JUnit/counts invented for unlaunched tests                                                              |
| Reports                 | Reject malformed, missing, stale, contradictory, empty, or skipped/TODO reports and selected-file mismatches; passing XML cannot override nonzero exit         |
| Scheduling              | Unit/app/Codex/Pandoc order, one attempt each, ordinary-failure continuation, cancellation boundaries, preserved completed states                              |
| Ownership               | Distinct concurrent roots; no overwrite/deletion across owners; replaced/symlink roots and pre-existing reports rejected                                       |
| Failure cleanup         | Setup/assertion/export/cleanup failures preserve all reasons, remove incomplete exports, and identify remaining work                                           |
| Terminal output         | Final states, available counts, failure/lifecycle reasons, and retention location appear in both modes; default result deletion preserves terminal diagnostics |
| Retention and evidence  | Scratch removed, only designated safe outputs retained, existing runs/inputs unchanged; Codex keys/values sanitized in both modes                              |

Use bounded fixtures rather than recursively running the full suite. A phase pass
requires all selected leaves and finalization to succeed; cleanup failure cannot
be presented as complete verification.

## Phase 4: Verify the Workflow and Publish Guidance

Run each leaf and the aggregate in both retention modes using declared prerequisites
and the agreed terminal/repetition protocol. Record failures and fixes alongside
passes. Deliver the testing guide and README link once its examples are verified.

Acceptance:

- [ ] Reconcile final paths/cases with the accepted inventory and baseline, including
      formerly conditional or bypassed coverage. Verify unit-default discovery,
      integration overrides, and prerequisite isolation after all moves.
- [ ] Compare Codex requests/checks across retention modes; inspect retained outputs
      and remove only acceptance-owned runs.
- [ ] Run separate lint, formatting, types, build, and built Node CLI/ESM/CJS checks.
      Record actual platform/tool versions and distinguish source from built evidence.
- [ ] Explain feature placement, suite suffixes, prerequisites, raw Bun limitations,
      failures, cleanup, retention, and adding tests in the guide.
- [ ] Review final docs and the complete phase range; resolve findings and close
      documents only when their own acceptance criteria pass.

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
