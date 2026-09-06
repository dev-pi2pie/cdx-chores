---
title: "Test Suite Responsibilities and Verification Lifecycle"
created-date: 2026-09-05
modified-date: 2026-09-06
status: completed
agent: codex
---

## Goal and Research Status

Define a useful test workflow with one aggregate command and distinct suites
selected by the behavior and dependencies they verify. Establish process and
scratch ownership before implementing shared orchestration.

The command model, behavioral suite boundaries, and shutdown outcomes below are
settled and implemented. Phases 1–3.2 established process ownership, feature-first
suite selection, managed execution, and bounded live output. Phase 4 completed
its fixed twenty-cell verification matrix, final inventory reconciliation, and
separate built-package checks. The linked implementation record preserves failed
attempts, the live Codex plugin-isolation correction, report/case correspondence,
and verified cleanup. Final documentation review passed, and the linked plan and job are completed.

Current contributor usage lives in the [Testing Guide](../guides/testing.md).
This research retains design rationale and the dated starting-state analysis.

## Contributor Command Model

Use one aggregate and four leaf suites:

| Command                           | Responsibility and dependencies                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test:unit`               | Isolated responsibilities with controlled collaborators; no live tools, network, personal state, or native database engines                   |
| `bun run test:integration:app`    | Application/CLI composition, native adapters, replay, generators, and file workflows; declared local dependencies with fake service responses |
| `bun run test:integration:codex`  | Installed Codex protocol and production discovery adapter; isolated homes and bounded metadata requests                                       |
| `bun run test:integration:pandoc` | Installed Pandoc conversion and application HTML processing                                                                                   |
| `bun run test:all`                | Every leaf once, in the order above                                                                                                           |

Application integration is named `app` because it extends beyond CLI invocation.
All commands execute locally; avoid overlapping `test:local` or generic integration
aliases. `test:all` is the only documented aggregate workflow.

## Current Structure Review

The 2026-09-05 non-ignored `rg --files test` inventory at `1ec8fddd` contains
513 files: 378 `*.test.ts` files and 135 support/input files. Of the test files,
31 remain at the root: 26 Markdown PDF and five Data Query. No additional
Bun-pattern test files were found outside `test/` in the non-ignored repository
inventory. These are file counts, not executed case counts or a fresh test pass.

| Area               | Current shape                                                                       | Structural finding                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Markdown PDF       | 53 tests in `markdown-pdf/`, 54 in seven sibling legacy folders, and 26 at the root | One feature has several entry points; `markdown-pdf/actions/` alone has 28 tests                    |
| Data Query         | 44 tests in `data-query/` plus five at the root                                     | Keep the established boundaries; inspect the residual root contracts before moving them             |
| Rename             | 46 tests in one feature tree                                                        | Preserve useful `actions`, `commands`, `interactive`, `planner`, and `direct` ownership             |
| Codex information  | Nine tests together in `codex-info/`                                                | Pure reports, CLI replay, and the live protocol share a feature but need different execution suites |
| Support and inputs | Cross-feature helpers, feature-local support, shared committed fixtures             | Review import effects separately from folder names; keep committed input paths stable               |

Representative tree at the initial review; omitted siblings remain part of the inventory:

```text
test/
  cli-actions-md-to-pdf-page-number-format.test.ts
  cli-actions-md-to-pdf-pandoc.test.ts
  cli-command-data-query*.test.ts
  markdown-pdf/
    actions/                  rendering-*, profile-codex-*, project-codex-*, ...
    adapters/  commands/  direct/  evidence/  interactive/  support/
  adapters-codex-markdown-pdf-profile/
  adapters-codex-markdown-pdf-template/
  cli-actions-md-to-pdf-profile-codex-action/
  cli-actions-md-to-pdf-project-codex/
  cli-actions-md-to-pdf-template-codex/
  cli-interactive-markdown-pdf/
  markdown-pdf-page-number-renderer-evidence/
  data-query/  rename/  codex-info/  cli-foundations/  ...
  helpers/  fixtures/
