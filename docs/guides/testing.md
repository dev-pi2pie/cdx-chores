---
title: "Contributor Testing Guide"
created-date: 2026-09-06
status: draft
agent: codex
---

## Choose a suite

Run commands from the repository root after installing the repository dependencies.
Bun runs the development test suite; the published CLI and package target Node.js.

| Command | Use it for |
| --- | --- |
| `bun run test:unit` | In-process logic, transformations, and injected behavior without integration dependencies |
| `bun run test:integration:app` | Application processes, filesystem workflows, installed native dependencies, and test-runner lifecycle contracts |
| `bun run test:integration:codex` | Contracts that execute the installed repository Codex CLI |
| `bun run test:integration:pandoc` | Contracts that execute Pandoc |
| `bun run test:all` | All four suites, sequentially in the order above |

Each command accepts only the optional `--keep-results` flag. There are no public
file-filter, retry, timeout, or output-directory flags. For example:

```bash
bun run test:unit
bun run test:all --keep-results
```

Each selected suite has its own prerequisite check and runs once, without automatic
retries. A missing prerequisite fails that suite rather than skipping its tests.
`test:all` can continue after a failed suite when process shutdown and ownership
remain verified. Cancellation or unverified ownership stops further scheduling.
The invocation succeeds only when every selected suite and finalization succeed.

## Platform requirements and verification coverage

Managed test execution currently requires macOS: preflight explicitly checks the
platform and `/bin/ps`, which the process lifecycle uses for observation. Verification
coverage is currently on macOS; other environments need implementation work and
verification before they can use this runner. This is a current runner limitation,
separate from the published package's Node.js runtime requirements.

All suites require Bun and the process-observation prerequisite. Additional
requirements are:

| Suite | Additional prerequisites |
| --- | --- |
| Unit | None |
| Application | Node.js with `node:sqlite`; bash, git, zip, unzip, jq and macOS shell utilities; DuckDB under Bun and Node.js; the matching existing DuckDB `excel` and `sqlite_scanner` extension cache; PDF.js |
| Codex | Node.js and the repository-installed Codex CLI at `node_modules/.bin/codex` |
| Pandoc | Pandoc available on `PATH` |

Node preflight enforces the repository runtime floor of Node.js 22.23.0. Keep the
installed package dependencies aligned with the lockfile. The runner checks installed
tools and existing native caches; it does not install tools or download missing
DuckDB extensions. Install or repair a reported prerequisite before retrying.
The executable policy lives in
[`suite-policy.ts`](../../scripts/testing/suites/suite-policy.ts).

## Environment and isolation

Each managed suite receives its own temporary home, Codex home, Git configuration,
XDG directories, and temporary directories. The runner forwards an explicit
environment allowlist, not the caller's credentials, personal configuration, or
loader flags. `PATH` is retained for declared tools. Application preflight copies
the required existing DuckDB cache into the isolated home after validating it;
it does not make the caller's home the test home.

The live Codex metadata fixtures disable plugins in every synthetic Codex home
and verify that setting through returned configuration. This keeps unrelated
plugin startup synchronization outside the protocol checks.

Tests that need configuration should construct it in their fixtures. Do not make
tests depend on a contributor's signed-in account or shell environment. For the
product's environment behavior, see
[Environment variables](environment-variables.md).

## Progress, results, and cancellation

Selected test stdout and stderr stream live to their corresponding destinations.
Stage lines identify preflight, test execution, validation, and finalization.
During quiet periods, an elapsed-time line can appear after 10 seconds with terminal
stdout or 30 seconds with redirected stdout, once output is at a line boundary.

Runner styling follows stdout's terminal state. The presence of `NO_COLOR`, even
with an empty value, disables color. Bun's reporter uses color only when both final
destinations are terminals and `NO_COLOR` is absent; mixed redirection produces a
plain reporter. Caller `FORCE_COLOR` does not override this policy. See also
[CLI output and color](cli-output-and-color.md).

The final summary includes suite outcomes, validated report counts, prerequisite
versions, lifecycle errors, and any retained or unresolved paths. A passing test
report alone does not prove a successful invocation: shutdown, export validation,
cleanup, and output delivery must also succeed. Check the command's exit status.

Each invocation allocates a unique directory under
`examples/playground/.tmp-tests/`. With verified ownership and shutdown:

| Mode | Final disposition |
| --- | --- |
| Default | Remove the invocation's scratch space and results, including after test failure |
| `--keep-results` | Remove scratch space; keep reports, `summary.json`, and explicitly designated fixture exports under the reported results path |

