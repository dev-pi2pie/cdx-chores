---
title: "Codex execution configuration implementation"
created-date: 2026-09-05
modified-date: 2026-09-05
status: in-progress
agent: codex
---

## Scope

Execution evidence for the [implementation plan](../plan-2026-09-05-codex-execution-configuration.md).
The starting checkpoint is `1dd5cf74`. Model/provider remain inherited when
omitted, reasoning defaults to `low`, and service tier remains inherited.

## Phase 1: Shared Policy And SDK Mapping

Status: completed. Reviewed range: `1dd5cf74..8eba2cb4`.

- Rechecked SDK `0.153.4` option types and argument serialization against the
  recorded research findings. Model/effort use thread options, provider uses
  constructor configuration, and no service-tier override is required.

- Added shared input validation and immutable resolved settings, reusable
  command options, and SDK factory mappings while retaining existing defaults.
- Focused resolver, real-SDK transport, and existing profile-runner coverage:
  `bun test test/cli-foundations/options/codex-execution.test.ts test/codex-adapters/direct/execution-transport.test.ts test/adapters-codex-markdown-pdf-profile/runner-behavior.test.ts`
  passed: 74 tests, 0 failures.
- `tsc --noEmit`, lint, format check, build, Node ESM/CJS imports, CLI help, and
  `git diff --check` passed. Build retains the existing TypeScript 7 API warning.
- The transport fixture launches an isolated real SDK with a synthetic
  executable and proves argument serialization without provider requests.

The full phase range review found no actionable issues. An independent rerun of
the resolver and transport suites passed 72 tests. Public option adoption starts
in the following phases; no live provider compatibility is claimed.

## Phase 2: Rename Adoption

Status: completed. Reviewed range: `63cba169..c5632f40`.

- Added the three command-local execution options to file/batch rename and the
  compatibility alias, retaining analyzer enable flags and timeout ordering.
- Actions and adapters validate direct inputs before work; image/document
  requests retain normalized settings across batches and retries.
- `bun test test/rename test/codex-adapters/direct test/cli-foundations/options/codex-execution.test.ts`
  passed: 372 tests across 53 files, 0 failures. TypeScript, lint, formatting,
  and diff checks passed.

The complete phase range review found no actionable issues. An independent run
of the three new Phase 2 suites passed 27 tests with no failures.

## Phase 3: Direct Data And Markdown Adoption

Status: completed. Reviewed range: `35f43634..e3c0d4eb`.

### Data Checkpoint

- Query drafting and stack assist forward validated execution settings to
  injected runners and SDK requests. Direct embedded suggestion flags retain
  defaults. Generic request errors are no longer automatically called schema
  errors by stack assist.
- `bun test test/data-query/actions test/data-query/commands test/data-stack/actions test/data-stack/commands test/data-stack/direct test/data-stack/interactive/codex-review.test.ts`
  passed 297 tests across 47 files. After adding another incompatible-effort
  regression, `bun test test/data-stack/actions/execution-policy.test.ts` passed
  all 12 tests. Scoped lint, formatting, and diff checks passed.

### Markdown And Integration Checkpoint

- Added leaf-command execution options and propagated settings through profile,
  template, project, and repair requests. Direct preparation validates before
  input work; settings stay out of prompts and durable outputs.
- Narrowed PDF schema-failure classification to schema-specific evidence.
  Updated existing command/default-runner assertions for the explicit policy.
- `bun test codex` passed 879 tests with 0 failures. The combined four new data
  and Markdown execution-policy suites passed 34 tests; the actual CLI scope
  suite passed 24 tests. Prepared-template lifecycle coverage verifies no extra
  requests or policy serialization when writing/rebinding existing outputs.
- TypeScript, lint, formatting, build, Node ESM/CJS imports, built CLI help, and
  diff checks passed. Build retains the existing TypeScript 7 API warning.

The full phase range review found no actionable issues; an independent focused
rerun passed 43 tests. A supplementary maintainability review found no material
concerns in the data and Markdown integration.

## Phase 4: Interactive Adoption

Status: completed. Reviewed range: `560f621d..dec8fe4f`.

- Explicit Interactive startup accepts execution options and snapshots normalized
  settings beside the independent timeout. Rename, data, and Markdown dispatch
  pass the session policy to every adopted request owner.
- Header/shape suggestions and cleanup analysis receive the policy at injected
  runner and SDK boundaries. Regeneration and repeated Markdown submenu visits
  retain selections; new sessions resolve their own defaults. Consent, manual
  recovery, and prepared-output lifecycles retain their existing behavior.
- `bun test test/rename test/cli-foundations/commands/interactive-timeout.test.ts test/cli-foundations/options/codex-execution-scope.test.ts`
  passed 315 tests across 48 files with no failures.
- `bun test test/data-query/interactive test/data-extract/interactive test/data-stack/interactive test/data-query/header-mapping.test.ts test/data-sources/direct/source-shape.test.ts test/data-query/direct/interactive-execution-validation.test.ts`
  passed 124 tests across 19 files with no failures.
