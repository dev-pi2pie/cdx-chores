---
title: "Test Suite Contract And Catalog Enhancement"
created-date: 2026-08-23
modified-date: 2026-08-23
status: active
agent: codex
---

## Goal

Turn the suite-wide contract and overlap research into a behavior-preserving
test enhancement. Establish one evidence-backed owner for each useful
contract, remove only proved duplication, clarify vague tests, split mixed
suites, and migrate surviving coverage toward a feature-first catalog with
bounded exceptions.

The goal is clearer regression ownership and navigation. Reducing test count,
line count, or runtime is not a success criterion by itself.

## Planning Boundary

This plan is `active`. Phases 1 and 2 complete the evidence required by the
related research. No test edit, removal, merge, split, or path migration may
begin before the Phase 2 admission gate accepts the inventory, representative
case matrices, and exact catalog topology.

The plan became `active` when Phase 1 execution began. Keep it active through
the evidence and migration phases unless a recorded blocker prevents the next
gate.

If the evidence does not support a removal, retain the test. If the catalog
cannot yet give a suite a stable owner, record an event-based deferral rather
than forcing a move.

## Related Documents

- [Test Suite Contract, Overlap, And Catalog Review](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md)
- [Test Catalog Path Correspondence](../references/test-catalog-path-correspondence.md)
- [Test Suite Audit Inventory](../references/test-suite-audit-inventory.md)
- [Test Suite Case Matrices And Catalog](../references/test-suite-case-matrices.md)
- [TypeScript Modularization Follow-Up Implementation](plan-2026-08-23-typescript-modularization-follow-up.md)
- [Historical Test Suite Modularization And Redundancy Reduction](archive/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md)

## Scope

In scope:

- inventory every discovered `test/**/*.test.ts` file
- complete case matrices for flagged vague, overlapping, or mixed suites
- rename useful but vague files and cases
- merge or remove only cases with a recorded retained contract owner
- split mixed suites by behavioral ownership
- move surviving tests in bounded feature or platform families
- colocate feature fixtures and helpers while retaining only proved
  cross-feature infrastructure globally
- record source-aligned exceptions and temporary root deferrals
- maintain historical-to-current path correspondence and current docs links
- validate each migration slice and the cumulative suite

Out of scope:

- production behavior, prompts, diagnostics, output, or artifact changes
- pruning tests because they are large, slow, inconvenient, or use broad
  matchers
- treating a zero-test-removal result as failure
- changing runtime support or introducing Bun-only production APIs
- rewriting historical commands or time-bounded evidence as if new paths
  existed earlier
- moving the complete suite in one repository-wide batch

## Implementation Rules

- Audit before editing. Every changed suite must have an accepted inventory
  disposition; every merge or removal must have an accepted case-matrix row.
- Preserve one clear test owner for every accepted direct, adapter, action,
  command, Interactive, integration, smoke, evidence, privacy, cleanup, and
  safety contract.
- Treat vague naming as a rename signal. Removal requires proof that another
  named case protects the same trigger, outcome, failure signal, boundary, and
  side-effect lifecycle.
- Leave `keep pending evidence` cases unchanged.
- Move one bounded feature or platform family per implementation checkpoint.
  Do not mix unrelated catalog migrations in one review range.
- Keep a single small suite at its nearest feature root. Create a boundary
  directory only when multiple suites or a stable production seam justify it.
- Admit a source-aligned exception only when it satisfies every criterion in
  the research and the inventory records its rationale.
- Keep global helpers or fixtures only after recording independent consumer
  families and feature-neutral semantics. Import count alone is insufficient.
- Preserve Node.js runtime compatibility. Bun remains the development and test
  runner.
- Update current imports, scripts, configuration, guides, references, and
  active current-state claims atomically with each move.
- Add correspondence rows for every accepted move, split, merge, or removal;
  do not duplicate that mapping in the execution record.
- Run focused validation and review the exact implementation `base..tip` range
  before starting the next migration slice. Widen and repeat the review if a
  review fix lands.