```

The existing [catalog research][catalog-research] already favors feature/platform
ownership and records deliberate deferrals. Preserve that contract and use the
[path correspondence][correspondence] to distinguish surviving residual cases
from their migrated siblings. Similar names do not establish duplicate coverage.

Initial source inspection found selection hazards; Phase 2B separated the
prerequisite probes from reusable support:

- [Rendering support][render-support] probed Pandoc at module load even when a
  consumer only needs a fake process runner. Separate that availability check
  from reusable fake construction; choosing a suite directory cannot isolate it.
- [Data Query command support][query-support] inspected native extensions at module
  load. Keep native preparation with application integration consumers and avoid
  importing it through support needed by unit tests.
- [Profile command wiring][profile-command-wiring] uses fake actions but parses
  composed commands. It belongs to application integration; the word `codex` in
  its feature name does not make it a live Codex test.
- [Rename helper lifecycle coverage][rename-support-tests] currently lives under
  `support/`. Executable helper-contract tests need ordinary suite ownership;
  excluding support indiscriminately would lose coverage.

This review establishes the structural direction and representative assignments.
It is not a case-by-case classification of all 378 files or a duplicate-test audit.

## Proposed Structure and Before/After Comparison

Keep feature/platform ownership first, retain useful boundary folders, and encode
execution membership in the final filename suffix:

```text
test/<owner>/<optional-boundary>/<optional-topic>/<contract>.<suite>.test.ts
```

Use exactly `unit`, `app`, `codex`, or `pandoc` for `<suite>`. These are repository
conventions, not Bun keywords. `app` maps to `test:integration:app`; similarly for
the two live-tool suffixes. A name such as `profile-codex.app.test.ts` identifies
the feature operation and its application-integration membership independently.

| Layout option                                                  | Benefit                                                                                   | Cost and recommendation                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `test/unit/<feature>` and `test/integration/<suite>/<feature>` | Simple directory selection                                                                | Distributes feature coverage across trees; do not use as the target catalog                            |
| `test/<feature>/<suite>/<boundary>`                            | Keeps the outer feature owner                                                             | Repeats boundary trees and adds depth throughout otherwise coherent features                           |
| Feature/boundary folders with suite suffixes                   | Keeps neighboring contracts together; membership is visible and mechanically discoverable | Requires classification and filename changes for every test; recommended for the pilot                 |
| Existing filenames plus an explicit per-file registry          | Fewer immediate renames                                                                   | Every addition/move needs a separate membership edit; bare Bun also needs synchronized discovery rules |

Proposed representative target, not an already accepted exhaustive move list:

```text
test/
  markdown-pdf/
    direct/
      page-number-format.unit.test.ts
      page-number-html.unit.test.ts
    actions/
      rendering/
        core.app.test.ts
        pandoc-language.pandoc.test.ts
        render-support.ts
      profile-codex/          related action contracts and local support
      project-codex/
      template-codex/
    adapters/
      profile-codex/prompt-schema.unit.test.ts
      template-codex/
    commands/profile-codex-wiring.app.test.ts
    interactive/codex-authoring/
    evidence/page-number-renderer/
    support/
  codex-info/
    report.unit.test.ts
    action.unit.test.ts
    cli-replay.app.test.ts
    live-protocol.codex.test.ts
    live-protocol-client.ts
    fixtures/                 committed inputs remain here
  data-query/                 preserve existing boundaries
  rename/                     preserve existing boundaries
  fonts/  data-sources/  cli-foundations/  ...
  utils/datetime.unit.test.ts
  test-runner/                future runner's own unit/app contract tests
  helpers/                    cross-feature infrastructure
  fixtures/                   committed shared inputs
