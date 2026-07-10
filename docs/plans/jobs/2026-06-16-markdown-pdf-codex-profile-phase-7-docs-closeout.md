---
title: "Markdown PDF Codex profile Phase 7 docs closeout"
created-date: 2026-06-16
status: completed
agent: codex
plan: ../plan-2026-06-15-markdown-pdf-codex-profile-helper.md
---

## Scope

Complete Phase 7 of the Markdown PDF Codex profile helper plan by documenting
the shipped direct `md pdf-profile codex` helper and closing the direct-helper
implementation plan.

## Changes

- Added `docs/guides/markdown-pdf-codex-profile-helper.md` as the dedicated
  user-facing guide for the direct helper.
- Updated `docs/guides/markdown-pdf-usage.md` to link the new helper guide,
  refresh the release boundary, and distinguish the direct helper from later
  Interactive mode work.
- Updated the main implementation plan:
  - marked Phase 7 checklist items complete
  - linked this Phase 7 job record
  - changed plan status from `active` to `completed`
- Updated the combined research doc with a direct-helper implementation
  checkpoint while keeping research status `in-progress` because Interactive
  mode still needs its own later plan.

## Documented Contract

The new guide records:

- command shape for `md pdf-profile codex [input]`
- direct helper use cases for document-informed, intent-only, font-hint, and
  base-profile refinement flows
- repeatable `--font-hint` semantics for separate font preference signals in
  the same Codex request
- positional input and `--input <path>` parity
- signal ladder for Codex-assisted, base-only deterministic, and no-signal
  deterministic routes
- preview-then-decide behavior through `--dry-run`
- deterministic replay through `md to-pdf --profile`
- optional diagnostic report retention and report/profile UID relationship
- generated profile identity and `profile.preset` replay
- candidate adaptation boundaries
- strict fixed-field profile patch boundary
- dedicated font patch role/key matrix
- `titleBlock.metadataTitle` title-block deduplication behavior
- table-signal layout policy
- profile versus template boundary
- unsupported profile directions such as local cover images, arbitrary CSS,
  custom HTML layout, and exact table styling

## Decisions

- The direct helper plan is complete because its scoped implementation and
  guide documentation are finished.
- The combined research remains `in-progress` because the Interactive mode layer
  is still pending.

## Evidence

- `git diff --check`
  - completed successfully
- `bun run format:check`
  - completed successfully
- `bun run lint`
  - completed successfully

## Review

The Phase 7 range review is performed after the commit that includes this job
record, so the review result is recorded in the thread closeout rather than in a
second recursive job-record update.
