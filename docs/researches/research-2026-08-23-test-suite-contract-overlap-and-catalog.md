---
title: "Test Suite Contract, Overlap, And Catalog Review"
created-date: 2026-08-23
modified-date: 2026-08-23
status: completed
agent: codex
---

## Goal And Current Finding

Review `test/**` by behavioral value rather than file size alone. The audit
must determine which tests protect useful contracts, which overlaps own
distinct boundaries, which vague cases need clearer names, which cases are
genuinely duplicated, and where surviving tests should live.

This is a follow-up to the completed TypeScript modularization work. That work
split accepted mixed files but did not perform a suite-wide test-value and
overlap audit.[2][3] Its completed history remains unchanged.

The recorded suite passes, but its topology is difficult to reason about as a
catalog:

- 2,625 tests pass across 289 discovered test files with 14,983 assertions
- `test/` contains 355 TypeScript files and approximately 90,400 lines
- 197 `*.test.ts` files remain directly under `test/`
- 78 test files are one directory below the root and 14 are two directories
  below it
- behavior-owned folders coexist with flat `cli-actions-*`, `cli-command-*`,
  and `cli-interactive-*` naming

These figures establish scale, not removal criteria. Runtime, file size, and
matcher shape do not determine whether a test is useful or duplicated.

The working sequence is:

```text
audit behavior -> settle ownership -> rename/merge/remove -> split -> move
```

The Phase 2 evidence supports a behavior-preserving cleanup with feature-first
ownership as the default. The complete inventory, 982-row literal case matrix,
support decisions, exact folder topology, deferrals, and accepted removal set
are recorded in the companion references and passed final documentation and
test-quality review.

### Baseline

The implementation baseline was refreshed on 2026-08-23 at commit `2f3013ca`,
before any test edit or path migration, with a clean tracked worktree:

```text
2625 pass
0 fail
14983 expect() calls
Ran 2625 tests across 289 files.
```

The completed modularization job records the same test and discovery counts.[3]

## Review Contract

### Scope

The audit covers every discovered `test/**/*.test.ts` file, case-level review
for flagged suites, layered and duplicate coverage, mixed suites, and fixture
or helper ownership. It should recommend a catalog and define the boundary for
a later implementation plan.

It does not change production behavior, optimize runtime as a primary goal,
move files before their disposition is understood, require all layered overlap
to disappear, or rewrite historical evidence around new paths.

### Classification

| Classification     | Evidence required                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------- |
| useful             | a concrete trigger, observable outcome, meaningful failure signal, and relied-on behavior |
| vague name         | useful behavior whose name does not identify the trigger and outcome; rename first        |
| behaviorally vague | assertions do not identify a meaningful outcome or regression signal                      |
| duplicated         | another named case owns the same trigger and outcome without losing a distinct boundary   |
| mixed suite        | test families have independent change reasons or different feature or lifecycle owners    |

A useful overlap must protect a distinct boundary:

| Layer          | Distinct contract                                                                |
| -------------- | -------------------------------------------------------------------------------- |
| direct/unit    | parsing, normalization, selection, formatting, or policy logic                   |
| adapter        | response translation, schema handling, fallback, timeout, or failure semantics   |
| action         | orchestration, side effects, diagnostics, or artifact lifecycle                  |
| command        | registration, parsing, precedence, defaults, environment handling, or forwarding |
| Interactive    | prompt order, backtracking, cancellation, regeneration, or retained state        |
| integration    | process, renderer, filesystem, archive, or runtime compatibility                 |
| evidence/smoke | guarded acceptance, cleanup, destructive-operation safety, or privacy policy     |

The existence of a layer does not justify a test by itself. Similar fixtures,
output text, or setup are also insufficient to prove duplication.

### Two-level audit

Every test file receives one primary file-level disposition:

| Disposition           | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| retain                | one coherent contract family with no material overlap signal       |
| rename review         | useful ownership whose file or case names obscure the contract     |
| case audit            | possible vague, duplicate, or layered overlap requiring comparison |
| split review          | independently changing contract families share one suite           |
| move-only review      | useful suite whose catalog ownership is unclear                    |
| fixture/helper review | support ownership may be duplicated, too broad, or misplaced       |

