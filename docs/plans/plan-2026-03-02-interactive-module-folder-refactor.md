---
title: "Interactive module folder refactor"
created-date: 2026-03-02
modified-date: 2026-03-02
status: draft
agent: codex
---

## Goal

Refactor `src/cli/interactive.ts` into a folder-based `src/cli/interactive/` module so interactive command routing and domain-specific flows are easier to read, test, and extend without changing current interactive behavior.

## Why This Plan

`src/cli/interactive.ts` is currently 742 lines and mixes several different responsibilities:

- top-level menu selection
- menu-owned types and selection models
- rename-specific interactive flows
- markdown/data interactive flows
- video interactive flows
- inline action dispatch

That concentration has the same scaling problem the old rename action file had: the file still works, but adding new interactive flows will keep increasing branching, repeated prompt setup, and domain coupling in one place.

## Current Boundary Snapshot

The file currently contains at least these distinct behavior areas:

- root menu and submenu choice models
- rename pattern/template interactive configuration
- data command interactive orchestration
- markdown command interactive orchestration
- rename file/batch/apply interactive orchestration
- video convert/resize/gif interactive orchestration
- final `runInteractiveMode()` dispatch

## Target Structure

Recommended target structure:

```text
src/cli/interactive/
  index.ts              # thin public entrypoint exposing runInteractiveMode()
  menu.ts               # menu-owned types, constants, and selection flow
  rename.ts             # rename:file, rename:batch, rename:apply, rename prompt helpers
  data.ts               # data:json-to-csv and data:csv-to-json flows
  markdown.ts           # md:to-docx and md:frontmatter-to-json flows
  video.ts              # video:convert, video:resize, video:gif flows
  shared.ts             # optional; only introduce if a small cross-domain helper remains
```

Notes:

- `menu.ts` should own the current menu-facing type aliases unless a clearly cross-module type emerges during extraction.
- `promptRenamePatternConfig()` is a rename-owned helper and should move into `rename.ts` with the rename flows.
- `validateIntegerInput()` should stay with rename unless another domain actually needs it after the split.
- `index.ts` should create `pathPromptContext` once and pass it into domain handlers explicitly; avoid hidden module-level runtime state.
- `doctor` can remain inline in `index.ts` unless that flow grows beyond its current trivial prompt-and-dispatch shape.
- No compatibility shim is planned. `src/command.ts` already imports `./cli/interactive`, so a folder `index.ts` preserves the same import surface.
- The exact filenames can change if a simpler split emerges, but the end state should use a folder boundary rather than a new set of `interactive-*.ts` siblings.

## In Scope

- split `src/cli/interactive.ts` into a folder-based module
- move interactive menu selection into its own module
- move rename interactive orchestration into its own module
- move markdown/data/video interactive orchestration into focused modules
- introduce shared helpers only where repetition is real across multiple domain modules
- preserve all current interactive command semantics and prompt wording unless a change is explicitly required for clarity

## Out of Scope

- redesigning the interactive UX flow itself
- adding new commands to interactive mode
- changing rename semantics or action-layer behavior
- replacing `@inquirer/prompts`
- broad prompt-system redesign outside `src/cli/interactive.ts`
- creating a generic helper bucket just because the old file was large

## Phases

## Phase 1: Extract the menu contract and define the entrypoint boundary

### Task Items

- [ ] move menu choice types/constants into `src/cli/interactive/menu.ts`
- [ ] move submenu selection flow into `src/cli/interactive/menu.ts`
- [ ] make the `index.ts` contract explicit: create `pathPromptContext` once and pass it to domain handlers
- [ ] only add `src/cli/interactive/shared.ts` if at least one helper is truly used across multiple domain modules
- [ ] keep the entrypoint thin and avoid speculative abstractions

### Phase Deliverable

- [ ] menu selection is isolated and the handler contract is explicit before domain extraction begins

## Phase 2: Extract the rename flow intact

