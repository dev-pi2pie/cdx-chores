---
title: "DOCX reader and Mammoth replacement"
created-date: 2026-10-16
modified-date: 2026-10-16
status: active
agent: codex
---

## Goal

Evaluate and, if justified, integrate a focused project-owned DOCX reader that preserves semantic rename evidence and fallback behavior while enabling complete Mammoth removal.

This plan includes candidate evaluation and conditional production migration. Phases 1–3 establish the research decision; Phases 4–5 proceed only after that decision supports replacement. Phase 6 validates documentation before closeout. The [unified execution record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md) tracks Phase 1 baseline capture, validation, and review. Execution stops before Phase 2 under the current scope; no replacement has been selected.

## Scope

In scope:

- Node-compatible TypeScript/JavaScript package discovery, ordered text, heading signals, metadata, and internal diagnostics using the existing ZIP/XML dependencies.
- Compatibility comparisons, explicit resource budgets, maintenance assessment, adapter integration, consumer migration, and dependency/distribution verification.
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

The exact file split, reader types, and failure representation remain provisional through evaluation. Avoid a second ZIP/XML implementation. Establish whether an internal non-text-content signal is needed to preserve extraction reasons without generating HTML. Prototype code may be retained after review and validation; it must not become production infrastructure merely because it exists.

## Candidate Build and Packaging Checks

Use a private evaluation harness that imports the actual candidate reader and builds separate ESM and CJS entry points with the repository's bundling tooling. Keep its build configuration separate from production entry points. Builds, generated inputs, package tarballs, consumer installations, caches, logs, and raw reports belong in owned OS temporary directories with cleanup on success and failure. Keep source entry points and fixture assertions reproducible in the harness; record concise outcomes rather than local setup or run metadata.

Pack those built entry points into an evaluation-only package with `private: true`, scratch exports for both formats, and the reader's actual runtime dependencies declared at repository-resolved versions. Keep those dependencies external to the harness build so installation exercises their resolution. The Mammoth baseline/comparison runner stays outside this package. Inspect the temporary tarball for the candidate code and required files; packing the unchanged production package does not establish candidate inclusion. This harness does not add a public reader API or publish a package.

The required installation matrix for both Phase 2 and Phase 5 is npm and Bun. Install the same stage-specific tarball in separate fresh temporary consumer directories, without links or module-resolution fallbacks to the repository's `node_modules`. After each installation, invoke both built formats with Node.js, including the minimum supported version, and assert representative extraction results. Inspect the installed dependency trees, then clean up temporary installations and caches. Record whether each required check passed, failed, or was not run. Candidate-package checks establish isolated feasibility; Phase 5 must repeat the checks on the actual integrated product and cannot use the evaluation package as shipping evidence.

## Phased Execution

### Phase 1: Capture baseline

- [x] When Phase 1 begins, create one unified execution job record under `docs/plans/jobs/`, link it from this plan and the research, and record the source baseline, reusable evidence references, and concise outcomes. Continue updating that same record through all phases. See the [unified execution record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md).
- [x] Reuse the seven existing DOCX title-evidence fixtures and OOXML metadata tests; add reproducible cases for the research's missing content, style, secondary-content, malformed-input, and failure-boundary variations.
- [x] Capture current HTML, raw text, metadata, complete normalized evidence, and prompt payloads separately. Give synthetic cases independent expected content assertions.
- [x] Inventory production, test, script, build, declaration, lockfile, and installed-tree Mammoth consumers, including the historical DOCX/PDF spike and references to it.
- [x] Measure the baseline on identified representative inputs and propose the supported workload, structural caps, and memory/time thresholds using the research's resource metrics and a recorded headroom rationale.

**Deliverable and exit criteria:** a reproducible baseline corpus and comparison harness, a consumer inventory, and proposed resource budgets. Every minimum matrix variation has an identified case; unavailable cases are recorded as gaps and prevent claiming the full comparison is complete. The current adapter is the baseline, not the historical spike's earlier evidence shape or ranking rules.

