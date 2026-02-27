---
title: "Rename Codex analyzer scope and file-type support research"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Clarify what the current `rename` action supports today versus what the Codex-assisted title generation path actually analyzes, especially for non-static images (for example GIF), video, and document formats (for example DOCX/PDF).

## Milestone Goal

Establish a design direction for extending rename-time semantic title suggestions beyond static images without weakening the current deterministic rename behavior.

## Key Findings

### 1. `rename` works on many file extensions, but Codex assistance does not

The rename workflow itself is not image-only.

- `rename batch` supports broad file filtering via `--profile`, `--ext`, and `--skip-ext` in `src/cli/actions/rename.ts`.
- Profiles already include non-image formats such as video/audio (`media`) and documents (`docs`).
- Files outside Codex support are still renamed using the normal deterministic rename flow (timestamp/prefix/original stem-based logic).

Implication: "rename works" and "Codex analyzes file content" are separate capabilities in the current design.

### 2. Codex title suggestions are currently static-image-only by implementation

Codex-assisted rename is implemented through `src/adapters/codex/image-rename-titles.ts`, which:

- builds an image-specific prompt ("Generate concise semantic titles for these image files")
- sends inputs as `local_image`
- returns structured filename/title suggestions only for those image inputs

Evidence checked on 2026-02-26:

- OpenAI Codex model pages for `gpt-5-codex` and `codex-mini-latest` currently list modalities as `Text, image` (not video).[^gpt5-codex-model][^codex-mini-model]
- The installed `@openai/codex-sdk` README documents "Attaching images" using `local_image` examples and does not document a `local_video` input entry in the README surface used by this project.[^codex-sdk-readme-local]

There is no current Codex adapter for:

- video files (for example `.mp4`, `.mov`, `.webm`)
- animated GIF frame sampling
- document files (for example `.docx`, `.pdf`, `.txt`)
- audio files

Implication: based on current OpenAI Codex model docs plus the SDK usage pattern in this repo, this CLI rename path should be treated as image-only unless/until OpenAI documents video support for the Codex model/tooling path we use.

### 3. GIF is intentionally excluded from Codex analysis (but still renamed)

`src/cli/actions/rename.ts` explicitly treats GIF as an image candidate, then skips it for Codex analysis:

- `.gif` is included in `IMAGE_EXTENSIONS`
- `.gif` is excluded from `CODEX_STATIC_IMAGE_EXTENSIONS`
- skip reason recorded: `codex_skipped_non_static`

This is also covered by tests in `test/cli-actions-data-rename.test.ts`.

The OpenAI docs evidence above supports the "no video" conclusion. It does **not** explicitly document animated GIF handling semantics for Codex image inputs (for example, whether animation frames are interpreted or only a still image path is accepted). Our current GIF skip is therefore a product decision for reliability, not a confirmed OpenAI hard limitation.[^gpt5-codex-model][^codex-mini-model][^codex-sdk-readme-local]

Implication: current behavior is intentionally conservative for animated media to avoid unreliable static-image interpretation.

### 4. Some "image profile" extensions are not eligible for Codex analysis today

The `images` profile includes `.heic`, `.heif`, and `.svg`, but Codex selection logic currently only considers the `IMAGE_EXTENSIONS` set used for `local_image` submission.

Current Codex-eligible set in `src/cli/actions/rename.ts`:

- `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.tif`, `.tiff`, `.avif`

Additional runtime filtering then excludes:

- `.gif` (non-static rule)
- files larger than 20 MiB (`CODEX_MAX_IMAGE_BYTES`)
- unreadable/non-file paths

Implication: profile membership and Codex analyzability are not the same thing; users can reasonably be confused if they enable `--profile images --codex-images`.

### 5. Documents (including DOCX) currently receive no content-based Codex title analysis in rename

For `.docx`, `.pdf`, `.txt`, and similar formats in the `docs` profile:

- rename planning still works
- Codex title suggestion selection ignores them completely (not in `IMAGE_EXTENSIONS`)
- the rename result falls back to deterministic naming based on existing filename stem + timestamp/prefix pipeline

