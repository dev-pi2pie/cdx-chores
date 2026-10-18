---
title: "Application Test Costs and Timeout Budgeting"
created-date: 2026-10-17
modified-date: 2026-10-18
status: in-progress
agent: codex
---

## Goal and Review Boundary

Identify avoidable application-test costs and a reasonable suite timeout while preserving meaningful coverage, fixture ownership, and bounded process shutdown. This research records historical measurements, agreed optimization directions for CLI registration, cancellation grace, the DOCX review corpus, video menu Escape handling, and managed runner blocked output, and the initial timeout allowance with reassessment criteria. The linked implementation plan specifies phases, concrete coverage mappings, and acceptance checks. Phase 1 has implemented and validated the 300-second policy through the normal managed command and passed implementation commit-range review. Phase 2 is complete after coverage, focused timing, managed validation, and implementation commit-range review passed. Phase 3 is complete after coverage, focused timing, managed validation, and implementation commit-range review passed. Phase 4 is complete after coverage, focused timing, managed validation, and implementation commit-range review passed. Phase 5 is underway; Phases 6–8 have not started.

Scope covers the managed application suite, selected expensive test families, and their relationship to direct tests. The existing suite command model and behavior-based ownership remain the starting point. Runtime alone does not establish that a test is unnecessary or duplicated.[^testing-guide][^overlap-research]

## Measured Baseline

The reviewed checkout was `2c04ee3f0b17cc7a5925df6a80d83cf8713ba27d`. Measurements were collected on 2026-10-17 with Bun `1.4.3` and Node.js `26.5.0` on macOS. They are local observations, not CI timing guarantees or a statistical runtime distribution.

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

Agreed direction: preserve all 25 scenarios in-process using the existing Commander harness pattern. Create a fresh program and captured runtime for each scenario, call the real `registerCliCommands`, and parse the same arguments rather than reconstructing registration or only inspecting option objects. Capture stdout and stderr, explicitly recognize Commander's successful help exit, and preserve every command and flag assertion. Rejected invocations must report the expected unknown-option error and never reach action execution; a test-only action-entry guard should fail before real action work if parsing unexpectedly accepts an invocation.[^command-harness]

Retain four representative subprocess checks alongside the complete in-process matrix:

| Invocation | Retained responsibility |
| ---------- | ----------------------- |
| Root help | Startup, successful process exit, stdout routing, and exclusion of command-local flags |
| One deeply nested adopted command's help | Nested entrypoint dispatch and visibility of the adopted flags |
| A root-level rejected flag | Real failure exit and stderr routing |
| A rejected flag on an excluded leaf command | Entrypoint rejection before filesystem or action work |

Coverage tradeoff: in-process parsing cannot establish actual startup or process exit behavior, so the retained subprocess checks own those responsibilities. Fresh programs prevent parser state from leaking between scenarios. Phase 2 of the implementation plan names the four invocations and maps the existing assertions to their retained owners. This direction reduces matrix subprocess launches from 25 to four without dropping any registration scenario. Phase 2 focused measurements reduced the median complete-file invocation from 4.007 to 0.833 seconds, including all replacement coverage. The 3.174-second saving is local evidence supported by passing managed validation and implementation commit-range review; Phase 2 is accepted. Measurements and commands are in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-2-cli-registration-matrix).

### Streaming Cancellation Grace

In the earlier exploratory measurement, the streaming-process cancellation and input-cancellation cases each took about 2.07 seconds. Both originally instantiated `ProcessOperation` with its two-second default grace and explicitly asserted elapsed time of at least 1,900 ms. The constructor already accepts `graceMs` and `forceMs`, and direct ownership tests use shorter values.[^streaming-fixture][^streaming-runtime][^ownership-tests]

Agreed direction: keep the two-child `cancel` scenario on the production two-second default and shorten only the `input-cancel` fixture's grace initially. The former already waits for both cooperative and resistant children to report readiness; preserve that synchronization and default timing coverage while strengthening observations of sent signals and each child's closure.