```

Do not create every possible boundary or topic folder. Add a topic where several
independently named files already share that responsibility, especially rendering
and Codex authoring within Markdown PDF. Keep small features flat where useful;
do not add a generic `features/` wrapper or relocate live tests away from their
feature owner. A suite change should normally change a suffix, not the owner.

Representative before/after mapping (all paths are under `test/`):

| Before                                                                                        | Proposed after                                                  | Disposition and evidence                                                                         |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `codex-info/report.test.ts`                                                                   | `codex-info/report.unit.test.ts`                                | Suffix only; supplied discovery data                                                             |
| `codex-info/cli-replay.test.ts`                                                               | `codex-info/cli-replay.app.test.ts`                             | Suffix only; CLI and replay subprocess                                                           |
| `codex-info/live-protocol.test.ts`                                                            | `codex-info/live-protocol.codex.test.ts`                        | Same feature; live prerequisite/capture changes reviewed separately from the rename              |
| `cli-actions-md-to-pdf-page-number-format.test.ts`                                            | `markdown-pdf/direct/page-number-format.unit.test.ts`           | Move; parser uses supplied strings                                                               |
| `markdown-pdf/actions/rendering-core.test.ts`                                                 | `markdown-pdf/actions/rendering/core.app.test.ts`               | Group existing rendering family; action coordinates real files with a fake process runner        |
| `cli-actions-md-to-pdf-pandoc.test.ts`                                                        | `markdown-pdf/actions/rendering/pandoc-language.pandoc.test.ts` | Move; real Pandoc conversion, with explicit prerequisite failure replacing availability skipping |
| `rename/support/run-cli.test.ts`                                                              | `rename/commands/plan-artifact-cleanup.app.test.ts`             | Move executable lifecycle coverage out of support; retain the helper itself                      |
| `helpers/cli-test-utils.ts`, `codex-info/fixtures/*`, `fixtures/*`, `data-sources/fixtures/*` | Same paths                                                      | Preserve shared infrastructure and committed input locations                                     |

Other Markdown PDF legacy folders fold into the corresponding feature boundary
shown above. Exact destinations, collisions, mixed-suite splits, and support
consumers must be recorded before each batch. Keep separate contracts in separate
files when consolidation would require another behavioral audit. Do not merge or
delete tests merely because they now share a directory or describe label.

## Proposed Discovery and Suite Membership

Derive sorted exact file paths from suite suffixes without importing tests. Keep
one definition per suite for its suffix, prerequisites, and execution policy;
the migration inventory is review evidence, not a second per-file runtime registry.

The selector checks all Bun-recognized test filename forms, including `.spec`
and underscore variants. Reject missing/unknown suffixes, out-of-tree test files,
duplicate ownership, and empty leaf selections. New tests use `.<suite>.test.ts`.
Explicitly distinguish test-shaped fixture inputs from executable coverage.
Review support imports for hidden registration: tests must not import executable
test files, and helpers must not implicitly register cases for multiple leaves.
Filename validation cannot replace manual reconciliation of split cases.

Apply this configuration only after the complete inventory is classified:

```toml
[test]
root = "./test"
pathIgnorePatterns = [
  "**/*.app.test.ts",
  "**/*.codex.test.ts",
  "**/*.pandoc.test.ts",
  "**/fixtures/**",
]
```

Bun documents [the discovery root][bun-root], [ignore patterns and their CLI
replacement behavior][bun-ignore], and [exact paths versus substring
filters][bun-discovery]. Suite suffixes and the unit-only default are repository
policy, not Bun concepts.

With a valid inventory, bare `bun test` and feature-directory discovery select
unit cases. Raw Bun has no membership guard: an unsuffixed `.test.ts` can still
run. Named commands reject invalid membership before launch, then pass explicit
`./` paths and `--path-ignore-patterns '**/fixtures/**'`. The override is required
even for an exact integration filename. Never fall back to unfiltered discovery
for an empty list. Keep common input exclusions synchronized with the config,
reject excluded selected tests, and reconcile JUnit file identities with selection.

An isolated Bun 1.4.1 experiment on 2026-09-05 used two features, five cases
(two unit and one per integration leaf), and a throwing test-shaped fixture input.
Seven invocations, each run once, produced:

| Invocation group                                                     | Observation                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Bare Bun; explicit feature directory                                 | Two unit cases; that feature's one unit case; both exit 0 |
| Exact app file; app substring filter, without override               | Both load no cases and exit 1                             |
| Exact app file; app substring filter, with common-exclusion override | Both run the one app case and exit 0                      |
| Exact list of all five files with override                           | Five cases, exit 0; fixture input excluded                |

The temporary experiment directory was removed. This proves discovery mechanics,
not repository-wide membership, import isolation, or managed lifecycle. Direct
integration troubleshooting uses the override plus an exact file path; a feature
directory alone does not select all its execution suites.

## What Unit Means in This Repository

Classify by exercised responsibility and dependencies, not filenames or direct
function calls. Unit tests use controlled inputs, collaborators, configuration,
and time; they do not invoke real Codex, Pandoc, Git, subprocesses, network, Node
SQLite, native DuckDB, or personal state. A small owned fixture for one file
utility is acceptable. Coordinated filesystem workflows and real timing/process
lifecycles belong to application integration.

| Reviewed boundary                                                                                              | Assignment                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Date utilities][date-tests], [rename templates][rename-direct], [report building][report-tests]               | Unit: supplied values                                  |
| [Isolated action with fake discovery][action-tests]                                                            | Unit: supplied collaborator and captured output        |
| [Filesystem-aware planning][rename-templates] and [collision planning][rename-collisions]                      | App: actual files, entries, timestamps, and collisions |
| [Composed command parsing][doctor-routing], [CLI replay][replay], [native fixture generation][duckdb-fixtures] | App, including command wiring with fake actions        |
| [Real Pandoc conversion][pandoc-language]; [live Codex protocol][live-probe]                                   | Their respective live-tool leaves                      |

Each case has exactly one leaf owner. Shared inputs/support may serve several
suites; split mixed files without duplicating assertions or losing distinct
coverage. Prefer existing narrow imports, but do not restructure production APIs
just to make tests qualify as unit tests. Measure counts and durations after
classification rather than promising a speedup.

Required cases must execute their checks or fail explicitly. Audit conditional
registration, availability skips, and early returns such as `sqliteReady`,
`duckdbReady`, and `excelReady`; a zero-skip JUnit report cannot reveal every
bypass. Preserve tests that assert controlled missing-dependency behavior.

## Process Completion and Failure Semantics

A passing assertion report does not establish successful cleanup. The current
[transport][transport-source] awaits its immediate child; the process design must
also establish descendant completion:

```text
Runner
  -> prerequisite probes
  -> Bun test process
       -> fixture subprocesses
       -> Codex Node launcher -> native Codex child