Retention does not preserve entire fixtures, raw account state, or a transcript of
streamed stdout/stderr. Export manifests identify designated files and whether the
fixture checks passed or the files are diagnostics after failure. A retained path
is not a success indicator.

Use Ctrl-C to cancel. The runner attempts bounded shutdown before finalization.
If process completion or directory ownership cannot be verified, it fails and
reports remaining paths instead of claiming cleanup succeeded. Resolve any live
processes and inspect the exact reported path before removing leftovers; do not
delete another invocation's directory or clear the shared scratch parent blindly.

If diagnostics report output delivery failure, treat the output as incomplete and
the invocation as failed. Test output is bounded to 8 MiB per suite, pending delivery
to 1 MiB, and stalled writes/final drainage to four seconds. A broken or blocked
consumer can therefore fail an otherwise passing suite.

## Focused local testing

Use the public suite commands for managed verification. For a focused development
loop, raw Bun can select an exact file:

```bash
bun test ./test/rename/direct/template.unit.test.ts
bun test ./test/markdown-pdf/actions/rendering/pandoc-language.pandoc.test.ts --path-ignore-patterns '**/fixtures/**'
```

The second command replaces the default ignore patterns so Bun can select an
integration file while still excluding fixture inputs. Without that replacement,
`bunfig.toml` excludes `.app.test.ts`, `.codex.test.ts`, and `.pandoc.test.ts`.

Raw Bun selection does not supply managed preflight, isolated homes, retention,
or the outer invocation's process and directory ownership checks. Individual
helpers may still enforce their own contracts. Bare `bun test` selects the default
unit files; that selection by itself is not proof that unit code avoids integration
dependencies. The verification-only
[`unit-boundary-preload.ts`](../../test/helpers/unit-boundary-preload.ts) provides
an explicit boundary check when auditing that property.

When a raw test launches a child whose stdout must remain machine-readable, clear
inherited `FORCE_COLOR` in that child's environment before parsing JSON. Managed
reporter color must not leak into protocol payloads.

## Add or move tests

Keep tests under their feature or platform owner in `test/`, using one suffix:
`.unit.test.ts`, `.app.test.ts`, `.codex.test.ts`, or `.pandoc.test.ts`. Classify by
the dependency actually exercised, not by a feature name containing “Codex” or
“Pandoc.” A pure transformation around those features can remain unit coverage;
an installed-tool invocation belongs in its integration suite.

Discovery rejects unknown suffixes, tests outside `test/`, duplicate ownership,
and unsupported symlink entries. Paths inside `fixtures/` are inputs, not suite
members. Keep feature-specific support beside its consumers; reserve
`test/helpers/` for independently reused, feature-neutral contracts. Update the
[ownership catalog](../references/test-suite-case-matrices.md) and
[path correspondence](../references/test-catalog-path-correspondence.md) when a
change affects their current mappings.

Reuse the existing fixture lifecycle, preferably `withTempFixtureDir` from
[`cli-test-utils.ts`](../../test/helpers/cli-test-utils.ts) or a feature wrapper.
It exports designated results before removing the fixture and preserves callback,
export, and cleanup failures. Register individual generated or diagnostic files
with `registerFixtureOutput`; do not retain a whole working directory. Use
`startFixtureProcess` for owned asynchronous or detached fixture subprocesses so
the outer runner can verify their completion. Reuse the installed-native probe
helper where applicable rather than adding import-time prerequisite checks.

Keep explicit timeouts and shutdown budgets for process work. Missing required
tools must fail integration coverage, not turn it into a passing skip. Run the
affected managed suite after the focused development loop.

## Source checks and built-package verification

Run the repository quality checks separately from tests:

```bash
bun run lint
bun run format:check
bunx tsc --noEmit
bun run build
```

The formatting command covers the configured source, test, script, and configuration
paths; review Markdown formatting and links separately.

Source tests execute TypeScript with Bun, including the source CLI helper. They do
not establish that the distributed package runs correctly under Node.js. After a
build, verify a representative CLI operation through `bun run cli` (which launches
Node), and assert representative exported behavior through both
`dist/esm/index.mjs` and `dist/cjs/index.cjs` using Node. Successful imports or
`--help` alone are insufficient when a change affects runtime behavior.

Keep manual smoke-test artifacts under `examples/playground/` and clean only the
files created for that check. Record source tests and built-package checks
separately in the relevant implementation record.
