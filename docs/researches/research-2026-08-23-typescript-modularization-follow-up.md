---
title: "TypeScript Modularization Follow-Up"
created-date: 2026-08-23
status: draft
agent: codex
---

## Goal

Reassess current TypeScript files over 300 lines in `src/` and `test/`, identify
where size now reflects mixed responsibility, and define a safe boundary for a
new behavior-preserving modularization plan.

This is follow-up research. The completed May size-refactor work remains the
historical record for its rename, data-query, and earlier test-suite phases.
This document focuses on the repository after later Markdown PDF, Project,
Template, Profile, Interactive, timeout, and Doctor work expanded the current
code and test surfaces.

## Research At A Glance

A strict current scan finds 59 TypeScript files in `src/` and 75 in `test/`
above 300 lines. The threshold is a discovery tool, not a refactor rule:

- 33 of the 59 source files are Markdown PDF or Interactive Markdown related
- 48 of the 75 test files are Markdown PDF related
- the largest mixed-responsibility files are concentrated in recently expanded
  Markdown PDF test and orchestration surfaces
- several long production modules remain cohesive safety boundaries and should
  not be split only to reduce line count

The strongest immediate opportunities are the large Profile, Project,
Interactive, Template, and adapter test suites. The clearest production split
is `src/cli/markdown-pdf/template-assets.ts`, which owns both remote-asset
policy and local-asset rewriting.

## Scope

In scope:

- current `.ts` files under `src/` and `test/` with more than 300 physical lines
- mixed-responsibility production modules with concrete extraction seams
- large tests containing distinct behavioral contracts under one suite
- stable facade, import, error, diagnostic, artifact, and CLI boundaries
- a recommended sequence for a later implementation plan
- final-plan requirements for cumulative validation and documentation closeout

Out of scope:

- implementing any module or test split
- changing command behavior, prompts, output, diagnostics, or artifact schemas
- changing dependencies or runtime support
- reopening or rewriting completed historical research, plans, or job records
- requiring every file above the threshold to become smaller than 300 lines

## Method

The review used:

- a strict `wc -l` inventory of every `.ts` file under `src/` and `test/`
- symbol, responsibility, import, caller, and test-suite inspection of the
  highest-value candidates
- comparison with the completed May TypeScript size-refactor research and plan
- comparison with the August Markdown PDF Phase 13 keep-or-split dispositions
- an independent read-only `ts_structure_planner` review

Reproduction command:

```bash
find src test -type f -name '*.ts' -print0 \
  | xargs -0 wc -l \
  | awk '$1 > 300 && $2 != "total"' \
  | sort -nr
```

The counts include test helpers and fixtures. Generated dependencies and
documentation are outside the scan.

The Markdown PDF concentration uses a conservative path/name rule: a source
file counts when its path contains `/markdown-pdf/` or
`/interactive/markdown/`; a test file counts when its path contains
`md-to-pdf` or `markdown-pdf`. The rule is intentionally mechanical and may
exclude shared helpers with broader names.

## Current Inventory Summary

| Root    | Files over 300 lines | Markdown PDF related | Other feature areas |
| ------- | -------------------: | -------------------: | ------------------: |
| `src/`  |                   59 |                   33 |                  26 |
| `test/` |                   75 |                   48 |                  27 |
| Total   |                  134 |                   81 |                  53 |

The completed May closeout recorded 21 source files and 20 test files above the
same threshold. The larger current inventory is primarily a signal of later
feature growth. It does not invalidate the earlier refactor or prove that 134
new splits are needed.

## Decision Criteria

A file is a strong split candidate when several of these are true:

- it owns multiple independently named lifecycle stages or policy domains
- tests already describe separate behavioral contracts inside the same file
- a small stable facade can preserve current imports and callers
- extraction reduces the number of reasons the file changes
- focused tests can verify the movement without changing assertions

A file should remain intact when:

- ordering is part of one safety or transactional boundary
- private helpers form one parse, normalization, projection, or write pipeline
- splitting would primarily introduce cross-module state or indirection
- a recent responsibility review explicitly retained the current boundary and
  no material drift now contradicts that decision

## Key Findings

### 1. Test modularization is the largest immediate opportunity

The largest current tests contain distinct behavioral clusters under one
top-level suite. They can be split without changing production imports or CLI
behavior.

| Lines | Test file                                                              | Recommended behavioral files                                                                                       |
| ----: | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 3,027 | `test/cli-actions-md-to-pdf-profile-codex-action.test.ts`              | request/progress; outputs and dry-run; signals and bases; reports and failures; path and alias safety              |
| 2,310 | `test/cli-actions-md-to-pdf-project-codex/action-write.test.ts`        | review and dry-run; privacy and redaction; successful writes; asset safety; no-usable and partial-write prevention |
| 1,652 | `test/cli-interactive-markdown-pdf/codex-authoring.test.ts`            | entry and setup; font-hint editing; regeneration; Project handoff; output and recovery lifecycle                   |
| 1,592 | `test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts` | document/title structure; font ownership; cover layout; ToC and CSS branches                                       |
| 1,440 | `test/adapters-codex-markdown-pdf-profile.test.ts`                     | prompt/schema; runner behavior; patch application; fallback and failure classification                             |
| 1,429 | `test/adapters-codex-markdown-pdf-template.test.ts`                    | prompt/schema; decision parsing; repair and timeout; CSS safety; failure classification                            |
|   995 | `test/cli-actions-md-to-pdf-commands.test.ts`                          | direct render; Profile; Template; Project command surfaces                                                         |

Use focused sibling `*.test.ts` files and feature-local fixtures, matching the
repository's existing test layout. Do not introduce a new compatibility-loader
or `*.cases.ts` convention unless a current automation dependency requires the
old test path. Current non-documentation code and scripts do not reference
these exact large test filenames.

