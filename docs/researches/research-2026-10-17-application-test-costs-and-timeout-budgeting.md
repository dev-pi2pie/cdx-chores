---
title: "Application Test Costs and Timeout Budgeting"
created-date: 2026-10-17
modified-date: 2026-10-18
status: completed
agent: codex
---

## Goal and Review Boundary

The five application-test cost reductions are accepted with preserved assertion ownership, bounded process handling, verified cleanup, and measured complete-family savings. Three final normal application runs support retaining the 300-second test-process allowance: the median was 201.618 seconds and the slowest run left 98.152 seconds of headroom. These are local observations, not CI or cross-machine timing guarantees.

This completed research preserves the historical baseline, accepted decisions, and coverage tradeoffs. The [completed implementation plan](../plans/plan-2026-10-18-application-test-costs-and-timeout-budgeting.md) owns the phase checklist; the [completed unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md) owns commands, measurements, failures, and reviews. All eight phases are complete, including documentation validation and range review.

Scope covers the managed application suite, selected expensive test families, and their relationship to direct tests. The existing suite command model and behavior-based ownership remain the starting point. Runtime alone does not establish that a test is unnecessary or duplicated.[^testing-guide][^overlap-research]

## Measured Baseline

The reviewed checkout was `2c04ee3f0b17cc7a5925df6a80d83cf8713ba27d`. Measurements were collected on 2026-10-17 before the optimizations, using the declared application prerequisites. They are local observations, not CI timing guarantees or a statistical runtime distribution.

| Observation                                                            | Result                                                                                                       | Interpretation                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Normal `bun run test:integration:app`                                  | 2,330 passed, one failed; 240.34 seconds                                                                     | The runner sent SIGTERM at 240.016 seconds. The guided frames workflow was interrupted after about 528 ms.                               |
| Interrupted workflow run alone                                         | One passed in 5.29 seconds                                                                                   | The workflow did not reproduce a standalone failure. Its own fixture limit is 30 seconds and its outer test limit is 35 seconds.         |
| Managed diagnostic run with a temporary 360-second execution allowance | 2,331 passed across 299 files; 14,447 assertions; zero failures, errors, or skips                            | Bun reported 242.434957 seconds; the owned test process reported 242.469 seconds. Report validation, fixture checks, and cleanup passed. |
| Earlier migration verification                                         | A timeout at 240 seconds, followed by a passing diagnostic run in 233.7 seconds using a 300-second allowance | Independently recorded in the XML migration job; the checked-in suite policy remained unchanged.[^xml-job]                               |

The diagnostic used the existing `RunnerOptions.dependencies.execute` hook to change only the test-process execution allowance. Preflight, selection, isolated environments, reports, process observation, fixture checks, and cleanup continued through the managed runner. The retained JUnit report and summary were inspected for this research; temporary result directories are not durable documentation dependencies.[^runner]

The diagnostic can be reproduced from the repository root, with the declared application prerequisites installed:

```sh
bun --eval '
import { runManagedTests } from "./scripts/testing/orchestration/runner.ts";
import { startOwnedProcess } from "./scripts/testing/execution/process.ts";
const result = await runManagedTests(process.cwd(), ["app", "--keep-results"], {
  dependencies: {
    execute: (options) => startOwnedProcess({ ...options, timeoutMs: 360000 }).completion,
  },
});
process.exitCode = result.exitCode;
'
```

This is a diagnostic use of an internal hook, not a proposed contributor command or public timeout option. No before/after dependency benchmark was performed, so these observations do not attribute the suite cost to XML validator migration.

### Slowest Test Files

Durations below sum JUnit testcase durations within each file. They exclude some module loading and hook/setup costs and must not be added to the suite wall time. A single reported testcase can execute many internal scenarios.

| File under `test/`                                 | Reported cases | Summed duration |
| -------------------------------------------------- | -------------: | --------------: |
| `video/interactive/frames-menus.app.test.ts`       |             13 |         24.588s |
| `document-rename/adapters/docx-review.app.test.ts` |              1 |         23.990s |
| `codex-info/transport.app.test.ts`                 |             30 |          9.521s |
| `video/frames/export.app.test.ts`                  |             18 |          9.004s |
| `document-rename/docx-runtime.app.test.ts`         |              1 |          8.840s |
| `test-runner/runner-entry-output.app.test.ts`      |              3 |          8.477s |
| `video/frames/sequence.app.test.ts`                |             14 |          7.992s |
| `video/frames/action.app.test.ts`                  |              1 |          6.477s |
| `video/interactive/frames-controller.app.test.ts`  |             16 |          6.099s |
| `test-runner/process.app.test.ts`                  |             20 |          5.787s |