Phase 1 is complete, with reusable corpus/expectations, consumer inventory, and provisional resource budgets linked from the [unified execution record](jobs/2026-10-16-docx-reader-and-mammoth-replacement.md). Validation, temporary-output cleanup, and full-range review passed. Candidate time/RSS enforcement cases remain explicitly unrun; no candidate comparison or budget acceptance is claimed. Phase 2 is unstarted.

### Phase 2: Build candidate reader

#### Initial slice and complexity checkpoint

- [ ] Implement an isolated candidate using the existing ZIP/XML and metadata infrastructure, without changing production dispatch.
- [ ] Exercise the seven existing DOCX fixtures plus identified cases for custom/inherited headings, mixed paragraph/table/text-box ordering, and metadata-only/invalid-content outcomes through a test-only adapter path. Capture complete evidence/prompt differences and independent expected results for the synthetic cases.
- [ ] Before expanding to the full corpus, record the source footprint, helper changes, unresolved OOXML semantics, and estimated remaining parsing/test work. Assess whether preserving evidence still fits a focused reader or requires substantially broader conversion logic.
- [ ] Record a continue, constrain, or defer outcome. Continue with the full evaluation if the scope remains maintainable; constrain the internal design only if the full compatibility requirements remain achievable. If complexity warrants deferral, move to Phase 3 with the supporting findings and mark remaining cases untested.

**Checkpoint:** this initial slice informs the cost decision and does not establish compatibility or select the candidate. A continue/constrain outcome must still complete the research's full minimum matrix and all acceptance checks below. A defer outcome follows the Phase 3 deferral route and Phase 6 documentation validation without claiming full evaluation or shipping acceptance.

#### Complete candidate evaluation

- [ ] Implement main-document/style discovery and the content/style semantics needed by the corpus; trace secondary content through both Mammoth outputs before choosing its handling.
- [ ] Expose ordered headings with levels, a separate body/raw-text stream, optional metadata, and internal diagnostics. Specify diagnostic/failure mappings and the proposed extractor identity.
- [ ] Implement selected-part reading, resource enforcement, deterministic cleanup, and offline handling. Do not load external URLs/files or evaluate executable content.
- [ ] Compare complete evidence and prompt payloads through a test-only adapter path. Classify every difference as equivalent under normalization, intentional and justified, or unresolved regression.
- [ ] Measure resource behavior and test below/at/above each proposed cap. Obtain maintainer acceptance of the budgets and support envelope before labeling candidate results as passing.
- [ ] Build and pack the actual candidate through the private harness described in **Candidate Build and Packaging Checks**. Verify extraction through both ESM/CJS entry points under Node.js `>=22.23.0`, including the minimum supported version, after fresh npm and Bun installations. Record inspection, extraction, and dependency-tree check outcomes; clean up temporary artifacts.

**Deliverable and exit criteria:** an executable candidate, complete comparison results, resource measurements, and runtime/distribution evidence ready for a selection decision. Missing cases, failed checks, and unaccepted budgets remain explicit gaps. A successful text extraction or Bun-only test run is insufficient.

### Phase 3: Evaluate and decide whether to proceed

- [ ] Review the full comparison matrix, exact accepted differences, diagnostic mappings, resource results, and candidate runtime/distribution checks against the research decision gate.
- [ ] Assess reused code, new parsing responsibilities, difficult compatibility cases, supported scope, limitations, retained dependencies, licenses/provenance, and ongoing corpus costs.
- [ ] Record maintainer acceptance of dependency/security updates, editor regressions, corpus upkeep, diagnostic decisions, and future resource-budget changes.
- [ ] Record a supported proceed-or-defer recommendation in the research, linked to execution evidence and the remaining consumer migration work.
- [ ] If proceeding, settle reader boundaries and types and refine Phases 4–5 from the demonstrated implementation requirements before integration begins.