Each inventory row must record the current path, feature owner, layer, tested
boundary, representative contract, closest overlap, disposition, rationale,
and a case-matrix link when required. A `retain` decision still requires a
recorded contract and distinct boundary.

Every `case audit` and `split review` suite then receives a case matrix:

| Current test | Claimed contract  | Closest overlap | Unique boundary       | Decision                                    | Target owner       |
| ------------ | ----------------- | --------------- | --------------------- | ------------------------------------------- | ------------------ |
| test name    | regression signal | related case    | distinct seam or none | keep, rename, merge, remove, move, or split | final suite/folder |

Before a merge or removal, compare the trigger, preconditions, observable
outcome, tested boundary, failure signal, side effects, persistence, cleanup,
and any higher-layer parsing or forwarding. A removal must name the retained
owner; a merge must name its destination. When evidence is incomplete or
reviewers disagree, record `keep pending evidence` and leave the case outside
the removal scope.

### Audit acceptance

The audit is complete only when:

- every discovered test file appears exactly once in the inventory
- every disposition has a contract-based rationale
- every `case audit` or `split review` row links to a completed matrix
- each accepted removal or merge names the retained owner or destination
- `keep pending evidence` cases remain outside the implementation scope
- representative feature pilots support the accepted catalog
- the inventory, matrices, and conclusions receive documentation and
  test-quality review

The complete inventory and matrices live in checked-in companion references:
`docs/references/test-suite-audit-inventory.md` owns file-level classification,
and `docs/references/test-suite-case-matrices.md` owns literal case decisions,
catalog targets, and support ownership. Keeping the evidence rows out of this
document preserves the research as a readable decision record without
weakening the audit gate.

## Pilot Evidence

These observations justify the audit method but are not final dispositions:

| Candidate                                       | Current evidence                                                                                             | Required review                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `cli-actions-rename-batch-codex-docs.test.ts`   | `works with docs profile scoping` is vague wording, but the case proves document selection and PNG exclusion | rename, not remove                                                                            |
| `cli-interactive-contextual-tip.test.ts`        | the same user-visible literal catalog is asserted through static, pool, and selected-tip cases               | identify one direct owner and retain only distinct helper-layer signals                       |
| Data Query action and command suites            | both exercise source, range, header, relation, and output behavior                                           | keep command cases only for unique parsing, precedence, environment, or forwarding boundaries |
| broad `not.toThrow()` and `toBeDefined()` cases | many guard extraction, CSS policy, or filesystem prerequisites before stronger assertions                    | judge the complete contract, not matcher shape                                                |
| Markdown PDF smoke and evidence suites          | large suites protect cleanup, redaction, collision, link, write-safety, and compatibility boundaries         | retain safety and acceptance signals unless literal overlap is proved                         |

The prior modularization closeout also deferred these mixed candidates:

- `test/cli-actions-doctor-markdown-video-deferred.test.ts`
- `test/cli-actions-md-to-pdf-bundle.test.ts`
- `test/cli-interactive-markdown-pdf/font-hints.test.ts`

The inventory should additionally cover `test/cli-ux.test.ts`, Data Query,
Data Stack, Doctor, root-level Markdown PDF actions, duplicated feature
fixtures, and global helpers with only one feature consumer. Inclusion is an
audit signal, not a presumption that the suite must be split or reduced.

## Accepted Catalog Direction

Feature-first ownership with a bounded second-level layer is the working
default because it keeps a feature's direct, action, command, Interactive, and
integration coverage close enough to compare:

```text
test/
  <feature-or-platform-owner>/
    <boundary>/        # only when multiple suites or a stable seam justify it
  helpers/             # cross-feature, feature-neutral infrastructure only
```

A feature owner may be a product family such as Data Query or Markdown PDF, or
a stable platform family such as CLI foundations, Codex adapters, tooling, or
utilities. A purely implementation-layer-first catalog is not preferred
because it distributes one feature across distant folders. Representative
pilots still need to settle exact names and depth.

The working rules are:

- A source-aligned exception requires one cohesive low-level contract, no
  clearer feature or platform owner, no expected sibling suites, and materially
  better discoverability beside its production boundary. Small size alone is
  insufficient.
- A single small suite may live at its nearest feature root. Do not create a
  one-file layer directory unless a stable boundary materially improves
  navigation.
