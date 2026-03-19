---
title: "TypeScript structural refactor sequencing"
created-date: 2026-03-19
status: draft
agent: codex
---

## Goal

Reduce the remaining large mixed-responsibility TypeScript hotspots in the CLI and data workflow layers without changing user-visible behavior, while keeping each refactor phase small enough to verify safely.

## Why This Plan

The repository has already completed two important structural passes:

- CLI action modularization under `src/cli/actions/`
- interactive entrypoint modularization under `src/cli/interactive/`

Those changes improved the overall tree, but the latest scan still shows several concentrated workflow files where prompting, orchestration, rendering, recovery, and backend coordination remain coupled.

The main remaining source hotspots are:

- `src/command.ts`
- `src/cli/interactive/data-query.ts`
- `src/cli/duckdb/query.ts`
- `src/adapters/codex/document-rename-titles.ts`
- `src/cli/fs-utils.ts`

There is also recurring data-workflow duplication across:

- `src/cli/actions/data-extract.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/interactive/data.ts`

The test suite also still has a few large files, but those largely mirror current source concentration rather than representing an independent first-priority problem.

## Objectives

- split the remaining large TypeScript workflow files into folder-based or domain-based modules
- reduce duplicated data-workflow orchestration across CLI action and interactive layers
- improve ownership and naming for ambiguous utility buckets such as `src/cli/fs-utils.ts`
- keep public import surfaces stable where possible through thin entrypoints or temporary compatibility shims
- preserve runtime behavior, output wording, and command semantics during each phase

## In Scope

- structural refactors for the remaining TypeScript hotspots
- creation of focused internal modules and folder entrypoints
- thin compatibility re-exports where they reduce migration risk
- test updates required to preserve or realign coverage after file moves
- use of `ts_structure_refactorer` for bounded implementation phases with explicit file ownership

## Out of Scope

- feature expansion
- CLI UX redesign
- changes to command semantics or option contracts
- broad renaming of repository-wide domain terminology without a direct structural benefit
- speculative architecture rewrites such as moving everything under a new top-level `features/` tree

## Target Areas

### 1. CLI registration and option parsing

Current hotspot:

- `src/command.ts`

Recommended target shape:

```text
src/cli/commands/
  index.ts
  data.ts
  rename.ts
  markdown.ts
  video.ts
src/cli/options/
  common.ts
  parsers.ts
```

Target outcome:

- `runCli()` becomes a thin bootstrap and dispatch entrypoint
- command-family registration moves into domain modules
- reusable option parser helpers stop living beside the full command tree

### 2. Shared data workflow extraction

Current concentration and duplication:

- `src/cli/actions/data-extract.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/interactive/data.ts`

Recommended target shape:

```text
src/cli/data-workflows/
  duckdb-remediation.ts
  header-mapping-flow.ts
  interactive-session.ts
  output.ts
  source-shape-flow.ts
```

Target outcome:

- shared recovery and artifact-review flows stop being reimplemented in slightly different forms
- direct CLI and interactive layers compose common data workflow helpers instead of owning their own copies

### 3. Interactive data-query modularization

Current hotspot:

- `src/cli/interactive/data-query.ts`

Recommended target shape:

```text
src/cli/interactive/data-query/
  index.ts
  duckdb-remediation.ts
  execution.ts
  header-review.ts
  source-selection.ts
  source-shape.ts
  types.ts
  sql/
    codex.ts
    formal-guide.ts
    manual.ts
```

Target outcome:

- `runInteractiveDataQuery()` remains the public entrypoint
- source selection, shape review, header review, SQL authoring modes, and execution are isolated by concern
- future interactive query changes no longer require editing a single 1.4k-line controller

### 4. DuckDB query service split

Current hotspot:

- `src/cli/duckdb/query.ts`

Recommended target shape:

```text
src/cli/duckdb/query/
  index.ts
  execute.ts
  excel-range.ts
  formats.ts
  introspection.ts
  prepare-source.ts
  source-resolution.ts
  types.ts
```