The interrupted guided frames workflow completed in 5.461 seconds in the successful full diagnostic run. Its position late in the suite exposed the aggregate deadline; this does not establish that it is the cause of excessive runtime.

## Agreed Directions and Coverage Tradeoffs

### CLI Registration and Option Matrices

Before Phase 2, the Codex execution scope matrix launched 25 CLI subprocesses to check nine adopted commands, eleven excluded commands, and five rejected invocations. The earlier exploratory measurement was 4.221 seconds; the Phase 2 comparison uses a separately collected three-run baseline, reported below. Each launch reloads the CLI even when the assertion concerns registration or option scope. The helper runs Bun against `src/bin.ts`; these checks cover the source entrypoint, not the packaged Node executable.[^cli-scope][^cli-helper]

Accepted implementation: all 25 scenarios run in-process using fresh Commander programs and captured runtimes. They call the real `registerCliCommands`, parse the original arguments, capture stdout/stderr, recognize the expected help/error outcome, and preserve every command and flag assertion. Rejected invocations report the expected unknown-option error with zero action entries; a test-only pre-action guard throws before real action work if parsing unexpectedly accepts an invocation.[^command-harness]

Four subprocess checks remain alongside the complete in-process matrix:

| Invocation | Retained responsibility |
| ---------- | ----------------------- |
| Root help | Startup, successful process exit, stdout routing, and exclusion of command-local flags |
| One deeply nested adopted command's help | Nested entrypoint dispatch and visibility of the adopted flags |
| A root-level rejected flag | Real failure exit and stderr routing |
| A rejected flag on an excluded leaf command | Entrypoint rejection before filesystem or action work |

Coverage tradeoff: in-process parsing cannot establish actual startup or process exit behavior, so the retained subprocess checks own those responsibilities. Fresh programs prevent parser state from leaking between scenarios. Phase 2 of the implementation plan names the four invocations and maps the existing assertions to their retained owners. This direction reduces matrix subprocess launches from 25 to four without dropping any registration scenario. Phase 2 focused measurements reduced the median complete-file invocation from 4.007 to 0.833 seconds, including all replacement coverage. The 3.174-second saving is local evidence supported by passing managed validation and implementation commit-range review; Phase 2 is accepted. Measurements and commands are in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-2-cli-registration-matrix).

### Streaming Cancellation Grace

In the earlier exploratory measurement, the streaming-process cancellation and input-cancellation cases each took about 2.07 seconds. Both originally instantiated `ProcessOperation` with its two-second default grace and explicitly asserted elapsed time of at least 1,900 ms. The constructor already accepts `graceMs` and `forceMs`, and direct ownership tests use shorter values.[^streaming-fixture][^streaming-runtime][^ownership-tests]

Accepted implementation: the two-child `cancel` scenario retains the production two-second default. It waits for both cooperative and resistant children to report readiness and verifies sent signals and each child's closure. Only `input-cancel` uses a shorter fixture-specific grace.

The accepted `input-cancel` grace is 250 ms. Its complete readiness marker and outstanding write establish cancellation during input production. Assertions cover input abortion and writer settlement, `SIGTERM` followed by `SIGKILL` for the resistant child, actual closure, and disposal. Grace-relative timing and lifecycle assertions replace the fixed 1,900 ms floor. A local observer wraps the existing real-spawn injection; signal attempts alone do not establish shutdown.

Keep production defaults, `forceMs`, and outer fixture timeout and cleanup limits unchanged. `forceMs` bounds settlement after escalation; shortening it offers no normal-path saving and would reduce scheduling headroom. Existing direct ownership tests continue to cover unconfirmed closure and unsettled consumers or input.[^ownership-tests]

