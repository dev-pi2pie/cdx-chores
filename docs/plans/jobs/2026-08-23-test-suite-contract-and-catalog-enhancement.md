---
title: "Test Suite Contract And Catalog Enhancement Execution"
created-date: 2026-08-23
modified-date: 2026-08-24
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
|     6 | remaining accepted family batches              | in-progress | per-batch            | Continue with constraints |

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

Status: `in-progress`

Manifest base: `2d6c81fa`

The parent plan owns the exact source selectors, destination catalogs,
operation boundaries, and support boundaries. This job records execution.

Manifest validation at `2d6c81fa` reproduced all 21 recorded selector counts
over existing `test/**/*.test.ts` inventory rows: 246 selected paths, 246
unique paths, and no overlap. Support-only rows remain governed separately by
the recorded batch boundaries. The admission checkpoint also normalizes the
Data Extract and Data Stack destination folders to the established plural
`actions/commands` convention without changing any case decision.

| ID   | Batch                                         | Status          | Batch base | Implementation tip | Evidence tip | Review range         | Decision                  |
| ---- | --------------------------------------------- | --------------- | ---------- | ------------------ | ------------ | -------------------- | ------------------------- |
| 6.1  | Markdown PDF general                          | completed       | `fca1204a` | `c55da02a`         | `870fef23`   | `fca1204a..870fef23` | Continue with constraints |
| 6.2  | Markdown PDF Template Codex                   | completed       | `2af1ae7b` | `b74f6279`         | `ae3d717b`   | `2af1ae7b..ae3d717b` | Continue with constraints |
| 6.3  | Markdown PDF Profile                          | completed       | `171eec39` | `b66e1c35`         | `4c13019d`   | `171eec39..4c13019d` | Continue with constraints |
| 6.4  | Markdown PDF Project Codex                    | completed       | `54c24460` | `e5489182`         | `1627e953`   | `54c24460..1627e953` | Continue with constraints |
| 6.5  | Markdown PDF Interactive and support closeout | completed       | `2b8151dd` | `b1d2c133`         | `70b71653`   | `2b8151dd..70b71653` | Continue with constraints |
| 6.6  | Release tooling                               | completed       | `bb3d683a` | `608b0d2b`         | `d0b989a9`   | `bb3d683a..d0b989a9` | Continue with constraints |
| 6.7  | Markdown Frontmatter                          | completed       | `16966305` | `61df100e`         | `16159a87`   | `16966305..16159a87` | Continue with constraints |
| 6.8  | Video                                         | completed       | `5b362772` | `cf85a757`         | `7feac20a`   | `5b362772..7feac20a` | Continue with constraints |
| 6.9  | Data Sources                                  | completed       | `9458f888` | `a3a76f53`         | `e35eea80`   | `9458f888..e35eea80` | Continue with constraints |
| 6.10 | Data Extract                                  | completed       | `733f27cb` | `d02bf761`         | `dbb5574e`   | `733f27cb..dbb5574e` | Continue with constraints |
| 6.11 | Data Preview                                  | completed       | `7b840652` | `3d95eba5`         | `350b07ac`   | `7b840652..350b07ac` | Continue with constraints |
| 6.12 | Data Stack                                    | completed       | `cf15f599` | `4ae50698`         | `6ee0d7b0`   | `cf15f599..6ee0d7b0` | Continue with constraints |
| 6.13 | Data Conversion                               | completed       | `f2fb794b` | `f7f509ee`         | `a24c3bdd`   | `f2fb794b..a24c3bdd` | Continue with constraints |
| 6.14 | Fonts                                         | completed       | `ba8a6cd7` | `4be23beb`         | `e4235892`   | `ba8a6cd7..e4235892` | Continue with constraints |
| 6.15 | Rename                                        | pending         | -          | -                  | -            | -                    | -                         |
| 6.16 | Codex adapter platform                        | matrix-required | -          | -                  | -            | -                    | -                         |
| 6.17 | Document Rename                               | pending         | -          | -                  | -            | -                    | -                         |
| 6.18 | DOCX                                          | pending         | -          | -                  | -            | -                    | -                         |
| 6.19 | Markdown platform                             | pending         | -          | -                  | -            | -                    | -                         |
| 6.20 | Utilities                                     | pending         | -          | -                  | -            | -                    | -                         |
| 6.21 | CLI foundations and mixed-root decomposition  | pending         | -          | -                  | -            | -                    | -                         |

### Phase 6.1: Markdown PDF General

Status: `completed`

Batch base: `fca1204a`

Implementation tip: `c55da02a`

Execution and stability range: `fca1204a..c55da02a`

Path migration range: `fca1204a..b5ffc3f1`

Evidence tip: `870fef23`

Exact batch review range: `fca1204a..870fef23`

The batch admitted 10 general Markdown PDF suites. The selector retained 16
additional suites at their current paths because their rename or destination
ownership remains unresolved; retention is an admitted deferral, not a claim
that the flat paths are final.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          26 |    326 |      0 |      2,648 |
| Post-change |          34 |    326 |      0 |      2,648 |

Implementation checkpoints:

- `9c3e795e` — split the admitted action contracts
- `a74487a7` — split the admitted direct and evidence contracts
- `b5ffc3f1` — localize the admitted Markdown PDF test support
- `c55da02a` — make the generated-fallback release test deterministic after
  initial full-suite attempts exposed incidental live-network timeout behavior

Pre-commit test-quality and maintainability review was incorporated before the
three Markdown PDF commits. Broad action `describe` titles were replaced with
owner-specific titles before `9c3e795e`; duplicated page-chrome helpers moved
to `test/markdown-pdf/direct/page-chrome-test-utils.ts` before `a74487a7`; and
duplicated `pathExists` ownership was removed from command fixtures so command,
Profile, Project, and Template consumers use
`test/markdown-pdf/support/path-fixtures.ts` before `b5ffc3f1`.

Validation evidence:

| Boundary                        | Passed | Failed | Assertions | Files |
| ------------------------------- | -----: | -----: | ---------: | ----: |
| Focused moved owners            |    181 |      0 |      1,927 |    18 |
| Changed-support consumer set    |    756 |      0 |      6,599 |    77 |
| Complete suite after `c55da02a` |  2,614 |      0 |     14,866 |   317 |

The first complete-suite attempts reached the release-script fallback case but
timed out while it could make a live `curl` request. The isolated release suite
confirmed that the generated fallback path, rather than the Markdown PDF
migration, owned the nondeterminism. Commit `c55da02a` stubs that request, after
which the complete suite passed with the result above.

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the migrated Phase 6.1 paths
- the completed audit inventory remains the dated Phase 1 baseline and now
  labels those entries as audited, rather than live, paths
- the current support-decision wording names the executed Phase 6.1 split and
  the pending Phase 6.2 and 6.3 completion events
- current ownership is recorded only in the correspondence rows below

Correspondence rows use the fixed path-migration range
`fca1204a..b5ffc3f1`; `c55da02a` is the separate full-suite stability
checkpoint. Exact-range test-quality and maintainability review found no
material concerns. Documentation review found that the evidence commit could
not name its own tip; this closeout accepts the finding by recording
`870fef23` and the exact reviewed range above.

Decision: `Continue with constraints`. Phase 6.1 is complete because all 26
selected owners were dispositioned: 10 admitted suites migrated and 16
unresolved suites remained at their recorded paths. The deferrals are not
catalog approval. Continue to Phase 6.2 with a new batch base, exact selector,
focused and full validation, evidence commit, and exact range review.

Review gate:

- [x] preserve the pre-change selector declarations and assertions
- [x] migrate the 10 admitted suites and retain the 16 unresolved suites
- [x] validate moved owners and all changed-support consumers
- [x] complete the full suite and repository checks
- [x] fix the evidence tip and complete the exact batch range review
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.2: Markdown PDF Template Codex

Status: `completed`

Batch base: `2af1ae7b`

Implementation tip: `b74f6279`

Execution and path migration range: `2af1ae7b..b74f6279`

Evidence tip: `ae3d717b`

Exact batch review range: `2af1ae7b..ae3d717b`

The batch admitted five Template Codex suites. One command suite split into
separate Template initialization and Codex command owners, producing six
destination suites. The selector retained 23 additional suites at their
recorded paths because their destination ownership remains unresolved;
retention is an admitted deferral, not catalog approval.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          28 |    234 |      0 |      1,413 |
| Post-change |          29 |    234 |      0 |      1,413 |

Three fixture sources moved with the admitted owners. Thirty-two imports were
rewritten across 30 consumer suites without changing their declarations or
assertions:

| Check       | Consumer files | Passed | Failed | Assertions |
| ----------- | -------------: | -----: | -----: | ---------: |
| Pre-change  |             30 |    276 |      0 |      2,271 |
| Post-change |             30 |    276 |      0 |      2,271 |

Implementation checkpoints:

- `ffbf4124` — move Template Codex support ownership
- `e9493be3` — move the admitted adapter contract
- `57f227f8` — split Template initialization from the Codex command owner
- `b74f6279` — move the admitted Template Codex action contracts

Pre-commit test-quality and maintainability review found no material concerns
at any checkpoint.

Validation evidence:

| Boundary                     | Passed | Failed | Assertions | Files |
| ---------------------------- | -----: | -----: | ---------: | ----: |
| All destination suites       |     43 |      0 |        344 |     6 |
| Fixture-support consumer set |    276 |      0 |      2,271 |    30 |
| Complete suite               |  2,614 |      0 |     14,866 |   318 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the migrated Phase 6.2 paths
- the completed audit inventory and literal Phase 2 case sections remain dated
  historical snapshots
- the current support-decision table records the three fixture moves executed
  in Phase 6.2
- the correspondence reference records five historical suite sources and
  three support sources over `2af1ae7b..b74f6279`

The implementation and validation evidence is clean through `b74f6279`.
Exact-range test-quality and maintainability review found no material concerns.
Documentation review found that the evidence receipt could not name its own
tip; this closeout accepts the finding by recording `ae3d717b` and the exact
reviewed range above.

Decision: `Continue with constraints`. Phase 6.2 is complete because all 28
selected owners were dispositioned: five admitted suites migrated into six
owners and 23 unresolved suites remained at their recorded paths. Those
deferrals are not catalog approval. Continue to Phase 6.3 from a new batch base
with its exact selector and the same validation, evidence, and review gates.

Review gate:

- [x] preserve all selected declarations and assertions
- [x] migrate the five admitted suites and retain the 23 unresolved suites
- [x] move the three fixture owners and validate all 30 consumer suites
- [x] complete focused, full-suite, and repository validation
- [x] record correspondence and current support-decision updates
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.3: Markdown PDF Profile

Status: `completed`

Batch base: `171eec39`

Implementation tip: `b66e1c35`

Execution and path migration range: `171eec39..b66e1c35`

Evidence tip: `4c13019d`

Exact batch review range: `171eec39..4c13019d`

The batch admitted four Profile suite sources into seven destination owners.
The selector retained 16 additional suites at their recorded paths because
their destination ownership remains unresolved; retention is an admitted
deferral, not catalog approval.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          20 |    189 |      0 |      1,451 |
| Post-change |          23 |    189 |      0 |      1,451 |

The Profile fixture source moved to
`test/markdown-pdf/actions/profile-codex-fixtures.ts`. Its request consumer
split into two owners, so the preserved consumer set grew from five to six
files without changing its declarations or assertions:

| Check       | Consumer files | Passed | Failed | Assertions |
| ----------- | -------------: | -----: | -----: | ---------: |
| Pre-change  |              5 |     60 |      0 |        428 |
| Post-change |              6 |     60 |      0 |        428 |

Implementation checkpoints:

- `feb569e8` — move Profile rendering ownership
- `7af78d9f` — split Profile initialization from the Codex command owner
- `21ac7949` — move the Profile fixture and split request from progress
- `b66e1c35` — split candidate construction from signal normalization