- `bun test test/cli-interactive-markdown-pdf test/markdown-pdf/interactive`
  passed 351 tests. After adding explicit submenu-cycle coverage,
  `bun test test/cli-interactive-markdown-pdf/codex-execution.test.ts` passed all
  four tests. `bun test codex` passed 884 tests across 105 files with no failures.
- TypeScript, lint, formatting, build, Node ESM/CJS imports, built Interactive
  help, and diff checks passed. Build retains the existing TypeScript 7 API
  warning. No live provider requests were used for this evidence.

The full phase range review found no actionable issues; an independent rerun of
seven focused suites passed 43 tests with no failures. Supplementary
maintainability and documentation reviews found no material gaps.

## Discovery Scope Extension

On 2026-09-05, the accepted command direction became `codex-info` with summary,
details, and JSON views plus a `models` child. The research was reopened to record
remaining configuration/default and provider/catalog evidence. Discovery is now
Phase 5; the former validation/documentation closeout is Phase 6. Completed
Phases 1–4 and their reviewed ranges are unchanged.

Documentation review clarified discovery failure handling, report labels,
missing-value semantics, and required protocol evidence. The follow-up review
found no material gaps. Local links, footnotes, code fences, phase numbering,
preservation of completed phase evidence, and `git diff --check` passed.

The follow-up environment clarification assigns dynamic `CODEX_HOME` handling,
discovery/execution consistency, and inspected-home reporting to Phase 5. Phase 6
will add the central `docs/guides/environment-variables.md` guide and discovery
links. A tool-owned configuration file remains future work.

Review clarified invocation-directory scope and effective-home reporting through
`initialize.codexHome`, with real CLI resolution evidence separated from synthetic
environment-forwarding tests. The final documentation review found no material
gaps. Link/structure checks and `git diff --check` passed; completed Phase 1–4
checklists and evidence were verified unchanged.

## Phase 5: Codex Information Discovery

Status: completed. Reviewed range: `0f51ab8d..c84f7fc3`. Implementation resumed
after the provider scope refinement at `ab4e8250`; the original base is retained.

An isolated CLI `0.153.4` probe used two temporary Codex homes with omitted/custom
provider selections, the same synthetic model selection, and no credentials. Initialization, `config/read`, and
`model/list` succeeded in both cases. The custom case reported `probe_proxy` and
its definition ID; the omitted-provider case returned a null selection and no
custom IDs. Both returned the same six visible models and recommendation, with
no next page. Temporary artifacts were removed; no generation was requested.
This observation proves neither complete provider enumeration nor backend model
compatibility. The version-labeled fixtures and their validation are recorded in
the checkpoints below.

The implemented scope includes `codex-info providers` and configured-ID extraction.
Inspected CLI surfaces expose no built-in ID enumeration, so the implementation
reports configured-only coverage. Provider listing
requires configuration/provider sources but not `model/list`; summary/models
retain complete-catalog requirements. Phase 6 will document all three commands.

Documentation review clarified raw-to-report provider mapping, successful
configured-only enumeration, and command-local output flag placement. The final
review found no material gaps; documentation checks passed before implementation
resumed.

### Protocol And Environment Evidence

- Installed CLI `0.153.4` help and generated experimental request schemas expose
  no built-in provider-ID enumeration. `modelProvider/capabilities/read` reports
  three capability booleans, not IDs. Provider coverage is therefore
  `configured-only`; no built-in list is guessed.
- Added an opt-in isolated protocol probe and sanitized version-labeled fixture
  under `test/codex-info/`. The probe performs initialization, configuration reads,
  and paginated model listing without credentials or generation requests.
- `CODEX_HOME` unset or empty selects the isolated default home. Existing relative
  and symlink paths produce canonical absolute homes. A directory named with
  spaces is accepted literally; a missing whitespace-named directory fails.
  Configuration origins distinguish user and trusted project layers.
- `env CDX_CHORES_RUN_CODEX_DISCOVERY_PROBE=1 bun test test/codex-info/live-protocol.test.ts`
  passed: 1 test, 33 assertions. The default suite skips this opt-in probe.
  Its companion fixture records the request parameters, response projections,
  pagination, and home cases; synthetic transport tests remain separate evidence.

### Implementation And Integration Checkpoint

- Evidence checkpoint: `aade3700`. Implementation checkpoint: `f83e32a5`.
  Initial review range: `0f51ab8d..f83e32a5`; review fixes and the expanded final
  range are recorded below.
- Added the owned stdio discovery adapter, SDK-matching executable resolution,
  invocation environment capture, authoritative home metadata, bounded output and
  pagination, and timeout/cancellation cleanup. Existing SDK execution stays intact.
- Added `codex-info`, `codex-info models`, and `codex-info providers`, with curated
  summary/details/JSON views. Provider listing never requests the model catalog;
  configured-only coverage is explicit. Unknown and unrequested metadata remain
  distinct. Root parser behavior is preserved through a default summary leaf.