- Update plan checklists and lifecycle status only after the required evidence
  passes.

## Accepted Catalog Contract

Phase 2 admits stable feature or platform owners with a bounded second level:

```text
test/
  data-query/{direct,actions,commands,interactive,evidence}/
  doctor/{actions,commands,workflow,interactive,support}/
  data-sources/{adapters,fixtures}/
  cli-foundations/{dependencies,inline-rendering,interactive-harness}/
  markdown-pdf/{actions,adapters,commands,direct,evidence,interactive,support}/
  markdown-docx/actions/
  video/actions/
  <other-feature>/{direct,actions,commands,interactive,support}/
  helpers/ # independently reused, feature-neutral infrastructure only
```

Do not create every listed boundary eagerly. A boundary directory is admitted
only when multiple suites or a stable seam justifies it. The complete targets,
support decisions, and event-based deferrals live in the case-matrix reference.

Feature-local fixtures and helpers should live under their owner. New feature
tests should not expand the flat `test/` root. Existing root suites may remain
only as recorded source-aligned exceptions or temporary deferrals with
event-based revisit conditions.

## Execution Record Strategy

Use one execution record for the complete rollout:

```text
docs/plans/jobs/YYYY-MM-DD-test-suite-contract-and-catalog-enhancement.md
```

Create it when Phase 1 begins, using that execution date, and keep it
`in-progress` through the rollout. Each phase section should record:

- inventory or behavior boundary reviewed
- suites and cases retained, renamed, merged, removed, split, moved, or
  deferred
- retained owner for every merge or removal
- focused validation and exact review range
- correspondence entries added and current docs updated
- historical path occurrences intentionally retained
- continue, constrain, or stop decision

For migration phases, include a compact before/after owner table and copy the
exact focused test paths from the accepted inventory before editing. Create a
separate job only if discovered work materially leaves this plan's scope.

## Phase Checklist

### Phase 1: Refresh The Baseline And Populate The Inventory

Tasks:

- [x] Refresh the test count, discovered-file count, assertion count, topology,
      and tracked baseline commit.
- [x] Create `docs/references/test-suite-audit-inventory.md` with `draft`
      status and the schema accepted by the research.
- [x] Record every discovered `*.test.ts` file exactly once with its feature
      owner, layer, tested boundary, representative contract, closest overlap,
      primary disposition, rationale, and matrix link when required.
- [x] Review support-only TypeScript files through their consuming suites and
      add explicit support rows where ownership is itself uncertain.
- [x] Prove mechanically that the inventory has no missing or duplicate test
      paths; add a small validator only if a reproducible one-off comparison is
      insufficient.
- [x] Run the complete suite without changing tests and record the fresh
      baseline in the unified job.

Validation:

```bash
find test -type f -name '*.ts' | wc -l
find test -type f -name '*.ts' -print0 | xargs -0 wc -l | tail -n 1
find test -type f -name '*.test.ts' | wc -l
find test -maxdepth 1 -type f -name '*.test.ts' | wc -l
bun test
```

Gate:

- Continue only when every discovered test file appears exactly once and every
  row names an observable contract and primary disposition.
- Constrain unresolved rows to `case audit`, `split review`, `move-only
review`, `fixture/helper review`, or `keep pending evidence`; do not infer
  implementation permission.
- Stop before Phase 2 if inventory completeness cannot be reproduced.

### Phase 2: Complete Case Matrices And Admit The Catalog

Tasks:

- [x] Complete literal case matrices for Data Query, Doctor, the contextual-tip
      catalog, and one mixed Markdown PDF family.
- [x] Add matrices for every other inventory row marked `case audit` or `split
review`.
- [x] Record rename-only cases separately from accepted merges and removals.
- [x] Name the retained owner for every accepted merge or removal and keep
      disputed cases as `keep pending evidence`.
- [x] Record accepted source-aligned exceptions and every temporary root
      deferral with its event-based revisit condition.
- [x] Record independent consumer families and semantic review for every
      accepted global helper or fixture.