```

Own each launched process and await its exit and required stream closure before
removing scratch. PID/group existence alone does not prove useful work remains.
Choose completion mechanisms and normal-shutdown/escalation budgets from observed
behavior, not a fixed delay or unexplained group-existence heuristic.

| Outcome                                                                             | Result                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Assertions pass; owned processes complete within the allowance                      | Pass                                                                      |
| Deliberately started server completes expected shutdown, including normal `SIGTERM` | Pass                                                                      |
| Unexpected live descendant requires force-kill after the allowance                  | Lifecycle failure, even if recovery succeeds                              |
| Preflight/test timeout or handled cancellation                                      | Nonzero; preserve original reason and cleanup outcome                     |
| Required completion cannot be established                                           | Nonzero with a verification limitation, not an unsupported leak diagnosis |

Prerequisite checks share this ownership and cancellation policy. Give preflight
a bounded deadline before test launch and a separate bounded cleanup allowance.
Potentially blocking tool/native probes must run through a controllable boundary;
a timer cannot interrupt synchronous native initialization in the runner itself.
A timed-out probe fails preflight, launches no tests, and requires no JUnit report.

On timeout, terminate and then escalate within the cleanup allowance. On handled
cancellation, also stop scheduling immediately. Remove scratch only after owned
work stops; otherwise report the remaining path and cleanup failure. Never signal
unrelated processes. Diagnostics identify owned PID, parent/group, executable,
observed state, signals, and outcome where available.

A regression intentionally exercising forced termination may pass when it asserts
that outcome and cleans up its owned work. Lifecycle evidence must cover launch
failure, normal/delayed exit, surviving descendants, resistant termination, hanging
preflight, and cancellation during both preflight and tests. Use bounded fixtures,
not recursive full-suite runs. Record every attempt in the agreed repetition
protocol under both terminal and captured-output execution.

## Shared Reporting and Artifact Contract

### Scheduling and Results

Validate arguments and membership before dependency launch; unknown arguments
fail before allocation. Each named command accepts `--keep-results`, default
false. The aggregate attempts unit, app, Codex, then Pandoc sequentially, with
one bounded preflight and test attempt per leaf and no automatic retries.
Continue after ordinary preflight/test/report failures and recovered lifecycle
failures; stop on cancellation or inability to stop owned work safely.

Preflight checks only the leaf's declared prerequisites. Missing tools, unusable
native packages/caches, and unavailable process capabilities fail before launching tests.
Dependencies may be shared if each affected leaf declares them. Unit selection
must neither load nor probe integration-only prerequisites.

| Final leaf state | Meaning                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `passed`         | Process, report, and lifecycle requirements all pass              |
| `failed`         | Its attempt began and failed, including preflight or cancellation |
| `not-run`        | Scheduling stopped before its attempt began                       |

Cancellation preserves completed outcomes, fails the active attempt, and leaves
unstarted leaves `not-run`. An unlaunched test process has no required JUnit report
or invented counts. Exit zero only when every selected leaf and finalization pass.

Use Bun JUnit plus the existing XML dependency. Each report must be absent before
launch and consumed afterward from the owned regular, non-symlink path. Validate
named testcase records, nested suites, nonnegative consistent totals, actual
skip/TODO representation, executed cases, and selected file identities. Passing
requires exit zero, a valid fresh report with zero failures/errors/skips/TODOs,
and successful lifecycle verification. None overrides another's failure; console
summaries are not verification input.

Always print a final terminal summary after finalization, regardless of retention:
suite states, available counts, tool versions, failure/not-run reasons, and lifecycle errors.
Include run-level failures and any remaining owned path. Print at most one existing
retained-results path, or state that no results were retained. Preserve this
diagnostic output even when default-run result files are removed; early argument
or allocation failure must still print its concrete reason.

### Live Test Output and Terminal Experience

Accepted follow-up contract for Phase 3.2. Streaming and presentation are
implemented, and bounded regressions, the real command matrix, and full-range
review passed. Phase 3 established final
reporting and lifecycle evidence but captured child output until finalization,
leaving long runs without visible feedback. The job records that manual
observation, the implementation, and current verification evidence.

#### Streaming Boundary

All five named commands should display the selected Bun test process's stdout
and stderr as data arrives, in both retention modes. Start streaming immediately;
do not wait for a duration threshold, suite completion, or the final report.
Preserve stdout/stderr destinations and order within each stream. Separate pipes
do not establish a total ordering between the two streams. Forward partial lines
without waiting indefinitely for a newline; handle split UTF-8 sequences correctly
where decoding or decoration is needed.

Use the existing owned pipes as the starting approach. Stream only the outer
Bun test output: prerequisite JSON, raw native probes, and nested Codex protocol
traffic remain internal. Present readable preflight status, validated versions,
and failure reasons through the runner. Keep raw streams out of retained summary
JSON and designated artifacts. Do not replay already displayed failure output
after finalization; the final summary still records every failure and cleanup
outcome.

Distinguish bounded diagnostic capture from live forwarding so display does not
wait for the whole run. Use this initial delivery policy, to be verified during
Phase 3.2 before changing limits based on measurements:

- Preserve the outer test process's existing 8 MiB total output limit and existing
  execution/cleanup deadlines. Exceeding that output limit remains an
  `output-limit` failure with owned termination.
- Limit combined pending terminal writes to 1 MiB, including bytes handed to a
  destination until its write callback completes. Pause the corresponding child
  readable when its destination applies backpressure; resume on drain. Keep
  cancellation and process-deadline handling responsive while reads are paused.
- If another chunk would exceed the pending-byte limit, fail output delivery and
  stop the owned producer instead of dropping bytes silently or spilling logs to
  disk. Use a four-second no-progress allowance while backpressured and a separate
  four-second final output-drain allowance after producer completion. Expiry or
  a broken destination also fails delivery and triggers bounded owned shutdown.
- On delivery failure, stop scheduling further suites. Preserve completed suite
  outcomes and any test/cleanup failures; fail the active attempt and invocation.
  Report the affected destination, limit/error, byte counts, and incomplete
  delivery through a surviving destination where possible. Do not claim successful
  delivery when both destinations are lost.

These initial limits passed bounded producer and destination checks; the job
records budget accounting and measured failure/drain behavior. Flush pending
output before the final summary when delivery succeeds. Output failures during
final summary delivery also make the invocation fail.

Live lines are informational. Exit status, validated JUnit, verified process
completion, export checks, and finalization continue to determine final results.
A child's printed pass line or an elapsed-time indicator cannot establish a
completed suite.

#### Presentation

Print immediate invocation/selection feedback and clear suite boundaries. Show
preflight, test execution, report validation, and cleanup stages. Actual streamed
test lines are the main progress display. During quiet work, show elapsed time
and the active stage; do not imply measured completion percentages or treat a
spinner as proof that assertions are advancing. Aggregate output identifies the
active suite and preserves completed suite results while later suites run.

Use the repository's existing color conventions for active, passed, failed, and
not-run states. Keep essential meaning in text and respect `NO_COLOR`. Detect
capabilities per destination, including separately redirected stdout/stderr. Verify the
installed Bun reporter's color behavior through pipes before choosing how to
enable child colors. For redirected streams, use plain append-only output and
infrequent status updates without cursor controls. Interactive redraws must not
overwrite test lines, partial output, or failure details. Finish with a readable
summary retaining the counts, versions, reasons, and paths required above;
group routine process metadata below the results and emphasize lifecycle problems.

#### Verification Boundary

Use bounded producers and controlled output destinations to prove visibility
before producer exit, partial-line/chunk handling, per-stream ordering, bounded
capture/queues, and absence of duplicate replay. Exercise quiet work, sustained
output, slow/broken destinations, output-budget exhaustion, timeout, and Ctrl+C.
Verify that output failures cannot hide test or cleanup failures or leave owned
work unaccounted for.

Exercise the privacy boundary with synthetic internal JSON and secret-like
sentinels from prerequisite/native/Codex probe fixtures. Assert that these values
never enter the streamed terminal output, summary JSON, or retained artifacts,
while sanitized status and failure reasons remain visible.

Inspect actual terminal and redirected execution, including `NO_COLOR`, failures,
both retention modes, and the named app/aggregate commands. Unit/application
fixtures must not recursively invoke the complete suite. Record measurements and
terminal observations in the existing job. A PTY or a separate research document
is warranted only if a concrete unresolved behavior requires that investigation.

### Ownership and Retention

One named invocation owns one atomically allocated unique run directory under
`examples/playground/.tmp-tests/`, including an aggregate invocation:

```text
run-<unique-id>/
  scratch/<suite>/...       temporary inputs, homes, and workspaces
  results/<suite>.junit.xml fresh report for each launched suite
  results/<suite>/...       designated copies when requested
  results/summary.json      one invocation summary