Implication: "Codex analytics on docs" is currently unsupported in rename, not just untested.

## Implications or Recommendations

### A. Make analyzer scope explicit in the rename architecture

Introduce a capability-oriented analyzer layer instead of embedding image-specific selection logic directly in `src/cli/actions/rename.ts`.

Recommended conceptual split:

- `rename planner` (deterministic, extension-agnostic)
- `rename analyzers` (optional semantic title enhancers by file type)
- `rename title resolver` (chooses analyzer result vs fallback)

This keeps rename usable for all files while making AI support boundaries explicit and testable.

### B. Define a file-type analyzer capability registry

Add a small registry (for rename only at first) that maps extensions to analyzer strategies and eligibility checks.

Example strategy categories:

- `static-image` (current path)
- `animated-image` (GIF/WebP animation frame sampling)
- `video` (sample frame extraction + image analysis)
- `document-text` (extract text/metadata, then title suggestion)
- `document-binary-unsupported` (fallback-only)
- `none` (deterministic rename only)

Benefits:

- one source of truth for user messaging and skip reasons
- easier to expose accurate counts by category
- clearer path for incremental rollout of experimental analyzers

### C. Promote current image adapter naming to match actual scope

Current adapter name is accurate enough internally, but future expansion will benefit from stricter naming.

Suggested future naming direction:

- keep current implementation as `static-image` analyzer
- add a generic rename analyzer interface (for example `rename-title-suggester`)
- move image-specific prompt/parse logic behind that interface

This avoids overloading "Codex rename" as if it already supports all file types.

### D. Add experimental preprocessors before asking Codex to analyze non-static/binary formats

For non-static media and documents, Codex title quality will depend on preprocessing.

Recommended preprocessing paths (incremental):

- GIF/video: extract 1..N representative frames and analyze frames as images
- DOCX: extract plain text + document metadata (title/heading if available), then ask for a filename title
- PDF: extract metadata and first-page text before considering page images
- Audio: defer unless transcript pipeline exists

Design rule: analyzers should produce normalized text evidence first, then ask Codex for a concise rename title.

### E. Improve user-facing reporting for mixed file batches

Current output reports only "Codex image titles".

For future extensibility, report by analyzer category and skip reason, for example:

- `Codex analyzers: static-image 12/15 suggested`
- `Skipped: animated-image unsupported (3), too-large (2), unreadable (1)`
- `Docs analyzed: 0/8 (feature disabled)`

This will reduce confusion when `--profile media` or `--profile docs` is used with `--codex-images`.

### F. Add explicit feature gating for non-image analyzers

When introducing doc/video analyzers, ship them behind opt-in flags first (for example `--codex-docs`, `--codex-video`) to avoid surprising behavior, performance regressions, or fragile dependencies.

The deterministic rename path should remain the default fallback for all unsupported or failed analyzer cases.

## Open Questions

1. Should DOCX/PDF rename analysis be implemented via internal extractors, external tools (`pandoc`, Python), or both behind capability checks?
2. For video/GIF rename analysis, what frame sampling policy is acceptable for latency/cost (single middle frame vs multi-frame)?
3. Should `.svg` be treated as a document-text/vector analyzer path instead of an image path for rename semantics?
4. How should analyzer confidence be represented in plan CSV rows (for example extra columns vs reason codes only)?

## Related Plans

- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## References

- `src/cli/actions/rename.ts`
- `src/adapters/codex/image-rename-titles.ts`
- `src/command.ts`
- `test/cli-actions-data-rename.test.ts`
- `docs/guides/cli-action-tool-integration-guide.md`

[^gpt5-codex-model]: OpenAI model docs, `gpt-5-codex` (modalities listed as `Text, image`): https://platform.openai.com/docs/models/gpt-5-codex
[^codex-mini-model]: OpenAI model docs, `codex-mini-latest` (modalities listed as `Text, image`): https://platform.openai.com/docs/models/codex-mini-latest
[^codex-sdk-readme-local]: Installed package documentation in this repo, `node_modules/@openai/codex-sdk/README.md` ("Attaching images" section with `local_image` examples)
