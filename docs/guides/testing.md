---
title: "Contributor Testing Guide"
created-date: 2026-09-06
status: completed
agent: codex
---

## Choose a suite

Run commands from the repository root after installing the repository dependencies.
Bun runs the development tests; the CLI and package run on Node.js.

| Command | Use it for |
| --- | --- |
| `bun run test:unit` | In-process logic, transformations, and injected behavior without integration dependencies |
| `bun run test:integration:app` | Application processes, filesystem workflows, native dependencies, and test-runner behavior |
| `bun run test:integration:codex` | Protocol and discovery checks using the repository-installed Codex CLI |
| `bun run test:integration:pandoc` | Conversion and HTML-processing checks using Pandoc |
| `bun run test:all` | All four suites, sequentially in the order above |

These commands use the managed runner for prerequisite checks, process handling,
reports, and cleanup. Each accepts one optional flag, `--keep-results`:

```bash
bun run test:unit
bun run test:all --keep-results
```

Each selected suite checks its prerequisites and runs once, without automatic
retries. Missing prerequisites fail the suite. `test:all` continues after a failed
suite when its processes have stopped and its files can be safely handled.
Cancellation or unresolved process/file ownership stops further scheduling.

## Platform requirements and verification coverage

All suites require Bun, compatible `ps` output, and POSIX process-group access.
The runner checks these capabilities before creating a run directory. Process
observation uses `ps -e` with PID, parent PID, group ID, state, and accounting-name
fields. It uses `/bin/ps`, or `/usr/bin/ps` if the first path is absent, independently
of the caller's `PATH`.

Execution has been verified on macOS. Other platforms are unverified. The required
capabilities must be available to attempt a run; passing the prerequisite checks
does not establish full platform compatibility. The test runner's requirements are
separate from the package's Node.js runtime requirements.

Additional prerequisites depend on the selected suite:

| Suite | Additional prerequisites |
| --- | --- |
| Unit | None |
| Application | Node.js with `node:sqlite`; bash, git, zip, unzip, jq and shell utilities; DuckDB under Bun and Node.js; the matching existing DuckDB `excel` and `sqlite_scanner` extension cache; PDF.js |
| Codex | Node.js and the repository-installed Codex CLI at `node_modules/.bin/codex` |
| Pandoc | Pandoc available on `PATH` |

Node preflight requires Node.js 22.23.0 or later. Keep package dependencies aligned
with the lockfile. The runner checks installed tools and existing native caches;
it does not install tools or download missing DuckDB extensions. Install or repair
a reported prerequisite before retrying. The suite requirements are defined in
[`suite-policy.ts`](../../scripts/testing/suites/suite-policy.ts).

## Environment and isolation

Each managed suite receives its own temporary home, Codex home, Git configuration,
XDG directories, and temporary directories. The runner forwards an explicit
allowlist of environment variables, including `PATH` for declared tools.
Contributor credentials, personal configuration, and loader flags are excluded.

Application preflight validates and copies the required DuckDB cache into the
isolated home. It selects the cache using the installed DuckDB version and runtime
platform identifier. Codex tests use isolated configuration with plugins disabled.

Create any configuration a test needs inside its fixtures. Tests should run
independently of a contributor's signed-in account or shell configuration. For the
product's environment behavior, see [Environment variables](environment-variables.md).

## Progress, results, and cancellation

Test stdout and stderr stream live to their corresponding destinations. Stage
lines show prerequisite checks, execution, result validation, and cleanup. During
quiet periods, an elapsed-time line can appear after 10 seconds with terminal
stdout or 30 seconds with redirected stdout, at a line boundary.

Runner styling follows stdout's terminal state. Set `NO_COLOR` to disable color;
an empty value also disables it. Bun's reporter uses color when both stdout and
stderr are terminals and `NO_COLOR` is absent. Redirecting either stream makes the
reporter plain. `FORCE_COLOR` cannot enable reporter color under these conditions.
See [CLI output and color](cli-output-and-color.md).

Check the command's exit status to determine success. It covers the tests, process
shutdown, retained-output validation, cleanup, and output delivery. The final
summary lists suite outcomes, report counts, prerequisite versions, errors, and
any retained or unresolved paths.

