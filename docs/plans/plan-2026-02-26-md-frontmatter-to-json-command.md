---
title: "md frontmatter-to-json command"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
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
  - optional `--data-only` emits only the parsed frontmatter object (without wrapper metadata)
- Formatting:
  - use `--pretty` as the common formatting flag for JSON-like output
  - flag mode: compact JSON by default (`--pretty` opt-in)
  - interactive mode: pretty-print prompt defaults to `true`
- Behavior:
  - error if no frontmatter exists
  - error if frontmatter exists but parsing fails / does not produce an object
  - initial output contract uses a wrapper object with `frontmatterType` and `data` by default
  - include trailing newline in JSON output

### Interactive Mode

- `md` submenu adds `frontmatter-to-json`
- Prompts:
  - input markdown file
  - output mode (`stdout` vs file) or optional output path prompt (implementation choice)
  - output shape (`wrapper` default vs `data-only`)
  - overwrite confirmation when writing file
  - pretty-print confirmation (default `true`)

## Output Shape Examples (Initial Output Contract)

### Example input (YAML frontmatter)

```md
---
title: "Release Notes"
draft: false
tags:
  - cli
  - markdown
version: 2
---

# Changelog
```

### Default output (metadata wrapper, selected)

```json
{
  "frontmatterType": "yaml",
  "data": {
    "title": "Release Notes",
    "draft": false,
    "tags": ["cli", "markdown"],
    "version": 2
  }
}
```

### `--data-only` output (supported option)

Useful for piping and compact scripting output:

```json
{"title":"Release Notes","draft":false,"tags":["cli","markdown"],"version":2}
```

## Design Principles / Constraints

- Reuse `src/markdown/parse-markdown.ts` as the parsing source of truth (no duplicate parser logic in CLI action code).
- Preserve Node.js runtime compatibility.
- Follow existing action-layer pattern (`src/cli/actions/*`) and shared fs/path helpers.
- Use `--pretty` as the standard formatting flag for JSON-like CLI outputs (including this command).
- Keep the initial version focused on extraction/serialization, not transformation of frontmatter values.

## In Scope

- New action handler for `md frontmatter-to-json`
- New `commander` subcommand wiring under `md`
- Interactive-mode submenu option and prompt flow
- JSON stdout/file output behavior (including wrapper default and `--data-only`)
- Validation and error handling for missing/invalid frontmatter
- A guide/schema-style document in `docs/guides/` describing the command output contract and examples
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

- [x] Define `MdFrontmatterToJsonOptions` (input, output?, pretty?, overwrite?, dataOnly?).
- [x] Decide stdout/file-output prompt UX for interactive mode (simple + consistent with current prompts).
- [x] Define output-shape selection behavior (wrapper default vs `--data-only`).
- [x] Define error messages/codes for:
  - missing frontmatter
  - invalid/unparseable frontmatter
  - non-object parsed payload (if encountered)
- [x] Document the initial output contract (`{ frontmatterType, data }` default) and `--data-only` behavior.

#### Phase Deliverable

- [x] Stable action contract and user-visible behavior for `md frontmatter-to-json`.

### Phase 2: Implement Action Handler

#### Task Items

- [x] Add `actionMdFrontmatterToJson(...)` in `src/cli/actions/markdown.ts` (or split file if needed).
- [x] Read markdown file via existing fs helpers and parse with `parseMarkdown(...)`.
- [x] Serialize either wrapper output (`{ frontmatterType, data }`) or data-only output based on option, with pretty/plain formatting and trailing newline.
- [x] Write to stdout or file output path via existing output helpers (safe overwrite handling).
- [x] Emit clear success messages for file output (and optionally concise stdout-mode status to stderr/stdout conventions).

#### Phase Deliverable

- [x] Working action-layer implementation using existing markdown parser utilities.

### Phase 3: Wire CLI + Interactive Mode

#### Task Items

- [x] Export the new action from `src/cli/actions/index.ts`.
- [x] Add `md frontmatter-to-json` in `src/command.ts` with options (`--input`, `--output`, `--overwrite`, `--pretty`, `--data-only`).
- [x] Add interactive menu action key + submenu entry in `src/cli/interactive.ts`.
- [x] Implement interactive prompt flow for the new subcommand.
- [x] Keep interactive defaults aligned with decision: stdout default + wrapper default + pretty prompt default `true`.

#### Phase Deliverable

- [x] Command is available in both flag mode and interactive mode.

### Phase 4: Tests, Docs, and Verification

#### Task Items

- [x] Add/extend tests for parser/action integration:
  - YAML frontmatter
  - TOML frontmatter
  - JSON frontmatter
  - missing frontmatter
  - malformed frontmatter
- [x] Add CLI usage examples to `README.md` (or relevant docs).
- [x] Add a guide/schema-style doc in `docs/guides/` for `md frontmatter-to-json` output contract:
  - default wrapper shape (`frontmatterType` + `data`)
  - `--data-only` shape
  - `--pretty` formatting examples
  - error cases / expectations (missing or invalid frontmatter)
- [x] Add a job record documenting implementation and manual checks.

#### Phase Deliverable

- [x] `md frontmatter-to-json` is documented (including `docs/guides/` output-contract guide) and verified across supported frontmatter types.

## Verification Plan

### Manual Checks

- [x] YAML-frontmatter markdown -> stdout JSON output
- [x] TOML-frontmatter markdown -> stdout JSON output
- [x] JSON-frontmatter markdown -> stdout JSON output
- [x] `--data-only` emits only the parsed frontmatter object
- [x] `--pretty` formats both wrapper and `--data-only` outputs consistently
- [x] `--output` writes JSON file with overwrite protection
- [x] Interactive `md` submenu shows `frontmatter-to-json`
- [x] Interactive flow routes to the new command and prompts correctly
- [x] Missing frontmatter returns a clear, actionable error

### Regression Focus

- [x] `md to-docx` behavior remains unchanged
- [x] Existing `src/markdown/*` parsing behavior is reused, not forked

## Reviewed Decisions (2026-02-26)

1. Default output mode is stdout; `--output <path>` is optional.
2. The initial output contract emits a wrapper object with `frontmatterType` and `data` by default.
3. `--data-only` is supported and emits only the parsed frontmatter object for pipeline-heavy usage.
4. `--pretty` is the common formatting flag for JSON-like output; flag mode defaults to compact JSON, and interactive mode pretty-print prompt defaults to `true`.

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/plan-2026-02-26-interactive-two-layer-command-menu-refactor.md`