```

Record canonical path and directory identity. Never adopt a pre-existing run;
allocation collisions require a fresh directory or explicit failure. Launch Bun
children directly with the same immutable run/retention context and distinct suite/fixture
namespaces; do not recurse through public commands or allocate a run per leaf.

Establish fixture ownership before setup can fail. Reuse `TMP_ROOT`,
`createTempFixtureDir`, and `withTempFixtureDir` where suitable. Audit direct,
sibling, subprocess, and production-session allocations; retain genuine system-temp
tests with exact cleanup owners. Fixtures register designated exports before
assertions and export before inner cleanup. The runner owns finalization.

Both modes remove scratch after processes stop. Default mode removes consumed
results and the owned run; retained mode preserves only reports and designated
regular outputs. Refuse symlink escape, remove incomplete exports, and preserve
test/capture/export/cleanup errors together. Never retain raw configuration,
credentials, environment dumps, temporary homes, whole workspaces, or copies of
committed inputs.

Reject reports already present before launch. Before removal, verify the allocated
root's identity and refuse cleanup if it was replaced or became an alias/symlink.
Preserve unrelated and earlier retained runs. Concurrent-run checks must establish
distinct roots, unchanged prior report contents, and no cross-owner overwrite or
deletion. The printed retained path is `run-<id>/results`; after review the caller
removes its parent run. SIGKILL and host loss have no cleanup guarantee.

### Codex Evidence

Exercise an independent protocol client and the real production discovery adapter.
Use isolated homes/project state, no personal authentication, and no generation
requests. Capture and validate evidence in both retention modes; sanitize keys
and values. Successful evidence may be a fixture candidate; failed evidence is
diagnostic only. Committed-fixture updates require separate review.

Compare requests and checks across retention modes, not whole-file identity or
volatile provider catalogs. Keep live opt-in gates during partial migration;
remove them together with the final unit default and explicit prerequisite
failures. Remove automatic committed-fixture writes. Public named commands ship
only with their complete managed contract.

## Scope, Evidence, and Documentation

Scope is local test tooling with execution verified on macOS, using recorded
Bun/Node, lockfile-installed Codex, and Pandoc versions. The capability follow-up
replaces OS-name vetoes with bounded process-observation and group-access checks
before managed work starts. Full `ps` snapshots must include the reader and provide
unambiguous numeric identities; group access is checked with signal zero. Runtime
observation, verified shutdown, and conservative cleanup remain required.

The implementation still requires compatible POSIX process-group operations and
system `ps` fields. Passing those prerequisites permits an execution attempt; it
does not certify that platform. Other-platform execution remains unverified in the
available development environment. Native cache selection uses the actual DuckDB
platform identifier with safe path-component validation. Dependency availability
and suite behavior can still differ by platform. A different process-containment
backend, including native Windows support, is not implemented by this follow-up.
Product runtime support and dependency installation remain unchanged.

Preserve Node-compatible production behavior and Node-only compiler ambient types.
Excluded: CI/release changes, uploads, dependency refresh, committed-fixture
updates, duplicate pruning, full PDF/FFmpeg certification, and additional platform
or Node-version matrices. Public evidence excludes credentials, environment dumps,
personal configuration, and raw process arguments.

This research owns design decisions and supporting evidence. The plan owns
execution and acceptance; its unified job owns actual mappings, commands,
results, and review ranges. Update terminal owners in the
[path correspondence][correspondence] as moves land, preserving historical evidence. The [Testing Guide](../guides/testing.md) documents verified usage and is linked
from README.
Lint, formatting, types, build, and built Node CLI/ESM/CJS checks remain separate
from the test aggregate.

## Verification Evidence

Phase 2 established the baseline inventory, prerequisite-isolated pilots, feature
migrations, and final selection/config/report-file agreement. The complete union
passed 2,995 cases across 424 files, including the formerly skipped protocol case;
the implementation record details retained identities and the two preexisting
volatile comparison exceptions. Phase 1 established process observation and
bounded preflight/shutdown budgets on macOS. Phase 3 delivered the five managed
commands, report validation, scheduling, terminal diagnostics, and retention;
both real aggregate modes passed 3,152 cases across 434 files. The
[implementation record](../plans/jobs/2026-09-05-test-suite-refactor.md)
contains failure/correction evidence, ownership and export inspection,
acceptance cleanup, and complete phase reviews. Phase 3.2 completed bounded
live-output, presentation, and output-failure checks, its real app/aggregate
terminal and redirected matrix, and full-range review. Phase 4 completed the fixed
leaf/aggregate repetition protocol: twenty passing cells, including twelve Codex
repetitions, plus recorded original attempts and correction diagnostics. Phase 4 checkpoint
coverage is 3,239 cases across 441 files, with report/case identity correspondence,
verified retained-output cleanup, quality checks, and actual built Node CLI/ESM/CJS
behavior recorded in the job. The live metadata fixtures disable plugin startup
synchronization through synthetic configuration and assert the returned setting;
process ownership and shutdown bounds remain unchanged. Platform coverage remains
macOS, and no CI/release expansion is implied. The research questions are answered by the recorded implementation and verification
evidence; final documentation review passed.

## Related Plans

- [Test Suite Refactor Implementation Plan](../plans/plan-2026-09-05-multi-test-commands.md)

## References

[transport-source]: ../../src/adapters/codex/discovery/transport.ts
[date-tests]: ../../test/utils/datetime.unit.test.ts
[rename-direct]: ../../test/rename/direct/template.unit.test.ts
[rename-collisions]: ../../test/rename/planner/collision-and-source-lifecycle.app.test.ts
[report-tests]: ../../test/codex-info/report.unit.test.ts
[action-tests]: ../../test/codex-info/action.unit.test.ts
[rename-templates]: ../../test/rename/planner/template-rendering.app.test.ts
[doctor-routing]: ../../test/doctor/commands/routing.app.test.ts
[replay]: ../../test/codex-info/cli-replay.app.test.ts
[duckdb-fixtures]: ../../test/data-query/evidence/duckdb-fixtures.app.test.ts
[pandoc-language]: ../../test/markdown-pdf/actions/rendering/pandoc-language.pandoc.test.ts
[live-probe]: ../../test/codex-info/live-protocol.codex.test.ts
[correspondence]: ../references/test-catalog-path-correspondence.md
[catalog-research]: research-2026-08-23-test-suite-contract-overlap-and-catalog.md
[render-support]: ../../test/markdown-pdf/actions/rendering/render-support.ts
[query-support]: ../../test/data-query/commands/support.ts
[profile-command-wiring]: ../../test/markdown-pdf/commands/profile-codex-wiring.app.test.ts
[rename-support-tests]: ../../test/rename/commands/plan-artifact-cleanup.app.test.ts
[bun-root]: https://bun.com/docs/test/configuration#root
[bun-ignore]: https://bun.com/docs/test/configuration#path-ignore-patterns
[bun-discovery]: https://bun.com/docs/test/discovery


## Capability Follow-up

The [unified implementation record](../plans/jobs/2026-09-05-test-suite-refactor.md#follow-up-capability-based-platform-requirements)
tracks removal of the original macOS guards, local regression evidence, and the
remaining absence of other-platform verification. The completed Phase 4 evidence
retains its historical scope.

The capability follow-up passed both local aggregate retention modes with 3,289
cases across 443 files, plus controlled capability/cache regressions and quality
checks. This extends local regression evidence; it does not add a verified platform.