Each run creates a unique directory under `examples/playground/.tmp-tests/`.
After verifying that its processes have stopped and its directories remain owned
by the run, the runner handles files as follows:

| Mode | Files after completion |
| --- | --- |
| Default | Remove scratch space and results, including after test failure |
| `--keep-results` | Remove scratch space; keep reports, `summary.json`, and registered fixture outputs under the reported results path |

Retained results include only reports and designated outputs. Full fixtures and
transcripts of streamed stdout/stderr are excluded. Export manifests identify the
registered files and whether they contain successful results or failure diagnostics.

Use Ctrl-C to cancel. The runner attempts to stop its processes within a bounded
time. If process observation fails or process/directory ownership cannot be
verified, the command fails and reports paths whose cleanup could not be verified.
Before removing leftovers, resolve any live processes and inspect the exact reported
path. Preserve directories belonging to other runs.

If output delivery fails, treat the output as incomplete and check its destination.
The runner limits test output to 8 MiB per suite, queued output to 1 MiB, and stalled
writes/final drainage to four seconds. A broken or blocked output destination fails
the command.

## Focused local testing

For a focused development loop, use Bun to select an exact file:

```bash
bun test ./test/rename/direct/template.unit.test.ts
bun test ./test/markdown-pdf/actions/rendering/pandoc-language.pandoc.test.ts --path-ignore-patterns '**/fixtures/**'
```

Bare `bun test` selects unit files. By default, `bunfig.toml` excludes `.app.test.ts`,
`.codex.test.ts`, `.pandoc.test.ts`, and fixture inputs. The second example replaces
the ignore patterns so Bun can select an integration file while excluding fixtures.

Direct Bun commands do not provide the managed runner's prerequisite checks,
isolated homes, retention, or overall process/directory ownership checks. Individual
fixture helpers enforce their own cleanup rules. After a focused check, run the
affected suite command to verify the managed workflow.

## Add or move tests

Keep tests under their feature or platform owner in `test/`, using one suffix:
`.unit.test.ts`, `.app.test.ts`, `.codex.test.ts`, or `.pandoc.test.ts`. Choose the
suite by the dependencies the test exercises. Pure transformations around Codex
or Pandoc can belong in unit coverage; installed-tool invocations belong in the
corresponding integration suite.

Discovery rejects unknown suffixes, tests outside `test/`, duplicate ownership,
and unsupported symlink entries. Paths inside `fixtures/` are inputs, not suite
members. Keep feature-specific support beside its consumers; reserve
`test/helpers/` for independently reused, feature-neutral infrastructure. Update the
[ownership catalog](../references/test-suite-case-matrices.md) and
[path correspondence](../references/test-catalog-path-correspondence.md) when a
change affects their mappings.

Use `withTempFixtureDir` from
[`cli-test-utils.ts`](../../test/helpers/cli-test-utils.ts), or a feature wrapper,
to manage fixture creation, designated exports, and cleanup. Register individual
result or diagnostic files with `registerFixtureOutput`. Use `startFixtureProcess`
for owned asynchronous or detached subprocesses so the runner can verify their
completion. Reuse the native prerequisite helper for installed-native checks.

Give process work explicit timeouts and shutdown budgets. Missing required tools
must fail integration tests. When parsing a child's stdout as JSON, clear inherited
`FORCE_COLOR` in that child's environment to keep the payload machine-readable.

To audit unit-test isolation, use
[`unit-boundary-preload.ts`](../../test/helpers/unit-boundary-preload.ts), which
detects attempts to use subprocesses, native dependencies, or fetch.

## Source checks and built-package verification

Run the repository quality checks separately from tests:

```bash
bun run lint
bun run format:check
bunx tsc --noEmit
bun run build
```

The formatting command covers the configured source, test, script, and configuration
paths. Review Markdown formatting and links separately.

Source tests execute TypeScript with Bun, including the source CLI helper. Verify
the built package under Node.js separately: after a build, exercise a representative
CLI operation through `bun run cli` and check exported behavior through both
`dist/esm/index.mjs` and `dist/cjs/index.cjs`. Choose operations that exercise the
behavior affected by the change.

Keep manual smoke-test artifacts under `examples/playground/` and clean only the
files created for that check. Record source tests and built-package checks
separately in the relevant implementation record.
