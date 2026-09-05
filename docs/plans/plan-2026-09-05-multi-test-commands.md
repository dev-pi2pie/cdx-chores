---
title: "Local Multi-Test Commands Implementation"
created-date: 2026-09-05
modified-date: 2026-09-05
status: draft
agent: codex
---

## Goal and Planning Boundary

Implement explicit local test commands, strict aggregate results, and default
scratch cleanup with optional result retention. All commands run on the
contributor's machine; integration means using real Codex or Pandoc.

This plan is `draft`; implementation has not started. The research remains
`in-progress` until the local acceptance evidence below is recorded.

GitHub Actions testing, publication/release gates, and artifact uploads are
outside this implementation. Existing publish/release workflows remain unchanged.
Linux and additional Node-version verification, duplicate-test deletion, and
broader test-catalog cleanup are deferred and do not block local closeout.

## Related Research

- [Multi-Test Commands and Verification Boundaries](../researches/research-2026-09-05-multi-test-commands.md)

## Related References

- [Documentation Policy](../../DOCUMENTATION_POLICY.md)
- [Test Catalog Path Correspondence](../references/test-catalog-path-correspondence.md)

## Command and Implementation Boundaries

| Planned command | Responsibility |
| --- | --- |
| `bun run test:local` | Controlled unit, action, command, native-package, fixture-subprocess, and replay tests |
| `bun run test:integration:codex` | Real Codex protocol and production discovery-adapter checks |
| `bun run test:integration:pandoc` | Real Pandoc conversion and application HTML processing |
| `bun run test:all` | All three suites sequentially, continuing after ordinary suite failures |

Every named command accepts `--keep-results`, default false. It changes retention
only. Reject unknown options before allocation or dependency launch. Bare
`bun test` remains the local shortcut with normal helper cleanup. Add no `test`
alias, `--keep`, custom output path, or recording command.

Use one fixed three-suite table and a small shared runner in `scripts/testing/`.
Keep local tests under `test/`, live suites under `integration/codex/` and
`integration/pandoc/`, and committed fixture inputs in place. Use ordinary
`.test.ts` names, `[test] root = "test"`, and explicit integration paths from
the repository root. A simple membership check is sufficient; no dynamic
registry, plugin API, or general-purpose process-management framework is needed.

Reuse `TMP_ROOT`, `createTempFixtureDir`, and `withTempFixtureDir`. Each named
invocation owns a unique run under `examples/playground/.tmp-tests/`. Extend
these helpers for run context and designated outputs rather than introducing
a second scratch mechanism. Audit all existing allocation patterns, including
those outside the helpers; do not generalize for hypothetical future ones.

A suite passes only with exit zero, valid fresh JUnit containing executed tests,
and zero failures, errors, skips, or TODOs. Prerequisite, report, platform,
export, and cleanup failures are nonzero outcomes. Preserve original failures
alongside lifecycle errors; a small reader using `fast-xml-parser` suffices.

Retain only registered regular output files and reports, copying before inner
cleanup. Remove scratch in both modes. Never retain raw configuration,
credentials, environment dumps, or whole fixture workspaces; refuse symlinks
outside the run. Retained results stay until the caller removes the printed
run after review. Later invocations must not sweep them.

Initial acceptance targets local macOS with Bun 1.4.1, Node 24.18.0,
lockfile-installed Codex, and Pandoc 3.9 as the candidate to validate. Record
actual versions and admit only verified harness platforms; initially reject
other platforms, including Windows. This does not change product runtime support.
Preserve Node-compatible production code and the Node-only compiler environment.

Keep lint, formatting, type checks, build, and a local built-Node smoke separate
from `test:all`. No dependency refresh, committed fixture update, full PDF/FFmpeg
execution coverage, or multi-version compatibility certification is included.

## Execution Evidence

When Phase 1 starts, create one job at
`docs/plans/jobs/YYYY-MM-DD-multi-test-commands.md` using the actual UTC date.
Link it here and from the research, set the plan `active`, and record phase
evidence there. Keep a mechanical suite-membership list, exact move/split paths,
and scratch-owner checklist; a new suite-wide quality inventory is unnecessary.

Check off tasks after their evidence passes. Keep current path mappings in the
existing correspondence reference, and commands, actual versions, failures, and
cleanup verification in the job. Use public-safe repository-relative records.
The guide remains `draft` while command behavior is assembled across the phases.

```text
Separate suites and define local commands
                  |
                  v
Strict reporting and bounded execution
                  |
                  v
Complete cleanup and explicit retention
                  |
                  v
Local verification and contributor guide
```

## Phase 1: Separate Suites and Define Local Commands

- [ ] Record the current local baseline and mechanically check suite membership.
      Inventory real-dependency cases and existing scratch owners, including direct
      allocators, generator/subprocess scratch, production-created sessions, and
      sibling files. Record exact move/split paths without auditing every assertion.
- [ ] Establish local prerequisite setup for Bun, Node SQLite, native DuckDB and
      required extension caches, Git/Bash/jq, zip/unzip, Codex, and Pandoc. Control
      ambient test configuration, especially doctor commands, and check unexpected
      network use. Setup occurs before testing; tests do not install dependencies.
- [ ] Move the three Pandoc conversion cases and split the Codex probe into home,
      configuration-precedence, and pagination/metadata checks. Preserve mixed-file
      local coverage and the independent protocol client; add real
      `discoverCodexInfo` coverage. Remove live-test availability/opt-in wrappers.
