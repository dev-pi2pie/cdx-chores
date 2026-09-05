---
title: "Multi-Test Commands and Verification Boundaries"
created-date: 2026-09-05
modified-date: 2026-09-05
status: in-progress
agent: codex
---

## Goal and Status

Define explicit local test commands, an aggregate run-all command, and one lifecycle
for temporary fixtures and test results. Reuse the existing
`examples/playground/.tmp-tests/` scratch root and shared helpers. Cleanup is
the default on success and failure; retaining results requires an explicit option.

The decisions below resolve the initial open questions. They are not shipped
commands: this research changes no package scripts, tests, helpers, or workflows.
Research remains `in-progress` until the remaining acceptance evidence is
recorded. The completed Codex execution research remains a separate feature record.

## Scope Boundary

All four commands run on the contributor's machine. Integration means using
real Codex or Pandoc; it does not mean GitHub Actions execution. This work adds
no GitHub Actions tests, publication gates, artifact uploads, or changes to the
existing publish/release workflows.

Keep orchestration small: a fixed table of three suites, one shared runner,
the existing scratch helpers, and focused failure checks. Mechanically check
suite membership and audit existing scratch ownership patterns; do not repeat
the repository-wide test-quality/catalog review or build a plugin framework.

Initial acceptance is local macOS verification. Linux and additional Node-version
coverage, hosted automation, and duplicate-test cleanup are separate follow-up
work, not completion requirements. Preserve Node-compatible production behavior
and existing regression cases, and describe only the environments actually verified.

## Evidence and Limits

The initial inspection at `463293cd` found 378 `.test.ts` files. Subsequent static
inspection covered subprocess calls, shared generators, skip mechanisms,
platform branches, and related runtime boundaries. This is not a claim that
every assertion or transitive dependency was dynamically audited.

| Finding | Evidence | Design consequence |
| --- | --- | --- |
| No named test scripts | [Package scripts][package] | Add commands with explicit suite membership. |
| Codex requires `CDX_CHORES_RUN_CODEX_DISCOVERY_PROBE=1`; another flag enables fixture writes | [Live probe][probe] | Use an explicit integration command and `--keep-results`; committed fixture updates remain a separate reviewed change. |
| Three Pandoc cases skip when Pandoc is absent | [Render support][render-support], [language attributes][pandoc-language], [highlighting][highlight] | Use explicit integration membership and prerequisite failures. |
| `withTempFixtureDir` removes scratch in `finally`; `createTempFixtureDir` only allocates it | [Test helpers][helpers] | Extend the callback lifecycle and audit cleanup ownership for direct allocator callers. |
| Some scratch bypasses the shared helper: direct system-temp workspaces, generator subprocess scratch, and production-created sessions with cleanup after assertions | [Workbook tests][xlsx-tests], [query generator][query-generator], [session lifecycle tests][session-tests] | Audit all temporary allocations and their owners, including paths outside the shared scratch root. |
| Lint and format scripts explicitly target `src test scripts`; the test lint override targets `test/**/*.test.ts` | [Package scripts][package], [lint configuration][lint-config] | Include `integration/` and extend applicable test overrides when moving tests. |
| Local tests use Node SQLite, native DuckDB, Git/Bash/jq, and zip/unzip | [Tabular generator][tabular-generator], [DuckDB fixtures][duckdb-fixtures], [release tests][release-tests], [workbook tests][xlsx-tests] | Local means controlled inputs, not Bun-only or pure unit tests. Supporting tools are prerequisites. |
| Fixture subprocesses and the independent live client serve different purposes | [Replay][replay], [transport tests][transport], [probe client][probe-client] | Keep both; also check the production discovery adapter with real Codex. |
| Four symlink tests return early on Windows; a permission test is conditionally unregistered | [File rename][rename-file], [recursion][rename-recursion], [preview][rename-preview], [collisions][rename-collision], [bundle integration][bundle-tests] | A zero-skip report alone cannot establish platform coverage. |
| Doctor's “built CLI” test launches `src/bin.ts` through Bun | [Doctor routing][doctor-routing], [helpers][helpers] | Correct its name; do not count it as built Node validation. |
| Workflows build/publish/release without test commands | [Workflows][workflows] | Leave these workflows unchanged; this implementation delivers local test commands only. |