For `input-cancel`, use approximately 250 ms as an initial fixture-specific grace to evaluate. Recognize a complete readiness marker instead of cancelling on any stdout chunk, and establish that input writing is underway with a pending write before cancellation. Verify input abortion and writer settlement, `SIGTERM` followed by `SIGKILL` for the resistant child, actual child closure, and successful disposal. Replace the fixed 1,900 ms floor with assertions tied to the configured grace and observed lifecycle. The existing `launch` injection can wrap a real spawn to observe signal attempts and closure; signal attempts alone must never establish shutdown.

Keep production defaults, `forceMs`, and outer fixture timeout and cleanup limits unchanged. `forceMs` bounds settlement after escalation; shortening it offers no normal-path saving and would reduce scheduling headroom. Existing direct ownership tests continue to cover unconfirmed closure and unsettled consumers or input.[^ownership-tests]

Coverage tradeoff: a shorter grace must still allow the real Node child to handle graceful termination before escalation. The final fixture value requires comparable repeated runs and verification of signal order, settlement, and cleanup. Phase 3 focused measurements using 250 ms reduced the median complete-file invocation from 4.890 to 3.153 seconds, including the stronger lifecycle observations and cleanup. The 1.737-second saving is local evidence supported by passing managed validation and implementation commit-range review; Phase 3 is accepted. The [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-3-cancellation-grace) retains all samples and validation results. The default-grace scenario remains deliberately slower to retain real default-policy coverage.

### DOCX Review Corpus Across Direct and Compiled Tests

The compiled DOCX review test processes 302 inputs across nine groups: general review, drawings, fallback, XML, ampersands, ampersand classification, fields, hyperlinks, and relationships. It checks reader results, evidence, and prompts through the compiled Node product and its supervised runtime. Those reader cases also have direct coverage in the content and drawing unit tests; fields additionally inspect parsed content classification.[^docx-review][^docx-direct]

The fixture already builds once and batches the nine groups, but each document still crosses the production supervisor's child-and-worker boundary. Repeated isolation is a structural cost-reduction opportunity; its share of the observed runtime has not been measured separately.[^docx-product][^docx-runtime]

Agreed direction: retain all 302 cases and their complete evidence/prompt assertions in the compiled Node driver, while selecting a smaller, explicit matrix for the unchanged production supervisor. For the complete corpus, read the generated DOCX bytes with the real compiled `readDocxDocument`, pass the actual result through the existing reader injection in `createDocxEvidenceExtractor`, and build the prompt from the resulting evidence. Return the same reader/evidence/prompt observation shape for assertion. The injected reader must never substitute expected case facts for actual parsing. This preserves compiled Node execution for every case without changing production behavior or moving the complete corpus into Bun unit tests.[^docx-extractor][^docx-product]

Retain exact reader diagnostics or successful raw text and headings, complete evidence objects, complete successful prompts, and exact failure reasons with null prompts. Evidence comparisons retain title ordering, warnings, metadata, and optional-field omission. Preserve case identity, uniqueness, and one observation per input. Existing direct reader tests keep their additional assertions, including field classification and content presence.[^docx-review][^docx-direct]

Select supervised representatives by named case ID and boundary responsibility, not an arbitrary percentage or the first case in each group:

| Retained boundary | Representative coverage |
| ----------------- | ----------------------- |
| Successful extraction and serialization | Ordered headings, differing raw text and title text, Unicode, and escaped characters |
| Reader failure propagation | Distinct diagnostic classes, including malformed XML and missing relationships |
| Evidence classification | Successful reading with no title signal versus actual reader failure |
| Package interpretation | Non-default relationship paths, namespace variations, drawings, and fallback behavior |
| Runtime operation | Fixed asset loading, sequential recovery, process settlement, and cleanup |

Map each responsibility to retained coverage, including existing suites, before reducing supervised cases. Distinct runtime-sensitive paths remain represented even when their outward reason is identical. The frozen baseline, contract, and runtime suites remain intact; they retain independent compatibility expectations and coverage of metadata, protocol, resource limits, cancellation, and cleanup. Cases whose purpose requires containment remain supervised.[^docx-baselines][^docx-runtime-tests]