Coverage tradeoff: a shorter grace must still allow the real Node child to handle graceful termination before escalation. The accepted fixture value passed comparable repeated runs and verification of signal order, settlement, and cleanup. Phase 3 focused measurements using 250 ms reduced the median complete-file invocation from 4.890 to 3.153 seconds, including the stronger lifecycle observations and cleanup. The 1.737-second saving is local evidence supported by passing managed validation and implementation commit-range review; Phase 3 is accepted. The [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-3-cancellation-grace) retains all samples and validation results. The default-grace scenario remains deliberately slower to retain real default-policy coverage.

### DOCX Review Corpus Across Direct and Compiled Tests

The compiled DOCX review test preserves all 302 inputs across nine groups: general review, drawings, fallback, XML, ampersands, ampersand classification, fields, hyperlinks, and relationships. Every case retains reader, evidence, and prompt assertions through direct compiled Node parsing; 39 named cases additionally exercise the production supervisor and observation parity. Content and drawing unit tests retain their additional semantics, including field classification.[^docx-review][^docx-direct]

Before Phase 4, the fixture built once and batched the nine groups, but every document crossed the production supervisor's child-and-worker boundary. The accepted reduction removes repeated isolation from the complete semantic corpus while retaining it for the selected boundary matrix; the isolated contribution of each runtime layer was not separately measured.[^docx-product][^docx-runtime]

Accepted implementation: the complete corpus reads generated DOCX bytes with compiled `readDocxDocument`, passes the actual result through the existing reader injection in `createDocxEvidenceExtractor`, and builds the prompt from that evidence. Both direct and supervised paths return the same reader/evidence/prompt observation shape. The injected reader never substitutes expected facts for parsing. All 302 cases continue to run under compiled Node; production behavior is unchanged.[^docx-extractor][^docx-product]

Retain exact reader diagnostics or successful raw text and headings, complete evidence objects, complete successful prompts, and exact failure reasons with null prompts. Evidence comparisons retain title ordering, warnings, metadata, and optional-field omission. Preserve case identity, uniqueness, and one observation per input. Existing direct reader tests keep their additional assertions, including field classification and content presence.[^docx-review][^docx-direct]

The 39 supervised representatives are selected by named case ID and boundary responsibility:

| Retained boundary | Representative coverage |
| ----------------- | ----------------------- |
| Successful extraction and serialization | Ordered headings, differing raw text and title text, Unicode, and escaped characters |
| Reader failure propagation | Distinct diagnostic classes, including malformed XML and missing relationships |
| Evidence classification | Successful reading with no title signal versus actual reader failure |
| Package interpretation | Non-default relationship paths, namespace variations, drawings, and fallback behavior |
| Runtime operation | Fixed asset loading, sequential recovery, process settlement, and cleanup |

The plan maps each responsibility to retained coverage, including existing suites. Distinct runtime-sensitive paths remain represented even when their outward reason is identical. The frozen baseline, contract, and runtime suites remain intact; they retain independent compatibility expectations and coverage of metadata, protocol, resource limits, cancellation, and cleanup. Cases whose purpose requires containment remain supervised.[^docx-baselines][^docx-runtime-tests]

Prompt expectations have two distinct owners. The review corpus compares the compiled prompt with the source `buildDocumentPrompt` applied to expected evidence, checking compiled/source agreement and evidence delivery. This cannot independently detect a formatting defect shared by both builders. The frozen baseline and contract suites compare against stored prompt text and retain that independent expectation. Preserve both forms of coverage; do not replace complete comparisons with substring checks or generate new expected snapshots from current output.[^docx-review][^docx-baselines]

Coverage tradeoff: exhaustive parsing, evidence, prompt, and compiled Node coverage remain, while exhaustive execution of every semantic variation under worker isolation, runtime guards, and protocol conversion is reduced. The named supervised matrix supports that reduction. The outer driver remains owned, bounded, and sequential, with the existing batch-size and output limits. Worker reuse, shared build caching, and concurrency were excluded. Acceptance included comparable measurements of both paths, observation parity, corpus completeness, settlement, and fixture cleanup. Phase 4 has verified complete direct coverage, the 39-case supervised parity matrix, the explicit launch reserve, and settlement before removal under a controlled timeout. Three before/after whole-file runs reduced the median from 23.318 to 5.314 seconds, including setup and the permanent timeout regression. Managed validation and implementation commit-range review also passed; Phase 4 is accepted. The [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-4-docx-review-corpus) retains all samples and coverage evidence. The earlier single test's observed 24–25-second runtime against its 30-second limit remains historical motivation.