### Bun Mechanics Verified

Isolated synthetic checks on Bun 1.4.1/macOS established:

| Check | Observed result |
| --- | --- |
| `[test] root = "test"` with bare `bun test` | Only tests under `test/` execute. |
| Explicit `bun test ./integration/codex` outside that root | Integration tests execute; explicit file arguments also work. |
| Pass plus skip and TODO with JUnit enabled | Exit zero; both omitted cases appear as skipped in XML. |
| Assertion failure | Nonzero exit and a report containing the failure. |
| Import failure or empty discovery | Nonzero exit; no report was produced in these checks. |

This agrees with Bun's [discovery][bun-discovery] and [reporter][bun-reporters]
documentation. It establishes a design basis, not cross-platform certification.
The eventual runner still needs local acceptance checks; Linux verification is
deferred. The synthetic probe files were temporary and were removed after inspection.

## Settled Command Contract

All commands below are planned, not currently available.

| Command | Responsibility | Required context |
| --- | --- | --- |
| `bun run test:local` | Controlled unit, action, command, native-package, fixture-subprocess, and replay verification | Bun, Node, installed packages, and supporting local tools |
| `bun run test:integration:codex` | Real Codex protocol and production discovery-adapter verification, including sanitized protocol evidence as a designated test result | Lockfile-installed Codex; isolated homes; bounded metadata requests; no personal credentials or content-generation requests |
| `bun run test:integration:pandoc` | Real Pandoc conversion and application HTML processing | Installed Pandoc |
| `bun run test:all` | Every registered verification suite, sequentially | All suite prerequisites |

Each named command accepts `--keep-results`, default false. It changes retention
only: never test selection, failures, or expectations. Reject unknown options
before creating scratch or launching dependencies. Do not add a shorter `--keep`
alias or custom output-path option initially; one option and the existing root suffice.

Package script names identify what to verify. `--keep-results` alone identifies
whether generated files survive cleanup. There is no separate recording script
whose name suggests that files will be saved by default.

```sh
# Report the outcome and remove temporary results.
bun run test:local
bun run test:all

# Retain designated results from successful and failed cases.
bun run test:integration:pandoc --keep-results
bun run test:all --keep-results

# The same Codex verification, with or without retained protocol evidence.
bun run test:integration:codex
bun run test:integration:codex --keep-results
```

Bare `bun test` remains a local shortcut with normal helper cleanup. Named commands
own prerequisite checks, structured verification, and retention. Do not add a
`bun run test` alias initially. Updating committed fixtures and running lint/type/
build checks remain separate responsibilities, not implicit steps of `test:all`.

## Suite Discovery and Registration

Keep local tests under `test/`; place real dependency cases under
`integration/codex/` and `integration/pandoc/`, with ordinary `.test.ts` names.
Put orchestration under `scripts/testing/`. This organizes test code, without
introducing an output root or relocating committed fixture inputs.

Set `[test] root = "test"` in `bunfig.toml` and invoke integration directories
explicitly from the repository root. Preserve helper imports, fixture paths,
and subprocess working directories when splitting mixed files.

Add `integration/` to `lint`, `lint:fix`, `format`, and `format:check`, and extend
applicable test-specific configuration overrides to the moved files. Verify
that integration tests and support files retain their lint and formatting
coverage. These checks remain separate from `test:all`.

One fixed table supplies the three suites' directories, prerequisites, deadlines,
and supported platforms. Individual commands and `test:all` use it. A simple
completeness check detects unassigned integration directories/files and duplicate
membership; no dynamic registration or extension API is needed. Real dependency
cases do not use environment flags or availability-based skips to register themselves.

## Aggregate Results and Failure Semantics

