---
title: "CLI actions modularization plan"
created-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Refactor `src/cli/actions.ts` into smaller modules with clearer ownership, while preserving current CLI behavior and interactive-mode behavior.

## Why This Plan

`src/cli/actions.ts` now contains multiple unrelated responsibilities in one file (doctor, data conversion, markdown conversion, rename flows, video wrappers, shared validation/output helpers). At ~350+ lines, it is still manageable, but further feature work will make it harder to:

- review changes safely
- reuse shared helpers without accidental coupling
- test/verify domain actions independently
- add new command families without increasing merge friction

This plan focuses on structure and separation only, not feature expansion.

It also includes a small follow-up design step to clarify source-tree taxonomy boundaries (especially `src/markdown/**` vs `src/utils/**`) so the action refactor does not reinforce a confusing module layout.

## In Scope

- Split `src/cli/actions.ts` into domain-oriented action modules
- Introduce a small shared helper module for common action utilities
- Preserve exported action names and option interfaces used by:
  - `src/command.ts`
  - `src/cli/interactive.ts`
- Keep output text and exit behavior functionally unchanged (except intentional cleanup if needed)
- Add an `index` barrel for stable imports
- Define and document module taxonomy guidance for `src/utils/**`, `src/markdown/**`, and future parser/core modules
- Add focused regression tests under `test/` for refactor-sensitive CLI behavior and run them with `bun test`

## Out of Scope

- New CLI commands or command options
- Behavior changes to conversions/rename/video execution
- Full test-suite introduction or test framework changes
- Broader CLI architecture rewrite (for example moving all logic under `src/features/**`)
- Moving `src/markdown/**` during this refactor (taxonomy decision only; move can be a separate follow-up if approved)

## Current `actions.ts` Responsibilities (Observed)

- shared output/validation helpers (`printLine`, path display formatting, input assertions, file existence checks)
- `doctor`
- data conversions (`json-to-csv`, `csv-to-json`)
- markdown conversion (`md to-docx`)
- rename batch workflow
- video wrappers (`convert`, `resize`, `gif`)
- deferred placeholder action

## Proposed Target Structure

- `src/cli/actions/index.ts`
  - re-export public action functions and option interfaces used by CLI wiring
- `src/cli/actions/shared.ts`
  - `printLine`
  - `assertNonEmpty`
  - `ensureFileExists`
  - path display helper(s)
- `src/cli/actions/doctor.ts`
  - `DoctorOptions`
  - `actionDoctor`
- `src/cli/actions/data.ts`
  - `JsonToCsvOptions`
  - `CsvToJsonOptions`
  - `actionJsonToCsv`
  - `actionCsvToJson`
  - JSON row normalization helper (module-local)
- `src/cli/actions/markdown.ts`
  - `MdToDocxOptions`
  - `actionMdToDocx`
- `src/cli/actions/rename.ts`
  - `RenameBatchOptions`
  - `actionRenameBatch`
  - rename preview formatting helper (module-local)
- `src/cli/actions/video.ts`
  - `VideoConvertOptions`
  - `VideoResizeOptions`
  - `VideoGifOptions`
  - `actionVideoConvert`
  - `actionVideoResize`
  - `actionVideoGif`
  - ffmpeg runner helper (module-local)
- `src/cli/actions/deferred.ts`
  - `actionDeferred`

## Module Taxonomy Follow-up (Included in This Plan)

### Objective

Avoid treating `src/utils/**` as a catch-all while `src/cli/actions.ts` is being modularized.

### Initial Position

- Keep `src/markdown/**` in place for now
- Treat `src/markdown/**` as a standalone subsystem (parser/domain module), not a utility bucket
- Revisit naming later if needed (for example `src/parsers/markdown/**` or `src/core/markdown/**`)

### Deliverable for this plan

- Record the taxonomy decision (and rationale) in the implementation job record
- Ensure new action-module paths do not assume `src/utils/**` is the default destination for every reusable module

## Design Constraints

- Preserve import ergonomics for call sites:
  - prefer `import { ... } from "./cli/actions"` via barrel exports
- Avoid circular imports between action modules
- Keep helper functions in `shared.ts` narrowly scoped and action-focused
- Do not move filesystem/process/dependency primitives out of existing modules in this refactor

## Implementation Sequence

1. Create `src/cli/actions/` directory and `index.ts` barrel

- Re-export existing action names and option interfaces
- Keep external call sites unchanged first

2. Extract shared helpers

- Move `printLine`, `assertNonEmpty`, `ensureFileExists`, and path display helper into `shared.ts`
- Update imports in `actions.ts` (temporary hybrid state is acceptable)

3. Extract low-risk domains first

- `doctor.ts`
- `deferred.ts`

These have minimal cross-domain dependencies and are good for proving the module boundaries.

4. Extract data and markdown actions

- Move JSON/CSV logic into `data.ts`
- Move `md to-docx` into `markdown.ts`

5. Extract rename and video actions

- Move rename-specific formatting and action into `rename.ts`
- Move ffmpeg helpers and video actions into `video.ts`

6. Replace legacy monolith

- Convert `src/cli/actions.ts` into a compatibility re-export (`export * from "./actions/index"`) or remove it and update imports directly
- Prefer keeping `src/cli/actions.ts` as a thin compatibility layer for one iteration to reduce churn

7. Verification pass

- Manual smoke checks for representative commands
- Confirm interactive mode imports still work
- Confirm help/version/path-display behavior remains unchanged
- Run `bun test` and confirm new focused tests pass (or note unrelated failures)

8. Record taxonomy decision

- Capture the `src/markdown/**` placement decision in the job record
- Note future rename options without moving the module in this refactor

## Deliverables

- Modularized action implementation under `src/cli/actions/`
- Stable action exports for `src/command.ts` and `src/cli/interactive.ts`
- No intentional behavior regressions in current command set
- Focused tests in `test/` covering key CLI behavior at risk during refactor (or adjacent UX behavior used as baseline)
- Job record documenting the refactor implementation and verification

## Verification Plan

### Build/typing

- `bunx tsc --noEmit` (noting any pre-existing unrelated failures)

### Tests

- `bun test`
- Add/update tests in `test/` for:
  - CLI version alias compatibility (`-v` and `-V`)
  - relative vs absolute path output formatting behavior

### Manual smoke checks

- `bun src/bin.ts doctor`
- `bun src/bin.ts doctor --json`
- `bun src/bin.ts data json-to-csv ...`
- `bun src/bin.ts data csv-to-json ...`
- `bun src/bin.ts rename batch ... --dry-run`
- `bun src/bin.ts video gif ...` (or another ffmpeg-backed command)
- no-arg interactive mode path through one or two actions

## Risks and Mitigations

- Risk: accidental behavior drift during extraction
  - Mitigation: preserve exact output strings where possible and migrate in small domain slices
- Risk: helper module becomes a new dumping ground
  - Mitigation: keep `shared.ts` limited to cross-domain action helpers only
- Risk: import churn creates merge conflicts
  - Mitigation: keep a compatibility barrel (`src/cli/actions.ts` or `src/cli/actions/index.ts`) during transition
- Risk: taxonomy debates slow down refactor execution
  - Mitigation: make a narrow decision now (`src/markdown/**` stays put), and defer directory renames to a separate focused plan/job

## Follow-up Jobs

- Job: extract CLI actions into domain modules (no behavior change)
- Job: add focused tests around extracted action modules (data and rename first)
- Job: module taxonomy cleanup proposal (`markdown`, `utils`, parser/core naming) if a directory move is later desired

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
