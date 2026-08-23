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
|     3 | Data Query migration pilot                     | in-progress | pending              | —                         |
|     4 | Doctor ownership migration pilot               | pending     | —                    | —                         |

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

Status: `in-progress`

Phase base: `db9622cf`

Initial review range: `db9622cf..0eaa2a15`

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

The review fix requires a widened exact-range review before Phase 3 admission.
No Phase 3 decision is recorded until that final review completes.
