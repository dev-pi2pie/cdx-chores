---
title: "Rename Scope and Codex Capability Guide"
created-date: 2026-02-26
modified-date: 2026-09-05
status: completed
agent: codex
---

## Goal

Clarify the difference between:

- deterministic rename support (planner/apply)
- Codex semantic analyzer support (`--codex-images`, `--codex-docs`)

## Core Rule

Rename support and Codex semantic support are separate layers:

- `rename` can process broad file sets.
- CLI `rename cleanup` remains deterministic by default.
- interactive `rename cleanup` can now optionally ask Codex for filename-only cleanup suggestions before deterministic cleanup runs.
- cleanup conflict handling is also deterministic today; `skip`, `number`, and `uid-suffix` are planner-side strategies, not analyzer behavior.
- Codex analyzers only run for eligible file types.
- Unsupported or weak semantic cases safely fall back to deterministic rename.

## Compact Capability Matrix

| Category                                                                                  | Deterministic rename        | Codex semantic support | Notes                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Static raster images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tif`, `.tiff`, `.avif`) | Yes                         | `--codex-images`       | Best-effort; fallback-safe                                                   |
| GIF (`.gif`)                                                                              | Yes                         | No (currently skipped) | Recorded as non-static skip                                                  |
| Text-like docs (`.md`, `.txt`, `.json`, `.yaml`, `.toml`, `.xml`, `.html`)                | Yes                         | `--codex-docs`         | Best-effort; fallback-safe                                                   |
| PDF (`.pdf`)                                                                              | Yes                         | `--codex-docs`         | PDF metadata/outline/page-text extraction                                    |
| DOCX (`.docx`)                                                                            | Yes                         | `--codex-docs`         | Best-effort; fallback-safe                                                   |
| Video/Audio (`.mp4`, `.mov`, `.mp3`, `.wav`, etc.)                                        | Yes                         | No                     | Current Codex docs list audio/video as unsupported[^gpt5-codex][^codex-mini] |
| Hidden/system files (`.DS_Store`, `Thumbs.db`, `._*`, dotfiles)                           | Skipped by default in batch | N/A                    | Safety default                                                               |

DOCX legacy note:

- Older `v0.0.7` usage guidance required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1` to opt into DOCX semantic titles.
- Current releases no longer require that env var; DOCX semantic titles now participate by default under `--codex-docs`.
- That older env-gated usage remains deprecated history only.

## Pattern/Template Coverage

`rename` supports template-driven naming through `--pattern`, for example
`--pattern '{date}-{stem}-{serial}'`.

Use [Rename Common Usage](rename-common-usage.md) for the complete token and
serial contract and
[Rename Timestamp Format Matrix](rename-timestamp-format-matrix.md) for exact
date and timestamp variants. The cross-feature
[Patterns, Placeholders, and Templates](patterns-placeholders-and-templates.md)
guide distinguishes rename filename templates from selection patterns and
document templates.

Template boundary note:

- `{uid}` is part of the current `rename` template placeholder contract.
- `rename cleanup` uses the same deterministic `uid-<token>` family for cleanup matching and conflict suffixing.
- `rename cleanup --style` currently formats surviving text only (`preserve` / `slug`); it is not a conflict-policy or whole-basename replacement axis.
- `rename cleanup --conflict-strategy` currently owns cleanup collision handling (`skip`, `number`, `uid-suffix`).

## Interactive Smart Router

Interactive rename asks once for Codex enablement, then a scope selector:

- `auto`
- `images`
- `docs`

Interactive rename also keeps pattern-related prompts conditional:

- `Filename prefix` is asked only when the chosen template includes `{prefix}`
- serial settings are asked only when the chosen template includes `{serial...}`

`auto` uses effective scope:

- batch: profile/extensions
- single file: target extension

Mixed docs+images in `auto` enables both analyzers.

## CLI Flag Contract

CLI uses `--codex` as the common smart-routing flag:

- `--codex` => auto-route eligible files by file type
- `--codex-images` => use only the image analyzer
- `--codex-docs` => use only the document analyzer