Use Bun's JUnit reporter with a fresh per-suite path under the owned run directory.
Parse XML with the existing XML dependency and consider both process status and
report contents. Never infer success from human-readable output alone.

A suite passes only with exit zero, a valid report containing executed tests,
and zero failures, errors, or skipped cases, including TODOs. Missing/malformed
reports, unexpected zero selection, missing prerequisites, unsupported test
platforms, and cleanup/retention failures make the command nonzero. Preserve the
original failure alongside lifecycle failures.

```text
test:all [--keep-results]
          |
          v
  Validate options and suite table
          |
          v
  Create one owned run directory
          |
          +--> local ---------------> outcome + JUnit
          +--> integration:codex ---> outcome + JUnit
          +--> integration:pandoc --> outcome + JUnit
          |     (ordinary failures do not stop later suites)
          v
  Aggregate test and prerequisite outcomes
          |
          v
  Finalize retention and cleanup --> include lifecycle failures
          |
          v
  Final summary; zero only when every suite passed
```

Handled cancellation stops new work, terminates owned child processes, finalizes
available results, and cleans up. Mark remaining suites not run and return
nonzero. SIGKILL, host termination, or power loss cannot guarantee cleanup;
do not promise otherwise or sweep another run's leftovers on the next invocation.

## Fixtures, Temporary Results, and Cleanup

The term “fixture” must not obscure ownership or lifetime:

| Artifact | Default lifecycle | With `--keep-results` |
| --- | --- | --- |
| Committed fixture inputs | Persistent inputs; never rewrite/delete during verification | Unchanged |
| Generated inputs, fake executables, unpacked workbooks, temporary repositories and homes | Remove when the owner finishes, including failures | Still remove |
| Designated output files: generated HTML/PDF, sanitized protocol evidence, diagnostic reports | Inspect and summarize, then remove | Retain only files registered as results by the test/harness |
| Per-suite JUnit and aggregate summary | Consume before deleting the run directory | Retain with results, suite outcomes, and versions |

Reuse `TMP_ROOT`, `createTempFixtureDir`, and `withTempFixtureDir`. Named commands
allocate a unique run beneath `.tmp-tests/`; helpers use its run context for
ownership. Prefer the callback helper for test lifetimes. Direct allocator calls
must either migrate to it or establish an explicit owner with `try/finally`
cleanup before work begins, including setup that may fail before the test body.
Allocation alone never establishes a cleanup guarantee.

Audit allocations beyond the shared helpers: direct `mkdtemp` calls, generator
and subprocess scratch, production-created temporary sessions, and sibling
files created to test ownership boundaries. Route scratch into the owned run
where practical. When a test needs real system-temp behavior, preserve that
coverage and give each external path an explicit owner and failure-safe cleanup.
Establish cleanup immediately after allocation, before setup or assertions can
fail. Named-command cancellation must also account for these paths, including
child-created scratch, rather than relying only on removal of the run directory.
Limit the ownership mechanism to the allocation and child-process patterns
present in these suites; a general-purpose process or temporary-file manager
is outside this work.

Register designated output paths before assertions can fail. Export existing
registered files during finalization, before an inner helper's `finally` removes
its working directory. Under bare `bun test`, callback and explicit-owner cleanup
still apply; retention requires a named-command context. Audit direct allocator
callers rather than assuming the aggregate runner repairs their normal lifecycle.

The runner propagates one immutable run context and retention choice to helpers
and child test processes. No contributor-facing environment flag is required.
Do not implement retention by disabling `finally` cleanup. Tests identify result
files explicitly; the shared helper copies registered files into the run's
result area only when retention was requested.

```text
examples/playground/.tmp-tests/<unique-run>/
  scratch/          inputs, homes, repositories, subprocess state
  results/          designated output copies and consumed reports

Create scratch --> execute --> inspect/assert --> capture outcome
                                    |
                        success / failure / handled cancellation
                                    |
                                    v
                    --keep-results requested?
                       /                   \
                     no                    yes
                      |                     |
             Consume reports       Export designated results
                      |             Label partial/failed output
                      |                     |
                      |              Remove all scratch
                      |                     |
             Remove owned run      Keep results; print location
                       \                   /
                        v                 v
                    Final outcome, including cleanup errors
```