Prompt expectations have two distinct owners. The review corpus compares the compiled prompt with the source `buildDocumentPrompt` applied to expected evidence, checking compiled/source agreement and evidence delivery. This cannot independently detect a formatting defect shared by both builders. The frozen baseline and contract suites compare against stored prompt text and retain that independent expectation. Preserve both forms of coverage; do not replace complete comparisons with substring checks or generate new expected snapshots from current output.[^docx-review][^docx-baselines]

Coverage tradeoff: exhaustive parsing, evidence, prompt, and compiled Node coverage remain, while exhaustive execution of every semantic variation under worker isolation, runtime guards, and protocol conversion is reduced. The named supervised matrix must justify that reduction. Keep the outer driver owned, bounded, and sequential, with the existing batch-size and output limits; worker reuse, shared build caching, and concurrency are outside this initial direction. Before acceptance, measure both execution paths under comparable conditions, compare observations for selected supervised cases, and verify corpus completeness, process settlement, and fixture cleanup. Phase 4 has verified complete direct coverage, the 39-case supervised parity matrix, the explicit launch reserve, and settlement before removal under a controlled timeout. Three before/after whole-file runs reduced the median from 23.318 to 5.314 seconds, including setup and the permanent timeout regression. Managed validation and implementation commit-range review also passed; Phase 4 is accepted. The [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-4-docx-review-corpus) retains all samples and coverage evidence. The earlier single test's observed 24–25-second runtime against its 30-second limit remains historical motivation.

### Video Menu Escape Handling

The video menu driver repeatedly writes raw bare Escape bytes while checking backtracking, retained drafts, settings, and cleanup in both simple and advanced editors. Source inspection of Node.js `26.5.0`'s bundled `internal/readline/emitKeypressEvents` found a default 500 ms Escape decoding timeout. The application's key parser adds its own 120 ms Escape-abort delay. These waits contribute to multi-second navigation scenarios; they are not deliberate sleeps in the fixture.[^frame-menus][^frame-menu-driver][^menu-prompt][^key-parser]

Agreed direction: emit decoded Escape events only for repeated navigation-focused steps, while keeping ordinary typing, arrows, Backspace, and Enter as real bytes. An explicit fixture helper should wait for prompt initialization, emit the normal `keypress` event on the existing input stream, and wait for the expected next prompt. Keep decoded Escape and raw-byte operations visibly distinct; do not silently intercept every Escape byte write. The helper must not abort the controller directly, resolve the prompt, or modify navigation state.

Retain the complete navigation scenarios and assertions through the real Inquirer and inline editors, including exact backtracking destinations, retained drafts, validation, selection, settings, returned values, and teardown in both simple and advanced modes. The application's 120 ms Escape-abort delay remains unchanged. This direction bypasses Node's bare-Escape decoding wait only where the assertion concerns navigation after decoding.[^frame-menu-driver][^menu-prompt][^key-parser]

Retain a named raw-byte matrix under Node with production decoder defaults:

| Input boundary | Required raw-byte coverage |
| -------------- | -------------------------- |
| Inquirer selection menu | Bare Escape returns the expected Back value |
| Simple text input | Escape cancels editing and preserves the draft |
| Advanced inline text editor | Escape releases the editor and restores the parent menu |
| Advanced inline path editor | Escape preserves the literal path and releases input ownership |
| Menu/editor transitions | The same streams remain usable when input ownership changes |

Across these cases, preserve complete arrow sequences and add explicit fragmented-byte sequences where existing coverage is insufficient. Write fragments separately across event-loop turns and verify navigation rather than an unintended Back transition. Existing parser tests supply synthetic key events and do not establish Node byte-decoding behavior. Raw-byte tests should assert outcomes under bounded deadlines without requiring completion at exactly 500 or 620 ms.[^key-parser-tests]