- [x] Replace the provisional catalog placeholders with the accepted owner and
      boundary names and select the exact Data Query, Doctor, and Markdown PDF
      pilot slices.
- [x] Add exact pre-change and expected post-change focused-test paths to the
      corresponding later phase sections or unified-job templates.
- [x] Review the completed inventory, matrices, catalog, and research with
      documentation and test-quality reviewers.
- [x] Update the research and audit-inventory lifecycle states only when their
      own completion criteria are satisfied.

Representative validation:

```bash
bun test test/cli-actions-data-query*.test.ts test/cli-command-data-query*.test.ts test/cli-interactive-*data-query*.test.ts test/data-query*.test.ts
bun test test/cli-action-doctor.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-command-doctor.test.ts test/cli-doctor-workflow.test.ts
bun test test/cli-interactive-contextual-tip.test.ts test/cli-actions-md-to-pdf-bundle.test.ts test/cli-interactive-markdown-pdf/font-hints.test.ts
```

Admission gate:

- Continue to Phase 3 only when the research evidence bar is satisfied and the
  exact pilot owners, paths, matrices, and focused commands are accepted.
- Constrain the implementation to rename, split, and move operations when no
  merge or removal meets the duplicate-evidence protocol.
- Stop before Phase 3 and mark the active plan `blocked` if the catalog or
  retained owners remain materially disputed.

### Phase 3: Migrate The Data Query Pilot

