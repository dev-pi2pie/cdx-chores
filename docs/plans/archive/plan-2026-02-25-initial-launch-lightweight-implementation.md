---
title: "Initial launch lightweight implementation plan"
created-date: 2026-02-25
modified-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement a lightweight, runnable first version of `cdx-chores` that proves the CLI structure, command dispatching, external-tool checks, and a small set of end-to-end commands without taking on advanced PDF processing or Excel-like workflows yet.

## Why This Plan

The repository is still in the launch/init phase, and the highest-value outcome is a visible, testable CLI baseline:

- command tree exists and runs
- `cdx-chores` with no args enters interactive mode by default
- `doctor` reports capabilities and missing dependencies clearly
- a few commands perform real work successfully

This plan intentionally avoids heavy backend decisions (advanced PDF pipelines, `.xlsx` workflows, `docx -> pdf`) until after the CLI foundation is stable.

## In Scope (Init Launch)

### CLI foundation and structure

- Implement root CLI bootstrap in `src/command.ts` using `commander`
- Default behavior: no args -> interactive mode
- Preserve nested command layout and add convenience aliases where useful
- Add shared action dispatch layer so flag mode and interactive mode call the same handlers

### Build and version embedding

- Keep `build` flow using embedded version generation (`node scripts/generate-embedded-version.mjs && tsdown`)
- Add a generated-version accessor in CLI output (for example, `--version` path) if needed during implementation

### `doctor` (core feature)

- Implement dependency checks and capability reporting
- Check command presence/version where possible for:
  - `pandoc`
  - `ffmpeg` (if user has it; report missing otherwise)
- Show OS-specific install suggestions as guidance only (no auto-install)
- Add `--json` output mode for `doctor`

### Basic runnable commands

- `data json-to-csv` (internal TypeScript)
- `data csv-to-json` (internal TypeScript)
- `md to-docx` via `pandoc`
- `rename batch` (deterministic mode first)
  - slug sanitization
  - prefix + datetime naming pattern support
  - collision handling
  - `--dry-run` preview
- `video` command scaffolding (`convert`, `resize`, `gif`) with dependency gating
  - implement at least one minimal happy-path wrapper if `ffmpeg` is available locally
  - otherwise keep commands present with clear "missing dependency" behavior

### Interactive mode (lightweight)

- Prompt user to choose a command family/action
- Collect only essential inputs for in-scope commands
- Dispatch to the same action handlers used by flag mode
- Keep interactive mode simple (no advanced wizard/recipe system yet)

## Out of Scope (Deferred)

- Advanced PDF processing implementation:
  - `pdf merge`
  - `pdf split`
  - `pdf to-images`
  - `pdf from-images`
- PDF-to-markdown extraction (`pymupdf4llm`) and related Python package checks in `doctor`
- PDF backend final selection (`qpdf`, `pdfcpu`, `pdftoppm`, `mutool`, `magick`)
- `.xlsx` / Excel-like workflows and spreadsheet command group
- `docx -> pdf` backend implementation (Python tool selection still pending research)
- Full `@openai/codex-sdk` workflow-router behavior (beyond minimal adapter scaffolding)
- Production-grade batch/media performance tuning

## Implementation Sequence

1. CLI scaffolding and command registry

- Implement root command setup, help text, nested groups, aliases
- Add no-args -> interactive routing
- Add shared action interface/types

2. Core utilities for process + filesystem + error model

- Process execution helper (stdout/stderr capture, exit status mapping)
- Path validation and overwrite checks
- Common error formatting for dependency and runtime failures

3. `doctor` + capability registry

- Define capability map (command/package -> feature)
- Implement checks and human-readable output
- Implement `doctor --json`

4. Internal data conversions

- Implement `json-to-csv`
- Implement `csv-to-json`
- Add basic file I/O validation and output path options

5. `md to-docx` via `pandoc`

- Thin wrapper command/action
- Dependency gating through shared capability checks
- Basic argument mapping and error messages

6. `rename batch` (deterministic + safe)

- File enumeration in target directory
- Naming policy pipeline (prefix, datetime, slug, collision handling)
- `--dry-run` preview + confirmation path for interactive mode
- Alias support (`batch-rename`)

7. Lightweight interactive mode prompts

- Wire prompts for `doctor`, `data`, `md`, `rename`
- Reuse action handlers from flag mode

8. Optional `video` happy-path wrapper (if `ffmpeg` available)

- Implement one minimal operation (`video convert` or `video gif`) first
- Leave other subcommands scaffolded with clear TODO/help text if not completed

## Deliverables

- Runnable CLI command tree with interactive default behavior
- `doctor` capability report (`text` + `--json`)
- Working `data json-to-csv` and `data csv-to-json`
- Working `md to-docx` (when `pandoc` is installed)
- Working `rename batch --dry-run` and non-destructive preview flow
- Updated `README.md` with basic usage examples and dependency notes for in-scope commands

## Verification Plan

### Manual smoke tests

- `cdx-chores` -> enters interactive mode
- `cdx-chores doctor`
- `cdx-chores doctor --json`
- `cdx-chores data json-to-csv ...`
- `cdx-chores data csv-to-json ...`
- `cdx-chores md to-docx ...` (with `pandoc`)
- `cdx-chores rename batch --dry-run ...`

### Failure-mode checks

- Missing dependency error for `pandoc`/`ffmpeg` commands (clear install suggestion)
- Invalid input file path
- Output file collision/overwrite handling
- Invalid JSON/CSV parsing errors

## Risks and Mitigations

- Risk: interactive mode duplicates logic
  - Mitigation: enforce command -> action separation from the start
- Risk: external tool behaviors vary by platform
  - Mitigation: centralize process adapters and `doctor` capability checks
- Risk: scope grows into PDF/Excel research areas too early
  - Mitigation: keep deferred features as explicit non-goals in this plan

## Follow-up Jobs (After This Plan Starts)

- Job: implement `doctor` + capability registry
- Job: implement data conversion commands
- Job: implement `md to-docx` wrapper
- Job: implement `rename batch` deterministic mode
- Job: add initial interactive prompt router
- Job: validate `ffmpeg` and implement first video wrapper (if dependency available)

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`
- `docs/researches/research-2026-02-25-excel-like-workflows-scope-and-tooling.md`

## Status Notes

- Initial launch lightweight implementation has been completed in the current codebase.
- Implemented items include CLI scaffolding, interactive default mode, `doctor`, basic `data` conversions, `md to-docx`, `rename batch` (with `--dry-run`), and ffmpeg-backed video command wrappers.
- Deferred items in this plan remain deferred (advanced PDF processing, `.xlsx` workflows, `docx -> pdf`, and deeper Codex SDK workflow routing).
