---
title: "Rename Scope and Codex Capability Guide"
created-date: 2026-02-26
modified-date: 2026-03-03
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
- `rename cleanup` is deterministic only in v1 and does not use Codex analyzers.
- Codex analyzers only run for eligible file types.
- Unsupported or weak semantic cases safely fall back to deterministic rename.

## Compact Capability Matrix

| Category                                                                                  | Deterministic rename        | Codex semantic support   | Notes                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| Static raster images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tif`, `.tiff`, `.avif`) | Yes                         | `--codex-images`         | Best-effort; fallback-safe                                                   |
| GIF (`.gif`)                                                                              | Yes                         | No (currently skipped)   | Recorded as non-static skip                                                  |
| Text-like docs (`.md`, `.txt`, `.json`, `.yaml`, `.toml`, `.xml`, `.html`)                | Yes                         | `--codex-docs`           | Best-effort; fallback-safe                                                   |
| PDF (`.pdf`)                                                                              | Yes                         | `--codex-docs`           | PDF metadata/outline/page-text extraction                                    |
| DOCX (`.docx`)                                                                            | Yes                         | Experimental (env-gated) | Requires `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`                         |
| Video/Audio (`.mp4`, `.mov`, `.mp3`, `.wav`, etc.)                                        | Yes                         | No                       | Current Codex docs list audio/video as unsupported[^gpt5-codex][^codex-mini] |
| Hidden/system files (`.DS_Store`, `Thumbs.db`, `._*`, dotfiles)                           | Skipped by default in batch | N/A                      | Safety default                                                               |

## Pattern/Template Coverage

`rename` supports template-driven naming through `--pattern`.

Supported placeholders:

- `{prefix}` (nullable)
- `{timestamp}` (UTC, backward-compatible alias)
- `{timestamp_local}` (local time, explicit)
- `{timestamp_utc}` (UTC, explicit)
- `{timestamp_local_iso}` (local ISO-like timestamp with numeric offset)
- `{timestamp_utc_iso}` (UTC ISO-like timestamp with `Z`)
- `{timestamp_local_12h}` (local compact `12hr` timestamp)
- `{timestamp_utc_12h}` (UTC compact `12hr` timestamp)
- `{date}`
- `{date_local}`
- `{date_utc}`
- `{stem}`
- `{serial...}`

Timestamp notes:

- `{timestamp}` defaults to UTC for backward compatibility.
- Use `{timestamp_local}` or `{timestamp_utc}` for explicit timezone control.
- Route A also supports explicit format variants:
  - `{timestamp_local_iso}`
  - `{timestamp_utc_iso}`
  - `{timestamp_local_12h}`
  - `{timestamp_utc_12h}`
- Local ISO output uses a numeric offset such as `+0800`.
- `Z` remains UTC-only.
- `--timestamp-timezone local|utc` overrides only `{timestamp}`; explicit placeholders are never rewritten.
- Use `docs/guides/rename-timestamp-format-matrix.md` for the full placeholder matrix and examples.

Serial token notes:

- `--prefix` is optional in CLI mode and interactive mode
- canonical style: `{serial_###_start_1_order_mtime_asc}`
- marker order is flexible in input and normalized internally
- only one `{serial...}` placeholder is allowed per template
- order values: `path_asc`, `path_desc`, `mtime_asc`, `mtime_desc`
- precedence is: explicit `--serial-*` flag override, then embedded `{serial...}` token value, then built-in default
- example: `--pattern '{stem}-{serial_start_3}'` starts at `3`, but adding `--serial-start 10` overrides it to `10`
- if the template does not include `{serial...}`, the serial flags have no effect
- default serial scope is one global sequence across all matched files
- use `--serial-scope directory` together with `--recursive` to restart numbering in each directory
- interactive serial prompts appear only when the selected template includes `{serial...}`
- interactive serial width uses digit count input such as `2` or `4`, not `#`

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

## Command Outcome Reference

| Command shape                                  | Semantic behavior                                              |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `rename batch --codex`                         | Auto-routes eligible files to image/doc analyzers by file type |
| `rename file <file> --codex`                   | Auto-routes from the selected file extension                   |
| `rename cleanup <path> --hint ...`             | Deterministic cleanup only; no Codex semantic analyzer path    |
| `rename batch --profile images --codex-images` | Eligible static images analyzed; others fallback               |
| `rename batch --profile docs --codex-docs`     | Eligible docs/PDF analyzed; others fallback                    |
| `rename batch --profile docs --codex-images`   | No image semantic analysis expected                            |
| `rename batch --profile media --codex-images`  | Only eligible static images analyzed                           |
| `rename file <file> --codex-images`            | Depends on file extension eligibility                          |
| `rename file <file> --codex-docs`              | Depends on doc/PDF/DOCX eligibility                            |

## Related Guides

- `docs/guides/rename-timestamp-format-matrix.md`
- `docs/guides/rename-common-usage.md`
- `README.md`

## References

- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/codex.ts`
- `src/cli/actions/rename/filters.ts`
- `src/cli/interactive.ts`
- `src/cli/fs-utils.ts`
- `src/adapters/codex/image-rename-titles.ts`
- `src/adapters/codex/document-rename-titles.ts`

[^gpt5-codex]: OpenAI model docs (GPT-5-Codex): audio/video not supported: https://platform.openai.com/docs/models/gpt-5-codex

[^codex-mini]: OpenAI model docs (codex-mini-latest): audio/video not supported: https://platform.openai.com/docs/models/codex-mini-latest