**Decision gate:** proceed only when useful evidence is equivalent or differences are specifically accepted, accepted resource budgets are met, candidate runtime/distribution checks pass, and maintenance ownership is accepted. Unresolved consequential regressions or missing required evidence prevent selection. Final repository migration is not required at this checkpoint.

If deferred, preserve the findings and identify unmet criteria; do not start Phases 4–5. Perform Phase 6 for the deferral outcome. Mark the plan `blocked` if it is expected to resume, or `cancelled` if the replacement is intentionally abandoned; do not mark the replacement plan completed. The research may be completed with an evidence-backed deferral even when implementation does not proceed.

### Phase 4: Integrate replacement

- [ ] Integrate the selected reader behind the existing DOCX rename adapter and reuse or relocate OOXML helpers with their existing consumers accounted for.
- [ ] Preserve adapter normalization, title ranking, limits, prompt construction, and outward failure behavior; apply only the differences accepted at the decision gate.
- [ ] Repeat complete evidence/prompt comparisons on the integrated path, retaining baseline expectations after Mammoth is removed from the repository.
- [ ] Run affected pure parsing and managed application tests. Use stubbed batch/thread checks for dispatch, option forwarding, retries/batching, and reason propagation without relying on live model-generated titles.
- [ ] Update affected extractor identity assertions and current behavior documentation as integration settles.

**Deliverable and exit criteria:** the integrated reader satisfies the agreed contract and affected tests. No runtime backend selector is introduced. Any newly discovered consequential difference returns to the compatibility decision before acceptance.

### Phase 5: Remove Mammoth and verify shipping acceptance

- [ ] Migrate or retire remaining Mammoth consumers. For the historical spike, check references and preserve still-needed findings and useful PDF comparisons before changing or retiring its DOCX path.
- [ ] Remove Mammoth imports, runtime/development declarations, build externalization, obsolete type references, and lockfile entries; regenerate repository installation state through the package manager.
- [ ] Confirm production code, tests, scripts, and historical tooling no longer require Mammoth. Explanatory historical references may remain.
- [ ] Run applicable lint, formatting, build, and managed test checks under the testing guide; repeat the final evidence/prompt, fallback, and resource acceptance checks.
- [ ] Verify the final CLI and built ESM/CJS entry points under supported Node.js, including the minimum supported version. Record the outcome for each required path.
- [ ] Inspect the actual packed product and repeat the npm/Bun fresh-consumer installation checks defined in **Candidate Build and Packaging Checks**, alongside repository installed trees. Exercise the integrated DOCX path under Node.js; the private candidate harness is not final-product evidence. Confirm Mammoth absence and account for any independent retained `argparse`/`sprintf-js` paths.
- [ ] Record final results, maintenance acceptance, limitations, and the precise dependency/audit outcome. Claim dependency remediation only when the installed-tree evidence supports it.

**Deliverable and exit criteria:** final integrated-product evidence satisfies the research's shipping gate and complete Mammoth removal goal. Technical acceptance does not complete this plan until Phase 6 passes.

### Phase 6: Docs validation

- [ ] Check that current guides describe verified extraction behavior, supported scope, provenance where relevant, fallback behavior, and limitations; do not publish unverified candidate behavior as shipped guidance.
- [ ] Check that the research records the supported recommendation, accepted differences, ownership, and links to evidence. A selected direction alone does not justify `completed`.
- [ ] Reconcile plan checkboxes and the unified execution job record's phase sections, results, and status with actual work, including pending checks or deferral reasons. Preserve the distinction between candidate selection and shipping acceptance.
- [ ] Check current extractor/dependency descriptions and clearly contextualize retained historical Mammoth references. Do not rewrite historical findings as if they described the replacement.
- [ ] Validate repository-relative links, required research/plan backlinks, UTC dates, front matter, paragraph formatting, and document placement against the documentation policy. Apply release-note policy if release notes are affected.
- [ ] Record documentation validation results and set final statuses from the demonstrated outcome. Keep research and plans in their current locations unless a separate archive review justifies moving them.