Pre-commit maintainability review found broad `describe` titles in the four
split action destinations. The request-lifecycle, progress, candidates, and
signals suites received owner-specific titles before their commits; subsequent
test-quality and maintainability review was clean.

Validation evidence:

| Boundary                     | Passed | Failed | Assertions | Files |
| ---------------------------- | -----: | -----: | ---------: | ----: |
| All destination suites       |     34 |      0 |        214 |     7 |
| Profile-fixture consumer set |     60 |      0 |        428 |     6 |
| Complete suite               |  2,614 |      0 |     14,866 |   321 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the migrated Phase 6.3 paths
- the completed audit inventory and literal Phase 2 case sections remain dated
  historical snapshots
- the current support-decision table records the Profile fixture split
  completed in Phase 6.3
- the correspondence reference records four historical suite sources and one
  support source over `171eec39..b66e1c35`

The implementation and validation evidence is clean through `b66e1c35`.
Exact-range test-quality and maintainability review found no material concerns.
Documentation review found that the evidence receipt could not name its own
tip; this closeout accepts the finding by recording `4c13019d` and the exact
reviewed range above.

Decision: `Continue with constraints`. Phase 6.3 is complete because all 20
selected owners were dispositioned: four admitted sources migrated into seven
owners and 16 unresolved suites remained at their recorded paths. Those
deferrals are not catalog approval. Continue to Phase 6.4 from a new batch base
with its exact selector and the same validation, evidence, and review gates.

Review gate:

- [x] preserve all selected declarations and assertions
- [x] migrate the four admitted suite sources and retain the 16 unresolved
      suites
- [x] move the Profile fixture and validate all six consumer suites
- [x] complete focused, full-suite, and repository validation
- [x] record correspondence and current support-decision updates
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.4: Markdown PDF Project Codex

Status: `completed`

Batch base: `54c24460`

Implementation tip: `e5489182`

Execution and path migration range: `54c24460..e5489182`

Evidence tip: `1627e953`

Exact batch review range: `54c24460..1627e953`

The batch admitted four Project Codex suite sources into five destination test
owners. The selector retained 12 additional suites at their recorded paths
because their destination ownership remains unresolved; retention is an
admitted deferral, not catalog approval.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          16 |    149 |      0 |      1,892 |
| Post-change |          17 |    149 |      0 |      1,892 |

The action-write fixture moved to
`test/markdown-pdf/actions/project-codex-action-write-fixtures.ts`. Its five
consumer suites preserved their declarations and assertions:

| Check       | Consumer files | Passed | Failed | Assertions |
| ----------- | -------------: | -----: | -----: | ---------: |
| Pre-change  |              5 |     28 |      0 |        816 |
| Post-change |              5 |     28 |      0 |        816 |

The prepared source split into request-lifecycle and handoff test owners.
Their common Project, Profile, and Template setup moved to the feature-local
`test/markdown-pdf/actions/project-codex-prepared-fixtures.ts` support owner;
the prepared-source correspondence records all three destinations.

Implementation checkpoints:

- `a30f3017` — move Project Codex action-write support ownership
- `be64b8ae` — move Project Codex command ownership
- `7bc14742` — split prepared request lifecycle from handoff projection
- `5130ac9a` — move output-plan ownership
- `e5489182` — move validation ownership

Pre-commit maintainability review found duplicated prepared-suite setup and
broad `describe` titles. The shared prepared fixture and owner-specific titles
were applied before `7bc14742`; subsequent test-quality and maintainability
review was clean.

Validation evidence:

| Boundary                       | Passed | Failed | Assertions | Files |
| ------------------------------ | -----: | -----: | ---------: | ----: |
| All destination suites         |     62 |      0 |        558 |     5 |
| Action-write fixture consumers |     28 |      0 |        816 |     5 |
| Complete suite                 |  2,614 |      0 |     14,866 |   322 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the migrated Phase 6.4 paths
- the completed audit inventory and literal Phase 2 case sections remain dated
  historical snapshots
- the current Phase 6 support-admission table records the executed action-write
  fixture move
- the correspondence reference records four historical suite sources and one
  support source over `54c24460..e5489182`

The implementation and validation evidence is clean through `e5489182`.
Exact-range test-quality and maintainability review found no material concerns.
Documentation review found that the evidence receipt could not name its own
tip; this closeout accepts the finding by recording `1627e953` and the exact
reviewed range above.

Decision: `Continue with constraints`. Phase 6.4 is complete because all 16
selected owners were dispositioned: four admitted sources migrated into five
test owners and 12 unresolved suites remained at their recorded paths. Those
deferrals are not catalog approval. Continue to Phase 6.5 from a new batch base
with its exact selector and the same validation, evidence, and review gates.

Review gate:

- [x] preserve all selected declarations and assertions
- [x] migrate the four admitted suite sources and retain the 12 unresolved
      suites
- [x] move the action-write fixture and validate all five consumer suites
- [x] extract prepared support without adding another test owner
- [x] complete focused, full-suite, and repository validation
- [x] record correspondence and current support-admission evidence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.5: Markdown PDF Interactive And Support Closeout

Status: `completed`

Batch base: `2b8151dd`

Implementation tip: `b1d2c133`

Execution and path migration range: `2b8151dd..b1d2c133`

Evidence tip: `70b71653`

Exact batch review range: `2b8151dd..70b71653`

The batch selected 19 Interactive Markdown PDF suites. Seven admitted sources
migrated into eight destination test owners; the remaining 12 unresolved
suites stay at their recorded paths. Those retained paths are explicit
deferrals, not catalog approval.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          19 |    319 |      0 |      1,425 |
| Post-change |          20 |    319 |      0 |      1,425 |

The Formal Guide source split into answer-collection and compilation owners.
Their two shared typed baselines moved to the feature-local
`test/markdown-pdf/interactive/formal-guide-fixtures.ts` support file. The two
Codex destinations also received owner-specific parent titles without changing
their test bodies.

Feature support moved before the suites:

- Markdown PDF module URLs split from the neutral harness registry into
  `test/markdown-pdf/interactive/module-urls.ts`
- the Markdown PDF harness mock moved to
  `test/markdown-pdf/interactive/mock-action.ts`
- the five Codex-authoring flows now share
  `test/markdown-pdf/interactive/codex-authoring-fixtures.ts`

The neutral harness runner, composition, filesystem, prompt, context, runtime,
and type contracts remain at their recorded paths for Phase 7.

Implementation checkpoints:

- `d4368a91` — localize the three admitted Interactive Markdown PDF support
  contracts and rewire their consumers
- `b1d2c133` — migrate seven admitted suites into eight exact matrix owners

Pre-commit test-quality review confirmed exact parity: 128 literal titles, 133
declarations, and 735 static assertions remain represented once. It found no
vague, duplicated, weakened, or missing case. Maintainability review confirmed
the feature-local support direction, Formal Guide fixture scope, owner names,
and absence of cycles or compatibility shims.

Validation evidence:

| Boundary                    | Passed | Failed | Assertions | Files |
| --------------------------- | -----: | -----: | ---------: | ----: |
| Admitted destination suites |    221 |      0 |      1,047 |     8 |
| Retained unresolved suites  |     98 |      0 |        378 |    12 |
| Complete Phase 6.5 selector |    319 |      0 |      1,425 |    20 |
| Complete repository suite   |  2,614 |      0 |     14,866 |   323 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the migrated Phase 6.5 paths
- the completed inventory and literal case sections remain dated historical
  evidence
- the current support matrix now identifies the executed feature-local moves
- the correspondence reference records seven suite sources and three support
  transitions over `2b8151dd..b1d2c133`

Exact-range test-quality and maintainability review found no material issue in
`2b8151dd..70b71653`. Documentation review found that the evidence receipt
could not name its own tip before commit; this closeout accepts the finding by
recording `70b71653` and the exact reviewed range above.

Decision: `Continue with constraints`. Phase 6.5 is complete because all 19
selected sources were dispositioned: seven admitted sources migrated into
eight test owners and 12 unresolved suites remained at their recorded paths.
Those deferrals are not catalog approval. Continue to Phase 6.6 from this
closeout tip while keeping the correspondence reference `draft` and the
neutral harness residue reserved for Phase 7.

Review gate:

- [x] reproduce the 19-source selector and pre-change baseline
- [x] migrate all seven admitted sources and retain the 12 unresolved suites
- [x] split the Formal Guide owner without declaration or assertion loss
- [x] localize the three admitted support contracts and preserve consumers
- [x] complete focused, retained-selector, full-suite, and repository checks
- [x] record correspondence and current support-matrix evidence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.6: Release Tooling

Status: `completed`

Batch base: `bb3d683a`

Implementation tip: `608b0d2b`

Execution and path migration range: `bb3d683a..608b0d2b`

Evidence tip: `d0b989a9`

Exact batch review range: `bb3d683a..d0b989a9`

The two selected Release tooling suites were fully dispositioned. The mixed
release-script source split into branch-policy and stable-note owners with one
feature-local fixture; the version synchronization suite moved to its admitted
catalog owner.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |           2 |      9 |      0 |        154 |
| Post-change |           3 |      9 |      0 |        154 |

The pre-move test-quality review found no vague, duplicate, or removable case.
It did find that the build-regeneration case proved only that the generator and
`tsdown` names were present. The accepted fix now proves that the embedded
version generator exists and appears before `tsdown`, without changing the
test title or declaration count.

Implementation checkpoint:

- `608b0d2b` — split branch filtering from stable-note generation, move version
  synchronization, extract the admitted release fixture, and strengthen build
  ordering coverage

Pre-commit test-quality and maintainability reviews were clean after the fix.
All nine literal titles and declarations remain represented once, the 28
static assertions remain split between test owners and their fixture, and the
generated-fallback case retains its deterministic failing `curl` stub.

Validation evidence:

| Boundary                  | Passed | Failed | Assertions | Files |
| ------------------------- | -----: | -----: | ---------: | ----: |
| Release tooling selector  |      9 |      0 |        154 |     3 |
| Complete repository suite |  2,614 |      0 |     14,866 |   324 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the two historical release paths
- the completed inventory and literal matrix remain dated historical evidence
- the current matrix records the exact version-sync and fixture admissions
- the correspondence reference records both historical suite sources over
  `bb3d683a..608b0d2b`

Exact-range test-quality and maintainability review found no material issue in
`bb3d683a..d0b989a9`. Documentation review found that the evidence receipt
could not name its own tip before commit; this closeout accepts the finding by
recording `d0b989a9` and the exact reviewed range above.

Decision: `Continue with constraints`. Phase 6.6 is complete because both
selected sources were dispositioned into the admitted Release tooling catalog,
all nine cases remain, and the weak ordering signal is now explicit. Continue
to Phase 6.7 from this closeout tip without broadening its one-source selector.

Review gate:

- [x] reproduce the two-source selector and pre-change baseline
- [x] split the release-script owner and move version synchronization
- [x] preserve all nine declarations and deterministic stable-note behavior
- [x] strengthen the weak build-order assertion
- [x] complete focused, full-suite, and repository validation
- [x] record correspondence and current exact-path evidence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.7: Markdown Frontmatter

Status: `completed`

Batch base: `16966305`

Implementation tip: `61df100e`

Execution and path migration range: `16966305..61df100e`

Evidence tip: `16159a87`

Exact batch review range: `16966305..16159a87`

The single selected suite split into its six-case action owner and three-case
command owner. Pre-move review found no vague, duplicated, or removable case:
the command cases intentionally retain CLI registration, parsing, forwarding,
exit, and stream boundaries distinct from direct action semantics.

Selector preservation:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |           1 |      9 |      0 |         38 |
| Post-change |           2 |      9 |      0 |         38 |

The admitted support extraction moved only `actionMdFrontmatterToJson` from the
mixed Interactive action mock to
`test/markdown-frontmatter/interactive/mock-action.ts`. The mixed residual and
neutral harness composition remain for later admitted batches and Phase 7.

