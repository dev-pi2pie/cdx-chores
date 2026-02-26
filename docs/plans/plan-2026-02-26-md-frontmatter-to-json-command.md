---
title: "md frontmatter-to-json command"
created-date: 2026-02-26
status: draft
agent: codex
---

## Goal

Add a new `md frontmatter-to-json` command that parses Markdown frontmatter (YAML, TOML, or JSON) and outputs normalized JSON using the existing `src/markdown/*` parser utilities.

## Why This Plan

- The `md` command group is now a stable submenu in interactive mode and should grow beyond `to-docx`.
- The repository already includes reusable markdown/frontmatter parsing code in `src/markdown/*`, so this feature can ship with low implementation risk.
- A frontmatter extraction command is useful on its own and also validates the markdown parsing utilities with a user-facing workflow.

## Current State (Baseline)

- `src/markdown/parse-markdown.ts` already parses fenced YAML/TOML/JSON frontmatter and returns:
  - `data` (parsed object or `null`)
  - `frontmatterType` (`yaml` | `toml` | `json` | `null`)
  - `content` (remaining markdown content)
- `src/command.ts` currently exposes only `md to-docx`.
- Interactive mode `md` submenu currently exposes only `to-docx`.

## Proposed Command UX

### Flag-driven CLI

- Command: `md frontmatter-to-json`
- Required input: Markdown file path
- Output:
  - default: print JSON to stdout
  - optional `--output <path>` writes JSON file
- Formatting:
  - `--pretty` (default `true`) for human-readable JSON
- Behavior:
  - error if no frontmatter exists
  - error if frontmatter exists but parsing fails / does not produce an object
  - include trailing newline in JSON output

### Interactive Mode

- `md` submenu adds `frontmatter-to-json`
- Prompts:
  - input markdown file
  - output mode (`stdout` vs file) or optional output path prompt (implementation choice)
  - overwrite confirmation when writing file
  - pretty-print confirmation (if not defaulted silently)

## Design Principles / Constraints

- Reuse `src/markdown/parse-markdown.ts` as the parsing source of truth (no duplicate parser logic in CLI action code).
- Preserve Node.js runtime compatibility.
- Follow existing action-layer pattern (`src/cli/actions/*`) and shared fs/path helpers.
- Keep the first version focused on extraction/serialization, not transformation of frontmatter values.

## In Scope

- New action handler for `md frontmatter-to-json`
- New `commander` subcommand wiring under `md`
- Interactive-mode submenu option and prompt flow
- JSON stdout/file output behavior
- Validation and error handling for missing/invalid frontmatter
- Tests for action/parser integration edge cases (as practical)

## Out of Scope (Initial Version)

- Frontmatter editing / write-back to markdown files
- Extracting markdown body content to separate outputs
- Multi-file batch processing / globbing
- JSONPath querying / key filtering
- Schema validation
- Converting frontmatter to CSV/YAML/TOML (future follow-up)

## Implementation Strategy

### Phase 1: Define Action Contract and Output Behavior

#### Task Items

- [ ] Define `MdFrontmatterToJsonOptions` (input, output?, pretty?, overwrite?).
- [ ] Decide stdout/file-output prompt UX for interactive mode (simple + consistent with current prompts).
- [ ] Define error messages/codes for:
  - missing frontmatter
  - invalid/unparseable frontmatter
  - non-object parsed payload (if encountered)

#### Phase Deliverable

- [ ] Stable action contract and user-visible behavior for `md frontmatter-to-json`.

### Phase 2: Implement Action Handler

#### Task Items

- [ ] Add `actionMdFrontmatterToJson(...)` in `src/cli/actions/markdown.ts` (or split file if needed).
- [ ] Read markdown file via existing fs helpers and parse with `parseMarkdown(...)`.
- [ ] Serialize parsed `data` to JSON with pretty/plain formatting and trailing newline.
- [ ] Write to stdout or file output path via existing output helpers (safe overwrite handling).
- [ ] Emit clear success messages for file output (and optionally concise stdout-mode status to stderr/stdout conventions).

#### Phase Deliverable

- [ ] Working action-layer implementation using existing markdown parser utilities.

### Phase 3: Wire CLI + Interactive Mode

#### Task Items

- [ ] Export the new action from `src/cli/actions/index.ts`.
- [ ] Add `md frontmatter-to-json` in `src/command.ts` with options (`--input`, `--output`, `--overwrite`, `--pretty`).
- [ ] Add interactive menu action key + submenu entry in `src/cli/interactive.ts`.
- [ ] Implement interactive prompt flow for the new subcommand.

#### Phase Deliverable

- [ ] Command is available in both flag mode and interactive mode.

### Phase 4: Tests, Docs, and Verification

#### Task Items

- [ ] Add/extend tests for parser/action integration:
  - YAML frontmatter
  - TOML frontmatter
  - JSON frontmatter
  - missing frontmatter
  - malformed frontmatter
- [ ] Add CLI usage examples to `README.md` (or relevant docs).
- [ ] Add a job record documenting implementation and manual checks.

#### Phase Deliverable

- [ ] `md frontmatter-to-json` is documented and verified across supported frontmatter types.

## Verification Plan

### Manual Checks

- [ ] YAML-frontmatter markdown -> stdout JSON output
- [ ] TOML-frontmatter markdown -> stdout JSON output
- [ ] JSON-frontmatter markdown -> stdout JSON output
- [ ] `--output` writes JSON file with overwrite protection
- [ ] Interactive `md` submenu shows `frontmatter-to-json`
- [ ] Interactive flow routes to the new command and prompts correctly
- [ ] Missing frontmatter returns a clear, actionable error

### Regression Focus

- [ ] `md to-docx` behavior remains unchanged
- [ ] Existing `src/markdown/*` parsing behavior is reused, not forked

## Open Questions (To Resolve During Implementation)

1. Should stdout be the default output mode, or should the command default to `<input>.frontmatter.json` for consistency with file-conversion commands?
2. Should the output include metadata (for example, `frontmatterType`) in a wrapper object, or emit only the parsed frontmatter object in v1?
3. Should `--pretty` default to `true` for readability, or `false` for script-friendly compact output (with `--pretty` opt-in)?

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/plan-2026-02-26-interactive-two-layer-command-menu-refactor.md`

