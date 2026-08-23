---
title: "Test Suite Contract And Catalog Enhancement Execution"
created-date: 2026-08-23
status: in-progress
agent: codex
---

## Goal

Record concise, reproducible evidence for the test-suite contract audit and
catalog migration without duplicating the parent plan or canonical lookup
references.

## Related Plan

- `docs/plans/plan-2026-08-23-test-suite-contract-and-catalog-enhancement.md`

## Related Research

- `docs/researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md`

## Related References

- `docs/references/test-catalog-path-correspondence.md`
- `docs/references/test-suite-audit-inventory.md`
- `docs/references/test-suite-case-matrices.md`

## Starting Evidence

- execution started from clean commit `2f3013ca`
- `test/` contains 355 TypeScript files and 90,399 total lines
- 289 discovered `*.test.ts` files include 197 at the root, 78 one directory
  below it, and 14 two directories below it
- the fresh Phase 1 full-suite baseline passed before any test edit
- no test edit or path migration is admitted before the Phase 2 evidence gate

## Phase Summary

| Phase | Boundary                                       | Status      | Review range         | Decision                  |
| ----: | ---------------------------------------------- | ----------- | -------------------- | ------------------------- |
|     1 | refreshed baseline and complete file inventory | completed   | `2f3013ca..fae7d92b` | Continue                  |
|     2 | case matrices and catalog admission            | completed   | `34d080e9..0b8d59bd` | Continue with constraints |
|     3 | Data Query migration pilot                     | completed   | `db9622cf..27ccab6e` | Continue with constraints |
|     4 | Doctor ownership migration pilot               | completed   | `ff0f3d6f..837e5d95` | Continue with constraints |
|     5 | bounded Markdown PDF migration pilot           | completed   | `05a87d54..4cce415a` | Continue with constraints |
|     6 | remaining accepted family batches              | pending     | per-batch             | Admitted                  |

## Phase 1: Refreshed Baseline And Complete File Inventory

Status: `completed`

Phase base: `2f3013ca`

Review range: `2f3013ca..fae7d92b`

The phase populates the canonical file inventory, proves exact discovered-path
coverage, and records a fresh full-suite baseline. File size, runtime, and
matcher shape remain audit context rather than removal criteria.

Baseline validation:

```bash
bun test
```

Result: 2,625 passed, 0 failed, and 14,983 assertions across 289 files in
99.37 seconds.

Inventory validation compared the sorted first-column paths in
`docs/references/test-suite-audit-inventory.md` with the sorted discovered
`test/**/*.test.ts` manifest.

Result:

- 289 inventory rows and 289 discovered paths
- no missing, extra, or duplicate paths
- nine populated inventory fields for every row
- 185 `retain`, 65 `case audit`, 29 `split review`, 5 `rename review`, 3
  `fixture/helper review`, and 2 `move-only review` dispositions
- every `case audit` and `split review` row requires a Phase 2 matrix; no other
  disposition carries that marker

Support validation compared the recorded support paths with the sorted
manifest from `rg --files test -g '*.ts' -g '!*.test.ts'`.

Result:

- 66 support-only rows and 66 discovered paths
- no missing, extra, or duplicate paths
- five populated support fields for every row
- 27 files owned through their consuming suites
- 39 cross-feature, global, or leaking support boundaries deferred to Phase 2
  ownership review

The initial exact-range review found two non-resolvable closest-overlap cells.
One was replaced with an em dash after a repository-wide symbol and text scan
found no other test owner; the other now names the two concrete Data Query
command validation suites. A later review required durable evidence for the
support-only TypeScript audit, so the 66-row support inventory was added. The
final documentation and test-quality review of `2f3013ca..fae7d92b` found no
remaining material issues.

Decision: `Continue` to Phase 2. The research and audit inventory remained
`draft` until the Phase 2 matrices and catalog admission gate were complete.

## Phase 2: Case Matrices And Catalog Admission

Status: `completed`

Phase base: `34d080e9`

Review range: `34d080e9..0b8d59bd`

The case-matrix reference covers all 94 `case audit` and `split review`
suites and all 982 declared `test` or `it` cases exactly once. Parameterized
declarations appear once with their literal source title and variants.

Accepted decisions:

- 739 `move`
- 215 `split`
- 4 `rename`
- 4 `merge`
- 10 `remove`
- 10 `keep pending evidence`

The accepted catalog also resolves all 39 support files deferred from Phase 1,
including independent consumer and semantic evidence for accepted global
helpers. Event-based deferrals keep unrelated Markdown PDF, Data Extract, Data
Stack, shared Data Sources, Rename, and Interactive-harness migrations out of
the Data Query and Doctor pilots.

Representative validation:

