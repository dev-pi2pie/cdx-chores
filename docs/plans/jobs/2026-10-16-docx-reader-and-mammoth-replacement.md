---
title: "DOCX reader and Mammoth replacement execution"
created-date: 2026-10-16
modified-date: 2026-10-16
status: in-progress
agent: codex
---

## Scope

Execution record for the [plan](../plan-2026-10-16-docx-reader-and-mammoth-replacement.md) and [research](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md). Phase 1 source baseline: `bc6e3e985fbb410797cefbece20a00e38a9bf526`. Phases 1–6 and Phase 6.1 are complete. Phase 7 owns subsequent budget/support acceptance and selection.

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

## Phase 5: Content Compatibility

Source baseline: `bd0c9679037e810602d6e6ac203d5aeff14bc7b7`.

| Check | Result |
| --- | --- |
| Mapper provenance, packaged notice, and all 1,061 baseline mappings | Passed; candidate pins `dingbat-to-unicode` 1.0.2 |
| Original baseline and contract captures after dependency change | Passed; unchanged |
| Content discovery, heading projection, symbols, notes/comments, metadata boundaries | Implemented; private candidate |
| Frozen 103 cases and ten additional probes, complete evidence/exact prompts, supervised ESM/CJS | Passed; only agreed extractor identity differs |
| Independent content, numbering, and resource checks | Passed; 67 checks, including complete mapping parity |
| Lint, formatting, types, production build, managed unit suite | Passed |
| Minimum Node supervised ESM/CJS comparisons | Passed |
| Managed application suite | Passed |
| Full phase review and documentation validation | Passed; finding fixed |

Reviewed source/verification range: `bd0c9679..3aef0456`; closing documentation reviewed separately. Review added complete symbol-mapping parity coverage. The managed 22-case smoke and separate full-corpus checks passed; temporary outputs were removed.

## Phase 6: Complete Candidate Validation

Source baseline: `fd35e9984539cd30b3011898ffa258e891bb2a10`.

| Check | Result |
| --- | --- |
| Frozen 124 cases and ten additional probes, supervised ESM/CJS, including minimum Node | Passed; 130 default comparisons, four default failures plus raised-cap semantic comparisons |
| Original boundary reconciliation and independent default selected/transport/deadline checks | Passed; 32 focused checks |
| Fixed 18 workloads, isolated baseline/candidate measurements, both runtime lanes | Passed; ten supported rows and eight expected-limit rows |
| Timing, sampled child RSS, loaded-caller independence, admission, and confirmed cleanup | Passed; proposed limits unchanged |
| Actual tarball, fresh dependency trees, and offline controls | Passed; three direct and eight transitive dependencies; Mammoth absent |
| npm/Bun consumers, ESM/CJS, including minimum Node | Passed; all eight paths |
| Managed unit suite | Passed |
| Lint, formatting, types, and production build | Passed |
| Managed application suite | Passed |
| Full phase review, documentation links/statuses, and temporary cleanup | Passed; no material findings |