### Video Menu Escape Handling

Before Phase 5, the video menu driver repeatedly wrote raw bare Escape bytes while checking backtracking, drafts, settings, and cleanup in both editor modes. Inspection of Node.js `26.5.0`'s bundled `internal/readline/emitKeypressEvents` found a default 500 ms Escape decoding timeout; the application parser has its separate 120 ms Escape-abort delay. This version-specific inspection explained the initial cost estimate. The accepted navigation driver now emits decoded Escape explicitly at repeated backtracking steps, while focused raw-byte cases retain decoding coverage.[^frame-menus][^frame-menu-driver][^menu-prompt][^key-parser]

Accepted implementation: decoded Escape is limited to explicit navigation steps; ordinary typing, arrows, Backspace, and Enter remain real bytes. The local helper waits for new prompt output and queued initialization, verifies active input ownership, emits the normal `keypress` event on the same stream, and waits for the next prompt. It does not intercept arbitrary byte writes, abort the controller, resolve the prompt, or modify navigation state.

Retain the complete navigation scenarios and assertions through the real Inquirer and inline editors, including exact backtracking destinations, retained drafts, validation, selection, settings, returned values, and teardown in both simple and advanced modes. The application's 120 ms Escape-abort delay remains unchanged. This direction bypasses Node's bare-Escape decoding wait only where the assertion concerns navigation after decoding.[^frame-menu-driver][^menu-prompt][^key-parser]

The retained raw-byte matrix runs under Node with production decoder defaults:[^frame-menu-bytes]

| Input boundary | Required raw-byte coverage |
| -------------- | -------------------------- |
| Inquirer selection menu | Bare Escape returns the expected Back value |
| Simple text input | Escape cancels editing and preserves the draft |
| Advanced inline text editor | Escape releases the editor and restores the parent menu |
| Advanced inline path editor | Escape preserves the literal path and releases input ownership |
| Menu/editor transitions | The same streams remain usable when input ownership changes |

The raw-byte cases verify complete and fragmented arrow sequences, with fragments written across event-loop turns. They assert menu movement, simple-input caret effects, and actual advanced inline/path completion behavior without unintended Back transitions. Existing parser tests retain synthetic key-event coverage; the byte cases establish Node decoding behavior. Assertions use bounded deadlines without requiring completion at exactly 500 or 620 ms.[^key-parser-tests]

Keep raw-mode, application `keypress` listener, and resize-listener checks throughout the navigation matrix. In selected ownership cases, allow queued initialization and cleanup effects to run after settlement and check again for late listener attachment. Start another prompt on the same streams and verify ordinary typing and selection, and verify that one Escape causes one intended transition without a stale abort affecting the next prompt. Keep the existing immediate, setup-time, and pre-aborted cancellation regressions unchanged. Parser timing tests retain their separate checks for bare-Escape abortion and disposal of a pending abort timer. Cleanup assertions target application-owned resources; they must not assume Node's reusable decoder leaves the stream with no listeners of any kind.[^prompt-cancellation][^key-parser-tests]

Coverage tradeoff: decoded Escape does not exercise raw-byte decoding or its timing in every navigation permutation. The retained matrix covers the named input owners and transitions, and representative raw/decoded comparisons passed before navigation conversion. This explicit bypass preserves decoder timing for the byte cases; product configuration, production prompt behavior, and the application Escape delay remain unchanged. Fixture enclosing-test headroom and uncertain-settlement retention were strengthened as recorded in the plan. The initial estimate was roughly 500 ms per converted bare-Escape step, less replacement coverage cost. Phase 5's three before/after complete-family measurements reduced the median from 24.528 to 13.869 seconds, including six raw-byte cases, four permanent parity cases, per-scenario compilation, and cleanup. The raw cases verify simple-input caret effects and actual advanced inline completion behavior. The 10.659-second local saving and coverage mapping are recorded in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-5-video-menu-escape-handling); retained-family validation, managed validation, and implementation commit-range review also passed. Phase 5 is accepted.

### Managed Runner Blocked Output

