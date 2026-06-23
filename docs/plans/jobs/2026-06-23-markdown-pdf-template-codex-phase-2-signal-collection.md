---
title: "Markdown PDF template Codex phase 2 signal collection"
created-date: 2026-06-23
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implemented Phase 2 of the direct `md pdf-template codex` plan.

This phase collects bounded command, document, profile, recipe, font, and cover
image signals, then classifies the command path before any default output
planning or bundle writes.

## Changes

- Added template-Codex signal collection for Markdown document signals by
  reusing the existing profile-Codex collectors.
- Added base-profile loading and summary capture as an internal signal and
  compatibility target.
- Added explicit recipe flag provenance and effective recipe option merging so
  CLI flags override base-profile recipe fields.
- Added bounded font signals from the selected base/default profile plus
  repeatable `--font-hint` values.
- Added local cover-image validation for non-local resource strings and a
  cover-image metadata collector for format, dimensions, aspect ratio,
  orientation bucket, and fit-pressure signals when dimensions can be read.
- Added signal-mode classification for low-signal, deterministic,
  Codex-assisted, and no-usable-template paths.
- Moved the action boundary forward: the command now collects signals, rejects
  low-signal requests before output planning, and stops at the Phase 3 boundary.
- Added focused tests for signal classification, document signal collection,
  profile recipe precedence, cover-image metadata, low-signal rejection, and the
  Phase 3 action boundary.
- Updated the implementation plan checklist for Phase 2.
- Addressed Phase 2 range-review findings by splitting raw image metadata
  parsing from cover signal heuristics, centralizing recipe provenance and merge
  logic, and adding missing tests for no-usable-template failure, unparseable
  local cover metadata, and side-effect-free Phase 2 failures.
- Addressed final Phase 2 range-review findings by returning tagged cover-image
  metadata parse results, making usable-template availability explicit in signal
  classification, narrowing the local template-Codex barrel exports to the
  Phase 2 surface, and adding JPEG/WebP, mixed-signal precedence, and
  command-layer option pass-through tests.
- Followed up on the WebP metadata parser readability by replacing inline byte
  math with named chunk constants and small decoding helpers for VP8X, VP8, and
  VP8L dimensions.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-template-codex.test.ts
bun test test/cli-actions-md-to-pdf-commands.test.ts
bun run format:check
bun run lint
bun run build
git diff --check
bun test --timeout 30000
```

Result: all commands passed. The focused Phase 2 suite reported 19 tests passed
and 0 failed. The command-layer suite reported 18 tests passed and 0 failed.
The final full suite reported 1219 tests passed and 0 failed.

Follow-up readability verification:

```bash
bun run format
bun test test/cli-actions-md-to-pdf-template-codex.test.ts
bun run format:check
bun run lint
bun run build
git diff --check
bun test --timeout 30000
```

Result: all commands passed. The focused template-Codex suite reported 19 tests
passed and 0 failed. The final full suite reported 1219 tests passed and 0
failed.

## Artifact Safety

No generated template bundles, Codex reports, PDFs, profiles, or local resource
artifacts were created or staged.
