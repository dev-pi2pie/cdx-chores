---
title: "cdx-chores CLI scope and architecture research"
created-date: 2026-02-25
modified-date: 2026-03-29
status: completed
agent: codex
---

## Goal

Define a clear research baseline for `cdx-chores` so planning can proceed with a stable command layout, separation of responsibilities, and a realistic dependency strategy around existing system tools (instead of re-implementing all media/document features in TypeScript).

## Phase Goal

Establish a launch-phase CLI foundation that:

- supports both flag-driven commands and an interactive mode
- uses a shared action layer (no duplicated business logic across modes)
- checks external tool availability via `doctor`
- implements a first set of thin wrappers around system tools (`ffmpeg`, `pandoc`, and selected PDF/document helpers)
- keeps Node.js runtime compatibility while using Bun for development/build workflows

## Key Findings

### 1. The repository is currently a minimal CLI skeleton

Current code indicates the project is at the right stage for architecture research before feature implementation:

- `src/bin.ts` only invokes `runCli()` and handles top-level errors.[^src-bin]
- `src/command.ts` creates a `commander` `Command` instance but does not yet define commands.[^src-command]
- `README.md` is the Bun init template and does not yet describe product scope or command usage.[^readme]

Implication: this is the correct time to decide command structure and module boundaries before adding feature commands.

### 2. The package baseline already supports the proposed interaction model

`package.json` already includes:

- `commander` for flag/nested subcommand mode
- `@inquirer/prompts` for interactive mode
- `@openai/codex-sdk` for AI-assisted flows (for example, semantic rename suggestions or workflow assistance)

This matches the stated requirement for two modes and Codex integration, so no immediate dependency changes are required for the launch-phase research baseline.[^package-json]

### 3. Build metadata embedding has started, but build script wiring is not yet defined

The repository now includes an embedded-version generator script:

- `scripts/generate-embedded-version.mjs` reads `package.json`
- it generates `src/cli/program/version-embedded.ts`
- it is designed to be run before build output is produced

At the same time, `package.json` currently has no `scripts` section, so the build integration order still needs to be documented and standardized.[^generate-embedded-version][^package-json]

### 4. The proposed command tree is coherent and should be preserved

The current proposed layout is consistent with task-oriented CLI design:

- top-level utility commands: `interactive`, `doctor`
- domain groups: `video`, `md`, `docx`, `pdf`, `data`, `rename`
- verb-oriented subcommands under each domain

This layout is easier to scale than a flat command list and maps well to a shared internal action registry.

### 5. External-tool orchestration should be the default strategy (not full in-project reimplementation)

Your stated constraint is important and should become a formal architecture rule:

- `cdx-chores` is primarily an orchestrator/curator CLI
- many subcommands should call existing tools available in the user's environment
- `doctor` exists to validate those dependencies and explain capability gaps

This reduces implementation burden and keeps the project focused on workflow integration, UX, and consistency.

### 6. `doctor` is not optional; it is a core product feature

Because many features depend on external commands or runtimes, `doctor` should:

- detect command existence (`PATH`)
- detect versions (when available)
- map commands to feature capabilities
- report missing dependencies with install hints
- optionally emit machine-readable output (`--json`) for debugging or automation

Without this, feature commands will fail unpredictably and create poor UX.

### 7. A shared action layer is required to support both CLI modes cleanly

Two user-facing modes should not produce two separate implementations.

Recommended flow:

- flag mode (`commander`) parses CLI args and dispatches to action handlers
- interactive mode prompts for inputs, then dispatches to the same action handlers
- action handlers call adapters (tool wrappers/internal processors)

This keeps behavior consistent and simplifies testing.

### 8. Some listed conversions need capability clarification before planning

Several requested tasks are clear, but a few need backend/tooling confirmation:

- `md -> docx`: `pandoc` is a strong fit, and `pandoc` is currently available in the local environment (good enough as a launch-phase workaround/baseline)
- video convert/resize/gif: `ffmpeg` is the primary fit
- JSON/CSV conversion: can be implemented internally in TypeScript (low external dependency)
- DOCX/PDF/image conversion and PDF operations: backend selection must be clarified per operation (`pandoc`, LibreOffice/`soffice`, `qpdf`, `pdfcpu`, `pdftoppm`, `magick`, Python helpers, etc.)
- local environment note (user-reported): `soffice`, `qpdf`, `pdfcpu`, `pdftoppm`, and `magick` are not currently installed
- `pymupdf4llm` is installed and is a strong candidate for PDF-to-markdown style workflows, including extracting images from PDFs into a side folder and appending image references into generated markdown
- `pymupdf4llm` is still not an obvious direct replacement for all PDF render/merge/split/document-conversion tasks (needs validation against desired use cases)
- Microsoft Office-like formats beyond CSV (for example, Excel files) need separate research and should not be assumed covered by current choices

This does not block architecture design, but it does affect launch-phase feature scope and `doctor` checks.

## Implications or Recommendations

### A. Adopt a layered module structure early

Recommended structure (conceptual):

- `src/command.ts`: root CLI bootstrap and commander wiring
- `src/commands/**`: command definitions only (argument parsing, help text, mode bridging)
- `src/actions/**`: normalized action handlers shared by flag mode and interactive mode
- `src/adapters/tools/**`: wrappers for external executables (`ffmpeg`, `pandoc`, etc.)
- `src/adapters/codex/**`: `@openai/codex-sdk` integration points
- `src/core/doctor/**`: dependency checks and capability matrix
- `src/core/process/**`: process spawning, logging, stderr/stdout capture, exit code mapping
- `src/core/fs/**`: file discovery, path validation, output naming, slug sanitization
- `src/features/**`: domain-specific orchestration (`video`, `pdf`, `data`, `rename`)