The historical baseline had two runner-entry tests that paused real stderr, produced 4 MiB of output, and waited for the production four-second output-stall handling. They took about 4.15 seconds each. Default and retained-result modes shared the same entrypoint-exit check but asserted different cleanup and persistence outcomes. Faster output-delivery, runner-output, and finalization tests already cover related behavior with controlled streams and shorter allowances.[^runner-entry][^output-runtime][^output-tests]

Accepted implementation: the `--keep-results` real-entry stalled-output case remains, alongside four controlled cases covering stdout/stderr and default/retained modes. The default-mode real-entry duplicate was removed only after replacement coverage passed. The retained real-entry case exercises persistence before actual entrypoint shutdown.

Keep the real test's launch of `scripts/testing/run.ts`, paused parent-side stderr reading, 4 MiB producer output, production four-second output limits, and bounded outer process supervision. Require exit code `1`, confirmed settlement, and `reason === "exit-failed"`; an outer timeout or supervisor kill must fail the test. Leave stderr paused until the child exits so draining cannot rescue a hung command. Preserve failed-summary, retained-path, scratch-removal, and process-settlement assertions. This case protects the entrypoint's explicit `process.exit(1)` after finalization and bounded fallback on output failure, which an in-process test cannot prove.[^runner-entry][^runner-entrypoint]

The controlled matrix covers both fallback directions: a stdout stall reports through healthy stderr, and a stderr stall reports through healthy stdout. Each case allows initial status delivery, sends a small execution marker to the selected destination, and withholds its callback. Assertions require that channel's `destination stalled` diagnostic and reject EPIPE, byte overflow, final-drain timeout, or fallback timeout as substitutes. The fixture uses 50 ms stall and 100 ms drain allowances; production defaults remain unchanged.[^output-tests][^output-runtime]

All four cases assert failed invocation and affected-leaf state, `outputFailed`, delivery diagnostics, opposite-channel fallback, and no later suite scheduling. They preserve these retention outcomes:

| Default mode | Retained mode |
| ------------ | ------------- |
| Entire allocated run removed | Results and readable summary retained |
| No retained-results path | Correct retained-results path reported |
| No remaining-owned-path warning | Scratch removed and no remaining-owned-path warning |
| No-results-retained message reported | Stored invocation and affected leaf marked failed |
| Failure reporting does not recreate the run | Delivery failure and stopped-process records persisted |

Filesystem outcomes are asserted before fixture-helper cleanup, and withheld callbacks are released in `finally`. The fast harness injects completed process results and uses real run allocation and finalization; it proves retention behavior given confirmed settlement, not actual process termination. The retained real-entry case owns that latter proof.[^runner-support]

Phase 6 implementation preserved the real retained-mode case and verified the controlled matrix before removing the default real-entry duplicate. Three before/after complete-family runs reduced the median from 9.167 to 5.207 seconds, including all replacement cases and cleanup. The 3.960-second local saving, exact assertion mapping, and fixture-retention guard are recorded in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-6-managed-runner-blocked-output). Managed validation and implementation commit-range review also passed. Phase 6 is accepted.

Keep the existing late-summary failure tests separate: a leaf may legitimately remain `passed` while the invocation becomes `failed` when delivery fails after execution and finalization. Also retain the SIGINT entrypoint case, fallback-failure tests, and finalization ownership and recovery tests.[^runner-entry][^output-tests]

Coverage tradeoff: both retention modes continue to exercise execution-time output-stall cleanup, while only retained mode keeps the real blocked-pipe entrypoint check. The replacement matrix passed before the default real-entry case was removed, and complete-family measurements verified the saving. The initial estimate was roughly four seconds minus replacement-test cost; the observed local median saving is 3.960 seconds. Normal managed validation and implementation commit-range review passed. Production stall/drain limits and outer process limits remain unchanged.

### Lower-Priority or Unsupported Changes

Three in-memory build samples per selected video driver measured approximately 0.5–5 ms per build. This small local experiment excluded file writing and process launch; it does not support adding a shared build cache or more fixture-lifecycle machinery as a priority.

No reviewed failure case has yet been shown unnecessary solely from its duration. Discovery transport, archive/process boundaries, and export failure scenarios protect distinct contracts. Smaller synthetic inputs, blanket assertion deletion, removing all layered overlap, or broad concurrent execution are not supported by the collected evidence. Moving tests between suites alone would redistribute time rather than reduce aggregate work.