Implementation checkpoint:

- `61df100e` — split action and command contracts and extract the one-action
  Frontmatter Interactive mock

Pre-commit test-quality and maintainability reviews found no material issue.
All nine literal titles, declarations, bodies, and 22 static assertions remain
represented once. The future Phase 6.21 top-level routing owner remains at its
historical path and continues to consume the extracted feature mock.

Validation evidence:

| Boundary                    | Passed | Failed | Assertions | Files |
| --------------------------- | -----: | -----: | ---------: | ----: |
| Frontmatter destination set |      9 |      0 |         38 |     2 |
| Top-level routing consumer  |     11 |      0 |         26 |     1 |
| Complete repository suite   |  2,614 |      0 |     14,866 |   325 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the historical Frontmatter suite or mock path
- the completed inventory and literal matrix remain dated historical evidence
- the current support matrix records the executed one-action extraction
- the correspondence reference records the selected suite and support split
  over `16966305..61df100e`

Exact-range test-quality and maintainability review found no material issue in
`16966305..16159a87`. Documentation review found that the evidence receipt
could not name its own tip before commit; this closeout accepts the finding by
recording `16159a87` and the exact reviewed range above.

Decision: `Continue with constraints`. Phase 6.7 is complete because its one
selected source was fully split into admitted action and command owners, and
the feature mock moved without pulling the mixed routing owner forward from
Phase 6.21. Continue to Phase 6.8 from this closeout tip.

Review gate:

- [x] reproduce the one-source selector and adjacent routing baseline
- [x] split all action and command cases into exact matrix owners
- [x] extract only the admitted Frontmatter mock behavior
- [x] preserve all nine declarations, 22 static assertions, and routing behavior
- [x] complete focused, full-suite, and repository validation
- [x] record correspondence and current support evidence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.8: Video

Status: `completed`

Batch base: `5b362772`

Implementation tip: `cf85a757`

Execution and path migration range: `5b362772..cf85a757`

Evidence tip: `7feac20a`

Exact batch review range: `5b362772..7feac20a`

The two selected Video suites moved to their exact action and Interactive
owners. Pre-move review found no vague or duplicated case: the focused
compressed Interactive route and the retained Phase 6.21 quality-mode smoke
route protect mutually exclusive prompt and option paths.

Selector preservation and strengthening:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |           2 |     12 |      0 |         54 |
| Post-change |           2 |     12 |      0 |         58 |

The two rejected compressed-mode option cases previously checked the typed
error and empty runtime output but not the claimed pre-execution boundary. Four
accepted assertions now prove that neither an FFmpeg log nor an output artifact
is created for incompatible `gifProfile` or `gifLook` inputs.

The admitted support extraction moved only the three Video action mocks to
`test/video/interactive/mock-action.ts`. The mixed residual and neutral harness
composition remain for later batches and Phase 7.

Implementation checkpoint:

- `cf85a757` — move GIF action and Interactive routing owners, extract Video
  mocks, and strengthen rejected-input side-effect coverage

Pre-commit test-quality and maintainability reviews found no material issue.
All 12 titles and declarations remain represented once; static assertions rose
from 41 to 45 only for the four accepted side-effect checks.

Validation evidence:

| Boundary                              | Passed | Failed | Assertions | Files |
| ------------------------------------- | -----: | -----: | ---------: | ----: |
| Video destinations                    |     12 |      0 |         58 |     2 |
| Destinations plus adjacent safety set |     31 |      0 |        132 |     4 |
| Complete repository suite             |  2,614 |      0 |     14,870 |   325 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- no current guide links name the two historical Video suite paths
- the completed inventory and literal matrix remain dated historical evidence
- the current matrix records the executed suite and support admissions
- the correspondence reference records two suite moves and the support split
  over `5b362772..cf85a757`

Exact-range test-quality and maintainability review found no material issue.
Documentation review found only the expected self-tip gap: the evidence commit
could not name itself before it existed. This closeout records `7feac20a` as
the evidence tip and closes that lifecycle gap.

Decision: `Continue with constraints`. Keep the retained quality-mode smoke
route with Phase 6.21, keep the mixed `action-misc` residual and neutral
Interactive-harness composition in their recorded later boundaries, and
continue to the exact Phase 6.9 Data Sources batch from this closeout tip.

Review gate:

- [x] reproduce the two-source selector and adjacent safety baseline
- [x] move both suites to their exact Video owners
- [x] extract only the three admitted Video action mocks
- [x] preserve all 12 declarations and add four accepted safety assertions
- [x] complete focused, full-suite, and repository validation
- [x] record correspondence and current exact-path evidence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.9: Data Sources

Status: `completed`

Batch base: `9458f888`

Implementation tip: `a3a76f53`

Execution and path migration range: `9458f888..a3a76f53`

Evidence tip: `e35eea80`

Exact batch review range: `9458f888..e35eea80`

The five selected suites moved to shared Data Sources adapter, direct, and
evidence owners. Reusable TypeScript fixture builders and the exact seven
checked-in CSV, TSV, Parquet, SQLite, and XLSX artifacts moved to the shared
`fixtures/` owner. No other directory entry was admitted or moved.

Pre-move review found no vague or duplicate case. It retained all 30 cases and
accepted one strengthening: the already-present DuckDB extension case now
tracks install calls and proves that the path does not reinstall.

Selector preservation and strengthening:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |           5 |     30 |      0 |         95 |
| Post-change |           5 |     30 |      0 |         96 |

Static declarations and titles remain 30 of 30. Static `expect(` calls rose
from 71 to 72 only for the accepted no-reinstall assertion.

The implementation checkpoint is:

- `a3a76f53` — move the five suite owners, three fixture helpers, and seven
  checked-in source artifacts; update current consumers and the Data Query
  guide; strengthen the DuckDB no-reinstall proof