Keep raw-mode, application `keypress` listener, and resize-listener checks throughout the navigation matrix. In selected ownership cases, allow queued initialization and cleanup effects to run after settlement and check again for late listener attachment. Start another prompt on the same streams and verify ordinary typing and selection, and verify that one Escape causes one intended transition without a stale abort affecting the next prompt. Keep the existing immediate, setup-time, and pre-aborted cancellation regressions unchanged. Parser timing tests retain their separate checks for bare-Escape abortion and disposal of a pending abort timer. Cleanup assertions target application-owned resources; they must not assume Node's reusable decoder leaves the stream with no listeners of any kind.[^prompt-cancellation][^key-parser-tests]

Coverage tradeoff: decoded Escape does not exercise raw-byte decoding or its timing in every navigation permutation. The retained matrix must cover each distinct input owner and ownership transition before converting the broader navigation scenarios. Prefer this explicit bypass over a fixture-local decoder timeout, which would change the byte-decoding timing under test. Keep product configuration, prompt/runtime limits, and the application Escape delay unchanged. Compare both input methods on representative flows, then measure the affected family and verify cleanup through the managed suite. The initial estimate was roughly 500 ms per converted bare-Escape step, less replacement coverage cost. Phase 5's three before/after complete-family measurements reduced the median from 24.528 to 13.869 seconds, including six raw-byte cases, four permanent parity cases, per-scenario compilation, and cleanup. The raw cases verify simple-input caret effects and actual advanced inline completion behavior. The 10.659-second local saving and coverage mapping are recorded in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-5-video-menu-escape-handling); retained-family and managed validation also passed, while full commit-range review remains pending.

### Managed Runner Blocked Output

Two runner-entry tests pause real stderr, produce 4 MiB of output, and wait for the production four-second output-stall handling. They take about 4.15 seconds each. Default and retained-result modes share the same entrypoint-exit check but assert different cleanup and persistence outcomes. Faster output-delivery, runner-output, and finalization tests already cover related behavior with controlled streams and shorter allowances.[^runner-entry][^output-runtime][^output-tests]

Agreed direction: retain the `--keep-results` real-entry stalled-output case and exercise both default and retained modes through a fast managed-runner stall matrix. Remove the default-mode real-entry stall only after the replacement matrix preserves its cleanup and reporting assertions. The retained real-entry case exercises the more involved persistence path before shutdown.

Keep the real test's launch of `scripts/testing/run.ts`, paused parent-side stderr reading, 4 MiB producer output, production four-second output limits, and bounded outer process supervision. Require exit code `1`, confirmed settlement, and `reason === "exit-failed"`; an outer timeout or supervisor kill must fail the test. Leave stderr paused until the child exits so draining cannot rescue a hung command. Preserve failed-summary, retained-path, scratch-removal, and process-settlement assertions. This case protects the entrypoint's explicit `process.exit(1)` after finalization and bounded fallback on output failure, which an in-process test cannot prove.[^runner-entry][^runner-entrypoint]

Add a controlled-stream default/retained matrix for execution-time stderr failure while preserving the existing stdout-stall case and its stderr fallback. The existing fast stall test blocks stdout; replacing it with stderr-only coverage would lose that full-runner fallback direction. Either retain that case separately or parameterize both output channel and retention mode. For the stderr matrix, allow initial status output to succeed, write a specific execution-progress marker to stderr, and withhold its write callback. Keep stdout healthy for fallback reporting. A small marker establishes outstanding delivery without OS pipe-capacity dependence; an immediate `EPIPE` is not a replacement for this stall. Start with the existing fixture allowances of 50 ms for stall and 100 ms for drain, subject to validation, while retaining production defaults.[^output-tests][^output-runtime]

Both modes must assert failed invocation and affected-leaf state, `outputFailed`, delivery diagnostics, fallback reporting, and no later suite scheduling. Preserve the distinct retention outcomes:

| Default mode | Retained mode |
| ------------ | ------------- |
| Entire allocated run removed | Results and readable summary retained |
| No retained-results path | Correct retained-results path reported |
| No remaining-owned-path warning | Scratch removed and no remaining-owned-path warning |
| No-results-retained message reported | Stored invocation and affected leaf marked failed |
| Failure reporting does not recreate the run | Delivery failure and stopped-process records persisted |

Assert filesystem outcomes before fixture-helper cleanup, so helper cleanup cannot conceal a runner defect. Release the withheld callback during test teardown. The fast harness injects completed process results and uses real run allocation and finalization; it proves retention behavior given confirmed settlement, not actual process termination. The retained real-entry case owns that latter proof.[^runner-support]

Keep the existing late-summary failure tests separate: a leaf may legitimately remain `passed` while the invocation becomes `failed` when delivery fails after execution and finalization. Also retain the SIGINT entrypoint case, fallback-failure tests, and finalization ownership and recovery tests.[^runner-entry][^output-tests]

Coverage tradeoff: both retention modes continue to exercise execution-time output-stall cleanup, while only retained mode keeps the real blocked-pipe entrypoint check. Validate the replacement matrix before removing the default-mode real-entry case, then measure the affected tests and verify the normal managed suite. Removing one real stall could save roughly four seconds minus the replacement-test cost; savings and replacement coverage remain unverified. Production stall/drain limits and outer process limits remain unchanged.

### Lower-Priority or Unsupported Changes

Three in-memory build samples per selected video driver measured approximately 0.5–5 ms per build. This small local experiment excluded file writing and process launch; it does not support adding a shared build cache or more fixture-lifecycle machinery as a priority.

No reviewed failure case has yet been shown unnecessary solely from its duration. Discovery transport, archive/process boundaries, and export failure scenarios protect distinct contracts. Smaller synthetic inputs, blanket assertion deletion, removing all layered overlap, or broad concurrent execution are not supported by the collected evidence. Moving tests between suites alone would redistribute time rather than reduce aggregate work.

## Timeout Budget Direction and Reassessment

At the historical baseline, the application execution allowance was 240 seconds and its comment cited a roughly 120-second earlier selection. Successful full runs at 233.7 and 242.43 seconds and repeated normal-workflow timeouts showed that the old headroom rationale no longer described this workload. Phase 1 changed the allowance to 300 seconds and updated that rationale. The normal managed command passed with unchanged coverage counts and verified cleanup; the refreshed baseline and all invocation outcomes are recorded in the [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md).[^suite-policy][^xml-job]

Agreed direction: adopt **300 seconds as the initial application execution allowance**, independently of the cost reductions, and reassess it at the final optimization validation checkpoint. This gives approximately 57.5 seconds, or 24%, above the historical successful 242.47-second process runtime. The previous deadline interrupted otherwise successful work, so adoption need not wait for optimization savings. The 360-second diagnostic ceiling was used to collect complete evidence, not selected as the policy. Phase 1 implements the 300-second direction; optimization savings and final reassessment remain pending.

Acceptance requires the normal `bun run test:integration:app` command to pass with the checked-in 300-second policy, without the diagnostic execution override, and complete report validation, process settlement, fixture checks, and cleanup. A diagnostic override is not normal-command verification.

The allowance covers test-process execution, not the entire command. Preflight, output delivery, validation, and finalization add time and retain their separate responsibilities. Keep preflight, per-test/fixture limits, graceful termination, cleanup budgets, and the one-attempt-per-suite policy unchanged unless separate evidence justifies a change. The owned-process cleanup budget already includes graceful termination, escalation, and verification; do not count it as grace plus another full cleanup allowance.[^suite-policy][^owned-process]

### Measurement Checkpoint

1. Establish a normal-command baseline under the checked-in 300-second policy before the cost reductions.
2. Measure each changed test family before and after under comparable conditions.
3. After all accepted optimizations, collect three separate full managed-suite runs: the first after normal build/setup, followed by two repeat runs.