Target outcome:

- source preparation, introspection, execution, and format detection become separate implementation lanes
- the existing folderized patterns in `src/cli/duckdb/header-mapping/` and `src/cli/duckdb/source-shape/` become the model for query internals

### 5. Codex document rename adapter split

Current hotspot:

- `src/adapters/codex/document-rename-titles.ts`

Recommended target shape:

```text
src/adapters/codex/document-rename/
  index.ts
  batch.ts
  prompt.ts
  types.ts
  extractors/
    docx.ts
    html.ts
    markdown.ts
    pdf.ts
    structured.ts
    text.ts
    xml.ts
```

Target outcome:

- file-type-specific evidence extraction stops living in one monolithic adapter
- prompt construction and batch orchestration gain explicit ownership boundaries

### 6. Rename/path/file utility boundary cleanup

Current hotspot:

- `src/cli/fs-utils.ts`

Recommended target shape:

```text
src/cli/
  file-io.ts
  path-utils.ts
src/cli/rename/
  apply.ts
  planner.ts
```

Target outcome:

- generic path and file helpers are separated from rename-domain planning logic
- the current “utility bucket” naming ambiguity is removed
- a temporary shim can keep `src/cli/fs-utils.ts` stable during migration if needed

## Test Strategy

The test suite should follow the source refactors rather than lead them.

Current large test files that likely move later with source changes:

- `test/cli-interactive-routing.test.ts`
- `test/cli-interactive-rename.test.ts`
- `test/helpers/interactive-harness.ts`
- `test/cli-actions-data-query.test.ts`
- `test/cli-actions-data-extract.test.ts`

Guideline:

- do not start with a test-only modularization pass here
- update or split tests when a source refactor makes the current file boundaries harder to maintain
- keep at least one user-facing integration test per behavior family while moving lower-level ownership to narrower files

## Recommended Order

1. Split `src/command.ts`.
2. Extract shared data workflow helpers.
3. Split `src/cli/interactive/data-query.ts`.
4. Split `src/cli/duckdb/query.ts`.
5. Split `src/adapters/codex/document-rename-titles.ts`.
6. Clean up `src/cli/fs-utils.ts`.

## Why This Order

- `src/command.ts` is large but relatively low-risk and improves navigation immediately.
- shared data-workflow extraction reduces duplication before the deeper interactive-query split.
- `src/cli/interactive/data-query.ts` and `src/cli/duckdb/query.ts` should be treated as adjacent work because their responsibilities overlap heavily.
- the Codex document adapter is large, but it is more isolated than the CLI data-workflow bottlenecks.
- `src/cli/fs-utils.ts` should follow the larger boundary shifts so its final ownership lines are clearer.

## Execution Approach

### General rule

- each phase should end with one thin public entrypoint and a clear internal folder boundary
- avoid whole-repo rewrites that move multiple unrelated hotspots at once
- prefer compatibility shims when they reduce import churn during a phase

### Using `ts_structure_refactorer`

`ts_structure_refactorer` is appropriate for implementation phases that have:

- a single clear hotspot
- a bounded write set
- an agreed target folder shape
- a low tolerance for behavior drift

Recommended usage pattern:

1. freeze the target structure in the plan or job record
2. assign one hotspot at a time to `ts_structure_refactorer`
3. keep ownership explicit, for example:
   - `src/command.ts` plus new `src/cli/commands/**` and `src/cli/options/**`
   - `src/cli/interactive/data-query.ts` plus new `src/cli/interactive/data-query/**`
4. verify the moved code locally before starting the next hotspot

Do not use `ts_structure_refactorer` to refactor all hotspots in one pass.

## Phases

## Phase 1: CLI registration split

### Task Items

- [ ] move command-family registration out of `src/command.ts`
- [ ] extract shared option parser helpers into `src/cli/options/parsers.ts`
- [ ] extract shared option wiring helpers into `src/cli/options/common.ts`
- [ ] keep `runCli()` as the stable public entrypoint
- [ ] preserve all current command names, flags, and semantics