- [ ] Run Codex from the frozen installation with isolated homes, an environment
      allowlist, bounded metadata requests, and no personal credentials, generation
      requests, or automatic retries. Make evidence capture, sanitization, and
      shape/version validation independent of the future retention choice.
      Remove automatic committed-fixture
      writes and both legacy probe flags. Catalog equality becomes an observation,
      not an invariant. Phase 3 implements designated-result retention; Phase 4
      verifies identical capture and checks with and without `--keep-results`.
- [ ] Add the fixed suite table, command entry points, and `bunfig.toml`; preserve
      imports, fixture locations, subprocess working directories, and every distinct
      regression case. Correct misleading built-CLI names and declare platform
      limits instead of accepting hidden partial coverage. Leave duplicate-test
      assertions in place.
- [ ] Include `integration/` in `lint`, `lint:fix`, `format`, and `format:check`,
      and extend applicable `.oxlintrc.json` test overrides. Verify that tests and
      support files remain covered. Update affected current links and path
      correspondence, and start the testing guide as `draft`.

Checkpoint: suite selection and prerequisite setup work locally, with real Codex
and Pandoc results distinguished from replay evidence. Bare `bun test` excludes
live suites; all moved coverage, fixture inputs, and tooling coverage survive.
The complete named-command contract remains pending Phases 2–4.

## Phase 2: Add Strict Results and Bounded Execution

- [ ] Complete the common runner with prerequisite/platform checks, fixed-table
      completeness checks, sequential execution, fresh per-suite JUnit, and one
      final summary. Reject unassigned or duplicate membership and unknown options.
- [ ] Allocate a unique run and pass one immutable run context to helpers and child
      tests without contributor-facing environment switches. Preserve the existing
      cleanup path; Phase 3 completes ownership and designated-result export.
- [ ] Combine process status and validated report contents. Distinguish passed,
      failed, and not-run suites; include prerequisite and lifecycle errors and
      continue later suites after ordinary failures.
- [ ] Bound suite execution and owned-child termination. Begin with a 120-second
      Codex suite deadline plus bounded cleanup, and record measured budgets for
      the other suites. Handled cancellation stops scheduling, terminates owned
      work, finalizes available outcomes, and exits nonzero. Scope supervision to
      the child-process patterns present in these suites.
- [ ] Exercise synthetic pass, assertion/import failure, empty selection,
      skips/TODOs, missing/malformed XML, nonzero exit with passing XML, missing
      prerequisites, unsupported platforms, unknown options, timeout/cancellation,
      and continuation after failure. Self-tests must not recursively launch
      the full local suite.

Checkpoint: focused scenarios demonstrate strict reporting and bounded execution;
a zero exit never represents missing, skipped, or failed verification.

## Phase 3: Complete Scratch Ownership and Result Retention

- [ ] Close every existing scratch-owner checklist entry. Prefer callback helpers
      or establish an explicit owner immediately after allocation, before setup
      and assertions. Include direct `mkdtemp`, generator/subprocess workspaces,
      production-created sessions, and sibling files outside the shared root.
- [ ] Route scratch into the run where practical. Preserve real system-temp tests
      with explicit external-path ownership and cancellation registration, including
      child-created paths. Cleanup cannot rely solely on a child reaching `finally`
      or on deleting the shared run directory.
- [ ] Register designated output files before assertions fail and export before
      inner cleanup. Keep requests/checks identical in both retention modes. Only
      validated successful Codex evidence is a fixture candidate; label retained
      partial/failing evidence as sanitized diagnostics.
- [ ] Verify setup/assertion failure cleanup for each ownership pattern under bare
      tests and named commands, plus handled cancellation of named commands with
      child/external scratch present. Cover nested export, export/cleanup failure,
      original-error preservation, concurrent runs, and unrelated-path/symlink
      protection through focused scenarios.

Checkpoint: default runs remove owned scratch/results; retained runs remove scratch
and print an existing results path, or explicitly report that nothing was retained.
Export failures remove incomplete copies and fail without claiming usable output;
cleanup failures report the remaining owned path. Committed inputs and earlier
retained runs remain untouched. SIGKILL, host termination, and power loss carry no
cleanup guarantee.

## Phase 4: Verify Locally and Complete Contributor Guidance

- [ ] Run each named command and `test:all` locally with the declared prerequisites.
      Verify both retention modes, identical Codex requests/checks, actual versions,
      Pandoc 3.9 behavior, and real discovery-adapter results. Confirm final suite
      membership, preserved move/split coverage, and unchanged committed fixtures.
- [ ] Run separate lint, formatting, type, and build checks. Smoke the built CLI
      and ESM/CJS exports through the local Node version; Bun source execution is
      not built-runtime evidence. Record macOS results and verify unsupported-platform
      rejection through focused preflight tests. Linux and additional Node versions
      are not acceptance gates.
- [ ] Complete `docs/guides/testing.md` and link it from README Local Development.
      Cover command choice, prerequisite/native-cache setup, verified versions and
      platform limits, metadata access, strict failures, cleanup, `--keep-results`,
      explicit retained-run removal, adding tests, and separate fixture review.
      Include concise examples and ASCII command/lifecycle flows, plus independent
      local checks. Remove retired contributor-facing opt-in instructions.
- [ ] Verify guide examples and links, reconcile local research acceptance with
      the job evidence, and mark guide/plan/job/research complete only when their
      own criteria pass. Link completed evidence from the research. Broader platform
      testing and hosted automation remain outside these completion criteria.

Checkpoint: the local workflow is verified and documented, with no unexplained
skips or unresolved cleanup/export failures. The guide describes actual behavior
and verified environments. Existing GitHub Actions workflows are unchanged.
