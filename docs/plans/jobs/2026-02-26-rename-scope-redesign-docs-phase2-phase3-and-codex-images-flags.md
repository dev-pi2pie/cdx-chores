---
title: "Complete rename scope redesign docs, phase 2/3 implementation, and codex-images flags"
created-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Stabilize the rename redesign UX contract in documentation, implement the low-risk CLI messaging/help updates and analyzer-boundary refactor, and adopt explicit image-scoped Codex rename flags before first public package release.

## Implemented

### 1. Finalized rename scope/capability documentation contract

- Added and iterated `docs/guides/rename-scope-and-codex-capability-guide.md` with:
  - capability matrix separating deterministic rename support vs Codex semantic analysis support
  - evidence/confidence columns
  - planned analyzer path column
  - flag-combination examples and expected outcomes
  - batch selector precedence documentation
  - note-vs-warning decision for valid-but-unsupported analyzer scopes

- Updated `docs/guides/cli-action-tool-integration-guide.md` to:
  - reflect current Codex SDK usage in runtime code
  - document rename-specific analyzer boundaries
  - link the rename scope/capability guide and redesign plan/research

### 2. Completed Phase 2 (CLI messaging/help clarity)

- Tightened rename CLI help text from generic image wording to explicit static-image wording.
- Added clearer `Codex note:` output in rename summaries for:
  - no supported static images in scope
  - ineligible static-image inputs (for example GIF, too large, unreadable)
  - deterministic fallback on unsupported file types in single-file rename

### 3. Completed Phase 3 (behavior-preserving analyzer boundary refactor)

- Introduced a local rename analyzer interface/runner in `src/cli/actions/rename.ts`.
- Moved static-image Codex eligibility logic behind the analyzer boundary.
- Kept deterministic rename planning independent from analyzer selection.
- Preserved current behavior, skip reasons, and CSV audit integration.

### 4. Adopted explicit image-scoped breaking CLI flag family

Breaking change (pre-release, accepted by design decision):

- replaced `--codex` with `--codex-images`
- replaced tuning flags with:
  - `--codex-images-timeout-ms`
  - `--codex-images-retries`
  - `--codex-images-batch-size`

Applied to:

- `rename file`
- `rename batch`
- `batch-rename` alias

Also aligned current docs/research/plan wording with the new flag family.

### 5. Internal option naming alignment

- Renamed action option fields to image-scoped names (`codexImages*`) in `src/cli/actions/rename.ts`.
- Updated command-to-action mapping and tests accordingly.

## Verification

Automated:

- `bun test test/cli-actions-data-rename.test.ts` ✅ (`26 pass`, `0 fail`)

Manual CLI checks:

- `bun src/bin.ts rename batch --help` ✅
  - shows `--codex-images*` flag family
- `bun src/bin.ts rename batch . --codex --dry-run` ✅
  - fails with unknown option (expected after breaking change)

## Notes

- The redesign plan `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md` is now complete for its current scope (Phases 1-3).
- Phase 4 remains intentionally deferred and should be handled by separate follow-up plans (document-text analyzer planning and backend research for binary docs/media analyzers).
- Historical completed plans/job records still mention `--codex` as part of past implementation snapshots and were not mass-edited.

## Follow-up Jobs

- Job: draft a document-text analyzer plan for `.md` / `.txt` semantic rename (`document-text` path)
- Job: research DOCX/PDF extractor backend options and portability constraints for semantic rename
- Job: decide whether scoped-capability notes should always show for mixed profiles or only when no eligible static images are found

## Related Plans

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`

## Related Research

- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