- Data Query: 202 passed, 0 failed, and 932 assertions across 36 files
- Doctor: 124 passed, 0 failed, and 894 assertions across 4 files
- contextual tip plus the mixed Markdown PDF candidates: 96 passed, 0 failed,
  and 296 assertions across 3 files

The initial exact-range review of `34d080e9..78bea000` found two proposed
reductions that lacked equivalent retained owners. The final decisions instead
preserve the complete four-state Markdown PDF action projection and the direct
DuckDB extension-install invalid-input contract. The correction landed in
`0b8d59bd`; documentation and test-quality reviewers then found no remaining
material issue in the widened range `34d080e9..0b8d59bd`.

Decision: `Continue with constraints` to Phase 3. Apply the accepted Data Query
pilot before Doctor, leave all ten `keep pending evidence` declarations at
their current paths and behavior, and enforce every event-based deferral. The
research, audit inventory, and case-matrix reference are now `completed`; the
plan and this job remain active, while the path-correspondence reference stays
`draft` until final reconciliation.

## Phase 3: Data Query Migration Pilot

Status: `completed`

Phase base: `db9622cf`

Review range: `db9622cf..27ccab6e`

The implementation applies the accepted Data Query path contract while
retaining the five `keep pending evidence` command owners at their root paths.
It also separates the Data Query portions of the shared Codex-timeout, CLI UX,
source-shape, and Interactive-harness owners without advancing the deferred
Data Extract or wider CLI-foundations migrations.

Focused validation before the move:

- 253 passed, 0 failed, and 1,182 assertions across 39 files

Focused validation after the move:

- 253 passed, 0 failed, and 1,174 assertions across 48 files

The runtime case count is preserved, and the static staged implementation diff
adds six `expect` lines. The aggregate Bun assertion count changed with the file
split and scheduling; no assertion source was removed.

The first complete-suite run exposed a process-wide DuckDB mock leaking from
the Parquet Preview suite into later Data Query owners. The implementation
replaced that broad mock seam with a narrow injectable DuckDB loader. A focused
36-case reproduction then passed, followed by the complete suite:

- 2,625 passed, 0 failed, and 14,975 assertions across 298 files

Repository checks also passed:

```bash
bun run format:check
bun run lint
bun run build
```

The current-document scan found no Data Query test paths in guides or current
reference prose that required rewriting. Historical documentation retains its
dated commands and wording. The 53 accepted path changes are recorded in the
path-correspondence reference, which remains `draft` through the initial
catalog migration.

The initial exact-range test-quality and maintainability reviews found no
material implementation issue. They confirmed the focused and complete-suite
results, all ten pending declarations, the accepted catalog split, and the
narrow DuckDB loader seam. The documentation review found one over-broad plan
checklist sentence: it implied every Data Query suite moved even though five
recorded pending command owners intentionally remain at the root. The sentence
now names the non-pending scope and the preserved deferral paths.

The widened exact-range documentation, test-quality, and maintainability
reviews found no remaining material issue in `db9622cf..27ccab6e`.

Decision: `Continue with constraints` to Phase 4. Reuse the accepted
feature-and-boundary catalog pattern, keep the five pending Data Query command
owners at their recorded root paths, preserve all Phase 2 event-based
deferrals, and do not generalize the Parquet Preview injection seam beyond the
specific test-isolation boundary that required it. The path-correspondence
reference remains `draft` until the later reconciliation phase.

## Phase 4: Doctor Ownership Migration Pilot

Status: `completed`

Phase base: `ff0f3d6f`

Review range: `ff0f3d6f..837e5d95`

The implementation applies the exact Doctor ownership pilot rather than the
complete CLI-foundations matrix. Doctor action, command, workflow, fixture,
menu, routing, and mock contracts move to feature-owned paths. Non-Doctor cases
remain in the two root Interactive suites, and the non-Doctor action-mock
residue remains at its recorded support path for Phase 6.

Focused validation before the move:

- 145 passed, 0 failed, and 957 assertions across 6 files

Focused validation after the move:

- 136 passed, 0 failed, and 857 assertions across 14 files

The post-change command includes the two unchanged cases in
`test/data-query/commands/duckdb-lifecycle.test.ts` because they are the
retained command/process owner for the removed direct DuckDB report case. The
changed-owner result is therefore 134 runtime cases. Compared with the 145
pre-change cases, exactly 11 evidence-approved runtime cases were removed; the
distinct direct DuckDB invalid-input contract moved separately to
`test/data-query/actions/duckdb-lifecycle.test.ts`.

The complete suite then passed:

- 2,614 passed, 0 failed, and 14,866 assertions across 305 files

Repository checks also passed:

```bash
bun run format:check
bun run lint
bun run build
```

