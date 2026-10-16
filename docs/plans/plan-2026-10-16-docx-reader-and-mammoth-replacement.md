---
title: "DOCX reader and Mammoth replacement"
created-date: 2026-10-16
modified-date: 2026-10-16
status: active
agent: codex
---

## Goal

Evaluate and, if justified, integrate a focused project-owned DOCX reader that preserves semantic rename evidence and fallback behavior while enabling complete Mammoth removal.

This plan includes contract research, candidate evaluation, and conditional production migration. Phases 1–7, including Phases 6.1–6.3, establish the research decision; Phases 8–9 proceed only after selection supports replacement. Phase 10 validates documentation before closeout. The [unified execution record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md) tracks outcomes across the ten main phases and three follow-ups. Phases 1–9 and 6.1–6.3 are complete. The maintainer accepted the [full Phase 7 proposal](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#phase-7-assessment-and-acceptance-proposal), selecting the reader for integration. Final-product shipping checks passed with recorded limitations; Phase 10 is unstarted.

## Scope

In scope:

- Node-compatible TypeScript/JavaScript package discovery, ordered text, heading signals, metadata, and internal diagnostics using the existing ZIP/XML dependencies.
- Compatibility comparisons, explicit resource budgets, maintenance assessment, adapter integration, consumer migration, and dependency/distribution verification.
- Evaluation of a focused symbol-mapping dependency or owned mapping data, subject to the research's coverage, provenance, and maintenance assessment.
- Simplification of the manual DOCX validation scripts, separation of manual feature-tool verification from routine product regressions, and verification of the remaining application suite before reader selection.
- Documentation of verified behavior, accepted differences, limitations, and execution evidence.

Out of scope: full DOCX-to-HTML conversion, layout rendering, images/OCR, legacy `.doc`, other Office formats, new CLI commands, public reader APIs, runtime backend selection, Mammoth forks, and changes to Pandoc-backed Markdown-to-DOCX generation. Dependency overrides, patches, and upstream Mammoth upgrades remain separate maintenance work.

## Baseline and Compatibility Contract

The [research](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md) describes source snapshot `8c75fdb831fab3b8348ae46e4f3b023281db2b25`. Phase 1 must record the actual execution baseline and reconcile intervening changes before capturing expected results.

Preserve the asynchronous DOCX adapter boundary, complete normalized evidence, resulting prompt payloads, outward warnings, extraction reasons, and deterministic fallback. Keep document dispatch, CLI options, Codex execution settings, batching, and retries unchanged. Preserve separate heading and body outputs because Mammoth's HTML and raw-text paths can include different content. Metadata-only and non-text documents require explicit failure-boundary comparisons.

The research's **Compatibility Policy**, **Validation Matrix and Method**, and **Decision and Shipping Gates** govern acceptance. Use its full minimum corpus as a checklist with identifiable case IDs and recorded outcomes; do not replace it with a smaller happy-path sample. Intentional differences need case-specific rationale and expected results, including the replacement extractor identity and resource-limit outcomes. New parser diagnostics stay internal initially unless an outward change is explicitly accepted.

## Proposed Ownership

```text
src/docx/                                  Proposed package/content reader
  package access and part discovery        Reuse or relocate existing OOXML helpers
  ordered heading and body signals         Preserve separate extraction semantics
  metadata and internal diagnostics        No rename title selection

src/adapters/codex/document-rename/
  extractors/docx.ts                       Normalization, ranking, limits, fallback
```

Phase 7 selects the existing `src/docx` reader/runtime boundaries and internal `DocxReadResult` / `DocxDocumentFacts` types, including content presence, ordered headings, raw text, metadata, and fixed failure diagnostics. The production adapter owns evidence assembly and outward failure mapping. Retain reusable OOXML helpers initially and avoid a second ZIP/XML implementation; the accepted reader does not provide general HTML conversion.

The research's [resource-isolation and content-support contract](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#resource-isolation-and-content-support-contract) governs process accounting, deadline/cleanup scope, communication bounds, symbol policy, and style/note limitations. The maintainer accepted its design, implementation scope, and validation method in Phase 2. Phase 6 supplies technical evidence; Phase 7 owns acceptance of the demonstrated numerical budgets and support envelope after Phases 6.1–6.3. Design agreement alone does not establish either acceptance.

## Candidate Build and Packaging Checks

Phases 6 and 6.2 use a private evaluation harness that imports the actual candidate reader and builds separate ESM and CJS entry points with the repository's bundling tooling. Phase 9 instead stages the actual production build configuration, manifest, public exports, CLI, and runtime assets. Builds, generated inputs, package tarballs, consumer installations, caches, logs, and raw reports belong in owned OS temporary directories. Clean them after confirmed process settlement on success or failure; unconfirmed cleanup fails and retains ownership. Keep source entry points and fixture assertions reproducible; record concise outcomes rather than local setup or run metadata.

The earlier evaluation-only package used `private: true`, scratch exports for both formats, and the reader's runtime dependencies declared at repository-resolved versions. Dependencies stayed external to exercise installation, and the live Mammoth runner stayed outside that package. Phase 9 retires live Mammoth consumers and packs the integrated product with its actual dependency declarations. Neither workflow adds a public reader API or publishes a package.

The required installation matrix for Phases 6, 6.2, and 9 is npm and Bun. Include every required child/worker/parser asset in the stage-specific package, with no dependency on source-tree paths. Install the same tarball in separate fresh temporary consumer directories, without links or module-resolution fallbacks to the repository's `node_modules`. After each installation, invoke both built formats with Node.js, including the minimum supported version, and assert representative extraction results. Check installed direct dependencies, then clean up temporary installations and caches after confirmed settlement. Record whether each required check passed, failed, or was not run. Candidate-package checks establish isolated feasibility; Phase 9 must repeat the checks on the actual integrated product and inspect its dependency trees for complete Mammoth removal. The evaluation package is not shipping evidence.

The quick verifier retains the explicit `runtimeDependencies` list of `dingbat-to-unicode`, `fast-xml-parser`, and `yauzl`. Earlier evaluation packages used repository-resolved versions; Phase 9 respects the production manifest's exact pins and declared ranges. Package managers resolve transitive dependencies independently of the repository lockfile. Following the Phase 6.3 simplification, the verifier neither traverses nor reports transitive inventories and does not enforce Mammoth absence. Required runtime assets, installed direct declarations and containment, extraction behavior, and cleanup remain acceptance checks.

Phase 6.3 separates these explicit manual commands from routine suites. Product regression fixtures, frozen expectations, and independent assertions belong under `test/` and exercise product code directly; manual commands may reuse them. Manual launcher, harness, smoke-retention, and package-inspector self-tests leave routine coverage. Shared managed-test infrastructure remains separate from manual feature tooling. Earlier phase results describe their reviewed revisions; they do not require retaining the evaluation harness's implementation or test ownership.

## Phased Execution

```text
1 Baseline
    |
2 Research and design agreement
    |  implementation boundary
3 Initial reader and complexity checkpoint
    |
4 Resource isolation
    |
5 Complete content compatibility
    |
6 Complete candidate technical validation
    |
6.1 Validation progress, presentation, and interruption handling
    |
6.2 Package compatibility verification simplification
    |
6.3 Manual script simplification and application-test ownership
    |  verification and selection evidence ready
7 Budget/support acceptance, selection, and maintenance decision
    |  production integration boundary
8 Integration
    |
9 Mammoth removal and shipping verification
    |
10 Documentation closeout
```

### Phase 1: Capture baseline

- [x] When Phase 1 begins, create one unified execution job record under `docs/plans/jobs/`, link it from this plan and the research, and record the source baseline, reusable evidence references, and concise outcomes. Continue updating that same record through all phases. See the [unified execution record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md).
- [x] Reuse the seven existing DOCX title-evidence fixtures and OOXML metadata tests; add reproducible cases for the research's missing content, style, secondary-content, malformed-input, and failure-boundary variations.
- [x] Capture current HTML, raw text, metadata, complete normalized evidence, and prompt payloads separately. Give synthetic cases independent expected content assertions.
- [x] Inventory production, test, script, build, declaration, lockfile, and installed-tree Mammoth consumers, including the historical DOCX/PDF spike and references to it.
- [x] Measure the baseline on identified representative inputs and propose the supported workload, structural caps, and memory/time thresholds using the research's resource metrics and a recorded headroom rationale.

**Deliverable and exit criteria:** a reproducible baseline corpus and comparison harness, a consumer inventory, and proposed resource budgets. Every minimum matrix variation has an identified case; unavailable cases are recorded as gaps and prevent claiming the full comparison is complete. The current adapter is the baseline, not the historical spike's earlier evidence shape or ranking rules.

Phase 1 is complete, with reusable corpus/expectations, consumer inventory, and provisional resource budgets linked from the [unified execution record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md). Its validation, temporary-output cleanup, and full-range review passed. Those baseline outcomes do not satisfy the revised candidate contract; the following phases supply that evidence.

### Phase 2: Research and settle the contract

- [x] Compare shared-process, RSS-increase, and separate-process accounting; settle the process topology, memory ownership, and sampling limitations.
- [x] Define processing-deadline scope, shutdown grace, complete API timing, input/result bounds, active-request limits, environment/loader handling, and offline behavior.
- [x] Trace mapped/unmapped/malformed symbols through the baseline and rename evidence. Evaluate mapping dependency/data ownership, provenance, and licenses; record case-specific omission/failure policies and diagnostic mappings.
- [x] Define the heading-style mapping grammar, note-expansion/cycle scope, and empty/non-text/metadata-only boundaries. Identify additional corpus cases and expected comparison outcomes.
- [x] Record maintainer agreement on the design, implementation scope, and validation method before Phase 3. Keep numerical proposals provisional through Phase 6 measurements and Phase 7 acceptance.

**Deliverable and exit criteria:** one reviewed contract in the research, with explicit choices and identified verification cases. Drafting diagrams or preferring an architecture does not complete this phase. Unresolved design decisions prevent candidate implementation; they do not require accepting all numeric budgets in advance.

### Phase 3: Build the initial reader slice

- [x] Implement a private inline candidate using the existing ZIP/XML and metadata infrastructure, without changing production dispatch or public exports. This initial evaluation slice does not provide the Phase 4 runtime guard.
- [x] Exercise the seven existing DOCX fixtures plus identified cases for custom/inherited headings, mixed paragraph/table/text-box ordering, and metadata-only/invalid-content outcomes through a test-only adapter path. Capture complete evidence/prompt differences and independent expected results for the synthetic cases.
- [x] Expose ordered headings with levels, separate body/raw text, optional metadata, and internal diagnostics. Establish whether content-presence facts are required to preserve failure reasons; keep title ranking in the adapter.
- [x] Record the source footprint, helper changes, difficult semantics, and estimated remaining resource/content/packaging work before expanding. Assess whether preserving evidence still fits a focused reader.
- [x] Record a continue, constrain, or defer outcome. Continue only if the agreed requirements remain achievable; route a supported deferral to Phase 7 with remaining cases explicitly untested.

**Deliverable and exit criteria:** a small executable reader slice with complete comparisons for identified inputs and a complexity decision. This checkpoint does not establish full compatibility, resource acceptance, or candidate selection. A defer outcome follows the Phase 7 decision and Phase 10 documentation route.

The research's [initial reader scope](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#initial-reader-scope) identifies the 22 comparison cases. Phase 5 covers broader content cases; Phase 6 validates the complete candidate envelope.

Phase 3 is complete with a continue outcome. The identified comparisons, built-format Node checks, applicable managed checks, and phase review passed; the [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-3-initial-reader) retains the results. Phases 4–5 track the separate resource boundary and complete content comparisons.

### Phase 4: Implement resource isolation

- [x] Implement the process/worker topology and bounded request/result transport agreed in Phase 2, including environment/loader handling and packaged entry resolution.
- [x] Implement selected-part reading and input, entry, decompressed-byte, XML-node/depth, and style-work limits with explicit outcomes and deterministic archive/stream cleanup.
- [x] Enforce the agreed processing deadline and sampled memory policy independently of blocked parsing. Bound shutdown/escalation and confirm resource settlement for ordinary results; report unconfirmed cleanup as infrastructure failure while retaining ownership/admission until settlement.
- [x] Verify caller-memory independence, controlled below/at/above observations, blocked parsing, startup/crash/early-exit cases, cancellation, parent disconnection, and malformed/oversized messages. Confirm no activity after settled completion, retained ownership during unconfirmed cleanup, and active-request limits.
- [x] Install scoped offline checks and independent positive controls inside the actual parser process/worker. Verify no external URL/file loading or executable-content evaluation.
- [x] Measure prototype overhead and reassess the cost of the execution boundary. Return unresolved accounting, cleanup, or portability issues to the contract before expanding evaluation.

**Deliverable and exit criteria:** an independently tested execution/resource boundary with honest sampling limitations and cleanup behavior. Threshold-policy tests are distinct from real-process feasibility; final budget acceptance belongs to Phase 7.

Phase 4 is complete. The [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-4-resource-isolation) retains guard, runtime, built-format, managed-check, and review outcomes. Stalled input and child cleanup retain ownership when settlement cannot be confirmed; the research describes this infrastructure exception explicitly.

### Phase 5: Complete content compatibility

- [x] Complete main-document/style discovery, ordered text/headings, and secondary-content handling for every minimum corpus variation, tracing both baseline outputs through evidence assembly.
- [x] Implement the agreed font/code mapping ownership and unsupported-symbol policy. Cover prefixed encodings, malformed attributes, and symbols in headings, lead text, and otherwise usable documents; classify each gap or intentional difference.
- [x] Implement the agreed style-map grammar and bounded note handling, including unsupported rules, cycles, repeated references, and distinct heading/raw inclusion.
- [x] Preserve metadata warnings and metadata-only/empty/non-text failure boundaries. Record internal-to-existing diagnostic mappings and the proposed extractor identity.
- [x] Compare complete normalized evidence and exact prompt payloads over the full corpus, including new contract cases. Retain independent synthetic assertions and classify every difference; do not rewrite frozen expectations during ordinary verification.

**Deliverable and exit criteria:** every required content variation has identified cases and complete comparison results. Unresolved consequential regressions prevent selection; restrictions do not become accepted merely because the reader emits text.

Phase 5 is complete. The [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-5-content-compatibility) retains full supervised content comparisons, independent regressions, applicable checks, cleanup, and phase review. Only the agreed extractor identity differs; complete measurements and distribution checks belong to Phase 6, and numerical budget/support acceptance belongs to Phase 7.

### Phase 6: Validate the complete candidate

- [x] Run the complete comparison corpus and reconcile all normalization, intentional-difference, and unresolved-regression classifications with the research contract.
- [x] Independently test below/at/above each structural/runtime threshold with other limits isolated. Distinguish raised-cap compatibility observations from inputs supported by the default workload envelope.
- [x] Measure representative/adversarial cases in isolated processes, including agreed startup, communication, extraction, and cleanup costs. Check actual memory scope, complete API timing, active-request bounds, offline behavior, and temporary cleanup.
- [x] Build and pack the actual candidate through **Candidate Build and Packaging Checks**. Inspect all reader/child/worker assets and dependency trees; verify ESM/CJS extraction after fresh npm and Bun installations under Node.js `>=22.23.0`, including the minimum supported version.
- [x] Pass applicable lint, formatting, type, build, and managed unit/application checks. Source tests and the baseline production package alone are insufficient candidate evidence.

**Deliverable and exit criteria:** an executable candidate, complete comparison results, resource measurements, and runtime/distribution evidence ready for assessment. Missing cases and failed checks remain explicit gaps. Budget/support acceptance and selection belong to Phase 7. A successful text extraction or Bun-only test run is insufficient.

Phase 6 is complete. Its technical checks and full-range review passed at the revision identified in the [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-6-complete-candidate-validation), which links complete comparisons, threshold reconciliation, measurements, and all eight fresh-consumer paths. Those results do not establish the follow-ups' implementation or verification. Phase 7 follows Phases 6.1–6.3 and assesses the research's [demonstrated candidate envelope](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#demonstrated-candidate-envelope), including budget/support acceptance before selection.

### Phase 6.1: Improve validation progress, presentation, and interruption handling

- [x] Stream bounded, append-only progress from the comparison, measurement, and package drivers, including selected scope/counts, active stage/case, actual completed work, and elapsed waiting status during quiet periods. Heartbeats report waiting without advancing completion counts.
- [x] Use the existing `picocolors` development dependency and [terminal presentation conventions](../../scripts/testing/terminal/presentation.ts): bold headings, cyan stages, green success, yellow cancellation/warnings, red failure, and dim timing. Style only a terminal progress destination; honor the presence of `NO_COLOR`, keep redirected progress plain, and retain readable text labels.
- [x] Send human progress to stderr while preserving final stdout status and measurement JSON contracts. Accept only recognized, sanitized progress events; bound buffering/output delivery and report output failures without exposing raw document data, local paths, environment details, or dependency logs.
- [x] Use asynchronous owned-process handling with explicit build/run stage deadlines separate from the reader's extraction deadline. Coordinate Ctrl+C/SIGTERM, startup errors, timeout/escalation, and output failures; confirm owned subprocess/input settlement before deleting temporary artifacts. Unconfirmed cleanup fails and retains ownership. Keep comparison invocable without a POSIX-only preflight and existing POSIX-only driver restrictions explicit; unavailable process-tree settlement must fail with retained ownership.
- [x] Identify failures by stage, synthetic case ID where applicable, and category: build, comparison, runner, startup, timeout, cancellation, output, or cleanup. Use the runner category for measurement/package command or validation failures not covered by a more specific category. Preserve nonzero failure/cancellation outcomes and emit final success only after confirmed cleanup. Keep progress outside the measured parser/RSS-sampling loop and retain the existing corpus, support policy, and extraction budgets.
- [x] Verify progress arrives before completion, truthful counts/waiting, terminal and plain output, `NO_COLOR`, final stdout compatibility, bounded/fragmented output, and interruption/failure cleanup with controlled fixtures. Repeat smoke/full ESM/CJS comparisons under supported Node, including the minimum version; recheck resource measurements and all eight fresh-consumer paths after process/output changes. Pass applicable lint, format, types, build, and managed unit/application checks.
- [x] Reconcile harness-method and test-ownership documentation with verified behavior and record concise outcomes and a manual-validation command subsection in the existing job. Keep durable synthetic fixture/assertion definitions under their test owner and execution artifacts in owned OS temporary storage; preserve frozen expectations and shared managed-test retention.
- [x] Add explicit opt-in smoke retention under `examples/playground/docx-candidate/smoke/<run-id>/`, with unique, owned run directories and no overwrite. Keep generated artifacts Git-ignored and untracked; durable fixture definitions and frozen expectations remain under their existing owners. Ordinary `--smoke` continues automatic cleanup.
- [x] After confirmed process settlement, export only synthetic DOCX inputs, readable extraction results grouped by ESM/CJS and case ID, and a compact `summary.json` containing outcomes and completeness. Print the repository-relative retained location. Clean temporary builds, dependency links, caches, and working files automatically. Failure/cancellation may retain available partial evidence with an explicit incomplete outcome; unconfirmed settlement must fail and must not publish a completed artifact set. Retained runs remain until explicitly removed by the user.
- [x] Verify default cleanup, opt-in retention, artifact contents, unique destinations, destination ownership/symlink safety, failure/cancellation handling, and Git exclusion. Preserve output contracts and shared managed-test retention; document the implemented command, retained layout, and removal responsibility with concise results in the job record. Review the extension commit range and fix findings before closing Phase 6.1 again.
- [x] Add `--help` and `-h` to `launch.mjs`, `measure-launch.mjs`, and `package-check.mjs`. Resolve help and invalid arguments before creating a harness/workspace, building, starting subprocesses, or checking execution prerequisites. Help writes usage to stdout and exits zero; invalid arguments write an actionable error and usage to stderr and exit nonzero. Reject unknown options and invalid combinations, including smoke retention without `--smoke`.
- [x] Keep each entry point's help concise: usage, options, default scope, and command-specific requirements. Keep detailed platform, output, and cleanup/retention instructions in the job's manual-validation section. Keep help readable when redirected; any styling follows destination TTY detection and the presence of `NO_COLOR`.
- [x] Verify both help aliases, output destinations and exit codes, invalid options/combinations, plain/terminal presentation, and absence of workspace/build/subprocess side effects. Update manual commands and concise verification records only after implementation; include help changes in the extension-range review.

**Deliverable and exit criteria:** observable, styled, interruptible validation with stable result output, verified deadlines/cleanup, and renewed candidate evidence after harness changes. The original harness work passed renewed checks, cleanup, and full implementation review in the [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-61-validation-harness-follow-up). The smoke-retention and help extension also passed renewed verification, cleanup, and full-range review. Numerical budget/support acceptance and selection remain in Phase 7. Retained smoke outputs use the ignored playground entry; no new runtime dependency is required.

### Phase 6.2: Simplify package compatibility verification

These checked items describe the reviewed Phase 6.2 revision. The Phase 6.3 follow-up subsequently removes recursive inventory reporting and candidate Mammoth checks.

- [x] Retain the explicit `runtimeDependencies` list of `dingbat-to-unicode`, `fast-xml-parser`, and `yauzl` as the candidate's direct dependency declaration. Use that single list to construct and verify the temporary manifest with repository-installed direct versions; keep dependency versions and reader behavior unchanged.
- [x] Remove `evaluatedTransitiveTree`, its inventory assertion, and npm/Bun tree-equality requirements. Observe resolved transitive inventories without requiring particular names, versions, counts, or per-package approval; preserve candidate Mammoth absence and isolated dependency resolution.
- [x] Verify required exports and reader/child/worker/parser assets while allowing additional ordinary package files. Remove regex-based JavaScript import inspection; use the declared dependencies and actual isolated consumer execution. Limit any byte-integrity comparisons to required runtime assets.
- [x] Support package-manager installation layouts and internal links whose resolved targets stay inside the owned consumer installation. Remove installer options used solely to satisfy the old layout checks. Continue rejecting resolution through repository or ambient dependencies, missing runtime requirements, and unavailable required imports; preserve the existing process/output ownership and cleanup handling.
- [x] Add focused regressions showing that valid transitive-version/tree differences, extra package files, and contained installation links pass, while missing assets/dependencies, repository fallback, and candidate Mammoth presence fail. Keep durable fixture/assertion definitions under their test owner and generated inputs/installations in owned OS temporary storage; clean verification artifacts after confirmed settlement.
- [x] Repeat all eight npm/Bun × primary/minimum Node × ESM/CJS consumer paths, including representative extraction, bounded failures, offline controls, and confirmed cleanup. Run affected regressions, entry-point help/error checks, and applicable lint, formatting, type, build, and managed checks. Repeat parser comparisons or resource measurements only if their execution path changes.
- [x] Update the research, manual-validation wording, test ownership references where affected, and the existing job section with verified outcomes. Preserve prior phase evidence and concise help; use the existing commands and approved retention entry without adding a general policy framework or strict/permissive modes.

**Historical Phase 6.2 exit criteria:** the packed candidate passed all eight consumer paths while accepting harmless transitive-inventory and installation-layout differences. Missing runtime requirements, isolation failures, Mammoth presence, and unconfirmed cleanup were failures at that revision. The [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-62-package-compatibility-verification) links the reviewed implementation, verification, and full-suite deadline limitation. The Phase 6.3 follow-up supersedes recursive inventory and candidate Mammoth checks; Phase 9 retains complete actual-product Mammoth-removal verification. License/notice review remains outside this quick verifier.

### Phase 6.3: Simplify manual validation and separate application regressions

- [x] Inventory routine tests whose subject is manual feature tooling, including DOCX evaluation, Markdown PDF evidence/smoke tools, video smoke workspaces, and data fixture generators. Account for each retained, migrated, or retired responsibility. Review related unit coverage as well as application wrappers; shared managed-test infrastructure remains under its existing owners. Limit script implementation simplification to the DOCX modules.
- [x] Place durable product fixtures, synthetic input builders, frozen expectations, and independent assertions under their test owner. Preserve reader content/evidence/prompt, fallback, and resource/process regression coverage by exercising product code directly. Manual commands may reuse these definitions; routine product tests must not depend on manual launchers or evaluation adapters.
- [x] Remove manual-script-only wrappers from routine suites and retire unused supporting drivers. Preserve product assertions from mixed tests before removing their manual-tooling checks. Do not reproduce the manual build/install/smoke workflow inside replacement tests or move it to another routine suite; record the resulting ownership and case-count changes explicitly.
- [x] Simplify the DOCX manual commands around comparison, measurement, and packaged-consumer validation. Remove embedded harness self-test probes, unused test-only configuration, and demonstrated redundant orchestration. Preserve concise help, observable styled/plain progress, nonzero failure/interruption outcomes, bounded subprocess handling, confirmed temporary cleanup, and explicit smoke retention. Keep the Phase 6.2 direct-dependency and runtime-focused package contract; add no policy framework or license checker. Keep reader behavior and extraction budgets unchanged.
- [x] Explicitly verify the affected manual commands, including help/errors, smoke retention, interruption/failure cleanup, and complete ESM/CJS comparisons. Recheck affected resource measurements and all eight fresh-consumer paths when build/process/output or package execution changes. Preserve corpus coverage and frozen expectations; record these outcomes separately from routine-suite results. Run affected product regressions and applicable lint, formatting, type, and build checks; add coverage only for changed product behavior.
- [x] Run the ordinary `bun run test:integration:app` command after ownership changes under the current committed policy. If it still reaches its ceiling, capture one full managed diagnostic run with a temporary 360-second suite ceiling and inspect elapsed time and main contributors before choosing a minimal work correction or justified suite-budget change. If that diagnostic also expires, investigate the explicit gap before another run. A diagnostic ceiling does not select the committed budget. Close only with an ordinary full run of the complete revised selection, zero failures/errors/skips, valid reports, successful output delivery, and confirmed cleanup. Preserve prerequisites, isolation, per-test/child deadlines, cancellation, and report validation; introduce no automatic retries, runtime filtering, profiling framework, or public runner options.
- [x] Preserve the existing managed fixture/report lifecycle and approved manual smoke-retention entry. Keep additional timing/log files in owned OS temporary storage and remove owned artifacts after confirmed settlement on success, failure, or cancellation; unconfirmed cleanup remains a failure. Update the research, affected testing guidance/ownership references, manual commands, and existing job section with compact simplification, coverage, verification/cleanup, and reviewed-revision outcomes. Preserve historical phase results and distinguish suite execution policy from extraction limits.
- [x] Follow-up: remove candidate Mammoth checks and recursive dependency inventory/reporting. Retain the three direct installed dependency checks, required assets/exports, contained resolution, and actual consumer behavior. Verify all eight fresh-consumer paths, help/errors, and focused direct-dependency failures; leave complete product Mammoth-removal verification in Phase 9.

**Deliverable and exit criteria:** simpler manual DOCX commands, explicit manual-tooling versus product-test ownership, preserved durable product coverage, and passing ordinary full application verification for the revised selection. A smaller suite alone does not demonstrate faster product behavior or resolve an individual failure. Phase 6.3 is complete; the [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-63-manual-script-simplification-and-test-ownership) covers ownership, preserved inputs, routine and explicit manual verification, cleanup, and review. The ordinary full application suite passes under its unchanged policy. Phase 7 acceptance and selection are recorded below.

### Phase 7: Assess and select

- [x] Confirm Phases 6, 6.1, 6.2, and 6.3 completion at their reviewed revisions, then review the full comparison matrix, proposed differences, diagnostic mappings, resource results, and candidate runtime/distribution checks against the research decision gate. Use Phase 6.3's simplified manual commands and test ownership as the current baseline; distinguish explicit manual matrices from routine product regression results.
- [x] Obtain maintainer acceptance of the demonstrated numerical budgets, memory/deadline semantics, support envelope, and specifically justified differences before selecting the reader. Revisit affected design/implementation and checks when proposed limits or policies change.
- [x] Assess reused code, new parsing responsibilities, difficult compatibility cases, demonstrated workload suitability, supported scope, limitations, retained dependencies, licenses/provenance, and upkeep of the product regression corpus and simplified manual validation commands.
- [x] Record maintainer acceptance of dependency/security updates, editor regressions, product-corpus and manual-command upkeep, diagnostic decisions, and future resource-budget changes.
- [x] Record a compact acceptance table in the research covering numerical budgets, memory/deadline semantics, content and platform support limits, accepted differences, maintenance responsibility, and the proceed-or-defer outcome. Link the reviewed candidate revision, execution evidence, and remaining consumer migration work; distinguish verified platforms from unverified coverage.
- [x] If proceeding, settle reader boundaries and types and refine Phases 8–9 from the demonstrated implementation requirements before integration begins.

**Decision gate:** proceed only when useful evidence is equivalent or differences are specifically accepted, accepted resource budgets are met, explicit candidate runtime/distribution checks and the ordinary full application suite for the reviewed ownership pass, and maintenance ownership is accepted. Explicit manual matrix results remain required after wrapper retirement. Unresolved consequential regressions or missing required evidence prevent selection. Final repository migration is not required at this checkpoint.

The maintainer accepted the [full proposal](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#phase-7-assessment-and-acceptance-proposal) recorded at `141363f4`, selecting assessed candidate `244b3e61` for integration. Phase 7 is complete; the Phase 8 scope below implements that decision. Phase 9 retains dependency removal and final actual-product shipping acceptance.

If deferred, preserve the findings and identify unmet criteria; do not start Phases 8–9. Perform Phase 10 for the deferral outcome and leave unrun candidate phases explicit. Mark the plan `blocked` if it is expected to resume, or `cancelled` if the replacement is intentionally abandoned; do not mark the replacement plan completed. The research may be completed with an evidence-backed deferral even when implementation does not proceed.

### Phase 8: Integrate the selected reader

- [x] Preserve the live Mammoth oracle in baseline-only support before switching production; redirect capture, baseline verification, and baseline measurement consumers without changing frozen expectations. Integrate the selected reader behind the existing DOCX rename adapter, retain reused OOXML helpers initially, and account for their metadata consumers. Live baseline retirement remains Phase 9.
- [x] Create one supervisor per document-title operation and reuse it through the existing sequential extraction loop. Verify repeated calls, concurrent independent operations with separate budgets, busy admission, and retained ownership after unconfirmed cleanup; do not bypass a failed owner with a new per-file owner. Preserve existing model batching/retries and keep model-request timeout distinct from per-document extraction deadline.
- [x] Include fixed child, worker, and parser assets in the production build and packed outputs. Verify packaged asset resolution through the actual CLI and built ESM/CJS entry points without source-tree paths or a new public reader API.
- [x] Preserve adapter normalization, title ranking, prompt construction, and outward failure behavior; apply only accepted resource/support differences. Keep the 10 MiB CLI prefilter: DOCX input above the accepted 8 MiB reader cap through 10 MiB returns existing `docx_extract_error`, while input above 10 MiB retains the existing too-large skip reason. Verify exact boundaries and accurate extractor identity.
- [x] Repeat complete evidence/prompt comparisons on the integrated adapter/runtime using Phase 6.3's test-owned fixtures and independent assertions, retaining baseline expectations after Mammoth is removed. Verify the accepted production process/output behavior without depending on the manual evaluation adapter or launcher.
- [x] Run affected pure parsing and managed application tests against product code directly. Use test-owned compiled Node drivers for source application coverage of fixed runtime assets; add no inline production fallback or manual launcher dependency. Use stubbed batch/thread checks for dispatch, option forwarding, retries/batching, and reason propagation without relying on live model-generated titles. Keep explicit built-format and fresh npm/Bun product-consumer validation separate, using the simplified manual process/cleanup approach; do not promote their harness into production or routine product coverage. Complete actual-product Mammoth removal and shipping checks remain Phase 9.
- [x] Update affected extractor identity assertions and current behavior documentation as integration settles.

**Deliverable and exit criteria:** the integrated reader satisfies the agreed contract and affected tests. No runtime backend selector is introduced. Any newly discovered consequential difference returns to the compatibility decision before acceptance. Phase 8 is complete; the [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-8-production-integration) separates routine and manual results, the unreproduced validation anomaly, and the full-range review. Phase 9 records subsequent dependency removal and shipping checks.

### Phase 9: Remove Mammoth and verify shipping acceptance

- [x] Capture and review expectations for remaining live-baseline probes before retiring their Mammoth calls. Account for the baseline-only support isolated during Phase 8. Preserve test-owned frozen expectations and independent product assertions, and separate historical Mammoth benchmark findings from ongoing correctness and budget checks. Do not restore manual baseline-launcher checks to routine suites.
- [x] Migrate or retire remaining Mammoth consumers, including live baseline capture and measurement paths, so product regressions and surviving manual validation commands run without Mammoth. For the historical spike, check references and preserve still-needed findings and useful PDF comparisons before changing or retiring its DOCX path.
- [x] Remove Mammoth imports, runtime/development declarations, build externalization, obsolete type references, and lockfile entries; regenerate repository installation state through the package manager.
- [x] Confirm production code, tests, scripts, and historical tooling no longer require Mammoth. Preserve historical expectations and supported document-part names such as `/mammoth/style-map`; explanatory historical references may remain.
- [x] Run applicable lint, formatting, build, and managed product test checks under the testing guide; repeat the final evidence/prompt, fallback, and resource acceptance checks. Record explicit manual validation separately and preserve Phase 6.3's ownership boundary.
- [x] Verify the final CLI and built ESM/CJS entry points under supported Node.js, including the minimum supported version. Record the outcome for each required path.
- [x] Inspect the actual packed product and explicitly repeat the npm/Bun fresh-consumer installation checks defined in **Candidate Build and Packaging Checks**, alongside repository installed trees. Apply the Phase 6.2 runtime-focused contract through the Phase 6.3 simplified manual tooling to the product's actual entry points and dependencies, retaining progress/interruption/cleanup behavior; the private candidate package is not final-product evidence. Review applicable licenses and packaged notices against the actual dependency inventory; the quick candidate verifier does not establish license or notice completeness. Confirm Mammoth absence and account for any independent retained `argparse`/`sprintf-js` paths.
- [x] Record final results, maintenance acceptance, limitations, and the precise dependency/audit outcome. Claim dependency remediation only when the installed-tree evidence supports it.

**Deliverable and exit criteria:** final integrated-product evidence satisfies the research's shipping gate and complete Mammoth removal goal. Phase 9 is complete; its [record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-9-mammoth-removal-and-shipping-verification) separates routine/manual checks, dependency findings, and remaining limitations. Technical acceptance does not complete this plan until Phase 10 passes.

### Phase 10: Validate documentation and close out

- [ ] Check that current guides describe verified extraction behavior, supported scope, provenance where relevant, fallback behavior, and limitations; do not publish unverified candidate behavior as shipped guidance. Reconcile surviving simplified manual commands with the Mammoth-free path, including prerequisites, cleanup, and optional smoke retention. Keep routine product-test ownership distinct from explicit manual evaluation and remove stale references to retired wrappers or tooling.
- [ ] Check that the research records the supported recommendation, accepted differences, ownership, and links to evidence. A selected direction alone does not justify `completed`.
- [ ] Reconcile plan checkboxes and the unified execution job record's phase sections, including Phases 6.1–6.3, results, and status with actual work, including pending checks or deferral reasons. Preserve the distinction between historical harness/package results, current manual verification and product regressions, budget/support acceptance, candidate selection, and shipping acceptance.
- [ ] Check current extractor/dependency descriptions and clearly contextualize retained historical Mammoth references. Do not rewrite historical findings as if they described the replacement.
- [ ] Validate repository-relative links, required research/plan backlinks, UTC dates, front matter, paragraph formatting, and document placement against the documentation policy. Apply release-note policy if release notes are affected.
- [ ] Record documentation validation results and set final statuses from the demonstrated outcome. Keep research and plans in their current locations unless a separate archive review justifies moving them.

**Deliverable and exit criteria:** documentation consistently describes the verified result and its limits. On the shipping path, all ten main phases and Phases 6.1–6.3 must be complete before the plan is marked `completed`. On the deferral path, documentation reflects deferral without presenting unexecuted candidate/integration/removal phases as complete.

## Phase Review and Recording

For each authorized phase, validate coherent changes, checkpoint meaningful verified progress, review the complete phase commit range, and fix/review findings before closing that phase. Record concise outcomes and reusable evidence links in the unified job record; keep rationale and accepted contracts in the research. A passing intermediate check does not complete a phase whose exit criteria remain unmet. These procedures apply across phases without becoming repeated implementation checklist items.

## Stop Conditions and Recovery

Keep the working Mammoth production path during candidate evaluation. Stop selection or integration when required compatibility or Phases 6.1–6.3 verification evidence is missing, consequential differences are unresolved, budgets are unaccepted or unmet, Node/distribution checks fail, or maintenance responsibility is unaccepted. Broader-than-expected OOXML complexity is grounds to reassess the benefit and defer.

Use reviewable phase boundaries and record tested revisions so a failed integration can be reverted coherently with its dependency declarations and lockfile. Before shipping, verify the candidate can be removed or the integration reverted without losing the baseline corpus and findings. Any rollback that restores Mammoth also restores its dependency exposure; update remediation claims accordingly. Do not introduce a permanent runtime backend switch for recovery.

## Evidence and Documentation Handling

The research owns findings and the proceed/defer recommendation; this plan owns execution steps and gates; the existing unified execution job record owns concise phase outcomes, pending checks, and links to reusable evidence across the ten main phases and Phases 6.1–6.3. Keep substantive compatibility decisions and budget rationale in the research or accepted contract, not a local execution diary. Maintain that record by plan phase rather than creating separate per-phase or plan-revision job records.

Keep the unified record `in-progress` while execution continues. Completing the evaluation or research decision alone does not complete the record while integration, removal, or final docs validation remains pending. Mark it `completed` only when all ten main phases and Phases 6.1–6.3 have passed. If the replacement is deferred, record the evidence and unexecuted phases and use `blocked` when execution is expected to resume or `cancelled` when it is intentionally abandoned, consistent with the plan's deferral route even after Phase 10 documents that outcome.

Use owned OS temporary directories for execution files and remove working files after confirmed process settlement on success or failure. Unconfirmed cleanup fails and retains ownership; explicit smoke exports follow the approved retention policy. Keep reviewed synthetic regression fixtures and expectations under their test owner. Record only concise check outcomes; do not commit raw execution reports, host details, local setup, cache locations, or run-specific paths. Baseline expectation updates require an explicit export and review; ordinary verification must not rewrite them.

`examples/playground/` is reserved for deliberately chosen, inspectable smoke-test examples and outputs. Phase 6.1 approved the Git-ignored `examples/playground/docx-candidate/smoke/<run-id>/` entry for explicit smoke retention; users remove retained runs after inspection. Before adding another entry, discuss its purpose, exact input/output files, inspection needs, and retention with the maintainer. Do not change shared managed-test fixture handling as part of the manual evaluation harness.

Update documentation during each phase; Phase 10 is the final consistency pass. Plan creation leaves both this plan and the current research `draft`. When execution starts, use `active` for the plan and `in-progress` for the research. Research completion may precede shipping only when its decision gate has supporting evidence.

## Related Research

- [DOCX extraction and Mammoth replacement](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md)

## Historical Context

The [February extractor spike plan](archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md) and [findings](../researches/archive/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md) evaluated whether Mammoth/PDF.js supplied useful rename evidence. They inform the fixture and harness approach but do not establish replacement compatibility. The [metadata helper and flag graduation plan](archive/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md) records subsequent OOXML infrastructure and title-ranking work that this plan should reuse.

## Supporting Policies

- [Documentation policy](../../DOCUMENTATION_POLICY.md)
- [Testing guide](../guides/testing.md)
- [CLI integration and subsystem placement](../guides/cli-action-tool-integration-guide.md#what-belongs-in-srcutils-vs-not)
- [Release notes policy](../../RELEASE_NOTES_POLICY.md)