## Timeout Budget Direction and Reassessment

At the historical baseline, the application execution allowance was 240 seconds and its comment cited a roughly 120-second earlier selection. Successful full runs at 233.7 and 242.43 seconds and repeated normal-workflow timeouts showed that the old headroom rationale no longer described this workload. Phase 1 changed the allowance to 300 seconds and updated that rationale. The normal managed command passed with unchanged coverage counts and verified cleanup; the refreshed baseline and all invocation outcomes are recorded in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md).[^suite-policy][^xml-job]

The initial decision was to adopt **300 seconds as the application execution allowance**, independently of the cost reductions, with reassessment at the final validation checkpoint. This gives approximately 57.5 seconds, or 24%, above the historical successful 242.47-second process runtime. The previous deadline interrupted otherwise successful work, so adoption need not wait for optimization savings. The 360-second diagnostic ceiling was used to collect complete evidence, not selected as the policy. Phase 1 implemented the 300-second direction, and Phases 2–6 verified their individual family savings. Phase 7 completed three fresh normal application observations, retained the 300-second allowance, and passed full phase commit-range review.

Acceptance requires the normal `bun run test:integration:app` command to pass with the checked-in 300-second policy, without the diagnostic execution override, and complete report validation, process settlement, fixture checks, and cleanup. A diagnostic override is not normal-command verification.

The allowance covers test-process execution, not the entire command. Preflight, output delivery, validation, and finalization add time and retain their separate responsibilities. Keep preflight, per-test/fixture limits, graceful termination, cleanup budgets, and the one-attempt-per-suite policy unchanged unless separate evidence justifies a change. The owned-process cleanup budget already includes graceful termination, escalation, and verification; do not count it as grace plus another full cleanup allowance.[^suite-policy][^owned-process]

### Measurement Checkpoint

1. Establish a normal-command baseline under the checked-in 300-second policy before the cost reductions.
2. Measure each changed test family before and after under comparable conditions.
3. After all accepted optimizations, collect three separate full managed-suite runs: the first after normal build/setup, followed by two repeat runs.

These are deliberate measurement invocations, each with one suite attempt, not retries until green. Three runs provide a practical initial check rather than a percentile estimate. Use test-process elapsed time as the primary budget measurement and record whole-command duration separately. Record revision, comparable measurement conditions, run order, every failure and timeout, coverage mapping, report validity, process settlement, and cleanup outcomes. Include specific runtime or environment details only when necessary to explain a result or limitation. Counts may change when scenarios become separate tests; retained assertion ownership matters more than identical totals.

Use the median successful runtime to describe typical cost and the slowest successful runtime to discuss observed headroom. Keep failed and timed-out attempts visible alongside those statistics. A timeout shows that execution did not complete within the allowance; it is not a successful timing sample or grounds to discard that attempt. If the checkpoint has failures, diagnose and resolve them before claiming validation; retain the failed outcomes when collecting follow-up evidence.

### Optimization Acceptance

Accept each optimization only after demonstrating preserved assertion ownership, stable lifecycle behavior, and a measured cost reduction under comparable conditions. Include retained or added replacement coverage in the measured cost; do not report only the faster portion of a changed test family. The estimated savings in this research are hypotheses, not mandatory numeric targets.

If an apparent saving is indistinguishable from ordinary runtime variation, investigate with additional focused measurements or defer the change rather than declare success. Revert or defer complexity that has no demonstrated cost benefit; any independent reason to retain it requires a separate explicit decision. One deferred optimization must not block validated improvements or the independently justified timeout allowance. Report the disposition and evidence for each family before the final suite reassessment.

### Reassessment Criteria

| Post-optimization evidence | Decision |
| -------------------------- | -------- |
| Successful runs comfortably below 240 seconds | Keep 300 seconds; recovered headroom accommodates ordinary variation |
| Repeated successful runs above 240 seconds | Review where time is spent because less than a minute of headroom remains |
| Any 300-second timeout | Classify the cause before considering an increase |
| Sustained results at or below roughly 180 seconds | Consider 240 seconds in a separate decision, preserving about a minute of headroom |

