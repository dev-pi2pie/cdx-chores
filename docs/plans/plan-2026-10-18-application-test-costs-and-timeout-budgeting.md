---
title: "Application Test Cost Reduction and Timeout Budget Implementation Plan"
created-date: 2026-10-18
status: active
agent: codex
---

## Goal and Execution Boundary

Implement the agreed application-test cost reductions while preserving named assertion owners, real-process coverage, and verified cleanup. Adopt a 300-second application execution allowance independently, then reassess it using the normal managed command after the accepted optimizations.

Phases 1–7 are complete. The five optimizations retain their mapped coverage, and Phase 7 passed static/build/unit checks, three fresh normal application runs, and full range review. The measured reassessment retains the 300-second allowance. Phase 8 is reconciling documentation and traceability before final closure; the documents remain at their current paths.

The [unified job record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md) owns execution history for all eight phases. Update that same record with implementation changes, validation results, measurements, failures, deferrals, and phase-gate decisions; do not create separate per-phase job records. The research retains rationale and historical evidence, and the plan tracks tasks and acceptance. The record was opened for authorized implementation, not for drafting or reviewing these documents.

The historical runtime baseline is recorded in the research. The planning checkout was `e1b9ab15`; Phase 1 started from `f0ecf2885a20ee3bf7e79f5d1137613806298ea5`, with only research/plan changes between those revisions. Phase 1 refreshed the inventory and normal-command baseline in the unified job record; refresh them again if later execution changes the relevant inputs. Bun remains the development/test runner; compiled DOCX and video fixtures continue to execute under Node.js.

## Related Research

- [Application test costs and timeout budgeting](../researches/research-2026-10-17-application-test-costs-and-timeout-budgeting.md): agreed direction, historical measurements, tradeoffs, and timeout reassessment criteria.

## Scope and Shared Acceptance Rules

- Production changes are limited to the application execution allowance and its rationale in `scripts/testing/suites/suite-policy.ts`. Preserve public commands, production parsing, process defaults, output limits, and fixture ownership contracts.
- Keep existing test families in their feature directories. The CLI matrix remains in its application test file; no suite migration is needed to obtain the startup saving.
- Use existing owned-fixture and process helpers. Do not introduce worker reuse, shared build caches, broad concurrency, automatic retries, or a public timeout override.
- Each optimization must preserve its mapped assertions, demonstrate stable settlement/cleanup, and reduce the total affected-family cost including replacement tests. Estimated savings are not numeric acceptance targets.
- If savings are unclear, use additional focused measurements or defer the optimization. Restore its original execution path if replacement coverage or lifecycle verification fails. Record failed attempts and deferrals; do not hide them in successful timing statistics.
- Phase 1 precedes optimization work. Phases 2–6 are independently reviewable; a deferred family does not block other verified changes. Phase 7 measures the final accepted set. Phase 8 is the final documentation-validation phase.

### Shared Phase Gates

Apply these dispositions to each optimization phase before proceeding. Acceptance checks remain unchecked until their evidence exists; a deferral is recorded as a deferral, not as successful implementation.

| Disposition | Required evidence and next action |
| ----------- | --------------------------------- |
| Accept | Coverage mapping, focused tests, relevant static checks, managed application validation, and measured total-family savings all pass. Record the accepted scope and continue. |
| Defer | Restore the phase's original execution paths and assertions while preserving independently accepted changes. Verify the restoration with the complete affected selection, relevant static checks, and the normal managed application suite. Record the reason and restoration results before continuing independent work. |
| Stop | Unresolved process/file ownership, unconfirmed cleanup, or an unexplained shared-suite failure prevents dependent execution. Retain unsafe artifacts, diagnose the cause, and resume only after ownership and the relevant validation are established. Do not treat an unverified restoration as a completed deferral. |

Unclear timing benefits permit additional focused measurements or deferral. They do not permit acceptance based only on passing tests. If an existing defect needs production changes beyond the allowed timeout-policy edit, resolve that scope separately rather than incorporating it silently into this optimization plan.

### Measurement and Verification Method

For each changed family, collect three focused baseline runs before its edits and three focused post-change runs under comparable runtime versions, environment, and output conditions. Keep the complete affected selection, including retained integration cases, in the comparison. Report individual durations, median, observed range, failures, and counts. Investigate overlap with ordinary variation rather than claiming precision from three samples. Do not add file testcase durations to suite wall time.

