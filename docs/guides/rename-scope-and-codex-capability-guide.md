---
title: "Rename Scope and Codex Capability Guide"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Clarify the difference between:

- files that `rename` can rename safely/deterministically
- files that current Codex semantic naming analyzers (`--codex-images`, `--codex-docs`) can analyze in `cdx-chores`

This guide exists to reduce confusion when using mixed file sets (for example `--profile media` or `--profile docs`) together with `--codex-images`.

## Scope of This Guide

This guide describes:

- current `cdx-chores` rename behavior (`rename file`, `rename batch`, `rename apply <csv>`)
- current Codex-assisted semantic rename behavior as implemented in:
  - `src/cli/actions/rename.ts`
  - `src/adapters/codex/image-rename-titles.ts`
  - `src/adapters/codex/document-rename-titles.ts`

This guide does **not** claim general OpenAI API modality support for non-Codex models. It is specifically about the current Codex model/tooling path used by this project.

## Key Principle

`rename` support and Codex semantic-analysis support are different layers:

- `rename` (planner/apply flow) can work for many file extensions
- `--codex-images` and `--codex-docs` each attempt semantic naming for narrower sets of eligible files
- all unsupported/failed Codex cases fall back to deterministic rename behavior

## Current Capability Matrix (2026-02-26)

| File category | Example extensions | Deterministic rename support | Codex semantic naming (current implementation) | Current status in `cdx-chores` | Planned analyzer path | Evidence type | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Static raster images | `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tif`, `.tiff`, `.avif` | Yes | Yes (best-effort) | Supported | `static-image` (current) | Project implementation (`src/cli/actions/rename.ts`, `src/adapters/codex/image-rename-titles.ts`) | High | Subject to file-size/readability checks |
| Animated image (GIF) | `.gif` | Yes | No (skipped) | Deferred for semantics | `animated-image` (deferred) | Project implementation + project policy (reliability choice) | High (current behavior), Medium (platform limitation) | Recorded as `codex_skipped_non_static` in current logic; skip is a product choice, not confirmed OpenAI hard limit |
| Other image-like / vector / photo formats in profile | `.heic`, `.heif`, `.svg` | Yes (via rename batch scoping) | No (currently not sent to Codex analyzer) | Deferred for semantics | `document-text` or format-specific analyzer (deferred) | Project implementation (`images` profile vs analyzer eligibility mismatch) | High | Present in `images` profile, but not in current Codex analyzer eligibility set |
| Video | `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.m4v` | Yes | No | Deferred | `video` (deferred) | OpenAI Codex model docs + project implementation | High | Current Codex model docs list video as not supported[^gpt5-codex][^codex-mini] |
| Audio | `.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg`, `.opus` | Yes | No | Deferred | `audio` (deferred) | OpenAI Codex model docs + project implementation | High | Current Codex model docs list audio as not supported[^gpt5-codex][^codex-mini] |
| Docs-like text files | `.md`, `.markdown`, `.txt`, `.json`, `.yaml`, `.toml`, `.xml`, `.html` | Yes | Yes (best-effort via `--codex-docs`) | Supported | `document-text` (current) | Project implementation (`src/cli/actions/rename.ts`, `src/adapters/codex/document-rename-titles.ts`) | High | Subject to file-size/readability checks; deterministic fallback on weak extraction/Codex failure |
| PDF documents | `.pdf` | Yes | Yes (best-effort via `--codex-docs`) | Supported (PDF-first) | `pdf-document` (current) | Project implementation (`pdfjs-dist` extractor path) | Medium-High | Uses metadata + outline + page-1 text; weak/scanned/no-text PDFs fall back with PDF-specific reasons |
| DOCX documents | `.docx` | Yes | Gated / experimental (`--codex-docs` + env opt-in) | Experimental (default disabled) | `document-word` (`mammoth`, gated) | Project implementation + completed extractor spike | Medium | Default reason `docx_experimental_disabled`; opt-in via `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` |
| Other binary office/docs | `.doc`, `.rtf`, `.odt` | Yes | No (today) | Deferred | `document-binary` / extractor-backed (deferred) | Project implementation + unresolved backend research | High (current behavior), Medium (future path) | Requires extractor/backend research before semantic naming |
| Hidden/system/config files | `.env`, `.gitignore`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `._*` | Batch: skipped by default | N/A | Protected by default | `none` (by default policy) | Project implementation + safety policy | High | Safer default; can consider opt-in inclusion later |

