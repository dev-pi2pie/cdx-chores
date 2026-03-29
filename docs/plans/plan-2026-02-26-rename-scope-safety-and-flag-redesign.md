---
title: "Rename scope, safety, and flag redesign"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Redesign the `rename` command surface so file-selection scope, safety rules, and optional Codex-assisted naming are clearly separated, while preserving deterministic rename behavior as the default.

## Why This Plan

Current `rename` behavior is functionally useful, but the CLI surface now mixes multiple concerns:

- batch file selection scope (`--profile`, `--ext`, `--skip-ext`, regex filters)
- rename formatting (`--prefix`, `--pattern`)
- traversal/safety (`--recursive`, `--max-depth`, hidden/system-file defaults)
- optional Codex-assisted semantic naming (`--codex-images`, `--codex-images-*` tuning flags)

This makes it harder to explain what image-scoped semantic analyzer flags do (and do not do) for mixed file sets such as `media` or `docs`.

## Design Direction (Working)

### 1. Keep deterministic rename as the baseline for all files

- `rename file` and `rename batch` should continue to work for many file extensions without requiring Codex.
- Codex-assisted naming remains optional and best-effort only.
- Dry-run CSV + replay (`rename apply <csv>`) remains the safety-first workflow.

### 2. Keep conservative default exclusions for hidden/system files

Default batch behavior should continue to skip:

- dot-prefixed entries (for example `.git`, `.env`, `.DS_Store`)
- AppleDouble entries (`._*`)
- known system noise files (`Thumbs.db`, `desktop.ini`, etc.)

Rationale:

- safer by default
- reduces accidental renames of config/system files
- aligns with bulk-rename expectations for user content folders

Future expansion can add explicit opt-in flags (for example `--include-hidden`) if needed, but not as a default.

### 3. Narrow and document Codex scope explicitly (static image first)

Short-term supported Codex-assisted semantic naming scope:

- static image files only (current behavior)

Explicitly out of scope for the redesign implementation phase (defer):

- video file analysis
- animated GIF / animated image analysis
- Python-backed doc extraction pipelines for rename-time semantics

Note:

- docs-like files (`.md`, `.txt`, `.docx`) should remain renameable in deterministic mode
- content-based semantic naming for docs requires separate extractor research and capability checks

### 4. Separate "selection scope" flags from "semantic analyzer" flags

Planned UX direction:

- selection flags answer: "Which files are in the batch?"
- naming flags answer: "How are filenames formatted?"
- semantic flags answer: "Should an analyzer propose a better stem for supported files?"
- safety flags answer: "How do preview/apply and traversal boundaries behave?"

This reduces ambiguity when users combine `--profile docs` with `--codex-images`.

## What To Keep (Current Behavior)

- `rename file`, `rename batch`, `rename apply <csv>` workflow
- `batch-rename` alias (unless a broader CLI naming cleanup is planned)
- dry-run plan CSV generation and replayable apply flow
- deterministic fallback when Codex fails or skips files
- symlink safety behavior
- hidden/system-file default exclusion behavior for batch mode
- profile-based batch scoping (`all`, `images`, `media`, `docs`) as a starting point

## What To Rework (Flags / Messaging / Scope Model)

### A. Clarify Codex flag semantics

Problem (resolved by breaking change decision):

- generic `--codex` reads like a broad rename intelligence flag
- actual behavior is narrower (supported static images only)

Decision (2026-02-26):

- use explicit image-scoped flag family:
  - `--codex-images`
  - `--codex-images-timeout-ms`
  - `--codex-images-retries`
  - `--codex-images-batch-size`
- no backward-compatibility alias is required before first public package release

Future option (still open if more analyzers are added):

- introduce scoped families later (for example docs/video) or a broader `--codex-scope ...` design when multiple analyzers exist

### B. Rationalize scope filters for batch mode

Problem:

- multiple overlapping selectors (`--profile`, `--ext`, `--skip-ext`, regex)
- valid but hard to reason about in mixed-content folders

Redesign target:

- document precedence clearly
- preserve current behavior where possible
- consider note text when combinations are likely confusing (for example `--profile docs --codex-images`)

### C. Make analyzer eligibility/reporting visible

Current user-facing output focuses on "Codex image titles" only.

Redesign target:

- clearly report eligible vs skipped by analyzer category/reason
- show why files were not analyzed (unsupported type, non-static, too large, unreadable)

## Deferred Scope (Separate Research/Plans)

These are intentionally not part of the immediate rename-flag redesign implementation:

- video semantic rename analysis (requires documented Codex support or frame-extraction pipeline decision)
- animated GIF semantic rename analysis (frame sampling policy + reliability evaluation)
- DOCX/PDF semantic rename via Python extractors (backend comparison and portability research)
- audio semantic rename/transcript-driven naming

This plan is considered complete once the current-scope redesign work (docs contract, CLI messaging/flag clarity, and static-image analyzer boundary refactor) is finished. Deferred items require separate follow-up plans.

## Execution Checklist (Draft)

### Phase 1: Documentation and UX Contract (First)

- [x] Document rename capability boundaries (rename works for many files; Codex semantic naming is narrower)
- [x] Add/maintain a file-type capability comparison matrix (deterministic rename vs Codex semantic naming)
- [x] Document default hidden/system-file exclusions and rationale
- [x] Document current flag combination behavior/precedence for batch scoping
- [x] Decide image-scoped Codex flag naming and breaking-change policy before first public release (`--codex-images*`)

### Phase 2: CLI Messaging Cleanup (Low Risk)

- [x] Use explicit image-scoped CLI flag naming (`--codex-images*`) and help text for static-image-only semantics
- [x] Improve dry-run/preview summary text for mixed batches (`docs`, `media`)
- [x] Ensure skip reasons remain visible in CSV and preview output

### Phase 3: Internal Design Refactor (No New Modalities Yet)

- [x] Introduce a rename analyzer capability registry/interface (static-image analyzer only at first)
- [x] Move image-specific Codex eligibility logic behind the analyzer boundary
- [x] Keep deterministic rename planner independent from analyzer selection

### Phase 4: Optional Future Expansion (Separate Plans)

- [ ] Draft a document-text analyzer plan (`.md` / `.txt` first, no Python dependency)
- [ ] Research DOCX/PDF extractor backends and portability constraints
- [ ] Revisit animated image/video analyzer feasibility after tooling research

## Documentation Follow-ups (Guide Status / Planned Updates)

Current guide statuses (2026-02-26 audit):

- `docs/guides/cli-action-tool-integration-guide.md` -> `draft`
- `docs/guides/interactive-path-prompt-ux.md` -> `completed`
- `docs/guides/md-frontmatter-to-json-output-contract.md` -> `draft`
- `docs/guides/rename-plan-csv-schema.md` -> `draft`

Rename redesign documentation should prioritize:

1. `docs/guides/rename-scope-and-codex-capability-guide.md`
2. `docs/guides/cli-action-tool-integration-guide.md`
3. `docs/guides/rename-plan-csv-schema.md` (only if analyzer reason/status semantics change)

## Open Questions

1. Should hidden-file inclusion be a single flag (`--include-hidden`) or split (`--include-dotfiles`, `--include-system-files`)?
2. Should the scoped-capability note be shown only when no eligible static images are found, or always when `--codex-images` is used with mixed profiles?
3. Should docs-like semantic naming start with `.md`/`.txt` only (Node-only extractor path) before considering `.docx`?

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
- `docs/researches/archive/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`

## Related Plans

- `docs/plans/archive/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- `docs/plans/archive/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