Key rule: command modules should not directly spawn system binaries. Route all execution through adapters/core process utilities.

### B. Add build-pipeline wiring for embedded version generation early

Because `scripts/generate-embedded-version.mjs` already writes generated source consumed by the CLI, it should be integrated into the build flow now (during the launch phase), not later.

Recommendations:

- add a `scripts` section in `package.json` if it does not exist yet
- ensure the embedded-version generator runs before the build command
- document the build order clearly (generate -> compile/bundle)
- avoid hand-editing generated files; treat `src/cli/program/version-embedded.ts` as generated output

This prevents version drift between `package.json` and CLI-reported version metadata.[^generate-embedded-version][^package-json]

### C. Define a capability registry for `doctor` and command gating

Create one source of truth that maps features to required tools, for example:

- `video.convert` -> `ffmpeg`
- `video.gif` -> `ffmpeg`
- `md.to-docx` -> `pandoc`
- `pdf.merge` -> chosen PDF backend(s)
- `rename.batch` -> optional `codex` capability for semantic naming, plus internal slug/date formatter

Benefits:

- `doctor` and runtime checks reuse the same definitions
- help output can explain optional vs required tools
- interactive mode can hide unsupported options automatically

### D. Treat AI-assisted rename as an optional enhancer, not a hard dependency

For `rename batch`, the naming pattern proposal is strong:

- `<prefix>-<datetime>-<sanity-concise-pic-title-name>`

Recommendations:

- provide deterministic fallback modes when AI is unavailable (`index`, original stem, EXIF date)
- split naming into phases:
  - metadata extraction (date/time)
  - title generation (Codex SDK or fallback)
  - slug sanitization
  - collision handling (`-01`, `-02`, ...)
- support `--dry-run` and preview in interactive mode before renaming

This keeps the feature useful even when API/network/auth is unavailable.

### E. Scope the launch phase around thin wrappers + internal data utilities

A realistic launch-phase implementation scope:

- `doctor`
- `interactive` shell (basic prompt router)
- `video convert`, `video resize`, `video gif` via `ffmpeg`
- `md to-docx` via `pandoc`
- `data json-to-csv`, `data csv-to-json` internal TypeScript
- `rename batch` with preview, slug sanitization, and optional Codex title generation
- experimental/research-track PDF markdown extraction using `pymupdf4llm` can be explored, but should be clearly labeled until behavior/output format is validated

Defer or mark experimental until backend choices are validated:

- `docx to-pdf`
- advanced PDF conversion/image pipelines
- PDF merge/split (unless a backend is selected and tested early)
- Excel/Office-like document workflows beyond CSV

### F. Standardize error model and output conventions

Because this CLI shells out to other tools, define conventions before implementation:

- user-facing error categories: missing dependency, invalid input, command failure, unsupported conversion, partial batch failure
- exit codes (at least distinguish configuration/dependency failures vs task failures)
- `--json` output for `doctor` first; consider later for task commands
- `--dry-run` for all destructive/batch operations where practical (`rename`, maybe conversions with overwrite behavior)

### G. Add planning follow-up documents after this research

Next documents recommended:

- plan doc for launch-phase architecture and scaffolding
- job record for implementing `doctor` + capability registry
- job record for implementing `video` commands via `ffmpeg`
- job record for implementing `rename batch` naming pipeline

## Reviewed Decisions (Current)

1. `interactive` should be the default behavior when running `cdx-chores` with no arguments.
2. PDF merge/split and PDF image conversion backends are not decided yet; create a separate research document with a comparison table before planning implementation.
3. For `docx -> pdf`, prefer a Python-based tool over LibreOffice/`soffice`, but perform additional research before choosing the backend.
4. `@openai/codex-sdk` should be used as a workflow router/assistant that helps determine the right tool or sub-workflow for a data-processing job (similar to a skill/sub-agent style dispatcher), not only for semantic rename.
5. `doctor` should include OS-specific install suggestion messages (macOS/Linux/Windows), but it should only report guidance; users install missing tools themselves.
6. Development uses Bun, runtime targets Node.js, and Node.js runtime support should be `>= 20`.
7. Command names should keep nested verbs (for example, `rename batch`) and also provide convenience aliases (for example, `batch-rename`).
8. Initial build usage should be `bun run build`, and the `package.json` `build` script should run embedded-version generation before bundling (for example, `node scripts/generate-embedded-version.mjs && tsdown`).

## Remaining Open Questions

1. Which exact Python-based backend should be selected for `docx -> pdf`, and what are its platform/runtime requirements?
2. Which backend(s) should be selected for PDF merge/split and PDF image conversions, based on a documented comparison table?
3. Should `pymupdf4llm` be introduced in the launch phase as an experimental command path (for PDF-to-markdown/image extraction), or only documented and deferred?
4. What is the minimum Bun version to document for development workflows?
5. How should Excel-like workflows be scoped (for example, `.xlsx` conversions, extraction, or tabular export) relative to the existing `data` command group?

## References

[^package-json]: `package.json`
[^src-bin]: `src/bin.ts`
[^src-command]: `src/command.ts`
[^readme]: `README.md`
[^agents]: `AGENTS.md`
[^generate-embedded-version]: `scripts/generate-embedded-version.mjs`