These are deliberate measurement invocations, each with one suite attempt, not retries until green. Three runs provide a practical initial check rather than a percentile estimate. Use test-process elapsed time as the primary budget measurement and record whole-command duration separately. Record revision, runtime versions, environment, run order, every failure and timeout, coverage mapping, report validity, process settlement, and cleanup outcomes. Counts may change when scenarios become separate tests; retained assertion ownership matters more than identical totals.

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

These are review criteria, not statistical guarantees or automatic failure gates. Do not automatically lower the timeout when optimizations succeed: savings improve ordinary feedback speed while a finite allowance tolerates variation. A lower limit should meaningfully improve hang detection without restoring fragility. Do not automatically raise it after a timeout either. Distinguish aggregate workload growth from a stuck fixture, output stall, prerequisite failure, or unresolved process ownership. A larger suite allowance does not repair those failures or resolve the DOCX test's separate 30-second limit.

The initial conclusion remains scoped to the measured environment. The checked-in GitHub workflows do not currently invoke the managed application suite, so they provide no application-suite CI timing evidence for this decision. Future CI measurements, materially slower-machine observations, repeated runs above the review threshold, or any suite timeout should prompt reassessment. Local observations do not establish cross-machine reliability.[^workflows]

## Planning Handoff

The [implementation plan](../plans/plan-2026-10-18-application-test-costs-and-timeout-budgeting.md) owns the concrete test selections, assertion mappings, phase tasks, and acceptance gates. It sequences independent budget adoption and baseline collection, five separately validated optimization phases, final three-run reassessment, and a final documentation-validation phase. This research remains the rationale and historical evidence source.

The [unified job record](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md) captures implementation changes, validation results, measurements, failures, deferrals, and phase-gate decisions across all eight phases. The plan tracks tasks and acceptance; that single record owns execution history. It was opened for authorized Phase 1 implementation, not for drafting or reviewing these documents.

The plan names the four CLI subprocess invocations, cancellation observations, DOCX supervised case IDs, proposed menu byte-input cases, and the four-case output-channel/retention matrix. Phase 2 has verified the CLI mapping, measured its saving, and passed managed lifecycle validation. Phase 3 has verified cancellation lifecycle observations, measured a local saving, passed managed validation, and passed implementation commit-range review. Phase 4 has verified the complete direct corpus, supervised parity, timeout cleanup, measured savings, managed validation, and implementation commit-range review. Phase 5 has verified byte decoding, raw/decoded parity, preserved navigation, measured complete-family savings, and managed validation; its full commit-range review remains pending. The remaining family still requires implementation, coverage and timing verification, and measured savings. An unsuccessful optimization can be deferred without blocking independently verified work or the separately justified allowance.

The plan requires a passing normal-command baseline at 300 seconds before optimization implementation; even a classified aggregate timeout stops that progression until the baseline passes or the execution approach is separately revised. Phase 1 has satisfied the baseline gate. Shared Accept/Defer/Stop gates require managed validation before optimization acceptance and verified restoration before deferral. Unresolved process or file ownership stops dependent work and prevents unsafe cleanup. Phases 2–5 have passed their coverage, savings, and managed-validation gates; the remaining optimization gate is unexecuted.

The final documentation phase reconciles actual outcomes with the testing guide and existing ownership/path catalogs, checks reciprocal links, and preserves evidence-based status. The plan remains active and this research remains in-progress after Phases 1–4 completed. Phase 5 is underway and current execution stops before Phase 6; later optimization and final validation remain pending.[^testing-guide][^test-catalog][^test-paths]

## Related Plans

- [Application test cost reduction and timeout budget implementation plan](../plans/plan-2026-10-18-application-test-costs-and-timeout-budgeting.md): phases, concrete coverage mappings, acceptance checks, and final documentation validation; Phases 1–4 complete, Phase 5 underway, Phases 6–8 unstarted.

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

[^frame-menu-driver]: [Video menu byte-input and ownership checks](../../test/video/interactive/fixtures/frames-menu-navigation.ts).

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