Phase 7 measured three fresh normal application invocations on one unchanged implementation after build/setup. Test-process times were 201.848, 193.826, and 201.618 seconds (median 201.618; range 193.826–201.848), while whole-command times were 203.288, 194.671, and 202.862 seconds (median 202.862). All three passed with matching counts, verified process settlement, reports, fixture outputs, and default cleanup. Retain 300 seconds: the slowest observation leaves 98.152 seconds of headroom, all observations are below 240 seconds, and none reaches the roughly 180-second lower-budget review threshold. The [unified Phase 7 record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-7-final-validation-and-timeout-reassessment) owns the count ledger, single-baseline comparison, validation details, limitations, and passed phase commit-range review. Phase 7 is accepted.

These are review criteria, not statistical guarantees or automatic failure gates. Do not automatically lower the timeout when optimizations succeed: savings improve ordinary feedback speed while a finite allowance tolerates variation. A lower limit should meaningfully improve hang detection without restoring fragility. Do not automatically raise it after a timeout either. Distinguish aggregate workload growth from a stuck fixture, output stall, prerequisite failure, or unresolved process ownership. A larger suite allowance does not repair those failures or replace the DOCX observation driver's separate 30-second execution limit and 45-second enclosing-test budget; teardown has its own 15-second limit.

The initial conclusion remains scoped to the measured environment. The checked-in GitHub workflows do not currently invoke the managed application suite, so they provide no application-suite CI timing evidence for this decision. Future CI measurements, materially slower-machine observations, repeated runs above the review threshold, or any suite timeout should prompt reassessment. Local observations do not establish cross-machine reliability.[^workflows]

## Planning Handoff

The [implementation plan](../plans/plan-2026-10-18-application-test-costs-and-timeout-budgeting.md) owns the concrete test selections, assertion mappings, phase tasks, and acceptance gates. It sequences independent budget adoption and baseline collection, five separately validated optimization phases, final three-run reassessment, and a final documentation-validation phase. This research remains the rationale and historical evidence source.

The [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md) captures implementation changes, validation results, measurements, failures, deferrals, and phase-gate decisions across all eight phases. The plan tracks tasks and acceptance; that single record owns execution history. It was opened for authorized Phase 1 implementation, not for drafting or reviewing these documents.

The plan and unified record map each accepted optimization to retained assertion owners and complete-family measurements. Phase 1 established the normal-command baseline; Phases 2–6 passed coverage, savings, managed validation, and implementation reviews. Phase 7 reconciled all count changes, passed static/build/unit checks and three fresh application runs, retained 300 seconds, and passed full range review. No optimization was deferred, and no unresolved Stop condition remains.

Phase 8 verified the current guide/catalog boundaries, reciprocal links, evidence, and lifecycle states, and passed full range review. The plan, research, and unified record are completed and remain useful current references at their existing paths. No documents were archived.[^testing-guide][^test-catalog][^test-paths]

## Related Plans

- [Application test cost reduction and timeout budget implementation plan](../plans/plan-2026-10-18-application-test-costs-and-timeout-budgeting.md): completed phases, concrete coverage mappings, acceptance checks, and final documentation validation; all eight phases complete.

## Related Research

- [Test suite contract, overlap, and catalog review](research-2026-08-23-test-suite-contract-overlap-and-catalog.md): behavioral value and distinct coverage boundaries.
- [Test suite responsibilities and verification lifecycle](research-2026-09-05-multi-test-commands.md): suite selection, ownership, and managed verification.
- [XML validator migration](research-2026-10-17-xml-validator-migration.md): the migration whose verification exposed the timeout; its completed scope remains separate.

## References

[^testing-guide]: [Testing guide](../guides/testing.md).

[^test-catalog]: [Test suite ownership catalog](../references/test-suite-case-matrices.md).

[^test-paths]: [Test catalog path correspondence](../references/test-catalog-path-correspondence.md).