Reusable checks: [complete comparisons](../../../scripts/docx-candidate/launch.mjs), [boundary probes](../../../test/document-rename/fixtures/docx-boundary-probes.ts), [measurements](../../../scripts/docx-candidate/measure-launch.mjs), and [package consumers](../../../scripts/docx-candidate/package-check.mjs). Proposed limits and intentional differences stay in the [candidate envelope](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md#demonstrated-candidate-envelope).

| Fresh installation | ESM | CJS |
| --- | --- | --- |
| npm, supported Node | Passed | Passed |
| npm, minimum Node | Passed | Passed |
| Bun, supported Node | Passed | Passed |
| Bun, minimum Node | Passed | Passed |

Each runtime measurement lane used 108 observed candidate calls, 72 ordinary ESM/CJS calls, 54 isolated baseline calls, and six controlled RSS transition probes. Candidate timing retained more than half the proposed windows; worst sampled RSS retained more than one tenth of its cap. Baseline memory exceeded that reference on one lane; the candidate's cap does not govern baseline success. Grouped observations include input, startup/communication, extraction, validation, and confirmed cleanup; sampling is not a continuous memory ceiling.

The fresh tree differs from the retained repository tree at three transitive versions; its compact inventory is checked independently. License and notice completeness belong to final shipping review; this quick verifier checks inventory and runtime behavior. Manual measurement/package drivers use POSIX process groups; no additional operating-system coverage is claimed. Manual evaluation inputs, builds, tarballs, consumers, caches, logs, and raw reports were removed after confirmed settlement; reviewed fixture definitions remain under their test owner. Managed retention is unchanged.

Phase 6 is complete. Reviewed full range: `fd35e998..4c660031`. The numerical proposal is unchanged; budget/support acceptance belongs to Phase 7 after Phase 6.1.

## Phase 6.1: Validation Harness Follow-up

| Check | Result |
| --- | --- |
| Live progress, presentation, and stdout compatibility | Passed |
| Cancellation, deadlines, output failures, and ownership | Passed; transient/persistent observation regressions and confirmed cleanup |
| Supported Node smoke/full ESM/CJS comparisons | Passed; 22 smoke / 134 full cases per format |
| Resource measurements and fresh consumers | Passed; 18 workloads and eight consumer paths |
| Lint, format, types, build, and managed suites | Passed; 1,734 unit / 2,428 application cases |
| Full implementation review and temporary cleanup | Passed |

Full Phase 6.1 implementation range reviewed: `4c660031..e9548edb`; final documentation reviewed separately. The [Phase 6.1 checklist](../plan-2026-10-16-docx-reader-and-mammoth-replacement.md#phase-61-improve-validation-progress-presentation-and-interruption-handling) is complete. Budget/support acceptance and selection remain in Phase 7.

### Smoke retention and help extension

| Item | Contract or result |
| --- | --- |
| Activation | `--smoke --keep-artifacts`; ordinary smoke runs still clean automatically |
| Destination | `examples/playground/docx-candidate/smoke/<run-id>/`; unique, Git-ignored and untracked |
| Contents | Synthetic DOCX inputs, readable ESM/CJS case results, compact `summary.json` with completeness |
| Lifecycle | Export after confirmed settlement; mark partial evidence incomplete; automatically clean temporary working files |
| Removal | User removes retained run directories when inspection is finished |
| Help | All three entry points: `--help` / `-h`; stdout and zero exit, before execution setup |
| Invalid arguments | Error and usage on stderr; nonzero exit, before execution setup |
| Help content | Concise usage/options, scope, and command-specific requirements; detailed lifecycle instructions below |
| Verification | Passed; early help, retained success/failed evidence, aggregate overflow, cancellation and ownership |
| Cleanup | Verification exports removed after inspection; working files cleaned |
| Help refinement | Passed; four CLI unit and three entry-point checks after shortening copy |

### Manual validation

Help and invalid arguments return before execution setup. Help uses stdout and exits zero; invalid arguments use stderr and exit nonzero. Help is concise plain text, including in a terminal; detailed requirements and lifecycle instructions follow below.

Run from the repository root after installing dependencies, using Node.js >=22.23.0. Progress streams to stderr; final comparison status and measurement status/JSON remain on stdout. Full comparisons cover 134 cases per format; measurements check 18 workloads and controlled RSS transitions. Package validation checks eight fresh-consumer paths and requires npm, Bun, tar, and registry access. Measurement/package drivers require POSIX process groups. Comparison has no POSIX-only preflight, but its current Windows path cannot confirm descendant settlement and fails with unconfirmed cleanup, retaining artifacts. Windows execution is unverified.

```sh
# Usage, scope, prerequisites, and cleanup policy.
node ./scripts/docx-candidate/launch.mjs --help
node ./scripts/docx-candidate/measure-launch.mjs --help
node ./scripts/docx-candidate/package-check.mjs --help

# Quick ESM/CJS comparisons.
node ./scripts/docx-candidate/launch.mjs --smoke

# Retain selected smoke inputs, extraction results, and summary for inspection.
node ./scripts/docx-candidate/launch.mjs --smoke --keep-artifacts

# Complete ESM/CJS comparisons.
node ./scripts/docx-candidate/launch.mjs

# Plain progress, including in a terminal.
NO_COLOR=1 node ./scripts/docx-candidate/launch.mjs --smoke

# Resource measurements and stable summary JSON.
node ./scripts/docx-candidate/measure-launch.mjs

# Actual candidate package and fresh npm/Bun consumers.
node ./scripts/docx-candidate/package-check.mjs
```

A passing comparison ends with `guarded reader: passed yes`; measurements report `candidate measurements: passed yes` and summary JSON. Package validation writes tarball, dependency-tree, consumer, and cleanup results to stdout, ending with `temporary cleanup: passed yes`. Check the exit status: zero means the script checks and output delivery passed; license and notice completeness are outside this quick verification scope. Waiting messages show elapsed time without claiming additional completed work.

To check cancellation, repeat a comparison run and press Ctrl+C while it is processing. Expect a cancellation diagnostic and nonzero exit after owned processes settle and temporary cleanup completes. SIGTERM uses the same cleanup path. Generated inputs, builds, packages, installations, caches, and raw reports use owned OS temporary storage and are removed after confirmed settlement; unconfirmed cleanup fails and retains ownership. Only explicit smoke retention exports selected artifacts to the ignored playground entry; frozen expectations are never rewritten.

Retained runs contain `summary.json` and `esm/<case-id>/` / `cjs/<case-id>/` directories with `input.docx` and `result.json`. The summary reports comparison outcomes and completeness; failed or interrupted runs may be incomplete. The repository-relative retained location is printed on stderr. Remove only the named run directory when inspection is finished; ordinary temporary working files are still cleaned automatically.

## Later Phases

Phase 6.1 is complete; Phases 7–10 are unstarted. Phase 7 reviews numerical budget/support and maintenance acceptance before selection; shipping checks follow later. Mammoth remains the production extractor; the candidate's symbol mapper is a separate pinned dependency.