Export only regular, owned result files. Do not follow symlinks outside the run
or preserve entire fixture workspaces. Raw Codex configuration, credentials,
environment dumps, and temporary homes are never registered as results. Retained
failure artifacts are diagnostic output, not successful fixture candidates.
If nothing can be retained, say so; never invent a retained path.

Cleanup errors report the remaining owned path and fail the command. Export
failure also fails, cleans scratch, and removes incomplete export files rather
than claiming a usable retained result. Cleanup targets exact owned directories,
never a blanket `examples/playground/.tmp*` glob.

Retained results remain until the caller explicitly removes the printed run
directory after local review; later tests must not sweep them. Keep raw reports
as local review artifacts rather than publishing them as repository documentation.

## Codex Integration Results and Fixture Updates

Split the single probe into home-resolution, configuration-precedence, and
pagination/metadata checks. Keep the independent protocol client and add a real
check through `discoverCodexInfo`; do not make the production implementation
the independent check's only oracle.

Replace `CDX_CHORES_RUN_CODEX_DISCOVERY_PROBE` with the integration command.
Remove the automatic committed-fixture write path controlled by
`CDX_CHORES_UPDATE_CODEX_DISCOVERY_EVIDENCE`. Neither switch remains necessary
for normal contributor use.

Integration checks capture protocol evidence into scratch, sanitize it, validate
its shape and version provenance, and register it as a designated result. The
same checks and requests run with or without `--keep-results`; the option does
not enable additional capture, network access, or different validation.

Without the option, summarize verification and remove the generated files.
With it, retain sanitized evidence for review. Evidence is a usable fixture
candidate only when capture and required checks succeeded. Failed runs may retain
sanitized diagnostics labeled with their failure, never partial evidence labeled
as a valid candidate. `test:all --keep-results` follows this same policy for its
Codex suite.

```text
test:integration:codex [--keep-results]
       |
       v
  Run checks --> capture --> sanitize --> validate evidence
                              |
                 +------------+-------------+
                 |                          |
          default cleanup             --keep-results
                 |                          |
         Summarize; remove         Retain designated results/
                                            |
                                   Successful evidence only:
                                   review fixture update separately
                                            |
                                   Accept or reject; remove saved run
```

Accepting a candidate into committed fixtures is a separate reviewed change.
Never update expectations automatically during verification or write evidence
under a filename naming another version. Equality of catalogs across providers
is an upstream observation to record, not an invariant to enforce; test our
honest reporting of unverified provider support instead.

## Resolved Research Questions

| Initial question | Resolution |
| --- | --- |
| Additional dependencies and membership | Declare local supporting tools instead of a command per executable. Keep real Codex and Pandoc contracts separate. Native DuckDB and generators remain local; provision required caches explicitly. Give doctor command tests a controlled environment. |
| Discovery and naming | Standard `.test.ts` files, local `test` root, explicit `./integration/<suite>` paths, one fixed suite table. Verify the implemented runner locally on macOS; broader platform checks are deferred. |
| Structured results | JUnit plus process status and fresh paths. Reject skips/TODOs and missing reports; separately correct platform early returns that XML cannot detect. |
| Versions and platforms | Use Bun 1.4.1 and Node 24.18.0 as the initial local verification baseline. Resolve Codex through the frozen lockfile. Start Pandoc integration with 3.9, contingent on its acceptance run. Admit macOS suite support after local verification; reject unsupported harness platforms explicitly, including Windows. Linux and Node 22.23.0 floor verification are deferred; product runtime support is unchanged. |
| Hosted automation | No GitHub Actions tests, release/publication gates, or artifact uploads in this implementation. Existing workflows remain unchanged. |
| Short alias | No `bun run test` alias initially. Bare `bun test` is the local shortcut; named commands own strict reporting and retention. |
| Coverage cleanup | Preserve regression cases during suite moves. Correct misleading names and hidden platform omissions. Duplicate-test deletion and broader catalog cleanup are deferred. |

