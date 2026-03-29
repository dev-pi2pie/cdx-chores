---
title: "Codex auto flag routing alignment"
created-date: 2026-02-27
modified-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Align non-interactive rename flags with the interactive smart-router model by introducing `--codex` as the CLI `auto` entrypoint, while preserving explicit analyzer flags for image-only and doc-only behavior.

## Scope

- Add a new umbrella flag: `--codex`
- Define `--codex` to mean auto-routing by eligible file type
- Keep `--codex-images` and `--codex-docs` as explicit analyzer controls
- Define precedence when `--codex` is combined with explicit analyzer flags
- Update help text, README, and rename guides to explain the new contract
- Add tests for auto-routing behavior and flag precedence

## Out Of Scope

- New analyzer types beyond the current image/doc analyzer split
- External config files for analyzer routing
- Renaming/removing existing `--codex-images` / `--codex-docs` flags in this phase
- Changing current analyzer capability boundaries for unsupported file types

## Decision Baseline

This draft assumes the following implementation direction:

- `--codex` means `auto`
- `auto` detects eligible file types after normal rename filtering
- mixed docs+images scope can invoke both analyzers in one run
- unsupported files remain deterministic fallback only
- explicit analyzer flags override umbrella auto behavior

## Phase Checklist

### Phase 1: CLI Contract Definition

- [x] Add `--codex` to `rename file`, `rename batch`, and `batch-rename`
- [x] Define help text for `--codex` as auto-routing by file type
- [x] Keep `--codex-images` and `--codex-docs` available as explicit overrides
- [x] Confirm precedence rule:
  - `--codex` alone => auto
  - `--codex --codex-images` => images only
  - `--codex --codex-docs` => docs only
  - `--codex-images --codex-docs` => both explicit
  - if explicit flags are present, they win over `--codex`

### Phase 2: Action Wiring and Routing Behavior

- [x] Normalize parsed CLI flags into one internal routing decision before rename planning
- [x] Reuse existing extension-capability routing helpers where possible
- [x] For batch rename, split in-scope files by eligible analyzer type after profile/ext/regex filtering
- [x] For single-file rename, resolve auto behavior from the selected file extension
- [x] Preserve deterministic fallback for unsupported or weak-analysis cases
- [x] Preserve existing mixed-run merge behavior when both analyzers are active

### Phase 3: UX and Help Surface

- [x] Update `--help` output to describe `--codex` as the default smart-routing flag
- [x] Keep wording clear that `--codex` does not send unsupported files to analyzers
- [x] Clarify that `--codex-images` / `--codex-docs` narrow analyzer scope rather than file-selection scope
- [x] Review interactive/CLI wording consistency so `auto` and `--codex` read as the same concept

### Phase 4: Tests

- [x] Add CLI/help coverage for the new `--codex` flag
- [x] Add rename action tests for `--codex` auto behavior on image-only input
- [x] Add rename action tests for `--codex` auto behavior on docs-only input
- [x] Add rename action tests for `--codex` auto behavior on mixed docs+images input
- [x] Add precedence tests for combined flags (`--codex` with explicit analyzer flags)
- [x] Add regression coverage to ensure unsupported file types still fall back deterministically

### Phase 5: Documentation

- [x] Update `README.md` examples to prefer `--codex` for the common smart-routing path
- [x] Update `docs/guides/rename-common-usage.md` with `--codex` examples and flag guidance
- [x] Update `docs/guides/rename-scope-and-codex-capability-guide.md` with the new CLI contract and precedence rules
- [x] Record that `--codex` is the CLI equivalent of interactive `auto`

### Phase 6: Verification

- [x] Run `bunx tsc --noEmit`
- [x] Run focused tests for CLI UX and rename actions
- [x] Run `bun test`
- [x] Run a focused smoke check for mixed-scope auto-routing in `examples/playground/`

## Completion Criteria

- `--codex` works as the common CLI smart-routing flag
- explicit analyzer flags still work and clearly override `--codex` when combined
- mixed docs+images runs can auto-route to both analyzers in one rename plan
- docs and help text explain the difference between file selection and analyzer routing
- tests cover auto behavior, precedence, and fallback safety

## Related Plans

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/archive/plan-2026-02-27-rename-pattern-router-and-docs-ux-v1-implementation.md`