### Deliverable

- [ ] `src/command.ts` is reduced to bootstrap/runtime setup and command registration composition

## Phase 2: Shared data workflow extraction

### Task Items

- [ ] extract DuckDB remediation helpers reused by extract/query flows
- [ ] extract shared header-mapping review or artifact-resolution helpers where duplication is real
- [ ] extract shared source-shape review or artifact-resolution helpers where duplication is real
- [ ] isolate reusable output/write-decision helpers
- [ ] keep action and interactive entry modules behaviorally unchanged

### Deliverable

- [ ] shared data workflow helpers exist under `src/cli/data-workflows/` and direct callers become thinner composition layers

## Phase 3: Interactive data-query split

### Task Items

- [ ] convert `src/cli/interactive/data-query.ts` into a folder-based module
- [ ] separate source selection, shape review, header review, execution, and authoring modes
- [ ] keep `runInteractiveDataQuery()` as the single public entrypoint
- [ ] avoid introducing hidden shared runtime state while moving helpers

### Deliverable

- [ ] interactive data-query flow is split by concern and no replacement mixed-responsibility controller appears

## Phase 4: DuckDB query service split

### Task Items

- [ ] convert `src/cli/duckdb/query.ts` into a folder-based module
- [ ] isolate format detection, source preparation, execution, introspection, and Excel range parsing
- [ ] preserve the current public exports through `index.ts`
- [ ] watch explicitly for circular imports with `header-mapping`, `source-shape`, and `xlsx-sources`

### Deliverable

- [ ] DuckDB query internals use clear domain files instead of one service bottleneck

## Phase 5: Codex document adapter split

### Task Items

- [ ] convert `src/adapters/codex/document-rename-titles.ts` into a folder-based module
- [ ] move file-type-specific extraction into extractor modules
- [ ] keep prompt assembly and batch orchestration as separate modules
- [ ] preserve the `suggestDocumentRenameTitlesWithCodex()` public surface

### Deliverable

- [ ] document rename extraction logic is organized by extractor type and orchestration concern

## Phase 6: Rename/path/file utility cleanup

### Task Items

- [ ] separate path-display and path-resolution helpers from generic file IO
- [ ] move rename planning and apply helpers into rename-owned modules
- [ ] keep or remove `src/cli/fs-utils.ts` based on whether a temporary compatibility shim is still useful

### Deliverable

- [ ] `src/cli/fs-utils.ts` no longer functions as a mixed utility bucket

## Verification Plan

### Per phase

- [ ] run targeted tests for the touched area
- [ ] run `bunx tsc --noEmit`
- [ ] run `bunx oxlint --tsconfig tsconfig.json src test scripts`

### Milestone checks

- [ ] run `bun run build` after each completed hotspot split
- [ ] run focused interactive or command smoke checks for the affected workflow
- [ ] run broader `bun test` at the end of each milestone or after any especially invasive move

## Risks and Mitigations

- Risk: structural extraction changes CLI wording or prompt behavior by accident.
  - Mitigation: keep each phase mechanical first, preserve thin entrypoints, and verify output-sensitive tests after each move.
- Risk: new helper folders become a different kind of dumping ground.
  - Mitigation: create only concern-owned modules and reject generic “misc” abstractions.
- Risk: data-query and DuckDB query refactors create circular imports.
  - Mitigation: keep types explicit, re-export only from entrypoints, and isolate cross-module helpers carefully.
- Risk: the test suite drifts away from the new source boundaries and becomes harder to maintain.
  - Mitigation: split tests only when a source refactor creates a clear ownership boundary worth mirroring.
- Risk: `ts_structure_refactorer` is used too broadly and produces an over-large mechanical rewrite.
  - Mitigation: assign one hotspot at a time with a fixed write scope and verify before proceeding.

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`
