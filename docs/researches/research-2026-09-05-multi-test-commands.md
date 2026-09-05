---
title: "Test Suite Responsibilities and Verification Lifecycle"
created-date: 2026-09-05
modified-date: 2026-09-05
status: in-progress
agent: codex
---

## Goal and Research Status

Define a useful test workflow with one aggregate command and distinct suites
selected by the behavior and dependencies they verify. Establish process and
scratch ownership before implementing shared orchestration.

The command model, behavioral suite boundaries, and shutdown outcomes below are
settled design decisions. Phase 2 implemented the feature-first layout and
filename-based selection, verified the baseline correspondence and prerequisite
boundaries, and passed the complete 424-file union. The implementation job records
the actual mapping, evidence, and completed Phase 2 range reviews. Phase 1 implementation and lifecycle
evidence are complete. Phase 3 delivered the managed runner and passed the real
aggregate in both retention modes. Research remains in progress pending Phase 4's
broader workflow verification and final usage documentation.

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
native packages/caches, and unsupported platforms fail before launching tests.
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

Scope is local test tooling on initially verified macOS, using recorded Bun/Node,
lockfile-installed Codex, and Pandoc versions. Other named-runner platforms fail
preflight explicitly; product runtime support and dependency installation remain
unchanged. Direct tests must fail required unsupported/dependency checks instead
of bypassing assertions.

The current platform restriction reflects Phase 1's verification coverage.
Linux shares the POSIX process-group/session mechanism used by Node's
[`detached` option](https://nodejs.org/api/child_process.html#optionsdetached), so
it is a candidate for extending this implementation. Its
[`ps` observation fields](https://man7.org/linux/man-pages/man1/ps.1.html), command
availability, and shutdown behavior still require verification. Windows has
different detached-process semantics and would need a platform-specific ownership
approach, potentially using [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
Any future platform extension must establish observation and termination behavior
and pass the same lifecycle acceptance tests before the guard is widened.

Preserve Node-compatible production behavior and Node-only compiler ambient types.
Excluded: CI/release changes, uploads, dependency refresh, committed-fixture
updates, duplicate pruning, full PDF/FFmpeg certification, and additional platform
or Node-version matrices. Public evidence excludes credentials, environment dumps,
personal configuration, and raw process arguments.

This research owns design decisions and supporting evidence. The plan owns
execution and acceptance; its unified job owns actual mappings, commands,
results, and review ranges. Update terminal owners in the
[path correspondence][correspondence] as moves land, preserving historical evidence. The future testing
guide documents verified usage and receives its README link when it exists.
Lint, formatting, types, build, and built Node CLI/ESM/CJS checks remain separate
from the test aggregate.

## Remaining Verification Work

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
acceptance cleanup, and complete phase reviews. Phase 4 still owns the broader
leaf/aggregate repetition protocol, final inventory reconciliation, built-package
checks, and usage documentation.

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