Contributors provision declared tools, frozen dependencies, and required native
caches before testing; tests do not install missing dependencies. Bound Codex
requests and the Codex suite (initial budget: 120 seconds plus bounded cleanup),
without automatic retries. Record actual versions rather than using `latest` or treating one
version as proof of all supported versions. Full PDF rendering, FFmpeg execution,
and Node build smoke are not established by fixture-backed tests. A separate
built-Node smoke runs on the locally verified Node version. Neither that check
nor local suite acceptance establishes a cross-platform or multi-version matrix.
Platform restrictions concern this harness, not product support.

## Coverage Preservation and Deferred Cleanup

| Candidate | Treatment and preserved evidence |
| --- | --- |
| Six summary/context/model cases in [render tests][render] duplicate exact-layout inputs | Keep in this implementation. Any later deletion must map to surviving compact/detailed layout cases and preserve distinct absent metadata, unlisted selection, empty output, and escaping coverage. |
| Hardcoded `expect(args).toContain("markdown")` in [Pandoc language test][pandoc-language] | Keep during the suite move; removal is optional follow-up cleanup. Preserve conversion exit status and actual HTML assertions. |
| Mixed live probe and fixture writes | Split the checks by behavior; make sanitized evidence a designated integration result and remove automatic committed-fixture writes. Preserve real adapter coverage and version provenance. |
| `pandocTest` availability alias | Replace with integration membership and preflight failure; retain all three conversion cases. |
| Doctor “built CLI” wording and Windows early returns | Correct names and platform declarations. Do not delete distinct coverage to make reporting green. |

Retain parser-scope, option propagation, timeout/cancellation, secret-exclusion,
generator cleanup/refusal, and protocol replay checks. Preserve the behaviors
owned by each moved or split test. Removing opt-in wrappers, fixture-write paths,
and the upstream catalog-equality invariant implements the new command contract;
it does not authorize unrelated assertion pruning.

## Testing Guide Deliverable

The suite refactor must deliver `docs/guides/testing.md`, linked from the
README's Local Development section. Write the guide alongside implementation
and verify its examples against the implemented commands before presenting it
as completed, current usage guidance. This research does not create that guide
or add a link to a file that does not yet exist.

The guide is the canonical contributor reference for:

- Choosing local, individual integration, or aggregate verification, including
  the distinction between bare `bun test` and the named commands.
- Installing each suite's prerequisites and understanding supported test
  platforms, locally verified versions, and bounded external metadata access.
- Default cleanup, `--keep-results`, the existing scratch root, reported retained
  locations, and explicitly removing retained runs after review.
- Interpreting test failures, missing prerequisites, absent or invalid reports,
  cancellation, and cleanup/export errors without mistaking partial coverage
  for an all-passed result.
- Reviewing retained protocol evidence and updating committed fixtures as a
  separate change; neither verification nor retention updates them automatically.
- Adding tests to the right suite, maintaining registration, assigning scratch
  ownership, and registering result files before assertions can fail.
- Running separate local lint, formatting, type, build, and built-Node checks.

Include concise command examples and ASCII flows for command selection and
the default-cleanup versus explicit-retention lifecycle. Keep the README entry
short and link to the guide rather than duplicating setup and command tables.
Update contributor-facing instructions that still advertise the retired opt-in
flags; historical research and job evidence should remain clearly historical.

The research explains decisions, the guide explains shipped usage, and job
records contain execution evidence. Keep implementation history and unresolved
design discussion out of the guide. Creating and verifying this guide is part
of refactor acceptance, not optional documentation to postpone after closeout.

## Implementation Acceptance Evidence Still Required

These are verification tasks for the settled design, not unresolved command choices:

- Confirm local prerequisite setup, including native extensions, controlled test
  configuration, and unexpected network use. Keep this tied to the existing suites.