- Moving every surviving test is a catalog goal, not a rigid completion gate.
  A temporary root deferral must name an event-based revisit condition, such
  as its owning feature audit or next substantive edit.
- Once the catalog is accepted, new feature tests should not normally expand
  the flat root even while recorded exceptions remain.
- Command cases survive only when they protect registration, parsing, aliases,
  option precedence, defaults, environment handling, forwarding, or a process
  boundary that action tests do not own.
- Global helpers require independent use by at least two feature families,
  feature-neutral semantics and vocabulary, no feature-module dependency, and
  a stable lifecycle or assertion contract worth sharing.

A 2026-08-23 consumer scan at commit `6212d65c` found 135 importing files for
`test/helpers/cli-test-utils.ts` and 91 for
`test/helpers/cli-action-test-utils.ts`. These counts make their global shells
strong candidates, but do not prove independent feature-family use or
feature-neutral semantics. The inventory must name the consumer families and
record the semantic review before retaining global ownership. Their Rename
cleanup dependency and re-exports remain feature leakage and should move to a
Rename owner during the audit. The Interactive harness and virtual terminal
are also global candidates pending the same review; Doctor, Data Stack,
Rename, and Data fixture helpers remain feature-local candidates.

## Enhancement Boundary

The later implementation should:

- use the completed inventory and matrices as its change boundary
- rename useful vague cases and remove only proved duplicate behavior
- split suites by contract ownership rather than line count
- migrate bounded feature families with recorded exceptions and deferrals
- preserve one clear owner for every accepted layer and safety boundary
- keep `keep pending evidence` cases unchanged
- update the dated path correspondence without rewriting historical evidence
- use one unified job record for implementation and validation receipts

Data Query is accepted as the first overlap and catalog pilot because it spans
direct, action, command, and Interactive coverage. Doctor is accepted as the
second pilot because its production boundaries are clearer than its remaining
mixed test layout. Their exact pre-change owners, destinations, support
boundaries, and focused commands live in the case-matrix reference.

A draft plan may define the evidence and migration gates, but no test edit or
path-migration phase should begin until the inventory, representative
matrices, and exact catalog topology are accepted.

## Documentation Currentness

Test movement has a separate documentation boundary. A 2026-08-23 scan at
commit `6212d65c`, excluding this active research, found:

- 2,791 `test/...` mentions across 386 Markdown files under `docs/guides/`,
  `docs/researches/`, and `docs/plans/`
- 2,194 mentions across 304 job records within that total
- 16 navigational links into `test/` across five documents
- seven distinct linked test targets, including two missing locations:
  `test/fonts.test.ts` and `test/cli-actions-md-to-pdf.test.ts`

These counts include fixtures and repeated historical commands. They establish
migration scale, not a rewrite total.

The canonical lookup belongs in
`docs/references/test-catalog-path-correspondence.md`. Each accepted historical
path receives one row containing the UTC reference date, transition, current
owner or owners, exact migration range, and unified-job evidence. The range is
authoritative when same-day ordering matters.

| Reference class                                                     | Required treatment                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| imports, scripts, configuration, and runnable current commands      | update atomically with the move                               |
| current guides, references, and active current-state claims         | use the accepted current path                                 |
| historical commands, output, ranges, and time-bounded prose         | preserve historical wording                                   |
| navigational links in historical records                            | keep resolvable and annotate the current location when needed |
| historical docs substantively edited on or after the reference date | scan the whole document, then classify each occurrence        |

For date comparison, use `modified-date` when present and otherwise
`created-date`. The date triggers review; it does not force every historical
command to be rewritten. A link-only repair does not add a substantive
`modified-date`.

Each migration phase updates its correspondence rows plus executable and
current documentation references. Its unified job section links to those rows
and owns decisions, exact ranges, and validation; it does not duplicate the
mapping table. The final phase scans every moved path, repairs broken links,
and confirms that all retained old paths are intentionally historical.

The correspondence reference remains `draft` throughout this initial
migration. It becomes `completed` only after the final reconciliation proves
that every accepted path change is recorded and no old-path occurrence remains
unclassified.

## Resolved Recommendations

The completed evidence supports these recommendations:

1. Use the accepted feature/platform catalog in the case-matrix reference;
   create a second-level boundary only for multiple siblings or a stable seam.