### Task Items

- [ ] move rename batch/file/apply interactive orchestration into `src/cli/interactive/rename.ts`
- [ ] move `promptRenamePatternConfig()` into `src/cli/interactive/rename.ts`
- [ ] keep `validateIntegerInput()` with rename unless another module proves a real need
- [ ] preserve current Codex routing questions and rename apply follow-up flow exactly
- [ ] keep action dispatch in the existing action layer; do not move business logic into prompt helpers

### Phase Deliverable

- [ ] rename interactive flow is isolated behind a focused module boundary without splitting its prompt logic across multiple files

## Phase 3: Extract remaining flows and finalize the folder module

### Task Items

- [ ] move data interactive flows into `src/cli/interactive/data.ts`
- [ ] move markdown interactive flows into `src/cli/interactive/markdown.ts`
- [ ] move video interactive flows into `src/cli/interactive/video.ts`
- [ ] add `src/cli/interactive/index.ts` as the thin entrypoint for `runInteractiveMode()`
- [ ] keep `doctor` inline in `index.ts` unless extraction becomes justified during implementation
- [ ] remove `src/cli/interactive.ts` once imports resolve through the folder entrypoint
- [ ] ensure imports elsewhere in the codebase resolve cleanly to the new entrypoint
- [ ] rerun verification after the split settles

### Phase Deliverable

- [ ] interactive mode is folder-based, readable by domain, and exposed through a thin entry module

## Verification Plan

### Functional checks

- [ ] `bun test test/cli-actions-data.test.ts`
- [ ] `bun test test/cli-actions-doctor-markdown-video-deferred.test.ts`
- [ ] `bun test test/cli-actions-rename-batch-core.test.ts`
- [ ] `bun test test/cli-actions-rename-file.test.ts`
- [ ] `bun test test/cli-actions-rename-apply-replay.test.ts`
- [ ] `bun test test/cli-rename-interactive-router.test.ts`
- [ ] `bun test test/cli-path.test.ts`

Notes:

- [ ] do not treat `test/cli-ux.test.ts` as interactive refactor coverage unless that file starts exercising interactive mode later

### Structural checks

- [ ] `src/cli/interactive.ts` no longer remains as the 742-line mixed interactive implementation
- [ ] interactive modules are organized by domain or shared responsibility
- [ ] no new oversized mixed-responsibility interactive helper file replaces the current hotspot
- [ ] `pathPromptContext` creation remains explicit and is not reintroduced as hidden shared state

### Quality checks

- [ ] `bunx tsc --noEmit`
- [ ] `bunx oxlint --tsconfig tsconfig.json src test scripts`
- [ ] `bun run build`
- [ ] `bun test`

## Risks and Mitigations

- Risk: prompt wording or default choices change accidentally during extraction.
  - Mitigation: keep logic moves mechanical first and verify through CLI/action-level tests after each phase.
- Risk: `pathPromptContext` fields drift or get passed incompletely during module extraction.
  - Mitigation: construct the context once in `index.ts`, type the handler contract clearly, and keep the passed object shape unchanged during the mechanical move.
- Risk: shared prompt helpers become another overgrown utility bucket.
  - Mitigation: only create `shared.ts` if at least one helper is clearly used across multiple domain modules.
- Risk: rename interactive logic gets split across too many small files and becomes harder to follow.
  - Mitigation: keep rename-specific prompt flow together in `rename.ts`, including `promptRenamePatternConfig()`, unless a helper has obvious standalone ownership.
- Risk: folder entrypoint resolution breaks runtime or bundle output.
  - Mitigation: rely on the existing `./cli/interactive` import surface, remove the old file only after the folder entrypoint works, and include `bun run build` in verification.

## Deliverables

- a folder-based `src/cli/interactive/` module
- thinner interactive entrypoint wiring
- domain-focused interactive flow modules
- verification notes showing the split preserved current behavior
