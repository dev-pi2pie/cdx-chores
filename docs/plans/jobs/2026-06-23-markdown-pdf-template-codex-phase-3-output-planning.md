---
title: "Markdown PDF template Codex phase 3 output planning"
created-date: 2026-06-23
status: active
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implemented Phase 3 of the direct `md pdf-template codex` plan.

This phase plans template bundle identity, output directories, recipe file
paths, optional report paths, and managed cover-asset target paths after signal
classification succeeds. It does not synthesize or write template bundle files;
the action still stops at the Phase 4 boundary.

## Changes

- Added template bundle ID generation in the
  `md-pdf-template-YYYYMMDDTHHMMSSZ-xxxxxxxx` format.
- Added side-effect-free output planning for explicit and generated template
  bundle directories.
- Added generated output directory retries with a bounded attempt limit.
- Added explicit output directory checks matching `md pdf-template init`
  semantics: existing non-empty directories fail unless `--overwrite` is
  provided.
- Added planned write-target checks for `template.html`, `style.css`, optional
  Codex reports, and managed cover assets.
- Added source/sink collision checks across Markdown input, base profile, cover
  image source, output directory, generated recipe files, report path, and
  planned asset targets.
- Added planned cover-image target paths under `assets/` using sanitized
  bundle-relative filenames.
- Moved the action boundary forward so successful signal collection now prints
  the planned bundle ID, output directory, generated recipe paths, managed asset
  count, and optional report path before stopping at Phase 4.
- Updated the implementation plan checklist for Phase 3.
- Addressed Phase 3 range-review findings by keeping report `bundlePath`
  bundle-relative only, replacing the manual collision matrix with
  role-derived pair checks, and extracting action preflight/summary helpers for
  later synthesis reuse.
- Added follow-up tests for exhausted generated-directory retries, symlink
  output directories, symlink planned recipe files, directory report/asset
  targets, and non-trivial cover-asset filename sanitization.
- Addressed final follow-up review by splitting planned report targets from
  ordinary bundle files, preserving bundle-relative paths for template, CSS, and
  asset files, and adding edge coverage for final retry success, asset
  sanitization fallback/truncation, style directory targets, report symlink
  targets, and asset symlink targets.

## Verification

```bash
bun test test/cli-actions-md-to-pdf-template-codex.test.ts
bun test test/cli-actions-md-to-pdf-template-codex.test.ts test/cli-actions-md-to-pdf-commands.test.ts
bun run format:check
bun run lint
bun run build
git diff --check
bun test --timeout 30000
```

Result: passed. The focused template-Codex suite reported 37 tests passed and 0
failed. The focused template-Codex plus command-layer suite reported 55 tests
passed and 0 failed. The final full suite reported 1237 tests passed and 0
failed.

## Artifact Safety

No generated template bundles, Codex reports, PDFs, profiles, or local resource
artifacts were created or staged.