2. Admit only proved feature-neutral global helpers. Move the Interactive
   harness to the CLI-foundations platform owner and extract feature mocks over
   bounded later checkpoints.
3. Keep all ten `keep pending evidence` cases unchanged. They do not authorize
   a merge, removal, or behavior rewrite.
4. Apply the Data Query path contract first, then the Doctor and mixed-suite
   path contract. Defer shared Data Sources, Markdown PDF, Data Extract, Data
   Stack, Rename, and broad harness migrations to their recorded events.
5. Use the Bundle plus Interactive font-hints pair as the later bounded
   Markdown PDF pilot; preserve renderer, safety, privacy, cleanup, collision,
   and evidence contracts.
6. Retain command cases only for registration, parsing, precedence, defaults,
   environment, forwarding, or process seams not owned by action coverage.
7. Accept a removal or merge only when its matrix row names the exact retained
   owner and final test-quality review confirms equivalent trigger, outcome,
   boundary, failure, and side-effect lifecycle.

Documentation and test-quality review accepted these conclusions in the exact
Phase 2 range recorded by the implementation job. The research, audit
inventory, and case-matrix reference are therefore `completed`. The
path-correspondence reference remains `draft` through implementation and final
documentation reconciliation.

## Reproduction Appendix

Baseline topology:

```bash
find test -type f -name '*.ts' | wc -l
find test -type f -name '*.ts' -print0 | xargs -0 wc -l | tail -n 1
find test -maxdepth 1 -type f -name '*.test.ts' | wc -l
find test -mindepth 2 -maxdepth 2 -type f -name '*.test.ts' | wc -l
find test -mindepth 3 -maxdepth 3 -type f -name '*.test.ts' | wc -l
bun test
```

Documentation scale:

```bash
rg -l 'test/' docs/guides docs/researches docs/plans \
  -g '*.md' \
  -g '!research-2026-08-23-test-suite-contract-overlap-and-catalog.md' | wc -l
rg -o 'test/[A-Za-z0-9_./-]+' docs/guides docs/researches docs/plans \
  -g '*.md' \
  -g '!research-2026-08-23-test-suite-contract-overlap-and-catalog.md' | wc -l
rg -l 'test/' docs/plans/jobs -g '*.md' | wc -l
rg -o 'test/[A-Za-z0-9_./-]+' docs/plans/jobs -g '*.md' | wc -l
```

Linked test targets:

```bash
rg -l -P '\[[^]]+\]\((?:\.\./)+test/[^)]*\)' docs \
  -g '*.md' \
  -g '!research-2026-08-23-test-suite-contract-overlap-and-catalog.md' | wc -l
rg -o -P '\[[^]]+\]\((?:\.\./)+test/[^)]*\)' docs \
  -g '*.md' \
  -g '!research-2026-08-23-test-suite-contract-overlap-and-catalog.md' | wc -l
rg -o --no-filename -P '\[[^]]+\]\((?:\.\./)+\Ktest/[^)]+' docs \
  -g '*.md' \
  -g '!research-2026-08-23-test-suite-contract-overlap-and-catalog.md' | sort -u
```

The seven reported targets were checked from the repository root with
`test -e`.

## Historical Context And Related Documents

The March audit identified redundant Rename preview and path-prompt coverage
and introduced keep/move/remove matrices and behavior-owned splits.[1] The
August modularization follow-up later split large tests and production modules
while explicitly deferring several suites from a suite-wide value review.[2][3]

- [TypeScript Modularization Follow-Up Implementation](../plans/plan-2026-08-23-typescript-modularization-follow-up.md)
- [Test Suite Contract And Catalog Enhancement](../plans/plan-2026-08-23-test-suite-contract-and-catalog-enhancement.md)
- [Historical Test Suite Modularization And Redundancy Reduction](../plans/archive/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md)
- [Test Catalog Path Correspondence](../references/test-catalog-path-correspondence.md)
- [Test Suite Audit Inventory](../references/test-suite-audit-inventory.md)
- [Test Suite Case Matrices And Catalog](../references/test-suite-case-matrices.md)

[1]: archive/research-2026-03-02-test-suite-audit.md
[2]: research-2026-08-23-typescript-modularization-follow-up.md
[3]: ../plans/jobs/2026-08-23-typescript-modularization-follow-up.md