Accepted path contract: [Phase 3 Data Query Path Contract](../references/test-suite-case-matrices.md#phase-3-data-query-path-contract)

Tasks:

- [x] Apply only the accepted Data Query matrix decisions.
- [x] Preserve direct query, action orchestration, command parsing and
      forwarding, Interactive lifecycle, adapter, and artifact contracts that
      own distinct boundaries.
- [x] Rename vague cases, merge or remove proved duplication, and split mixed
      suites before moving the retained owners.
- [x] Move all non-pending Data Query suites and feature-local support into the
      accepted catalog without creating a second compatibility test tree;
      preserve the five recorded pending command owners at their current
      paths.
- [x] Update imports, scripts, current docs, and correspondence rows atomically.
- [x] Run every pre-change owner and final Data Query catalog path recorded by
      Phase 2.
- [x] Review the exact phase range and record whether the catalog pattern is
      accepted, constrained, or stopped before applying it elsewhere.

Observable contracts:

- direct query semantics remain owned independently from action orchestration
- command tests retain only distinct registration, parsing, precedence,
  environment, forwarding, and process boundaries
- Interactive routing, review, cancellation, workspace, header, and
  source-shape contracts remain represented
- artifact validation, DuckDB lifecycle, and fixture generation remain covered

### Phase 4: Migrate The Doctor Ownership Pilot

Accepted path contract: [Phase 4 Doctor Path Contract](../references/test-suite-case-matrices.md#phase-4-doctor-path-contract)

Tasks:

- [x] Apply the accepted Doctor and mixed-suite matrix decisions.
- [x] Split Doctor inspection, workflow projection, command rendering, Markdown,
      DOCX, and video behavior into their accepted owners.
- [x] Keep feature-local Doctor fixtures with Doctor unless independent
      cross-feature use and feature-neutral semantics are proved.
- [x] Move retained Doctor suites into the accepted catalog and update all
      imports, current docs, and correspondence rows.
- [x] Run every pre-change owner, every destination owner created by the split,
      and the complete Doctor family.
- [x] Review the exact phase range before continuing.

Observable contracts:

- Doctor inspection, projection, rendering, command, JSON, and exit behavior
  retain distinct coverage
- Markdown, DOCX, and video failure contracts remain owned by their actual
  features rather than a mixed Doctor bucket
- no production behavior changes occur

### Phase 5: Migrate The Markdown PDF Catalog Pilot

Admission boundary:

- migrate exactly `test/cli-actions-md-to-pdf-bundle.test.ts` and
  `test/cli-interactive-markdown-pdf/font-hints.test.ts`
- apply only the accepted split and move decisions in the Phase 2 matrix
- make no production change or test removal
- leave shared Markdown PDF support and every other Markdown PDF suite at its
  current path
- land the Bundle and font-hints owners as separate implementation commits,
  then land a separate evidence commit containing validation, correspondence,
  and status evidence
- review the complete phase-base-to-evidence-tip range; record the closeout
  receipt only after that range is clean

Tasks:

- [x] Apply the accepted matrix for the bounded Markdown PDF pilot selected in
      Phase 2.
- [x] Keep safety, privacy, cleanup, collision, symlink, hardlink,
      partial-write, renderer, and reproducible evidence contracts unless
      literal duplication is proved.
- [x] Separate direct, adapter, action, command, Interactive, integration, and
      evidence ownership without reorganizing the entire Markdown PDF family in
      one checkpoint.
- [x] Move retained suites and feature-local fixtures into the accepted catalog
      and update current documentation and correspondence rows.
- [x] Run every recorded pre-change owner, destination owner, and adjacent
      Markdown PDF integration or evidence suite affected by shared support.
- [x] Review the exact phase range and decide whether the catalog pattern is
      safe for the remaining large feature families.

Observable contracts:

- command and action semantics remain distinct where parsing, forwarding, and
  process boundaries differ
- Interactive lifecycle and renderer/evidence safety retain clear owners
- no test is removed because of runtime, size, or matcher style

### Phase 6: Migrate Remaining Feature And Platform Families

Repeat this phase as one checkpoint per accepted manifest row; do not combine
rows merely because they share a feature prefix.

#### Phase 6 Batch Manifest

Manifest base: `2d6c81fa`

Let `I` be the rows in the completed inventory's `Complete File Inventory`
whose recorded current path exists at the manifest base and matches
`test/**/*.test.ts`. Support-only rows are excluded from selector counts and
are governed by each row's support boundary. Source selectors are evaluated
against `I`, not against the changing working tree. The 21 rows select 246
distinct test paths with no overlap.

For the five Markdown PDF rows, let `M` be paths whose feature owner contains
`Markdown PDF`. The Phase 5 historical sources are absent at the manifest base
and therefore outside `M`.

| ID   | Batch                                         | Exact source selector                                                                                                                                                                                 | Count | Accepted destination                                              | Test operations                              | Support boundary                                                                   |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| 6.1  | Markdown PDF general                          | `M` excluding 6.2-6.5                                                                                                                                                                                 |    26 | `test/markdown-pdf/{actions,commands,direct,evidence}/`            | move and accepted split                      | Move slice-exclusive support only; retain cross-slice support.                     |
| 6.2  | Markdown PDF Template Codex                   | `M` paths containing `markdown-pdf-template` or `md-to-pdf-template`, plus `test/cli-actions-md-to-pdf-commands/template.test.ts`                                                                      |    28 | `test/markdown-pdf/{actions,adapters,commands}/`                   | move and accepted split                      | Move Template-exclusive fixtures before their remaining consumers.                |
| 6.3  | Markdown PDF Profile                          | `M` paths containing `markdown-pdf-profile` or `md-to-pdf-profile`, plus `test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts` and `test/cli-actions-md-to-pdf-commands/profile.test.ts`         |    20 | `test/markdown-pdf/{actions,adapters,commands,evidence}/`          | move and accepted split                      | Move Profile-exclusive fixtures; retain cross-slice path support.                  |
| 6.4  | Markdown PDF Project Codex                    | `M` paths containing `md-to-pdf-project-codex`, plus `test/cli-actions-md-to-pdf-commands/project.test.ts`                                                                                            |    16 | `test/markdown-pdf/{actions,commands}/`                            | move and accepted split                      | Move Project action-write fixtures; retain cross-slice support.                    |
| 6.5  | Markdown PDF Interactive and support closeout | `M` paths beneath `test/cli-interactive-markdown-pdf/`                                                                                                                                                |    19 | `test/markdown-pdf/{interactive,support}/`                         | move and accepted split                      | Move remaining Markdown support; retain neutral harness residue for Phase 7.       |
| 6.6  | Release tooling                               | owner exactly `Release tooling`                                                                                                                                                                       |     2 | `test/release-tooling/`                                           | move and accepted split                      | Feature-local fixtures only.                                                       |
| 6.7  | Markdown Frontmatter                          | owner exactly `Markdown Frontmatter`                                                                                                                                                                  |     1 | `test/markdown-frontmatter/{actions,commands}/`                    | accepted split                               | Extract its action mock; catch-all deletion remains Phase 7.                       |
| 6.8  | Video                                         | owner exactly `Video`                                                                                                                                                                                 |     2 | `test/video/{actions,interactive}/`                                | pure move                                    | Extract its mock behavior; CLI UX and routing remain in 6.21.                      |
| 6.9  | Data Sources                                  | owner in `DuckDB adapter`, `Shared data fixtures`, `Spreadsheet source adapter`, `Shared data shaping`, or `Shared spreadsheet fixtures`                                                              |     5 | `test/data-sources/{adapters,direct,evidence,fixtures}/`           | pure move                                    | Move accepted tabular and DuckDB fixture helpers; no harness work.                 |
| 6.10 | Data Extract                                  | owner exactly `Data Extract`                                                                                                                                                                          |    13 | `test/data-extract/{actions,commands,interactive}/`                | pure test moves                              | Move feature support and mocks; retain neutral harness residue.                    |
| 6.11 | Data Preview                                  | owner exactly `Data Preview`                                                                                                                                                                          |     6 | `test/data-preview/{actions,commands,interactive}/`                | pure test moves                              | Split feature support and introduce accepted `test/helpers/ansi.ts`.               |
| 6.12 | Data Stack                                    | owner exactly `Data Stack`                                                                                                                                                                            |    21 | `test/data-stack/{actions,commands,direct,interactive,evidence}/`  | move and one accepted split                  | Move feature support; compatibility facade remains Phase 7.                        |
| 6.13 | Data Conversion                               | owner exactly `Data Convert` or `Data Conversion`                                                                                                                                                     |     2 | `test/data-conversion/{actions,commands,interactive}/`             | pure test moves                              | Extract its mock behavior; shared root UX and routing remain in 6.21.              |
| 6.14 | Fonts                                         | owner exactly `Fonts`                                                                                                                                                                                 |    21 | `test/fonts/{actions,adapters,commands,direct}/`                   | move and accepted split                      | No shared-support move; remove only the recorded empty `describe`.                 |
| 6.15 | Rename                                        | owner exactly `Rename`, `Rename cleanup`, or `Rename / Apply replay`                                                                                                                                  |    34 | `test/rename/{actions,adapters,codex,commands,direct,interactive,planner,presentation,support}/` | move, accepted split, and two title renames | Move local support and mocks; retain only `runCli`'s internal cleanup import for Phase 7. |
| 6.16 | Codex adapter platform                        | owner exactly `Codex adapter platform`                                                                                                                                                                |     2 | `test/codex-adapters/direct/`                                     | move, accepted split, two title renames, bounded assertion strengthening | No support move; the exact platform matrix is complete.                            |
| 6.17 | Document Rename                               | owner exactly `Document Rename`                                                                                                                                                                       |     1 | `test/document-rename/adapters/`                                  | pure move                                    | No support move.                                                                   |
| 6.18 | DOCX                                          | owner exactly `DOCX`                                                                                                                                                                                  |     1 | `test/markdown-docx/adapters/`                                    | pure move                                    | Extract only DOCX mock behavior; neutral harness residue remains Phase 7.          |
| 6.19 | Markdown platform                             | owner exactly `Markdown`                                                                                                                                                                              |     1 | `test/markdown/commands/`                                         | pure move                                    | No support move.                                                                   |
| 6.20 | Utilities                                     | owner exactly `Utilities`                                                                                                                                                                             |     1 | `test/utils/`                                                     | source-aligned move                          | No support move.                                                                   |
| 6.21 | CLI foundations and mixed-root decomposition  | owner in `CLI foundations`, `CLI foundations and Doctor`, `CLI Interactive infrastructure`, `CLI Interactive`, or `CLI command families`                                                              |    24 | accepted CLI-foundations and feature destinations                 | move, split, merge, rename, accepted removal | Move virtual terminal; defer neutral harness and compatibility cleanup to Phase 7. |

CLI foundations runs last so every destination referenced by the mixed routing
and UX owners already exists. A batch may start only when its selector
reproduces the recorded count, every selected path exists or has a recorded
earlier transition, and its destination and support boundary are settled.
An inventory row without an exact case-matrix destination must receive an
exact path mapping in that batch's admission receipt or remain at its current
path; a destination folder alone does not authorize an opportunistic rename.

Tasks for each batch:

- [x] Filter the accepted inventory to one owner and confirm every changed
      suite has a settled disposition.
- [x] Complete any newly required case matrix before editing.
- [x] Apply accepted rename, merge, removal, split, and move decisions.
- [x] Colocate feature-local support and preserve approved global imports.
- [x] Update executable references, current docs, and correspondence rows.
- [x] Run the complete focused owner set plus affected adjacent boundaries.
- [x] Run the complete suite and repository checks after the focused owner set.
- [x] Review the exact batch range and record a continue, constrain, defer, or
      stop decision.

Batch gate:

- A family may be deferred only with a named ownership issue and event-based
  revisit condition.
- A new finding outside the accepted inventory returns to matrix review or
  becomes separate work; it is not folded silently into the batch.

### Phase 7: Close Global Support Ownership And Root Deferrals

This is a post-family closure and reconciliation phase. It may finish only
explicitly accepted residual support moves and root classifications; it must
not introduce another unbounded feature or CLI-foundations migration.

Tasks:

- [ ] Verify the named consumer families and feature-neutral semantics of every
      retained global helper and fixture.
- [ ] Move feature-specific helper dependencies and re-exports to their feature
      owners, including accepted Rename leakage from global CLI helpers.
- [ ] Confirm each remaining flat-root suite is an accepted source-aligned
      exception or a temporary deferral with a revisit event.
- [ ] Confirm no migration phase introduced a new flat-root feature suite.
- [ ] Re-run all suites importing changed global support and the affected
      feature families.
- [ ] Update the inventory and unified job with final global, local, exception,
      and deferral ownership.
- [ ] Review the exact phase range before cumulative closeout.

### Phase 8: Validate And Reconcile Documentation

Tasks:

- [ ] Run every focused owner set affected by the rollout.
- [ ] Run the complete Bun test suite, TypeScript check, lint, formatting check,
      build, and diff check.
- [ ] Confirm inventory current paths, dispositions, retained owners,
      exceptions, and deferrals match the final tree.
- [ ] Scan every moved historical path across imports, scripts, configuration,
      guides, references, research, plans, and job records.
- [ ] Update current paths, repair navigational links, and classify each
      retained old path as intentional historical evidence.
- [ ] Confirm every accepted move, split, merge, and removal has a complete
      correspondence row and unified-job evidence.
- [ ] Review the complete implementation range for test-quality, documentation,
      maintainability, and behavior-preservation risks.
- [ ] Update the research, plan, references, and unified job statuses only from
      their recorded completion evidence.

Closeout validation:

```bash
bun test
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

## Completion Criteria

This plan may be marked `completed` only when:

- every discovered test file remains represented in the final inventory
- every implemented merge or removal names a retained owner and matches an
  accepted case matrix
- every surviving test has an accepted feature, platform, source-aligned, or
  temporary-deferral owner
- every deferral has an event-based revisit condition
- focused and cumulative validation pass
- exact phase and batch review ranges are recorded in the unified job
- current documentation uses accepted paths and remaining old paths are
  intentionally historical
- the correspondence reference satisfies its final reconciliation boundary
- final documentation and test-quality review report no unresolved material
  findings

Completion does not require every test to move or the suite to become smaller.
It requires every exception and retained overlap to be evidence-backed and no
accepted path change to remain undocumented.