## What "No" Means in the Matrix

When the matrix says "No" for Codex semantic naming, it means one of these:

1. The current implementation does not attempt analysis for that file type.
2. The current implementation intentionally skips it for reliability (for example GIF).
3. The current Codex model docs indicate the modality is not supported (audio/video).

## How To Read `Evidence type` and `Confidence`

- `Evidence type` explains where the claim comes from:
  - OpenAI docs (model capability statement)
  - project implementation (current code behavior)
  - project policy (intentional product decision)
  - mixed (combination of the above)
- `Confidence` is about the statement in this guide, not future roadmap certainty.
  - `High`: directly visible in current code or official docs
  - `Medium`: current product policy or inference where platform behavior is not explicitly documented

## How To Read `Planned analyzer path`

- `static-image` means the current Codex-backed image-title analyzer path used in rename.
- `document-text` means a possible future analyzer path that extracts text/metadata first, then proposes a semantic stem.
- `video`, `audio`, `animated-image`, and `document-binary` are design placeholders for future capability discussions, not implemented analyzers.
- `none` means no semantic analyzer is planned by default for that category under current safety policy.

## Evidence Summary (Codex Model Support)

As of 2026-02-26, OpenAI model docs for Codex models used in this project show:

- `GPT-5-Codex`: `Audio` -> `Not supported`; `Video` -> `Not supported`[^gpt5-codex]
- `codex-mini-latest`: `Audio` -> `Not supported`; `Video` -> `Not supported`[^codex-mini]

These support the current project decision to defer audio/video semantic rename analysis for Codex-assisted rename.

## Current Implementation Notes (Project-Specific)

### Image analyzer adapter remains image-specific

`src/adapters/codex/image-rename-titles.ts`:

- builds an image-specific prompt
- attaches inputs as `local_image`
- returns normalized filename/title suggestions

### `--codex-docs` supports text-like docs and PDF (with DOCX gated)

`src/adapters/codex/document-rename-titles.ts` and `src/cli/actions/rename.ts`:

- extract text/metadata evidence for supported text-like docs
- extract PDF evidence via `pdfjs-dist` (`metadata`, `outline`, page-1 text)
- include `.docx` in doc analyzer candidate selection but gate semantic extraction behind `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`
- record subtype-specific reasons (for example `pdf_no_text`, `docx_experimental_disabled`)

### GIF is intentionally skipped for semantic naming

`src/cli/actions/rename.ts`:

- includes `.gif` in image candidates
- excludes `.gif` from static-image Codex eligibility
- records skip reason `codex_skipped_non_static`

### Hidden/system files are skipped by default in batch mode

`src/cli/actions/rename.ts` default exclusion logic skips:

- dot-prefixed entries (`.` prefix)
- AppleDouble (`._*`)
- known system noise entries (for example `Thumbs.db`, `desktop.ini`, `.DS_Store`)

## Practical Recommendations (Current UX)

- Use `--codex-images` only when you expect static image files to be in scope
- Use `--codex-docs` when working with text-like docs and PDFs; review dry-run CSV reasons for weak/no-text fallbacks
- Use `--dry-run` for mixed folders (`media`, `docs`) to review which files were analyzed vs deterministic fallback
- `docs` profile + `--codex-images` remains deterministic for doc files; use `--codex-docs` for document semantic naming
- Treat DOCX semantic rename as experimental (opt-in via env gate) until metadata/title-quality follow-up work lands

## Flag Combinations (Current Expected Outcomes)

The table below documents current behavior and the intended UX wording direction while the rename redesign is in progress.