Test movement should preserve every assertion and test name where practical.
Shared setup should move only when it represents a stable feature fixture, not
into a new general-purpose test helper dumping ground.

### 2. Template asset handling is the clearest production split

`src/cli/markdown-pdf/template-assets.ts` is 540 lines and has two public
operations:

- reject disallowed remote assets by scanning custom CSS, HTML, inline styles,
  `srcset`, and recursively imported CSS
- rewrite local Template HTML, CSS, and `srcset` references into render-safe
  file URLs

Recommended boundary:

```text
src/cli/markdown-pdf/
├── template-assets.ts                 # stable public facade
└── template-assets/
    ├── reference.ts                   # shared URL/path/srcset classification
    ├── remote-policy.ts               # remote detection and rejection
    └── local-rewrite.ts               # local resolution and rewriting
```

The existing exported function names should remain available from
`template-assets.ts`. Corresponding asset tests should remain action-level
contract coverage while focused pure cases may be added only where extraction
creates a useful internal seam.

### 3. Three additional production modules have useful seams

| Lines | Source file                              | Recommended boundary                                                                                                                                                      |
| ----: | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   441 | `src/cli/commands/rename.ts`             | Extract Codex option registration, scoped timeout resolution, and migration notices first; keep command registration and action wiring in the facade.                     |
|   506 | `src/cli/doctor/workflow.ts`             | Separate the shared projection model/kernel from Markdown, video, data, extension, and font domain projectors; preserve `projectDoctorWorkflows` and diagnostic ordering. |
|   530 | `src/cli/interactive/markdown/to-pdf.ts` | Extract source preparation, prepared-render handling, and output/final review; retain the top-level cancellation/backtracking state machine in the current module.        |

Do not start by splitting every rename subcommand into a separate module. The
first extraction should remove the independently testable Codex option and
timeout policy while avoiding a new directory of one-function command files.

The Interactive Markdown split is higher risk than the other two because
cancellation, backtracking, regeneration, and durable-versus-temporary
lifecycle choices are observable behavior. It should follow safer test and
production extractions rather than lead the plan.

### 4. Recent cohesive boundaries should remain deferred

The
[August Phase 13 review](../plans/jobs/2026-08-14-markdown-pdf-phase-13-contract-normalization.md)
already evaluated several Markdown PDF hotspots by responsibility rather than
line count. Current inspection does not show enough drift to reverse these
dispositions:

- `src/cli/markdown-pdf/profile/normalize.ts`
- `src/cli/markdown-pdf/profile/signals.ts`
- `src/cli/markdown-pdf/template-codex/synthesize-css.ts`
- `src/cli/markdown-pdf/template-codex/output-plan.ts`
- `src/cli/markdown-pdf/project-codex/validate-project.ts`
- `src/cli/markdown-pdf/project-codex/output-plan.ts`
- `src/cli/markdown-pdf/project-codex/prepared.ts`
- `src/cli/markdown-pdf/project-codex/handoff-projection.ts`

They are long, but each currently owns one ordered normalization, synthesis,
planning, preparation, validation, or projection boundary. Similar Template
and Project filenames also do not establish a safe shared abstraction.

Other intentional deferrals remain:

- `src/cli/prompts/path-inline.ts` and `text-inline.ts`: raw-terminal state
  machines
- `src/cli/data-stack/plan/parse.ts`: one strict artifact parser
- `src/cli/markdown-pdf/code-highlight.ts`: one parse-transform-serialize
  pipeline
- `src/cli/file-io.ts`: ordered atomic-write and rollback behavior
- `src/cli/markdown-pdf/template/init-service.ts`: transactional initialization
- `src/utils/exif.ts`: cohesive format-specific timestamp parsing behind one API

These files may be reassessed when concrete feature work changes their
responsibility, but they should not enter the initial modularization scope.

## Recommended Direction

Implementation should remain behavior-preserving and proceed through bounded
phases rather than one repository-wide movement:

1. split the Profile Codex action test by behavioral ownership
2. split Template asset policy and rewriting behind the existing facade
3. split the Project Codex action-write test
4. extract rename Codex option and timeout ownership
5. split Doctor workflow domain projections
6. continue with the remaining accepted Markdown PDF tests and adapter suites,
   one behavioral boundary per phase
7. reassess the Interactive Markdown `to-pdf` boundary after the safer work;
   split it only if mixed responsibility remains clear
8. complete cumulative validation and documentation closeout

Only one feature boundary should move in a phase. Test-only movement should not
carry assertion or production behavior changes. Any defect found during a
refactor should be reported and fixed in a separate change unless it blocks
safe movement.

Each production phase should preserve current public names and imports through
small facades, avoid broad barrels or cross-feature abstractions, identify its
observable contracts and focused tests, and receive exact-boundary review
before the next production slice begins.

The final phase should include:

- all focused suites associated with moved source and test boundaries
- the complete Bun test suite
- TypeScript checking, lint, formatting, build, and `git diff --check`
- a fresh strict over-300-line inventory with explicit remaining deferrals
- public-import and accidental-deep-import review
- test-layout review for duplicated fixtures or scattered ownership
- updates to the plan checklist and all phase job records from actual evidence
- a final current-state documentation pass so guides, research, plans, and job
  records do not retain stale paths or responsibility claims
- final review of the complete refactor range before lifecycle closeout

Validation evidence should be recorded as a concise receipt. It should not
claim that every remaining file over 300 lines is a defect.

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
- `docs/plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md`

## References

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-8.md`
- `docs/plans/jobs/2026-08-14-markdown-pdf-phase-13-contract-normalization.md`
- `DOCUMENTATION_POLICY.md`
