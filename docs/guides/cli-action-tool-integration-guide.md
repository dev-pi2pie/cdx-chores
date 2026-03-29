---
title: "CLI Action Tool Integration Guide"
created-date: 2026-02-25
modified-date: 2026-03-29
status: draft
agent: codex
---

## Goal

Provide a practical guide for adding or extending chores commands in `cdx-chores` using the current command/action structure, with clear boundaries for external tools and Codex SDK adapters.

## Current Integration Pattern (Recommended)

Use this flow for new features:

1. CLI command parsing in `src/command.ts`
2. User input collection in `src/cli/interactive.ts` (if interactive path is supported)
3. Shared action orchestration in `src/cli/actions/*.ts` or `src/cli/actions/<feature>/**`
4. Tool/system execution via existing helpers/adapters (for example `src/cli/deps.ts`, `src/cli/process.ts`, `src/cli/fs-utils.ts`)
5. Reusable pure helpers in `src/utils/**` only when they are truly generic

## File Placement Guidelines

### Command wiring

- Use `src/command.ts` for:
  - command tree definitions
  - flag parsing
  - aliases
  - dispatch into action functions

### Interactive prompts

- Use `src/cli/interactive.ts` for:
  - prompt UX only
  - collecting inputs and confirming options
  - dispatching to the same action functions used by CLI flag mode

Do not duplicate business logic in interactive mode.

### Actions (orchestration layer)

- Use `src/cli/actions/*.ts` for:
  - validating action-level inputs
  - coordinating file/process/dependency helpers
  - shaping user-facing output
  - sequencing multiple steps in a chore workflow
- When one feature area grows beyond a single file, prefer a folder boundary such as `src/cli/actions/rename/**`.

Avoid direct SDK/tool-client complexity inside action modules when an adapter boundary is appropriate.

### External tool wrappers

- Use `src/cli/deps.ts` for:
  - dependency inspection and install hints
- Use `src/cli/process.ts` for:
  - process execution helpers
- Add focused adapters when logic grows:
  - example future path: `src/adapters/codex/**`
  - example future path: `src/adapters/tools/**` (if wrappers outgrow `src/cli/*`)

## Codex SDK Integration Guidance (Current + Planned)

`@openai/codex-sdk` is now used in runtime code for rename-time semantic image title suggestions via `src/adapters/codex/image-rename-titles.ts`.

When adding or expanding Codex-backed features:

- Keep SDK calls out of `src/command.ts`
- Prefer keeping SDK calls out of `src/cli/actions/*.ts` unless the action remains very thin
- Add an adapter boundary for:
  - prompt construction
  - response parsing
  - retry/timeout handling
  - fallback behavior
  - capability/eligibility checks (when modality/file-type scope matters)

Recommended shape for image rename assistance:

- rename action module (`src/cli/actions/rename/codex.ts`) coordinates semantic title suggestions through Codex adapters
- Codex adapter returns normalized structured suggestions (not raw SDK responses)
- action applies deterministic slug/length/collision handling before file operations

## Rename-Specific Integration Guidance (Important)

Rename flows now combine multiple concerns that should remain explicitly separated:

- file selection scope (profiles, extensions, regex)
- rename formatting (prefix/pattern/timestamp/stem)
- safety behavior (dry-run/apply replay, traversal limits, hidden/system-file defaults)
- optional semantic analyzers (for example Codex-assisted title suggestions)

Recommended boundary for rename work:

- `src/cli/actions/rename/`
  - `index.ts` for the thin public action surface
  - `batch.ts` / `file.ts` / `apply.ts` for orchestration entrypoints
  - `filters.ts` / `reporting.ts` / `plan-output.ts` / `codex.ts` for shared rename-specific helper boundaries
- `src/adapters/codex/**`
  - Codex-specific analyzer implementations (prompting/parsing/retries/timeouts)
- future analyzer capability registry (rename-specific)
  - maps file types to analyzer eligibility and skip reasons
  - keeps "rename works" separate from "semantic analyzer can analyze"

Design rule for rename:

- deterministic rename planning must remain usable for all scoped files, even when analyzers are unsupported, skipped, or failing

Current scope note:

- Codex semantic rename in this project is currently limited to supported static image files
- audio/video semantic analysis is deferred for Codex-assisted rename based on current Codex model support docs
- docs-like semantic analysis is a future analyzer path and should not be implied by `--codex-images` today

See also:

- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/researches/archive/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`

## Designing a New Chore Command (Checklist)

- Define the CLI surface in `src/command.ts`
- Decide whether interactive mode support is needed in `src/cli/interactive.ts`
- Add/update action module in `src/cli/actions/`
- Reuse existing helpers (`fs-utils`, `deps`, `process`) before creating new ones
- Add tests:
  - success path
  - failure path(s)
  - path display behavior if output paths are printed
- Update docs:
  - job record for implementation
  - plan/research docs if the feature changes architecture or scope

## What Belongs in `src/utils/**` vs Not

Use `src/utils/**` for generic, reusable utilities with minimal CLI coupling.

Examples in this repo:

- CSV helpers
- path/filename helpers
- datetime formatting
- slug utilities

Do not move cohesive subsystems into `src/utils/**` just because they are reusable.

Example:

- `src/markdown/**` should remain a standalone subsystem (parser/types/TOML parsing internals), not `src/utils/markdown/**`, unless a broader source-tree taxonomy refactor is planned.

## Testing Notes

- Prefer isolated temporary fixtures under `examples/playground/` (for example, `examples/playground/.tmp-tests`)
- Keep black-box CLI tests and action-module unit tests both:
  - CLI tests validate wiring/flags/end-to-end behavior
  - action tests validate orchestration and failure handling faster

## Historical Plans

- `docs/plans/archive/plan-2026-02-25-cli-actions-modularization.md`
- `docs/plans/archive/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`

## Historical Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
- `docs/researches/archive/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