The pre-commit maintainability review found two issues: moved suites retained
misleading mixed or root-oriented `describe` titles, and an empty
`DoctorInteractiveHarnessScenario = Record<never, never>` abstraction added no
scenario contract. The accepted fixes renamed each suite to its actual feature
and boundary and removed the empty type and import while retaining the
meaningful Doctor mock extraction. Re-review found both concerns resolved and
no remaining material maintainability issue. The pre-commit test-quality
review was clean.

Eight historical Phase 4 paths now have dated entries in the path
correspondence reference. Removed portions of the mixed suite name their
controlled action, command, requirements, and feature owners instead of
leaving a blank destination. The reference remains `draft`, the plan remains
`active`, and this job remains `in-progress`.

The exact-range documentation, test-quality, and maintainability reviews found
no material issue in `ff0f3d6f..837e5d95`.

Decision: `Continue with constraints` to Phase 5. Reuse the accepted
feature-and-boundary catalog pattern, but do not treat the deferred non-Doctor
Interactive cases or residual mixed action mocks as migrated. Keep those paths
for Phase 6, keep the correspondence reference `draft`, and apply only the
bounded Markdown PDF matrix admitted for the next pilot.

## Phase 5: Bounded Markdown PDF Migration Pilot

Status: `completed`

Phase base: `05a87d54`

Implementation range: `05a87d54..802d3b86`

Review range: `05a87d54..4cce415a`

The pilot is limited to these two pre-change owners:

- `test/cli-actions-md-to-pdf-bundle.test.ts`
- `test/cli-interactive-markdown-pdf/font-hints.test.ts`

The Phase 2 matrix admitted six destination owners under
`test/markdown-pdf/actions/` and `test/markdown-pdf/interactive/`. The Bundle
split landed in `c581ba43`; the font-hints split landed in `802d3b86`. All
shared Markdown PDF support and every other Markdown PDF suite remain at their
pre-phase paths.

Focused validation before the split:

- 84 passed, 0 failed, and 284 assertions across 2 files

Focused validation after the split:

- 84 passed, 0 failed, and 284 assertions across 6 files
- all 63 admitted declarations remain represented exactly once

The adjacent safety set passed with 89 tests, 0 failures, and 1,508 assertions
across action asset safety, action validation, Interactive lifecycle, and
renderer-evidence orchestration owners.

The complete suite passed with 2,614 tests, 0 failures, and 14,866 assertions
across 309 files. Formatting, lint, build, TypeScript no-emit, and diff checks
also passed.

The current-link scan found no affected guide or current reference link beyond
the canonical correspondence and matrix records. Older plan and job commands
remain dated historical evidence.

The pre-commit test-quality and maintainability reviews found no material
issue. They confirmed declaration and runtime preservation, safety and
side-effect coverage, cancellation and keyboard behavior, local helper scope,
and the absence of production or shared-support changes.

The exact-range documentation, test-quality, and maintainability reviews found
no material issue in `05a87d54..4cce415a`. They confirmed the implementation
range, evidence tip, correspondence rows, preserved declarations, focused and
adjacent behavior, helper ownership, and historical-link classification.

Execution receipt:

- [x] record the focused pre-change baseline
- [x] land the Bundle and font-hints owners as separate validated commits
- [x] run all six destination owners and the recorded adjacent safety set
- [x] run the complete suite, formatting check, lint, build, and diff check
- [x] land a separate evidence commit containing validation, correspondence,
      and status evidence
- [x] review the complete phase-base-to-evidence-tip range
- [x] record the closeout receipt and continuation decision after clean review

Decision: `Continue with constraints` to Phase 6. Reuse the accepted
owner-boundary split, but require an exact manifest before each remaining
family batch. Keep shared Markdown PDF support at its recorded path until its
own accepted batch or Phase 7 closure, run the complete suite for every batch,
and do not fold out-of-manifest findings into a migration checkpoint.

## Phase 6: Remaining Accepted Family Batches

Status: `pending`

Before the first test edit, expand each row below into its exact source and
destination manifest from the completed inventory and case matrices. Each row
is an independent checkpoint with its own base, focused evidence, complete
suite and repository checks, exact review range, and decision.

1. remaining Markdown PDF slices
2. release tooling
3. Markdown Frontmatter
4. Video
5. Data Sources fixtures
6. Data Extract
7. Data Preview
8. Data Stack
9. Data Conversion or shared Data ownership
10. Fonts
11. Rename
12. Codex adapter platform
13. Document Rename
14. DOCX
15. utilities
16. CLI foundations

An out-of-manifest finding returns to inventory or matrix review. Phase 7 owns
global-helper neutrality, explicitly accepted residual support moves, and final
root exception or deferral classification; it does not admit another broad
family migration.