- Verify discovery, explicit selection, and suite-table completeness locally on
  macOS without breaking existing import, fixture, or subprocess paths. Check
  rejection of unsupported platforms through focused preflight tests.
- Verify that all four lint/format scripts include `integration/`, applicable
  test overrides cover the moved files, and lint and formatting checks actually
  inspect integration tests and support files after the move.
- Exercise pass, assertion failure, import failure, no tests, skips/TODOs,
  cancellation, missing/malformed reports, and nonzero exits with passing XML.
- Verify default cleanup after pass/failure/handled cancellation; export before
  inner cleanup; explicit retention of successful and diagnostic partial output;
  failed export/cleanup; concurrent run ownership; and no touching committed inputs.
- Confirm identical Codex checks and requests with and without `--keep-results`;
  verify that only retention differs and neither mode updates committed fixtures.
- Audit every direct `createTempFixtureDir` caller for explicit ownership or
  callback migration, plus direct `mkdtemp` calls, generator/subprocess scratch,
  production-created sessions, and sibling files outside the shared root.
  Exercise setup and assertion failures before normal cleanup for each ownership
  pattern under bare `bun test` and named commands; verify handled cancellation
  also removes owned external paths without deleting unrelated temporary files.
- Run `test:all` locally, validate Pandoc 3.9, and record real Codex adapter results
  and actual tool versions. Earlier replay passes are not this evidence.
- Verify that moved/split cases preserve their coverage and validate built output
  on the local Node version independently of Bun source execution. No hosted CI,
  Linux, or additional Node-version evidence is required for this scope's closeout.
- Deliver `docs/guides/testing.md` and the README Local Development link. Verify
  its command examples, prerequisite failures, and local cleanup/retention
  instructions against implementation; check links and remove stale
  contributor-facing opt-in instructions before marking the guide completed.

The linked implementation plan organizes this work into phased acceptance checks.
Keep research `in-progress` until its required evidence is recorded;
documentation review alone does not complete it.

## Related Plans

- [Local Multi-Test Commands Implementation](../plans/plan-2026-09-05-multi-test-commands.md)

## Related Research

- [Codex Execution Configuration](./research-2026-08-21-codex-execution-configuration.md)
  records the completed feature and original discovery observations.

## References

[package]: ../../package.json
[helpers]: ../../test/helpers/cli-test-utils.ts
[lint-config]: ../../.oxlintrc.json
[query-generator]: ../../scripts/generate-data-query-fixtures.mjs
[session-tests]: ../../test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts
[probe]: ../../test/codex-info/live-protocol.test.ts
[probe-client]: ../../test/codex-info/live-protocol-client.ts
[replay]: ../../test/codex-info/cli-replay.test.ts
[transport]: ../../test/codex-info/transport.test.ts
[render-support]: ../../test/markdown-pdf/actions/render-support.ts
[pandoc-language]: ../../test/cli-actions-md-to-pdf-pandoc.test.ts
[highlight]: ../../test/cli-actions-md-to-pdf-code-highlight.test.ts
[render]: ../../test/codex-info/render.test.ts
[tabular-generator]: ../../scripts/generate-data-extract-fixtures.mjs
[duckdb-fixtures]: ../../test/data-query/evidence/duckdb-fixtures.test.ts
[release-tests]: ../../test/release-tooling/stable-notes.test.ts
[xlsx-tests]: ../../test/data-sources/adapters/xlsx-sources.test.ts
[rename-file]: ../../test/rename/actions/file-core.test.ts
[rename-recursion]: ../../test/rename/actions/batch-recursion.test.ts
[rename-preview]: ../../test/rename/actions/batch-preview.test.ts
[rename-collision]: ../../test/rename/planner/collision-and-source-lifecycle.test.ts
[bundle-tests]: ../../test/markdown-pdf/actions/bundle-integration.test.ts
[doctor-routing]: ../../test/doctor/commands/routing.test.ts
[workflows]: ../../.github/workflows
[bun-discovery]: https://bun.com/docs/test/discovery
[bun-reporters]: https://bun.com/docs/test/reporters