Pre-commit test-quality and maintainability reviews found no material issue.
They confirmed coherent `adapters/`, `direct/`, `evidence/`, and `fixtures/`
ownership, one-way Data Query and Data Extract dependencies on shared Data
Sources support, exact title preservation, and no stale current-path import.

Validation evidence:

| Boundary                              | Passed | Failed | Assertions | Files |
| ------------------------------------- | -----: | -----: | ---------: | ----: |
| Data Sources destinations             |     30 |      0 |         96 |     5 |
| Destinations plus adjacent safety set |    272 |      0 |      1,214 |    56 |
| Complete repository suite             |  2,614 |      0 |     14,871 |   325 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bunx tsc --noEmit`
- `git diff --check`

Documentation path scan:

- the current Data Query guide now names `test/data-sources/fixtures/`
- current test imports and literal fixture paths use the shared owner
- the completed inventory and time-bounded historical records retain their
  reference-date paths
- the current matrix records the executed suite, helper, and exact artifact
  admissions
- the correspondence reference records all 15 accepted path changes over
  `9458f888..a3a76f53`

Exact-range test-quality and maintainability review found no material issue.
It also confirmed that all seven checked-in source artifacts remain
byte-for-byte identical after relocation. Documentation review found only the
expected self-tip gap; this closeout records `e35eea80` as the evidence tip.

Decision: `Continue with constraints`. Phase 6.10 and later feature batches
must consume the shared Data Sources fixtures without recreating feature-local
copies. The dated inventory remains historical, while current guides and
reference paths continue to use the shared owner.

Review gate:

- [x] reproduce the five-source selector and adjacent safety baseline
- [x] admit exact suite, helper, and seven-artifact targets
- [x] move only the accepted Data Sources owners and current consumers
- [x] preserve all 30 declarations and add one accepted safety assertion
- [x] complete focused, full-suite, and repository validation
- [x] update the current guide, matrix, and path correspondence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.10: Data Extract

Status: `completed`

Batch base: `733f27cb`

Implementation tip: `d02bf761`

Execution and path migration range: `733f27cb..d02bf761`

Evidence tip: `dbb5574e`

Exact batch review range: `733f27cb..dbb5574e`

The 13 selected suites moved to six action, four command, and three
Interactive owners. Feature-local action and command support moved with their
consumers. The remaining Data Extract action, introspection, source-shape, and
installation mocks left the historical mixed Data Query residue without moving
the neutral harness or compatibility facade.

The initial exact admission was `7d9be60b`. Pre-commit maintainability review
found that its first implementation duplicated `SourceShapeSuggestionOptions`
between Data Query and Data Extract. The accepted admission correction at
`733f27cb` keeps that shared request type in the neutral harness, keeps
`DataQueryIntrospectionColumn` Data Query-local, and drops the unused residual
introspection interface. The implementation contains no duplicated shared
mock type.

Pre-move review found no vague, duplicate, or removable case. It retained all
55 cases and accepted two focused strengthenings:

- overwrite rejection now proves the pre-existing output remains exactly
  `existing\n`
- the command-layer shape conflict now proves exit code `2` and empty stdout

Selector preservation and strengthening:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          13 |     55 |      0 |        264 |
| Post-change |          13 |     55 |      0 |        266 |

All 55 declarations and exact titles remain represented once. Static
assertions rose from 211 to 213 only for the two accepted checks.

The implementation checkpoint is:

- `d02bf761` — move all 13 suite owners, localize action and command support,
  decompose the remaining Data Extract mocks, and apply the two accepted
  assertion strengthenings

Pre-commit test-quality review found no material issue. Maintainability review
accepted the corrected shared-type ownership and found no remaining stale
import, cycle, compatibility shim, or duplicate support contract.

Validation evidence:

| Boundary                              | Passed | Failed | Assertions | Files |
| ------------------------------------- | -----: | -----: | ---------: | ----: |
| Data Extract destinations             |     55 |      0 |        266 |    13 |
| Destinations plus adjacent safety set |    112 |      0 |        449 |    15 |
| Data Query Interactive compatibility  |     40 |      0 |        155 |     8 |
| Complete repository suite             |  2,614 |      0 |     14,873 |   325 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bunx tsc --noEmit`
- `bun run build`
- `git diff --check`

Documentation path scan:

- no current guide names a historical Phase 6.10 suite or support path
- the completed inventory and time-bounded matrix source headings remain
  historical evidence
- the current support dispositions and exact admission record the executed
  suite and support ownership
- the correspondence reference records all 22 accepted path transitions over
  `733f27cb..d02bf761`

Exact-range test-quality and maintainability review found no material issue.
Documentation review found only the expected self-tip gap; this closeout
records `dbb5574e` as the evidence tip. The combined Data Extract and Data Query
Interactive compatibility slice also passed 95 tests with 421 assertions.

Decision: `Continue with constraints`. Keep shared introspection scenario
fields and the temporary routing facade neutral until their later admitted
cleanup. Do not recreate the deleted mixed Data Query residues or duplicate the
shared source-shape request type in later feature mocks.

Review gate:

- [x] reproduce the 13-source selector and 55-case baseline
- [x] admit all suite and support targets, then correct shared-type ownership
- [x] move only the accepted Data Extract suites and feature support
- [x] preserve all 55 declarations and add two accepted safety assertions
- [x] complete focused, compatibility, full-suite, and repository validation
- [x] record current support dispositions and path correspondence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.11: Data Preview

Status: `completed`

Batch base: `7b840652`

Implementation tip: `3d95eba5`

Execution and path migration range: `7b840652..3d95eba5`

Evidence tip: `350b07ac`

Exact batch review range: `7b840652..350b07ac`

The six selected suites moved to four action and two Interactive owners.
Preview-specific action support moved with its consumers, neutral ANSI
stripping now has one global implementation, and the three Preview harness
mocks left the mixed residual without moving conversion or Markdown DOCX
behavior. The shared Parquet fixtures remained at their admitted root.

Pre-move review found no vague, duplicate, or removable case. It retained all
48 cases and accepted four bounded assertion edits:

- the paired blank-filter failures now prove that neither path writes output
- TTY styling checks now associate ANSI sequences with the `Input` label and
  `name` header
- the Parquet summary case drops a direct empty-stderr assertion duplicated by
  `expectNoStderr()`
- the scalar-array case drops a generic `value` containment check while
  retaining the exact column summary and three row values

Selector preservation and bounded edits:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |           6 |     48 |      0 |        237 |
| Post-change |           6 |     48 |      0 |        236 |

All 48 declarations and exact titles remain represented once. Static
`expect(` calls changed from 112 to 110 only through the admitted edits.

The implementation checkpoint is:

- `3d95eba5` — move all six suite owners, split feature-local and neutral
  support, extract the Preview harness mocks, and apply the four admitted
  assertion edits

Pre-commit test-quality and maintainability reviews found no material issue.
They confirmed exact title preservation, bounded assertion changes, coherent
feature-local ownership, one neutral ANSI implementation, acyclic imports,
and no fixture or unrelated mixed-mock drift.

Validation evidence:

| Boundary                              | Passed | Failed | Assertions | Files |
| ------------------------------------- | -----: | -----: | ---------: | ----: |
| Data Preview destinations             |     48 |      0 |        236 |     6 |
| Exact adjacent safety set             |     82 |      0 |        398 |     7 |
| Broader compatibility slice           |     97 |      0 |        449 |    16 |
| Complete repository suite             |  2,614 |      0 |     14,872 |   325 |

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bunx tsc --noEmit`
- `bun run build`
- `git diff --check`

Documentation path scan:

- no current guide names a historical Phase 6.11 suite or support path
- the completed inventory and time-bounded source records retain their
  historical paths
- the current exact admission and support dispositions record the executed
  ownership
- the correspondence reference records all nine accepted path transitions
  over `7b840652..3d95eba5`

Exact-range test-quality, maintainability, and documentation review found no
material issue. The documentation review found only the expected self-tip gap;
this closeout records `350b07ac` as the evidence tip.

Decision: `Continue with constraints`. Keep the shared Parquet fixtures at
their current owner, retain the routing facade only until its recorded Phase 7
cleanup, and let Phase 6.12 consume the neutral ANSI helper without recreating
a Data Preview dependency.

Review gate:

- [x] reproduce the six-source selector and 48-case baseline
- [x] admit the exact suite, support, residual-mock, and fixture boundaries
- [x] move only the accepted Data Preview suites and support
- [x] preserve all 48 declarations and apply only four admitted assertion edits
- [x] complete focused, adjacent, full-suite, and repository validation
- [x] record current support dispositions and path correspondence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.12: Data Stack

Status: `completed`

Batch base: `cf15f599`

Implementation tip: `4ae50698`

Execution and path migration range: `cf15f599..4ae50698`

Review-fix tip: `04a0cfea`

Evidence tip: `6ee0d7b0`

Exact batch review range: `cf15f599..6ee0d7b0`

The 21 selected suites moved to five action, three command, nine direct,
four Interactive, and one evidence owner. The reporting-renderer case split
from command options into its direct production seam, producing 22 destination
test files. Direct and Interactive support moved to feature owners; Data Stack
harness fields and mocks moved locally while shared timeout fields and neutral
composition remained global.

Pre-move review found no vague, duplicate, or removable case. It retained all
181 cases and accepted four focused strengthenings:

- the generated default dry-run plan now proves the reported artifact parses
  and no stack output is materialized
- output/input conflict rejection now proves source bytes remain unchanged
  with overwrite enabled
- unknown unique-key diagnostics now prove the exact CLI error contract
- signal-label formatting now proves all five accepted signal mappings

Selector preservation and strengthening:

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          21 |    181 |      0 |        798 |
| Post-change |          22 |    181 |      0 |        804 |

All 181 declarations and exact titles remain represented once. The one-file
increase is the accepted direct reporting split; the six added runtime
assertions come only from the four admitted strengthenings.

The implementation checkpoint is:

- `4ae50698` — migrate all 21 source suites, split the direct reporting case,
  localize Data Stack support and harness contracts, and apply the four
  accepted strengthenings

Pre-commit test-quality and maintainability reviews found no material issue.
They confirmed exact title preservation, the single admitted split, coherent
feature ownership, neutral harness composition, narrow facade behavior, no
cycle, and no shared fixture or unrelated mock drift.

The first exact-range maintainability review found that the newly split direct
reporting owner retained a command-oriented `describe` label and duplicated
the neutral ANSI stripping implementation. Both findings were accepted in
`04a0cfea`: the owner label now names reporting, and the normalized-output
assertion consumes `test/helpers/ansi.ts`. The test title and assertion
semantics remain unchanged. Targeted reporting and complete Data Stack catalog
checks pass after the fix, as do lint, type checking, and diff validation.

Validation evidence:

| Boundary                              | Passed | Failed | Assertions | Files |
| ------------------------------------- | -----: | -----: | ---------: | ----: |
| Data Stack destinations               |    181 |      0 |        804 |    22 |
| Exact adjacent safety set             |     59 |      0 |        227 |     4 |
| Complete repository suite, final run  |  2,614 |      0 |     14,878 |   326 |

The first complete-suite run had one unrelated failure in
`test/cli-path-inline.test.ts` at the Tab-cycling case. That file immediately
passed three consecutive focused reruns, and the complete suite then passed in
full. No Data Stack case failed in either complete-suite run.

Repository checks are clean:

- `bun run format:check`
- `bun run lint`
- `bunx tsc --noEmit`
- `bun run build`
- `git diff --check`

Documentation path scan:

- no current guide names a historical Phase 6.12 suite or support path
- the completed inventory and time-bounded records retain historical paths
- the current admission and support dispositions record the executed owners
- the correspondence reference records all 26 accepted path transitions over
  `cf15f599..4ae50698`

The updated exact-range test-quality, maintainability, and documentation
review found no remaining material issue. It confirmed that `04a0cfea`
resolved both initial findings without changing any test title or assertion
semantics. This closeout records `6ee0d7b0` as the evidence tip.

Decision: `Continue with constraints`. Preserve the direct reporting owner and
neutral ANSI dependency, keep the shared timeout fields and neutral harness
composition global, and retain the routing facade only through its recorded
Phase 7 cleanup.

Review gate:

- [x] reproduce the 21-source selector and 181-case baseline
- [x] admit exact suite, split, support, harness, and facade boundaries
- [x] migrate only the accepted Data Stack owners
- [x] preserve all 181 declarations and apply four admitted strengthenings
- [x] complete focused, adjacent, full-suite, and repository validation
- [x] classify and clear the unrelated transient full-suite failure
- [x] record current support dispositions and path correspondence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the batch continuation decision

### Phase 6.13: Data Conversion

Status: `completed`

Batch base: `f2fb794b`

Implementation tip: `f7f509ee`

Execution and path migration range: `f2fb794b..f7f509ee`

Evidence tip: `a24c3bdd`

Exact batch review range: `f2fb794b..a24c3bdd`

The two selected suites moved to action and Interactive owners. Exactly six
conversion action mocks left the mixed residual; `actionMdToDocx` remains
there for Phase 6.18, and neutral composition remains global. No command owner
was created because mixed CLI UX conversion cases stay deferred to Phase 6.21.

All 13 cases remain represented once. Two admitted assertion edits replaced
broad CSV substrings with exact bytes and added derived-output absence after
invalid JSON; they offset at 56 assertions. Pre-commit review also replaced
two generic `describe` labels with feature-specific Data Conversion owners
without changing test titles or assertions.

| Boundary                             | Passed | Failed | Assertions | Files |
| ------------------------------------ | -----: | -----: | ---------: | ----: |
| Data Conversion destinations         |     13 |      0 |         56 |     2 |
| Exact adjacent safety set            |     42 |      0 |        198 |     2 |
| Complete repository suite            |  2,614 |      0 |     14,878 |   326 |

Repository checks are clean: `bun run format:check`, `bun run lint`,
`bunx tsc --noEmit`, `bun run build`, and `git diff --check`.

Documentation scan found no current guide using the historical suite or mock
paths. The matrix records the executed support split, and the correspondence
reference records three transitions over `f2fb794b..f7f509ee`.

Exact-range test-quality, maintainability, and documentation review found no
material issue. This closeout records `a24c3bdd` as the evidence tip.

Decision: `Continue with constraints`. Keep command-level conversion cases for
Phase 6.21, retain `actionMdToDocx` for Phase 6.18, and do not reintroduce a
generic Data Conversion suite label or mixed conversion mock owner.

Review gate:

- [x] reproduce the two-source and adjacent baselines
- [x] migrate only action, Interactive, and six mock contracts
- [x] preserve all 13 titles and the 56-assertion count
- [x] keep command cases and the DOCX residual in later phases
- [x] complete focused, adjacent, full-suite, and repository validation
- [x] record support disposition and path correspondence
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the continuation decision

### Phase 6.14: Fonts

Status: `completed`

Batch base: `ba8a6cd7`

Implementation tip: `4be23beb`

Execution and path migration range: `ba8a6cd7..4be23beb`

Evidence tip: `e4235892`

Exact batch review range: `ba8a6cd7..e4235892`

The 21 selected suites moved to 11 action, one command, six adapter, and four
direct owners. Three compound sources were decomposed into independently
failing contracts, producing 22 destination files and 113 declarations from
the original 105. No scenario or assertion was added or removed; the only
structural deletion was an empty `font coverage` wrapper.

| Check       | Owner files | Passed | Failed | Assertions |
| ----------- | ----------: | -----: | -----: | ---------: |
| Pre-change  |          21 |    105 |      0 |        493 |
| Post-change |          22 |    113 |      0 |        493 |

The five compound titles became 13 precise titles, while the other 100 titles
remain unchanged. Pre-commit review found and corrected one split-owner label:
`check-diagnostics.test.ts` now names diagnostics rather than duplicating the
text-output `describe` label. No case title or assertion changed in that fix.

| Boundary                              | Passed | Failed | Assertions | Files |
| ------------------------------------- | -----: | -----: | ---------: | ----: |
| Fonts destinations                    |    113 |      0 |        493 |    22 |
| Adjacent Markdown PDF font slice      |     30 |      0 |        162 |     4 |
| Complete repository suite             |  2,622 |      0 |     14,878 |   327 |

Repository checks are clean: `bun run format:check`, `bun run lint`,
`bunx tsc --noEmit`, `bun run build`, and `git diff --check`.

No current guide names a historical Fonts test path. The completed historical
inventory and plans retain dated commands; the current matrix records the
executed splits, and correspondence records all 21 transitions over
`ba8a6cd7..4be23beb`.

Exact-range test-quality, maintainability, and documentation review found no
material issue. This closeout records `e4235892` as the evidence tip.

Decision: `Continue with constraints`. Preserve the decomposed declaration
owners and their unchanged assertion inventory; do not reintroduce the empty
wrapper, generic diagnostics label, or a feature-local helper layer.

Review gate:

- [x] reproduce the 21-source and adjacent baselines
- [x] migrate only the admitted Fonts suites
- [x] decompose three compound sources without assertion drift
- [x] remove only the empty wrapper and fix the diagnostics owner label
- [x] complete focused, adjacent, full-suite, and repository validation
- [x] record all 21 path transitions
- [x] create the evidence commit and review the exact batch range
- [x] record accepted review fixes and the continuation decision

For each completed row, record its selected source count and dispositions,
focused pre/post and adjacent results, complete-suite and repository checks,
implementation and evidence commits, correspondence rows, exact test-quality,
maintainability, and documentation review range, accepted fixes, and final
`continue`, `constrain`, `defer`, or `stop` decision.

An out-of-manifest finding returns to inventory or matrix review. Phase 7 owns
global-helper neutrality, explicitly accepted residual support moves, and final
root exception or deferral classification; it does not admit another broad
family migration.
