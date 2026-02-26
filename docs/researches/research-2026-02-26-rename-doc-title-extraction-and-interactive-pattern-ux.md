---
title: "Rename doc-title extraction and interactive pattern UX research"
created-date: 2026-02-26
status: draft
agent: codex
---

## Goal

Define a practical design direction for improving `rename` in two areas:

- Codex-assisted title suggestions for document-like files via content extraction (not image-only)
- Interactive rename UX that reveals the current renaming pattern and lets users choose a preset or custom pattern

## Milestone Goal

Produce an implementation-ready research baseline for a follow-up plan that extends rename analyzers beyond static images and restores/improves pattern-template UX in both CLI and interactive flows.

## Key Findings

### 1. The rename action already has an analyzer abstraction, but only a static-image analyzer is implemented

`src/cli/actions/rename.ts` already contains a generic analyzer shape:

- candidate selection
- eligibility filtering
- suggestion execution
- summary/error reporting

Current implementation only wires one analyzer:

- `codex-static-image` via `createCodexStaticImageTitleAnalyzer(...)`

Implication: the architecture is already close to supporting a document analyzer. We can extend the existing analyzer pattern instead of inventing a separate rename pipeline.

### 2. Codex-assisted title generation is image-specific at the adapter boundary today

`src/adapters/codex/image-rename-titles.ts` is explicitly image-only:

- prompt wording is image-specific
- inputs are sent as `local_image`
- output schema expects filename/title suggestions for image batches

Implication: adding doc rename assistance should not be bolted into the image adapter. A new adapter (or a shared interface with file-type-specific adapters) is the correct boundary.

### 3. The current codebase does not expose rename pattern/template selection in CLI or interactive mode

Current rename surfaces in `src/command.ts` and `src/cli/interactive.ts` support:

- `--prefix`
- batch scope filters (`--profile`, `--ext`, regex, recursion)
- `--codex-images` and related runtime knobs

They do not currently expose a `--pattern`/template option, and interactive mode only asks for:

- target path/directory
- prefix
- dry-run
- Codex image toggle

Implication: the requested UX improvement ("show current renaming pattern" and "choose different/custom pattern") is not a small prompt tweak; it requires restoring or adding actual pattern/template support in the rename planner and command wiring.

### 4. There is a documentation/code drift around rename pattern support

Existing completed docs/job records describe implemented `--pattern <template>` support and interactive template prompts, but the current source code no longer shows that behavior in:

- `src/command.ts`
- `src/cli/interactive.ts`
- `src/cli/fs-utils.ts`

Implication: before new pattern UX work, we should decide whether pattern support was intentionally reverted or accidentally regressed. The new work should explicitly include a docs reconciliation step.

### 5. Existing rename-scope docs already point toward a future document-text analyzer path

Recent docs already establish the core separation needed for this request:

- deterministic rename planner vs semantic analyzers
- current `--codex-images` is static-image-only
- document-text analyzer is a future path

Implication: the proposed "basic codex-doc-assistant" is aligned with current documented direction, but needs a concrete extractor-first design and UX/flag semantics.

## Implications or Recommendations

### A. Add a document-content extractor stage before Codex title suggestion

For doc-like files, the Codex request should be based on extracted evidence, not raw binary files.

Recommended flow:

1. `rename` planner builds candidate list (existing behavior)
2. `document-text` analyzer selects eligible files by extension
3. local extractor produces a compact evidence payload per file
4. Codex suggester proposes concise titles from extracted evidence
5. rename planner re-runs with `titleOverrides` (same pattern as image flow)

This matches the existing `titleOverrides` reuse pattern in `src/cli/actions/rename.ts`.

### B. Start with a minimal "basic codex-doc-assistant" scope

Phase 1 scope should target low-dependency formats first:

- `.md`, `.markdown`, `.txt`
- `.json`, `.yaml`, `.yml`, `.toml`
- `.xml`, `.html`, `.htm`
- optionally `.csv`/`.tsv` (header-focused only)

Extractor output should be compact and deterministic, for example:

- basename + extension
- file size
- first non-empty lines (capped)
- detected heading/title candidates
- top-level keys (JSON/TOML/YAML) when easy to parse safely

This avoids blocking on PDF/DOCX extraction toolchain decisions while delivering the requested "extract basic content to Codex" capability.

### C. Keep analyzer naming and flags explicit by file type

Do not overload `--codex-images` to silently include docs.

Recommended direction:

- keep `--codex-images` for current static-image analyzer
- introduce a separate opt-in flag for docs (for example `--codex-docs`)
- later consider a grouped flag only after multiple analyzers are stable

This preserves current user expectations and makes mixed-batch reporting clearer.

### D. Design interactive rename pattern UX around "effective pattern" visibility

Interactive mode should show the currently effective pattern before asking for changes.

Recommended prompt sequence (rename file + rename batch):

1. Show effective pattern summary (default or prior selection)
2. Ask pattern choice:
   - Keep current/default
   - Choose preset
   - Enter custom template
3. If custom, validate placeholders immediately
4. Show one example rendered filename preview before running rename

Presets should be explicit and named, for example:

- `prefix-timestamp-stem` (default)
- `timestamp-stem`
- `prefix-stem`
- `stem-only` (use cautiously, still collision-safe)

### E. Reintroduce planner-level pattern/template support before interactive-only UX work

Pattern selection must be a planner capability (shared by CLI and interactive), not prompt-local formatting.

Recommended implementation order:

1. restore/add planner template rendering in `src/cli/fs-utils.ts`
2. expose `--pattern` in `src/command.ts`
3. add interactive pattern prompts in `src/cli/interactive.ts`
4. update dry-run CSV/audit rows if pattern metadata should be recorded

This avoids duplicating filename formatting logic in interactive mode.

### F. Add analyzer result reporting that distinguishes images vs docs

Once docs are supported, batch summaries should report per analyzer category rather than only "Codex image titles".

Example summary direction:

- `Codex image titles: 8/10 suggested`
- `Codex doc titles: 5/7 suggested`
- `Codex notes: 2 docs skipped (unsupported extractor)`

This will reduce confusion in `--profile docs` and `--profile media` workflows.

### G. Add a docs reconciliation task to prevent repeated drift

Because completed job docs currently describe behavior not present in source, follow-up implementation should include:

- source/CLI verification checklist
- docs updates for changed flag names and interactive prompts
- test coverage for pattern/template CLI + interactive-adjacent action behavior

## Open Questions

1. Should the initial doc analyzer use one shared text-extraction path for all text-like files, or format-specific extractors from day one?
2. How much extracted content should be sent to Codex per file (line count / byte cap) to balance quality vs latency/cost?
3. Should doc analyzer suggestions include a confidence or evidence-based fallback reason in the rename plan CSV?
4. Was prior `--pattern` support intentionally removed, or is this a regression that should be restored as part of the same milestone?
5. Should interactive mode remember the last-used pattern within a single session (or via config) when renaming multiple files/batches?

## Related Plans

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`

## Related Research

- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## References

- `src/cli/actions/rename.ts`
- `src/adapters/codex/image-rename-titles.ts`
- `src/cli/interactive.ts`
- `src/command.ts`
- `src/cli/fs-utils.ts`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/guides/cli-action-tool-integration-guide.md`
- `docs/plans/jobs/2026-02-25-rename-pattern-template-support.md`