Use exact file selections for focused checks. For application files, follow the testing guide's override pattern: `bun test ./test/<exact-file>.app.test.ts --path-ignore-patterns '**/fixtures/**'`. Direct checks do not replace managed prerequisite, report, process, and cleanup validation. Each optimization passed its own normal `bun run test:integration:app` check before acceptance. Phase 7 separately ran the full managed unit suite and three fresh application invocations. Changed TypeScript received lint, formatting, and compiler checks; Phase 7 also passed the final build.

Record the revision, exact selection, run order, and all outcomes in the unified job record. Keep environment descriptions minimal: note comparable measurement conditions and include specific environment details only when they explain a result or limitation. Retained reports remain owned artifacts, not permanent documentation dependencies. The final three full application runs use the checked-in policy without diagnostic overrides; measure process elapsed time and whole-command duration separately.

## Phase 1: Adopt the Execution Allowance and Establish the Baseline

**Tasks:**

- [x] Change only the application `execution.timeoutMs` from `240_000` to `300_000` and replace the stale roughly 120-second workload rationale.
- [x] Preserve other suites, application preflight, grace/cleanup allowances, output delivery limits, per-test limits, and one attempt per suite.
- [x] Run the existing suite-policy coverage in `test/test-runner/prerequisites.unit.test.ts` and relevant static checks.
- [x] Run the normal `bun run test:integration:app` before any cost reduction; record full counts, process time, whole-command duration, report validation, process settlement, fixture output checks, and cleanup.

**Acceptance checks:**

- [x] The normal managed command passes with no execution hook override and no missing/skipped coverage.
- [x] The policy diff contains only the intended allowance and rationale change. A passing diagnostic invocation is not substituted for the normal-command baseline.

**Execution evidence:** The [Phase 1 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-1-execution-allowance-and-baseline) records the passing normal-command baseline, the earlier environment failure, preserved policy values, focused/static checks, and implementation commit-range review. The baseline gate is satisfied and Phase 1 is complete.

**Gate:** A passing normal-command baseline is required before Phases 2–6. For behavioral, prerequisite, report, or ownership failures, stop dependent work and resolve the cause. A confirmed aggregate timeout at 300 seconds also stops optimization implementation under this plan: preserve the failed outcome, classify the workload, and revise the execution approach separately if a passing baseline cannot be established. Read-only diagnosis may continue, but neither a diagnostic override nor the historical passing run satisfies this gate. Do not increase the allowance automatically, mark the timed-out baseline passed, or begin cost reductions to conceal a baseline failure. Phase 1 has passed this gate using the normal managed command; the 300-second direction remains independently justified and was retained by the completed Phase 7 reassessment.

## Phase 2: Move the CLI Registration Matrix In-Process

**Owners:** `test/cli-foundations/options/codex-execution-scope.app.test.ts`; reuse the harness pattern from `test/codex-info/commands.app.test.ts`. Keep support local unless an existing shared helper fits.

### Coverage Mapping

| Current assertions | Retained owner and execution | Acceptance |
| ------------------ | ---------------------------- | ---------- |
| Nine adopted-command help cases expose all three execution flags | All nine existing rows in a fresh in-process Commander harness | Parse the original `--help` arguments; assert successful help exit and every flag |
| Eleven excluded-command help cases hide those flags | All eleven existing rows in that harness | Parse the original arguments; assert successful help exit and every absence |
| Five excluded invocations reject `--codex-model` | All five existing rows in that harness | Exact unknown-option diagnostic, nonzero Commander exit, and zero action entries |
| Real root startup and output routing | Subprocess: `--help` | Exit 0, help on stdout, no execution flags and no unexpected stderr |
| Nested adopted-command entrypoint dispatch | Subprocess: `md pdf-profile codex --help` | Exit 0 and all three adopted flags visible |
| Root rejection exit and stderr | Subprocess: `--codex-model synthetic-model` | Nonzero exit and expected unknown-option diagnostic on stderr |
| Excluded-leaf rejection before action work | Subprocess: `md to-pdf --input missing.md --codex-model synthetic-model` | Nonzero exit, unknown-option diagnostic rather than input processing, no action output/artifacts |

**Tasks:**

- [x] Measure the current 25-process file, then preserve its nine/eleven/five scenario arrays in the in-process matrix.
- [x] Create a fresh program and captured runtime per case, call the real `registerCliCommands`, and recognize only the expected Commander help/error outcome.
- [x] Install a test-only pre-action guard that records and throws before an accepted invocation could perform action work. Require zero entries for help and rejection cases; do not add production injection APIs.
- [x] Retain exactly the four subprocess invocations above alongside all 25 in-process scenarios. These use Bun's source entrypoint and do not claim packaged Node compatibility.
- [x] Verify the changed file together with `codex-execution.app.test.ts` and `test/codex-info/commands.app.test.ts`, then run the managed suite and compare the complete changed-file cost.

**Acceptance checks:**

- [x] All original flag-presence, flag-absence, and rejection assertions have owners; no parser state leaks between cases.
- [x] Actual process output/exit checks remain, and launch count for this matrix falls from 25 to four.
- [x] Total file cost falls without altering production registration or command behavior.

**Execution evidence:** The [Phase 2 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-2-cli-registration-matrix) records preserved scenario arrays, four retained process cases, three before/after measurements, related-file/static checks, passing managed lifecycle validation, and implementation commit-range review. The measured median complete-file cost fell from 4.007 to 0.833 seconds. Phase 2 is accepted and complete.

**Gate:** Apply the shared Accept/Defer/Stop rules. If the harness cannot prove equivalent parsing and pre-action rejection, restore the original subprocess matrix and verify that restoration before recording deferral.

## Phase 3: Shorten Only the Repeated Input-Cancellation Grace

**Owners:** `test/cli-foundations/process/fixtures/driver.ts`, `fixtures/subject.cjs`, the local `fixtures/cancellation-observer.ts`, and `streaming.app.test.ts`; retain `ownership.unit.test.ts` under the same directory.

| Current scenario | Retained responsibility | Concrete observations |
| ---------------- | ----------------------- | --------------------- |
| `cancel` | Production default grace and cancellation of cooperative/resistant children | Both complete readiness records; cooperative closure after SIGTERM; resistant SIGTERM then SIGKILL; cancellation rejections; confirmed closure and disposal |
| `input-cancel` | Cancellation during unfinished stdin writing with shorter fixture grace | Complete readiness record plus an outstanding write; input signal aborted and producer settled; resistant child signal order and actual close; cancellation reason; successful disposal |
| Existing direct ownership tests | Unconfirmed closure, pending consumer/input settlement, and blocked reuse | Preserve existing failure assertions and short injected test budgets |

**Tasks:**

- [x] Measure the complete streaming family before changing the input-cancellation fixture.
- [x] Keep `cancel` on the two-second production default and preserve its existing default elapsed-time checks.
- [x] Configure approximately 250 ms grace only for `input-cancel`; retain `forceMs`, outer process limits, and cleanup allowances.
- [x] Parse readiness as a complete line. Track input write entry/settlement so cancellation occurs while a write is outstanding after readiness, not on an arbitrary stdout chunk.
- [x] Wrap the existing real-spawn injection to observe signal attempts and child close. Record SIGTERM handling in the resistant subject as needed through a separate fixture observation channel; signal attempts alone are not closure evidence.
- [x] Replace only the input-cancellation 1,900 ms floor with ordering/timing assertions referenced to cancellation and the configured grace, using scheduling tolerance. Require no premature escalation and preserve outer deadlines.
- [x] Verify both cancellation scenarios, the entire streaming file, and ownership unit coverage, then measure and run the managed suite.

**Acceptance checks:**

- [x] Readiness and pending input are demonstrated, cancellation settles the producer, and no child or stream remains unconfirmed.
- [x] Real default-policy coverage remains in `cancel`; the shorter value passes repeated focused checks without weakening shutdown assertions.
- [x] The full streaming family shows a saving. If 250 ms is unstable, evaluate a larger fixture-only value or defer; do not shorten production policy or erase escalation coverage.

**Execution evidence:** The [Phase 3 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-3-cancellation-grace) records the retained default, fixture-only 250 ms grace, lifecycle observations, unchanged limits, ownership unit checks, passing managed validation, and implementation commit-range review. Three before/after complete-file measurements reduced the median from 4.890 to 3.153 seconds. Phase 3 is accepted and complete.

**Gate:** Apply the shared Accept/Defer/Stop rules. A failed shorter-grace experiment requires restoration and verification of the original fixture behavior before independent work continues; unconfirmed closure takes the Stop path.

## Phase 4: Run the Complete DOCX Corpus Directly in Compiled Node

**Owners:** `test/document-rename/adapters/docx-review.app.test.ts`, `test/document-rename/fixtures/docx-product/{build,driver,entry}.ts`, and `test/document-rename/fixtures/docx-review-matrix.ts` for shared review inventory and explicit supervised IDs. Do not import executable test files to share cases.

### Complete-Corpus Mapping

| Current group factory | Current cases | Retained semantic owner |
| --------------------- | ------------: | ----------------------- |
| `createDocxReviewCases` | 60 | Complete compiled Node direct observation plus current content unit coverage |
| `createDocxDrawingCases` | 50 | Complete compiled Node direct observation plus drawing unit coverage |
| `createDocxFallbackCases` | 4 | Complete compiled Node direct observation plus drawing unit coverage |
| `createDocxXmlCases` | 46 | Complete compiled Node direct observation plus content unit coverage |
| `createDocxAmpersandCases` | 35 | Complete compiled Node direct observation plus content unit coverage |
| `createDocxAmpersandClassificationCases` | 60 | Complete compiled Node direct observation plus content unit coverage |
| `createDocxFieldCases` | 9 | Complete compiled Node direct observation; content tests retain checkbox classification |
| `createDocxHyperlinkFragmentCases` | 23 | Complete compiled Node direct observation plus content unit coverage |
| `createDocxRelationshipCases` | 15 | Complete compiled Node direct observation plus content unit coverage |

All 302 current inputs retain actual parsing, exact reader diagnostics or raw text/headings, complete `expectedReviewEvidence` comparison, complete prompt comparison, and failure-reason/null-prompt checks. Preserve existing direct-test assertions beyond that shared shape. Counts describe the current inventory, not a ceiling on future cases; require unique IDs and one ordered observation per input.

### Selected Supervised Matrix

The 39 IDs below continue through the unchanged production supervisor and retain the same complete observation assertions. This is the initial explicit selection; add a case if implementation review identifies an uncovered runtime-sensitive path, recording the reason before removing broader supervised coverage.

| Case IDs | Boundary retained |
| -------- | ----------------- |
| `review-xml-roots-valid-prolog`, `review-xml-roots-metadata-cannot-rescue` | Valid root/prolog and malformed-document diagnostic despite usable metadata |
| `review-xml-numeric-text`, `review-xml-xml-escapes`, `review-cdata-mixed` | Unicode/non-BMP, escaping, and literal CDATA through result and prompt serialization |
| `review-strong-heading-boundaries`, `review-strong-embedded-suppress`, `review-vertical-merge-discarded-span-column` | Distinct raw text/title signals, suppression, and ordered multi-heading evidence |
| `review-shared-malformed-metadata-budget` | Optional metadata failure and shared parsing-budget behavior |
| `review-checkbox-only-empty`, `review-vertical-merge-eager-failure` | Successful read with no-title classification versus `docx_symbol_font_missing` |
| `review-drawing-inline-valid`, `review-drawing-anchor-valid`, `review-drawing-inline-missing-image-relation`, `review-drawing-inline-absent-media`, `review-drawing-external-image-omitted` | Drawing wrappers, reader error, omitted media, and external-image omission under runtime guards |
| `review-fallback-selected`, `review-fallback-absent`, `review-fallback-eager-image-failure` | Alternate-content selection/absence and eager failure propagation |
| `review-xml-namespace-renamed`, `review-xml-namespace-default`, `review-xml-namespace-unbound-main-metadata` | Namespace equivalence and `docx_main_document_unavailable` propagation |
| `review-xml-attribute-tab-double`, `review-xml-attribute-decimal-tab-double` | Literal versus referenced attribute whitespace affecting heading selection |
| `review-ampersand-text-mixed`, `review-ampersand-relationship`, `review-ampersand-classification-mixed-double`, `review-ampersand-classification-undeclared-am-relationship` | Literal/reference handling in text, attributes, and relationships; `docx_xml_invalid` |
| `review-field-hyperlink-nested-checkbox`, `review-field-unseparated-outer-nested-checkbox` | Nested-field interpretation with different heading/title evidence |
| `review-hyperlink-fragment-document-line-separator`, `review-hyperlink-fragment-footnote-lf`, `review-hyperlink-fragment-endnote-lf`, `review-hyperlink-fragment-comment-lf` | Fragment interpretation and secondary-part sources through serialization |
| `review-relationship-main-root-style`, `review-relationship-main-nested`, `review-relationship-main-literal-percent`, `review-relationship-root-footnote-missing`, `review-relationship-root-style-missing` | Root/nested/literal package paths, required relationship failure, and optional-style fallback |

Other permutations retain compiled Node parsing and complete evidence/prompt assertions but no longer each repeat worker isolation and protocol conversion. The selection retains every diagnostic class currently present in the review corpus and representatives across all nine groups. Quote styles, repeated equivalent text/attribute variants, and remaining drawing/field combinations remain exhaustive in direct compiled observations. Any containment-specific case discovered outside this selection stays supervised.

| Existing suite | Coverage kept unchanged |
| -------------- | ----------------------- |
| `adapters/docx-baseline.app.test.ts` and `adapters/docx-baseline-contract.app.test.ts` | Frozen independent full evidence/prompt expectations, metadata, and compatibility contracts |
| `adapters/docx-product.app.test.ts` | `sequential`, `batch`, `thread`, `concurrent`, and `input-limits` modes, including failure recovery |
| `adapters/title-evidence.app.test.ts` | Shared-fixture metadata, title selection, and prompt filenames |
| `docx-runtime.app.test.ts` and `docx-runtime.unit.test.ts` | Asset loading, protocol conversion/failures, offline controls, limits, cancellation, and cleanup |
| `docx-evidence.unit.test.ts`, `docx-content.unit.test.ts`, and `docx-drawing.unit.test.ts` | Reader rejection mapping, no-title classification, detailed semantic and field checks |

### Test Ownership and Timeout Hierarchy

Use one shared compiled review fixture, built in a `beforeAll` hook, followed by nine sequential direct-batch tests (one per group) and one sequential supervised-matrix test for the 39 selected cases. Each batch test owns exactly one driver invocation. Store direct observations by ID for parity comparison; a missing direct observation must fail the comparison explicitly. Do not put all ten driver invocations inside one 30-second test or run dependent comparisons concurrently.

| Owner | Accepted limit and responsibility |
| ----- | -------------------------------- |
| Shared build/setup hook | 45 seconds; compile once without starting observation drivers |
| Each direct or supervised driver | 30 seconds execution, then the existing 3-second total termination/verification budget, including its 250 ms grace; 70-case and 512 KiB output bounds remain |
| Each enclosing batch test | 45 seconds; one child execution plus termination, input preparation, observation parsing, and assertions |
| Shared teardown hook | 15 seconds; await any active owned completion, then remove only a fixture whose process settlement is verified |

Before launching a batch driver, require at least 38 seconds remaining in its enclosing test: 30 for execution, 3 for termination/verification, and 5 for result handling. If preparation consumes that reserve, fail without launching another child. These fixture-level allowances establish an explicit hierarchy, not a larger production parsing budget. They must be validated against actual setup and finalization costs; if insufficient, defer or revise the fixture design with evidence rather than let the outer timeout race process settlement.

Driver completion must be awaited on success, timeout, parsing error, and assertion failure. Track active ownership before awaiting completion so teardown cannot infer safety from an unset result. A teardown deadline or unconfirmed completion fails the fixture and retains its directory; it must not trigger deletion while a child may still be active. Any future arrangement that places multiple drivers inside one test must budget their aggregate execution and termination time plus finalization, or retain the one-driver-per-test layout above.

**Tasks:**

- [x] Measure the current compiled review family and verify the complete inventory and supervised IDs above.
- [x] Add a direct observation mode in the existing compiled driver: real DOCX bytes → compiled `readDocxDocument` → actual-result reader injection in `createDocxEvidenceExtractor` → real prompt builder. Never inject expected facts.
- [x] Preserve supervised behavior as the default for existing fixture callers. Give direct batches the same 70-case maximum, 30-second process allowance, and 512 KiB output bound as existing observation batches; do not accidentally use the ordinary single-operation 15-second/65,536-byte branch.
- [x] Implement the shared setup, ten sequential batch tests, launch reserve, and teardown ownership described above. Measure whole-file elapsed time including hooks so moving work into setup does not manufacture a reported saving.
- [x] Verify the timeout/failure path with a controlled fixture driver that exceeds a short test-only execution allowance. Use proportionally larger termination, enclosing-test, and teardown budgets; require observed timeout, confirmed child/group settlement before directory removal, and no outer-test timeout as a substitute. Include this permanent regression in replacement-family cost. Retain existing unconfirmed-ownership tests and their retain-scratch behavior.
- [x] Use shared observation assertions for both modes, assert the selected supervised observations equal the direct observations after the same JSON transport, and preserve ordered identity/completeness checks.
- [x] Keep source-versus-compiled prompt agreement and independent frozen prompt captures separate. Do not regenerate expected text from current output.
- [x] Verify the review file with all unchanged suites listed above, compare combined direct-plus-supervised cost against the old review family, and run the managed suite before accepting the reduction.

**Acceptance checks:**

- [x] All current 302 inputs retain complete semantic observations; all listed supervised IDs exist exactly once and the selected observations agree across paths.
- [x] Frozen captures are unchanged; lifecycle, metadata, and runtime responsibilities remain covered by the named owners.
- [x] The enclosing test outlives its owned execution and termination budget, the timeout regression settles before teardown removes files, and unconfirmed ownership prevents cleanup. Successful runs alone do not satisfy this lifecycle check.
- [x] Total replacement cost, including build/setup hooks and the timeout regression, is lower. All process/output limits remain finite. Retain the full supervised corpus if the mapping, equivalence, or timeout hierarchy cannot be demonstrated.

**Execution evidence:** The [Phase 4 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-4-docx-review-corpus) records the fixture foundation, complete 302-case direct coverage, 39-case supervised parity, timeout cleanup, and retained-suite verification. Whole-file median time fell from 23.318 to 5.314 seconds across three before/after runs. Managed validation and implementation commit-range review also passed. Phase 4 is accepted and complete.

**Gate:** Apply the shared Accept/Defer/Stop rules. Verify restoration of the full supervised review path before recording deferral. A child or fixture with unconfirmed ownership takes the Stop path and is retained for diagnosis.

## Phase 5: Separate Menu Navigation from Repeated Escape Decoding

**Owners:** `test/video/interactive/frames-menus.app.test.ts` and `fixtures/frames-menu-navigation.ts`; `frames-menu-bytes.app.test.ts` and `fixtures/frames-menu-byte-input.ts` in the same directories for focused real-Node byte checks. Local `frames-menu-input.ts`, `frames-menu-arrows.ts`, and `frames-menu-fixture.ts` support synchronization, byte cases, and owned launches. Preserve controller, operation, and key-parser tests.

### Coverage Mapping

| Existing owner/scenario | Accepted execution and preserved assertions |
| ----------------------- | ------------------------------------------- |
| `boundaries`, `resize`, information scenarios | Existing real-byte behavior and display/selection assertions remain |
| `cadence`, `direct`, `naming`, `settings` | Decoded Escape only at explicit backtracking steps; preserve cadence drafts, no premature resolution, exact naming/settings results, and both editor modes |
| `custom-destinations-inline`, `custom-destinations-simple`, `retained-filename-inline`, `retained-filename-simple` | Decoded Escape only; preserve literal drafts, destination type, extension validation, and returned paths |
| Every existing navigation scenario | Keep real typing, arrows, Backspace, Enter, real prompt implementation, 120 ms application Escape delay, raw-mode restoration, and listener checks |

The byte test file retains the following named cases with actual Node decoder defaults:

| Raw-byte case | Concrete flow and assertions |
| ------------ | ---------------------------- |
| `raw-select-back-and-reuse` | `chooseFrameOption`: bare Escape returns Back; settle/clean, then select by bytes on the same streams |
| `raw-simple-draft-return` | `promptFrameNaming` with `simple: true`: type a template, Escape to Image naming, reopen and verify the exact draft, then finish normally |
| `raw-inline-draft-return` | Same flow with `simple: false`, exercising the advanced text editor |
| `raw-inline-path-return` | `promptFrameImageSettings` with `simple: false`: type a literal custom file path, Escape to destination selection, reopen, retain the draft, and finish |
| `raw-simple-path-return` | Same path transition with `simple: true`, retaining the simple-input ownership path |
| `raw-fragmented-arrows` | Separate `ESC`, `[`, and direction writes across event-loop turns after readiness; verify menu movement, simple-input caret effects, and advanced inline completion without Back, then bare Escape and stream reuse |

Use 20-second enclosing tests with an 18-second pre-launch reserve for the existing twelve-second execution and four-second total termination budget plus result handling. Keep the 500 ms grace, output bounds, and internal guard unchanged. Retain fixture scratch whenever process completion is unconfirmed.

**Tasks:**

- [x] Measure the existing menu family before adding the focused byte cases or changing Escape steps.
- [x] Add an explicit decoded-Escape operation on the existing stream. Wait for the current prompt's new output and initialization before emitting a normal Escape `keypress`, then wait for the expected next prompt. Do not intercept arbitrary writes or invoke abort/state transitions directly.
- [x] Implement the named raw-byte cases first. Verify complete and fragmented arrow sequences for menu/simple/inline input owners, with bounded deadlines and no exact 500/620 ms completion assertion. Do not deliberately delay fragments across the decoder timeout.
- [x] Compare raw and decoded Escape using the same representative naming and path flows in both editor modes before converting broader navigation. The comparison can reuse these fixture flows; count any permanent parity cases in replacement cost.
- [x] After settlement, flush queued effects and check raw mode and application keypress/resize listeners again. Verify one Escape causes one transition and the next prompt is not affected by stale abort work. Respect Node decoder-owned listeners.
- [x] Keep `fixtures/real-prompt-cancellation.ts` immediate/setup/pre-aborted cases, `frames-controller.app.test.ts`, `frames-operation.app.test.ts`, and `test/cli-foundations/tui/keys.{unit,app}.test.ts` unchanged unless a specific fixture adjustment is necessary and separately reviewed.
- [x] Run the combined navigation and new byte selection plus the retained ownership/parser families; measure total replacement cost and verify the managed suite.

**Acceptance checks:**

- [x] All original navigation assertions remain, raw-byte cases cover each named input owner, and fragmented arrows cannot satisfy the test by exiting the prompt.
- [x] Both input methods produce equivalent representative results and release ownership; queued effects do not reattach application listeners after cleanup.
- [x] Savings survive the cost of retained/added byte tests. If initialization or ownership differs, retain raw Escape for that flow and investigate or defer it.

**Execution evidence:** The [Phase 5 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-5-video-menu-escape-handling) records the raw-byte foundation, four representative parity comparisons, and preserved navigation assertions. Three before/after complete-family runs reduced the median from 24.528 to 13.869 seconds, including the new byte/parity tests and cleanup. Retained-family validation, managed validation, and implementation commit-range review also passed. Phase 5 is accepted and complete.

**Gate:** Apply the shared Accept/Defer/Stop rules. For a partially deferred flow, restore and verify its original raw-byte path and measure the complete retained family before accepting any remaining conversions.

## Phase 6: Consolidate Real Runner Stalls and Preserve Retention Coverage

**Owners:** `test/test-runner/runner-entry-output.app.test.ts` and `runner-output.app.test.ts`; reuse `runner-support.ts`. Preserve production `run.ts` and output-delivery policy. The retained real-entry fixture must retain its owner when settlement is unconfirmed; its existing twenty-second enclosing test reserves eighteen seconds before launch for twelve-second execution, four-second total termination, and result handling.

### Coverage Mapping

| Original coverage | Retained owner | Required assertions |
| ---------------- | -------------- | ------------------- |
| Real blocked stderr, retained mode | Existing real-entry case | 4 MiB producer, paused reading until child exit, production four-second limits, exit 1 with `exit-failed`, verified stopped process, failed summary, retained path, scratch removed |
| Real blocked stderr, default mode | Fast `stderr/default` case | Entire owned run removed before helper cleanup, no retained or remaining path, no-results message, failure reporting does not recreate the run |
| Existing controlled stdout stall with stderr fallback | Fast `stdout/default` and `stdout/retained` cases | Bounded stall failure and healthy stderr fallback, no later suites, mode-specific cleanup |
| Retained cleanup under execution-time stderr stall | Fast `stderr/retained` case | Failed invocation and leaf, stopped process records, delivery diagnostics persisted, correct retained path, scratch absent, no remaining-owned-path warning |
| SIGINT real entry, late-summary output failure, fallback failure, finalization ownership/recovery | Existing entry/output/finalization suites | Preserve distinct timing and ownership semantics; late-summary leaf may remain passed |

**Tasks:**

- [x] Measure the existing real-entry and runner-output files before changing the matrix.
- [x] Parameterize controlled output failure across both stalled channels and both retention modes: four cases. Allow initial status, withhold only an execution-marker callback, and capture the opposite channel for fallback.
- [x] Start with the existing fixture `stallMs: 50` and `drainMs: 100`; use a small marker and a generous outer test deadline. Require that the execution marker reaches the stalled destination, its callback remains withheld until teardown, and diagnostics identify `destination stalled` for the intended channel. Reject a final-drain timeout, unrelated EPIPE, pending-byte overflow, or fallback timeout as a substitute for the intended stall.
- [x] In all four cases, require exit code 1, `outputFailed`, failed invocation/affected leaf, delivery diagnostics, fallback text, and no later suite scheduling. Require nonempty expected process records before checking their stopped flags.
- [x] Assert default removal and retained persisted-summary contents before `withRunner` teardown. Release withheld callbacks in `finally`; do not let test cleanup supply the product's missing cleanup proof.
- [x] Validate this matrix before removing only the default-mode real-entry stall. Keep retained real-entry stdout reporting and persistence checks, and require `exit-failed` rather than a supervisor timeout/kill.
- [x] Run the two changed files with `output-delivery.app.test.ts` and `finalization-delivery.app.test.ts`, compare the combined family cost, and verify the managed suite.

**Acceptance checks:**

- [x] Both fallback directions and both retention policies have explicit controlled-stall coverage; real blocked-pipe termination remains verified.
- [x] No production timer, output volume for the real case, or outer supervisor limit was shortened to manufacture savings.
- [x] Removed real-entry assertions have retained owners and replacement cost is lower. Keep both original real-entry cases if this cannot be demonstrated.

**Execution evidence:** The [Phase 6 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-6-managed-runner-blocked-output) records the validated four-case controlled-stall foundation and subsequent removal of only the default-mode real-entry stall. Three before/after complete-family measurements reduced the median from 9.167 to 5.207 seconds, including replacement coverage and cleanup. Managed validation and implementation commit-range review also passed. Phase 6 is accepted and complete.

**Gate:** Apply the shared Accept/Defer/Stop rules. If replacement coverage is insufficient, restore and verify both original real-entry retention cases and the existing controlled stdout stall before recording deferral.

## Phase 7: Validate the Accepted Set and Reassess the Budget

**Tasks:**

- [x] Record each optimization as accepted or deferred with its assertion mapping and measured whole-family outcome. Require recorded restoration checks for every deferred change; no phase may enter final validation with a pending Stop condition.
- [x] Run `bun run lint`, `bun run format:check`, `bun run build`, and `bun run test:unit` for the final accepted checkout. Resolve failures before claiming validation.
- [x] Run three separate normal `bun run test:integration:app` invocations after normal build/setup, without execution overrides or retries inside a suite. Record all attempts, not just passing ones.
- [x] Compare process and whole-command durations, inventory/count changes, report validity, process settlement, fixture outputs, and cleanup against Phase 1. Reconcile every count change to added or redistributed assertions.
- [x] Retain 300 seconds by default. Investigate repeated successful runs above 240 seconds or any timeout; sustained results around or below 180 seconds only justify a separate proposal to lower the allowance.

**Acceptance checks:**

- [x] The final unchanged implementation passes all three planned managed runs and required static/unit/build checks. After any corrective code change, establish a fresh three-run set while retaining prior failures in the evidence.
- [x] No unresolved ownership, report, skip, or cleanup failure remains. Three runs are an initial local validation, not a percentile or CI guarantee.
- [x] Measured results support accepted changes; deferred work and environment limits remain explicit. Do not sum estimated family savings as proof of the final suite saving.

**Execution evidence:** The [Phase 7 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-7-final-validation-and-timeout-reassessment) reconciles the five accepted optimizations and confirms suite counts. Static checks, build, the full managed unit suite, and all three fresh application runs passed on the unchanged implementation. Process times were 201.848, 193.826, and 201.618 seconds; the median was 201.618 seconds, with 98.152 seconds of headroom on the slowest run. The allowance remains 300 seconds. Full phase commit-range review also passed. Phase 7 is accepted and complete.

**Gate:** Phase 7 execution evidence and full commit-range review passed, satisfying the prerequisite for Phase 8 documentation validation. An unexplained timeout or lifecycle failure would prevent implementation completion; it would not authorize a larger budget automatically.

## Phase 8: Validate Documentation and Traceability

This is the final phase. Documentation must describe the accepted implementation and its actual evidence, including deferrals; it must not convert planned checks into completed claims.

**Tasks:**

- [x] Update `docs/references/test-suite-case-matrices.md` for changed assertion/execution ownership, including complete direct compiled DOCX coverage versus the selected supervised matrix and the two output-fallback directions.
- [x] Update `docs/references/test-catalog-path-correspondence.md` only if existing paths move or its mappings change; adding local fixtures alone does not imply a historical path migration.
- [x] Update `docs/guides/testing.md` only where current accepted guidance changes, including the application allowance if documented there. Keep rationale in the research, task and acceptance progress in the plan, and per-phase execution evidence in the unified job record, not duplicated in current-reference tables.
- [x] Reconcile the research with observed savings and limitations, preserve its historical baseline, and replace stale allowance statements and the suite-policy rationale without changing executable policy values.
- [x] Check reciprocal `Related Plans`/`Related Research` links, headings and anchors, repository-relative paths, footnotes, front matter, and policy-required modification dates. Preserve one source line per prose paragraph.
- [x] Review every phase checkbox against evidence. Keep deferred work clearly identified; do not mark unperformed tasks done. Preserve evidence-based lifecycle states: the plan became active and research in-progress with authorized Phase 1 execution; neither is complete while later verification remains pending. Never treat drafting or an accepted direction as execution proof.
- [x] Verify that the unified job record covers all eight phases, including final validation and documentation outcomes, and links to this plan and its related research.
- [x] Review the final documentation diff for unsupported runtime/CI claims, private machine details, broken links, and contradictions with the testing guide or source policy.

**Acceptance checks:**

- [x] Every reader-facing claim has matching source behavior or recorded evidence; unresolved or deferred items are visible.
- [x] Catalog, guide, research, and plan boundaries agree, links resolve, and no historical evidence is silently rewritten.
- [ ] The final documentation pass is complete without introducing unverified implementation or completion claims.

**Execution evidence:** The [Phase 8 record](jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#phase-8-documentation-validation-and-closeout) records verified coverage/timeout claims, preserved historical evidence, link and metadata checks, and the comment-only policy update. The guide and path catalog were reviewed and need no changes. Documentation and evidence reviews passed; final acceptance remains open until full phase commit-range review.

**Gate:** Close the plan, research, and unified record only after documentation checks and the full Phase 8 commit-range review pass. Keep all three at their current paths; this closeout does not archive them.

## References

- [Testing guide](../guides/testing.md)
- [Test suite ownership catalog](../references/test-suite-case-matrices.md)
- [Test catalog path correspondence](../references/test-catalog-path-correspondence.md)
- [Documentation policy](../../DOCUMENTATION_POLICY.md)
- [Suite execution policy](../../scripts/testing/suites/suite-policy.ts)