[^overlap-research]: [Overlap review contract](research-2026-08-23-test-suite-contract-overlap-and-catalog.md#review-contract).

[^xml-job]: [XML migration behavior verification](../plans/jobs/2026-10-17-xml-validator-migration.md#phase-2-behavior-verification).

[^runner]: [Managed runner and dependency hooks](../../scripts/testing/orchestration/runner.ts).

[^cli-scope]: [Codex execution scope matrix](../../test/cli-foundations/options/codex-execution-scope.app.test.ts).

[^cli-helper]: [CLI subprocess helper and captured runtime](../../test/helpers/cli-test-utils.ts).

[^command-harness]: [In-process command harness](../../test/codex-info/commands.app.test.ts).

[^streaming-fixture]: [Streaming process scenarios](../../test/cli-foundations/process/fixtures/driver.ts).

[^streaming-runtime]: [Process operation and configurable shutdown limits](../../src/cli/process/streaming.ts).

[^ownership-tests]: [Direct process ownership tests](../../test/cli-foundations/process/ownership.unit.test.ts).

[^docx-review]: [Compiled DOCX review corpus](../../test/document-rename/adapters/docx-review.app.test.ts).

[^docx-direct]: [Direct content coverage](../../test/document-rename/docx-content.unit.test.ts) and [drawing/fallback coverage](../../test/document-rename/docx-drawing.unit.test.ts).

[^docx-product]: [Compiled fixture setup and observation](../../test/document-rename/fixtures/docx-product/build.ts) and [Node observation driver](../../test/document-rename/fixtures/docx-product/driver.ts).

[^docx-extractor]: [DOCX evidence extractor and reader injection](../../src/adapters/codex/document-rename/extractors/docx.ts).

[^docx-runtime]: [Production DOCX supervisor](../../src/docx/runtime/index.ts) and [worker parsing and result conversion](../../src/docx/runtime/docx-worker.ts).

[^docx-runtime-tests]: [DOCX runtime boundary coverage](../../test/document-rename/docx-runtime.app.test.ts).

[^docx-baselines]: [Frozen semantic baseline](../../test/document-rename/adapters/docx-baseline.app.test.ts) and [contract coverage](../../test/document-rename/adapters/docx-baseline-contract.app.test.ts).

[^frame-menus]: [Video menu scenario selection](../../test/video/interactive/frames-menus.app.test.ts).

[^frame-menu-driver]: [Video menu navigation and draft-retention driver](../../test/video/interactive/fixtures/frames-menu-navigation.ts) and [input synchronization and cleanup helper](../../test/video/interactive/fixtures/frames-menu-input.ts).

[^frame-menu-bytes]: [Raw-byte and parity tests](../../test/video/interactive/frames-menu-bytes.app.test.ts), [representative byte-input flows](../../test/video/interactive/fixtures/frames-menu-byte-input.ts), and [complete/fragmented arrow checks](../../test/video/interactive/fixtures/frames-menu-arrows.ts).

[^menu-prompt]: [Menu keypress initialization](../../src/cli/interactive/menu-prompt.ts).

[^key-parser]: [Application Escape parser](../../src/cli/tui/keys.ts).

[^key-parser-tests]: [Synthetic key-sequence coverage](../../test/cli-foundations/tui/keys.unit.test.ts) and [Escape timing and disposal coverage](../../test/cli-foundations/tui/keys.app.test.ts).

[^prompt-cancellation]: [Real prompt cancellation and stream reuse](../../test/video/interactive/fixtures/real-prompt-cancellation.ts) and [controller ownership coverage](../../test/video/interactive/frames-controller.app.test.ts).

[^runner-entry]: [Real runner entry output-shutdown tests](../../test/test-runner/runner-entry-output.app.test.ts).

[^runner-entrypoint]: [Managed runner entrypoint and output-failure exit](../../scripts/testing/run.ts).

[^runner-support]: [Managed runner fixture dependencies and cleanup](../../test/test-runner/runner-support.ts).

[^output-runtime]: [Output delivery limits and stall handling](../../scripts/testing/execution/output.ts).

[^output-tests]: [Controlled output delivery](../../test/test-runner/output-delivery.app.test.ts), [runner output failure](../../test/test-runner/runner-output.app.test.ts), and [summary recovery](../../test/test-runner/finalization-delivery.app.test.ts).

[^suite-policy]: [Suite execution budgets and rationale](../../scripts/testing/suites/suite-policy.ts).

[^owned-process]: [Owned-process execution and total termination budgets](../../scripts/testing/execution/process.ts).

[^workflows]: [Checked-in GitHub workflows](../../.github/workflows/).