**Deliverable and exit criteria:** documentation consistently describes the verified result and its limits. On the shipping path, all six phases must be complete before the plan is marked `completed`. On the deferral path, documentation reflects deferral without presenting unexecuted integration/removal phases as complete.

## Stop Conditions and Recovery

Keep the working Mammoth production path during candidate evaluation. Stop selection or integration when required compatibility evidence is missing, consequential differences are unresolved, budgets are unaccepted or unmet, Node/distribution checks fail, or maintenance responsibility is unaccepted. Broader-than-expected OOXML complexity is grounds to reassess the benefit and defer.

Use reviewable phase boundaries and record tested revisions so a failed integration can be reverted coherently with its dependency declarations and lockfile. Before shipping, verify the candidate can be removed or the integration reverted without losing the baseline corpus and findings. Any rollback that restores Mammoth also restores its dependency exposure; update remediation claims accordingly. Do not introduce a permanent runtime backend switch for recovery.

## Evidence and Documentation Handling

The research owns findings and the proceed/defer recommendation; this plan owns execution steps and gates; one unified execution job record owns concise phase outcomes, pending checks, and links to reusable evidence across all six phases. Keep substantive compatibility decisions and budget rationale in the research or accepted contract, not a local execution diary. Create and link the record only when Phase 1 execution begins, using the actual creation date under the documentation policy. Do not create a job record for drafting or revising this plan. Organize the same record by plan phase and update it throughout execution; do not create separate per-phase job records by default.

Keep the unified record `in-progress` while execution continues. Completing the evaluation or research decision alone does not complete the record while integration, removal, or final docs validation remains pending. Mark it `completed` only when all six phases have passed. If the replacement is deferred, record the evidence and unexecuted phases and use `blocked` when execution is expected to resume or `cancelled` when it is intentionally abandoned, consistent with the plan's deferral route even after Phase 6 documents that outcome.

Use owned OS temporary directories for execution files and remove them on success or failure. Keep reviewed synthetic regression fixtures and expectations under their test owner. Record only concise check outcomes; do not commit raw execution reports, host details, local setup, cache locations, or run-specific paths. Baseline expectation updates require an explicit export and review; ordinary verification must not rewrite them.

`examples/playground/` is reserved for deliberately chosen, inspectable smoke-test examples and outputs. Before adding an entry, discuss its purpose, exact input/output files, inspection needs, and retention with the maintainer. This plan does not authorize a playground entry; Phase 1 needs none. Do not change shared managed-test fixture handling as part of the manual evaluation harness.

Update documentation during each phase; Phase 6 is the final consistency pass. Plan creation leaves both this plan and the current research `draft`. When execution starts, use `active` for the plan and `in-progress` for the research. Research completion may precede shipping only when its decision gate has supporting evidence.

## Related Research

- [DOCX extraction and Mammoth replacement](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md)

## Historical Context

The [February extractor spike plan](archive/plan-2026-02-26-docx-pdf-title-evidence-extractor-spike.md) and [findings](../researches/archive/research-2026-02-26-docx-pdf-title-evidence-spike-findings.md) evaluated whether Mammoth/PDF.js supplied useful rename evidence. They inform the fixture and harness approach but do not establish replacement compatibility. The [metadata helper and flag graduation plan](archive/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md) records subsequent OOXML infrastructure and title-ranking work that this plan should reuse.

## Supporting Policies

- [Documentation policy](../../DOCUMENTATION_POLICY.md)
- [Testing guide](../guides/testing.md)
- [CLI integration and subsystem placement](../guides/cli-action-tool-integration-guide.md#what-belongs-in-srcutils-vs-not)
- [Release notes policy](../../RELEASE_NOTES_POLICY.md)
