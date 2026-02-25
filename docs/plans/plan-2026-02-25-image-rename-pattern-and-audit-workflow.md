---
title: "Image rename pattern and audit workflow plan"
created-date: 2026-02-25
modified-date: 2026-02-25
status: active
agent: codex
---

## Goal

Define a robust rename pattern and audit workflow for image batch renaming in `cdx-chores`, including deterministic safety rules, Codex-assisted title integration, and a lightweight audit trail that remains local-first.

## Why This Plan

The current `rename batch` flow is safe and useful, but image-heavy workflows benefit from a stronger naming policy and traceability:

- clearer filename structure (prefix + timestamp + semantic stem)
- collision-safe and repeatable behavior
- auditability (what changed, when, and why)
- optional Codex assistance without requiring model-specific CLI flags

This plan is inspired by local-first image rename tools, but adapted to `cdx-chores` conventions:

- Codex assistance is opt-in via `--codex`
- model selection is not exposed as a user flag (Codex chooses internally)
- cost/latency is controlled through timeout/batch/retry defaults instead of model knobs

Reference inspiration/spec input:

- A prior local Python image-rename utility prototype (used as a behavior reference for pattern/audit/safety ideas, not a strict implementation mirror).

## Execution Checklist By Phase

### Phase 1: Replay-Safe Foundation (Completed)

- [x] Define stable dry-run plan cache workflow (write plan CSV and apply exact snapshot later)
- [x] Define/apply a rename plan CSV schema contract (with replay-safe path fields)
- [x] Implement `rename apply <csv>` command to apply an exact dry-run snapshot
- [x] Define CSV replay/apply flow (`rename apply <csv>` baseline + safety checks)

### Phase 2: Core Rename Workflows and Scope Controls (Completed)

- [x] Define single-file rename UX (`rename file` command vs `rename batch --file`)
- [x] Define allowed extensions default list and override behavior (`--ext`)

### Phase 3: Naming Pattern and Template Design (Current Implementation Phase)

- [ ] Define canonical rename filename pattern (prefix / timestamp / stem / suffix)
- [ ] Define custom rename pattern/template support (placeholders + validation)
- [ ] Decide default prefix behavior (directory name vs fixed `file` vs current behavior compatibility)
- [ ] Define timestamp precedence for images (EXIF `DateTimeOriginal` vs file mtime)
- [ ] Decide whether EXIF support is in scope for Node-only launch or requires a separate backend/tool

### Phase 4: Scope Safety and Traversal Policy (Deferred Until Recursive Work)

- [ ] Define recursive behavior (`--recursive`) and safety boundaries
- [ ] Define symlink policy (skip, log reason)

### Phase 5: Audit and Replay UX Expansion (Deferred)

- [ ] Define audit CSV format and naming (including dry-run suffix)
- [ ] Decide whether audit CSV is always written (including dry-run) or opt-in
- [ ] Decide whether `rename apply <csv>` is the only replay UX or if `rename batch --rename-csv <path>` alias is also needed
- [ ] Define how Codex-assisted titles are recorded in audit CSV (provider/model metadata may be optional/minimal)

### Phase 6: UX Defaults, Compatibility, and Documentation (Deferred)

- [ ] Define confirmation UX for Codex-assisted runs (`--dry-run`, interactive confirm, `--auto` equivalent or not)
- [ ] Document cost-light defaults (timeout, batch size, retry count) without exposing model-selection flags
- [ ] Document compatibility/behavior differences from the Python reference script
- [ ] Add examples for image workflows in docs/README after design is settled

## Draft Naming Pattern (Proposal)

Candidate format (compatible with current implementation direction):

- `<prefix>-<YYYYMMDD-HHMMSS>-<stem><ext>`

Where:

- `prefix` defaults to current `rename batch` behavior unless changed by this plan
- timestamp uses image metadata when available (future), otherwise file mtime
- `stem` comes from:
  - deterministic cleaned filename stem (default)
  - Codex-assisted semantic title when `--codex` succeeds
- collisions append `-02`, `-03`, ...

## Dry-Run Snapshot and Replay (Design Decision)

- `rename batch ... --dry-run` should write a plan CSV under `cwd`
- filename pattern: `rename-<timecode>-<uid>.csv`
- apply should replay the CSV snapshot exactly (not recompute the plan)
- direct replay should be supported with a dedicated command:
  - `rename apply <csv>`

This prevents dry-run/apply drift caused by:

- Codex suggestions changing between runs
- file mtimes changing
- directory contents changing (collisions/new files)

## Safety and Local-First Principles

- Never rename outside the chosen directory scope
- Skip symlinks
- Keep deterministic fallback when Codex is unavailable
- Prefer preview (`--dry-run`) before apply
- Keep audit artifacts local and repo-safe (for playground/testing data)

## Notes on Codex Integration

- No `--ai-model` style flag is planned for `cdx-chores` image rename
- Codex runtime chooses the effective model/tooling path
- User-facing controls should focus on:
  - enable/disable Codex assist
  - timeout/retry/batch limits (if exposed later)
  - apply/preview confirmation behavior

## Schema Contract

Rename plan CSV schema should be documented in a dedicated guide:

- `docs/guides/rename-plan-csv-schema.md`

## Follow-up Jobs

- Job: design and implement audit CSV generation for rename batch (dry-run + apply)
- Job: add Codex-assisted rename audit columns (suggested title, final title, fallback reason)
- Job: evaluate EXIF timestamp extraction options for Node/Bun-compatible image workflows
- Job: design and implement single-file rename workflow
- Job: design and implement custom rename pattern/template parsing + validation
- Job: add recursive support and safety boundaries with tests
- Job: document regex/ext scoping examples for image/non-image mixed folders
- Job: implement CSV replay/apply mode if adopted

## Related Plans

- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Status Notes

- `rename file <path>` is implemented as the single-file workflow (preferred over overloading `rename batch`).
- `rename file` supports `--prefix` and `--dry-run`, and dry-run writes the same replayable plan CSV schema used by batch mode.
- Interactive mode now includes a `rename file` menu entry with the same dry-run/apply-now pattern used by `rename batch`.
- `rename file` currently rejects symlink inputs explicitly (direct-path safety); batch-mode symlink policy/audit logging remains a separate checklist item for recursive/audit design.
- `rename batch` now supports file scoping controls for batch selection:
  - `--match-regex`
  - `--skip-regex`
  - `--ext`
  - `--skip-ext`
- Extension filters are case-insensitive and apply before dry-run/apply plan generation, so CSV snapshots only include scoped files.
