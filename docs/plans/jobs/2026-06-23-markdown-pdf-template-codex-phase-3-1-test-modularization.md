---
title: "Markdown PDF template Codex phase 3.1 test modularization"
created-date: 2026-06-23
status: active
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Refactor the completed Phase 1-3 `md pdf-template codex` test coverage into
focused files before Phase 4 adds deterministic template family and synthesis
coverage.

This job is refactor-only. It should preserve behavior, assertions, and command
coverage while improving test-file ownership.

## Changes

- Split the large catch-all template-Codex action test into focused files under
  `test/cli-actions-md-to-pdf-template-codex/`.
- Used a feature-folder layout after structure-planning review, with separate
  files for command-state normalization, signal mode, signal collection, image
  metadata, output path planning, output directory behavior, output target
  validation, output collision checks, and action-boundary behavior.
- Extracted shared binary/image fixture builders and small path helpers into
  `test/cli-actions-md-to-pdf-template-codex/fixtures.ts`.
- Updated the implementation plan checklist for completed Phase 3.1 refactor
  mechanics.
- Addressed maintainability review by splitting the first-pass `signals` file
  into pure signal-mode and signal-collection coverage, and by splitting output
  validation into directory, target, and collision-focused files.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
git diff --check
bun test --timeout 30000
```

Result: passed. The focused template-Codex split plus command-layer suite
reported 56 tests passed and 0 failed. The full suite reported 1238 tests passed
and 0 failed across 186 files.

## Review

Pending maintainability and test coverage review on the Phase 3.1 commit range.