| Example command shape | File selection outcome | Codex semantic outcome (today) | UX guidance |
| --- | --- | --- | --- |
| `rename batch --profile images --codex-images` | Image-profile files are included | Static raster images may be analyzed; GIF may be skipped; some profile formats (for example `.heic`, `.svg`) are not analyzed | Supported; recommend `--dry-run` |
| `rename batch --profile media --codex-images` | Images + video + audio profile files are included | Only supported static raster images are analyzed; video/audio remain deterministic | Show a note (not warning) that Codex semantic naming is limited to supported static images |
| `rename batch --profile docs --codex-images` | Docs profile files are included | No current Codex semantic analysis; deterministic rename only | Show a note (not warning) that no supported static images are in scope |
| `rename batch --profile docs --codex-docs` | Docs-profile files are included | Supported text-like docs + PDFs may be analyzed; DOCX is gated/experimental; unsupported docs remain deterministic | Supported; recommend `--dry-run` and review reasons |
| `rename batch --ext png --codex-images` | Only `.png` files are included | Eligible for current static-image analyzer (size/readability permitting) | Supported |
| `rename batch --ext gif --codex-images` | Only `.gif` files are included | GIFs are currently skipped for Codex semantics | Show a note with skip/fallback reason in preview/CSV |
| `rename file <path> --codex-images` where file is `.docx` | Single file selected | Deterministic rename only | Show a note (not warning) that file type is unsupported for current Codex semantic analyzer |
| `rename file <path> --codex-images` where file is `.png` | Single file selected | Eligible for current static-image analyzer (size/readability permitting) | Supported |
| `rename file <path> --codex-docs` where file is `.pdf` | Single file selected | Eligible for PDF doc analyzer (size/readability permitting) | Supported; fallback-safe on weak/no-text PDF |
| `rename file <path> --codex-docs` where file is `.docx` (default env) | Single file selected | Deterministic rename with DOCX gated note | Supported workflow; semantic DOCX is experimental and disabled by default |
| `rename file <path> --codex-docs` where file is `.docx` + `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` | Single file selected | DOCX analyzer path may run (best-effort, experimental) | Use `--dry-run`; expect fallback on weak extraction or Codex errors |

### `--profile docs --codex-images`: Note vs Warning (Current Decision)

Current documentation decision for the redesign:

- use a user-facing **note**, not a warning
- rationale:
  - command is still valid and useful (deterministic rename still works)
  - no unsafe behavior occurs
  - this is capability scoping, not an error condition

## Batch Selector Precedence (Current Behavior)

Current batch filtering behavior in `src/cli/actions/rename.ts` is:

1. default hidden/system exclusions apply first (dotfiles, `._*`, known noise files)
2. `--match-regex` acts as an include filter (must match if provided)
3. `--skip-regex` acts as an exclude filter (removed if matched)
4. `--profile` and `--ext` are combined as a union include set (not override)
5. `--skip-ext` excludes from that result

Important implication:

- `--profile docs --ext png` includes both docs-profile extensions and `.png` files (union behavior)

This should be preserved or changed only with explicit documentation and compatibility review.

## Planned Follow-up (Design Direction)

- Use explicit image-scoped flag naming (`--codex-images*`) for clarity in current CLI UX
- Add clearer analyzer eligibility/skip reporting in batch summaries
- Consider a future analyzer capability registry (static image + document analyzers first)
- Defer video/audio/animated-image semantic naming until separate research/plans are completed

## Related Plans

- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`

## Related Research

- `docs/researches/research-2026-02-26-rename-codex-analyzer-scope-and-file-type-support.md`

## References

- `src/cli/actions/rename.ts`
- `src/adapters/codex/image-rename-titles.ts`
- `src/adapters/codex/document-rename-titles.ts`
- `src/command.ts`
- `test/cli-actions-data-rename.test.ts`

[^gpt5-codex]: OpenAI API model docs for GPT-5-Codex (modalities section shows `Audio: Not supported`, `Video: Not supported`): https://platform.openai.com/docs/models/gpt-5-codex
[^codex-mini]: OpenAI API model docs for codex-mini-latest (modalities section shows `Audio: Not supported`, `Video: Not supported`): https://platform.openai.com/docs/models/codex-mini-latest