Precedence rules:

- `--codex` alone => auto
- `--codex --codex-images` => image analyzer only
- `--codex --codex-docs` => document analyzer only
- `--codex-images --codex-docs` => both explicit
- explicit analyzer flags win when combined with `--codex`

Important:

- these flags affect analyzer routing, not file-selection scope
- unsupported files still use deterministic rename behavior

## Timeout and Analyzer Routing

Model, provider, and reasoning selection is also separate from analyzer routing.
`rename file`, `rename batch`, and `batch-rename` accept the shared execution
options; one selection is used by both enabled analyzers across batches and
retries. See [Codex Execution Configuration](codex-execution-configuration.md)
for these options and their defaults.

Timeout selection is separate from analyzer routing. A timeout flag changes the
per-attempt limit only for an analyzer that `--codex`, `--codex-images`, or
`--codex-docs` already enables; it does not enable Codex analysis by itself.

For each enabled analyzer, rename resolves the effective value in this order:

| Analyzer | Timeout precedence                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Image    | `--codex-images-timeout` -> deprecated `--codex-images-timeout-ms` -> `--codex-timeout` -> built-in default |
| Document | `--codex-docs-timeout` -> deprecated `--codex-docs-timeout-ms` -> `--codex-timeout` -> built-in default     |

A shared and scoped duration may be combined. For example, this gives image
requests the shared value and document requests the scoped override:

```bash
cdx-chores rename batch ./mixed-folder \
  --codex \
  --codex-timeout 30s \
  --codex-docs-timeout 2m \
  --dry-run
```

Do not combine a current scoped duration with its legacy millisecond form for
the same analyzer; the command rejects that ambiguous pairing. The legacy
forms remain compatibility inputs and print migration guidance when used.

Rename retry counts remain analyzer-specific. Each retry is an additional
attempt for one batch, and every attempt receives that analyzer's effective
timeout. With sequential batches, the approximate request-time multiplier is
`batch count x (retries + 1) x per-attempt timeout`, plus retry delays and local
processing.

See
[Codex Timeouts, Retries, and Recovery](codex-timeouts-retries-and-recovery.md)
for the shared duration contract, legacy transition, and comparison with
workflow-owned repair or user-triggered regeneration.

## Command Outcome Reference

| Command shape                                  | Semantic behavior                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `rename batch --codex`                         | Auto-routes eligible files to image/doc analyzers by file type                                         |
| `rename file <file> --codex`                   | Auto-routes from the selected file extension                                                           |
| `rename cleanup <path> --hint ...`             | Deterministic cleanup in CLI; interactive cleanup also has an opt-in filename analyzer suggestion step |
| `rename batch --profile images --codex-images` | Eligible static images analyzed; others fallback                                                       |
| `rename batch --profile docs --codex-docs`     | Eligible docs/PDF analyzed; others fallback                                                            |
| `rename batch --profile docs --codex-images`   | No image semantic analysis expected                                                                    |
| `rename batch --profile media --codex-images`  | Only eligible static images analyzed                                                                   |
| `rename file <file> --codex-images`            | Depends on file extension eligibility                                                                  |
| `rename file <file> --codex-docs`              | Depends on doc/PDF/DOCX eligibility                                                                    |

## Related Guides

- `docs/guides/codex-timeouts-retries-and-recovery.md`
- `docs/guides/rename-timestamp-format-matrix.md`
- `docs/guides/rename-common-usage.md`
- `README.md`

## References

- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/codex/`
- `src/cli/actions/rename/filters.ts`
- `src/cli/interactive.ts`
- `src/cli/fs-utils.ts`
- `src/adapters/codex/image-rename-titles.ts`
- `src/adapters/codex/document-rename-titles.ts`

[^gpt5-codex]: OpenAI model docs (GPT-5-Codex): audio/video not supported: https://platform.openai.com/docs/models/gpt-5-codex

[^codex-mini]: OpenAI model docs (codex-mini-latest): audio/video not supported: https://platform.openai.com/docs/models/codex-mini-latest
