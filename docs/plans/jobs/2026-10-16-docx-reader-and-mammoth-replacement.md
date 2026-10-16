---
title: "DOCX reader and Mammoth replacement execution"
created-date: 2026-10-16
modified-date: 2026-10-16
status: in-progress
agent: codex
---

## Scope

Execution record for the [plan](../plan-2026-10-16-docx-reader-and-mammoth-replacement.md) and [research](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md). Phase 1 source baseline: `bc6e3e985fbb410797cefbece20a00e38a9bf526`. Phases 1–4 are complete.

## Phase 1 Outcomes

The [case manifest](../../../test/document-rename/fixtures/docx-baseline/manifest.json) covers 70 semantic cases, including seven existing DOCX fixtures, and 21 structural boundary cases. Phase 1 captured current Mammoth behavior for later candidate comparison.

| Check | Result |
| --- | --- |
| [Mammoth consumer inventory](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#phase-1-consumer-inventory) completed | Yes |
| Complete evidence and prompt expectations retained | Yes |
| Resource measurements completed and [provisional budgets](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#resource-budgets) proposed | Yes |
| Candidate implementation started | No |

Reusable evidence: [harness](../../../scripts/docx-baseline/launch.mjs), [corpus](../../../scripts/docx-baseline/corpus/index.ts), [semantic expectations](../../../test/document-rename/fixtures/docx-baseline/expected.json), [resource expectations](../../../test/document-rename/fixtures/docx-baseline/resources.json), and [provisional limits](../../../scripts/docx-baseline/resources.ts). Execution files and raw reports are temporary; no playground entry is needed for this phase.

## Phase 1 Verification and Review

| Verification | Passed |
| --- | --- |
| Lint, formatting, type checking, and production build | Yes |
| Managed unit and application suites | Yes |
| Node baseline verification, including the minimum supported runtime | Yes |
| Scoped offline checks and temporary-output cleanup | Yes |

Reviewed Phase 1 range: `bc6e3e98..b6299eae`. Result: no remaining material findings.

## Phase 2: Research and Contract

The earlier candidate attempt is preserved on `codex/docx-reader-phase2-preserved` at `2034f31e`. The active work resumed from the completed Phase 1 checkpoint, `b6f456e0`; preserved candidate checks do not satisfy the revised contract.

Phase 2 source baseline: `e21bc413ec52a2b882b4a01f25f527e962331dbf`.

| Check | Result |
| --- | --- |
| Attempt preserved and Phase 1 checkpoint restored | Yes |
| [Technical research section and ASCII sketches](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#resource-isolation-and-content-support-contract) added | Yes |
| Plan renumbered into ten outcome-focused phases | Yes |
| Documentation review and link/status checks | Yes; no remaining material findings |
| Additional baseline contract cases | Yes; 33 cases, original 91 unchanged |
| Runtime and content contract review | Yes; agreed design recorded |
| Lint, formatting, types, build, managed unit/application checks, Node baseline/contract verification | Passed |
| Phase 2 full-range review | Passed; findings fixed |
| Phase 2 design agreement | Yes; implementation scope and validation method accepted |
| Candidate implementation during Phase 2 | No |

Reviewed full Phase 2 range: `e21bc413..35bfe746`. Review fixes distinguish successful empty conversion from converter failure, prove overlapping style-rule precedence, and assert note ordering/ranking before deduplication.

## Phase 3: Initial Reader

Source baseline: `35bfe7466bf797bff6d49f0d143ce6a3f83ede03`. The private inline reader is an evaluation slice; production extraction continues through Mammoth.

| Check | Result |
| --- | --- |
| [Identified 22-case comparisons](../../../scripts/docx-candidate/cases.ts), complete evidence/prompts, independent expectations | Passed; only agreed extractor identity differs |
| Built ESM/CJS checks under Node, including minimum supported runtime | Passed |
| [Footprint and remaining work](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#initial-reader-assessment) assessed | Yes |
| Lint, formatting, types | Passed |
| Production build and managed unit checks | Passed |
| Managed application checks | Passed |
| Full Phase 3 source/verification range review | Passed; no remaining material findings |
| Documentation wording, links, statuses, and temporary cleanup | Passed |
| Complexity checkpoint | Continue |

Reviewed source/verification range: `35bfe746..19403f8a`; closing documentation reviewed separately. The 336-line reader remains a trusted-input slice. Resource enforcement, broader content support, and installation acceptance are untested candidate obligations.

## Phase 4: Resource Isolation

Source baseline: `13b66b3b9ea7961bae5c897c3d0a56962541611f`.

| Check | Result |
| --- | --- |
| [Selected-part guards and cleanup](../../../test/document-rename/docx-resource.unit.test.ts), initial reader facts, unchanged baseline captures | Passed |
| Process/worker boundary and transport | Passed; private candidate only |
| Boundary failures, offline controls, and cleanup checks | Passed; 27 unit checks and 50 Node scenarios |
| Guarded 22-case ESM/CJS comparisons, including minimum Node | Passed |
| Prototype overhead and provisional API window | Measured; passed |
| Lint, formatting, types, build, and managed unit checks | Passed |
| Managed application checks | Passed |
| Full phase review and documentation validation | Passed; findings fixed |

Review fixes cover stalled input ownership through deadline/cancellation and valid results followed by failed cleanup. Unconfirmed cleanup retains admission until owned resources settle.

Reviewed source/verification range: `13b66b3b..721a942b`; closing documentation reviewed separately. Temporary outputs were removed. The resource boundary supports continuing content evaluation; numerical budgets and fresh-consumer acceptance remain pending.

## Later Phases

Phases 5–10 are unstarted. Numerical budget/support acceptance, complete candidate compatibility, maintenance acceptance, and shipping checks remain pending. Mammoth remains the production extractor; dependencies are unchanged.