- `bun test test/codex-info` passed 96 tests with one opt-in probe skipped.
  `bun test codex test/cli-foundations` passed 1,128 tests across 137 files,
  with the same single skip and no failures. Environment parity tests launch the
  real SDK against a synthetic executable and verify forwarding without changing
  the calling process environment or making model requests.
- TypeScript, lint, formatting, build, Node ESM/CJS imports, and diff checks passed.
  Built Node ESM provider/model commands and CJS provider discovery passed using
  isolated homes and loopback-only endpoint configuration. Home/cwd, provider IDs,
  coverage, and requested/unrequested catalog fields matched the contract.
  The build retains only the existing TypeScript 7 API warning.

### Review Fixes And Final Validation

- Review identified terminal-control Unicode escaping missing from JSON output.
  `c84f7fc3` adds a serializer that escapes those characters while retaining the
  exact parsed values, with hostile-metadata regression coverage.
- The same checkpoint adds always-on recorded-fixture CLI replay, configuration
  failure sequencing, cancellation during model pagination with child cleanup,
  and whitespace environment parity. Executable lookup now falls through to the
  existing module-path fallback when package metadata lookup returns no result.
- `bun test test/codex-info` passed 101 tests with the opt-in probe skipped.
  The final `bun test codex test/cli-foundations` run passed 1,133 tests across
  138 files, with one opt-in skip and no failures. TypeScript, lint, formatting,
  build, and final Node ESM/CJS discovery smoke passed. Node smoke used `26.5.0`;
  this is not a claim that every supported Node version was exercised.
- The expanded `0f51ab8d..c84f7fc3` review found no remaining material code,
  security, maintainability, or test-coverage issues. Independent focused reruns
  passed 101 tests with one opt-in skip; security's focused rerun passed 74 tests.
  A further home-field assertion in CLI replay was suggested as optional; those
  fields already have transport/render coverage and final built-Node assertions.

Final documentation review corrected stale gate wording and found no remaining
material gaps. Local links, phase numbering, status/checklist consistency, and
`git diff --check` passed.

Phase 5 is complete. Research conclusions and plan checkboxes reflect the verified
scope. Phase 5.5 is the pending presentation follow-up; Phase 6 remains pending
for final repository validation and public guides.

## Phase 5.5: Codex Information Presentation

Status: in-progress. Review base: `89d948ff`. Added after Phase 5 to make each human command view concise and
adopt the shared terminal styling policy. The research and plan now define
command-specific context, source deduplication, details pruning, and unchanged
JSON/discovery boundaries. No presentation implementation is included in this
planning update. Implementation now proceeds in concision and styling checkpoints.

The preceding read-only review confirmed existing picocolors, `NO_COLOR`, global
`--no-color`, and per-stream TTY handling. The existing color and Codex rendering/
action suites passed 35 tests with no failures. This is baseline evidence;
Phase 5.5 acceptance tests and commit-range review remain pending.

Planning review found no material gaps. Local links and `git diff --check` passed.
The explicit Markdown formatter check reports issues in the plan and research;
both committed baselines report the same file-level failures. Broad reformatting
was left outside this planning update.

### Concision Checkpoint

- Checkpoint commit: `a233dca4`.
- Tailored overview, models, and providers output to their own context; condensed
  source/coverage wording and moved invocation context to the details footer.
  Configured reasoning remains in overview details; child views omit unrelated
  execution settings. Missing optional prose and duplicate model identifiers are
  omitted while unknown capabilities/defaults remain explicit.
- Exact synthetic output examples cover all three commands in default/details
  views. Updated real CLI replay checks preserve scoped provider/catalog output.
- `bun test test/codex-info/render.test.ts test/codex-info/cli-replay.test.ts`
  passed 24 tests, 201 assertions. Report/action/command and shared-color suites
  passed another 73 tests. TypeScript, lint, repository format check, and
  `git diff --check` passed. Styling and final phase review remain pending.

### Styling Checkpoint

- Applied shared per-stream colors to titles, context headings, IDs, and literal
  selection markers. All external strings are escaped before styling; plain
  wording, curated JSON, and discovery behavior are preserved.
- Added all-view/default/details ANSI-stripped equality, independent stream and
  runtime-disable tests, JSON equality, hostile-string regression, and one-call
  action assertions. Isolated real CLI tests verify nonempty/empty `NO_COLOR` and
  global `--no-color` without mutating the test process environment.
- `bun test test/codex-info test/cli-foundations/color` passed 141 tests with
  one existing opt-in live-protocol skip, 846 assertions, and no failures.
  TypeScript, lint, repository format check, build, and diff checks passed.
  Build retains only the existing TypeScript 7 API warning.
- Built Node `26.5.0` ESM/CJS package smoke checked all nine command/format
  combinations with styled and empty-`NO_COLOR` output. Synthetic subprocess
  responses established human ANSI/plain equality and unchanged parsed JSON;
  no provider requests or user configuration were used. Scratch files were removed.
  Full phase review remains pending.

## Phase 6: Validation And Documentation Closeout

Status: pending. Final repository validation and shipped-guide updates remain
owned by this phase, including the central environment-variable guide.
