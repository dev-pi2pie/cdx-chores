---
title: "Initial launch CLI foundation and basic commands"
created-date: 2026-02-25
modified-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement the initial launch CLI foundation for `cdx-chores` with a runnable command tree, interactive default mode, and a small set of basic commands that prove end-to-end behavior.

## Scope

- CLI scaffolding with `commander`
- no-args -> interactive mode
- shared action dispatch between flag mode and interactive mode
- `doctor` (lightweight scope: `pandoc`, `ffmpeg`, install guidance, `--json`)
- `data json-to-csv`
- `data csv-to-json`
- `md to-docx` via `pandoc`
- `rename batch` deterministic mode with `--dry-run`
- video command scaffolding and dependency-gated behavior

## Out of Scope

- Advanced PDF processing commands
- PDF backend selection/validation
- `pymupdf4llm` integration and doctor checks
- `.xlsx` / Excel-like workflows
- `docx -> pdf`
- Codex SDK usage/cost reporting

## Notes

- This job follows the lightweight launch plan and intentionally defers heavy backend decisions.
- Implementation should favor clear module separation (commands -> actions -> adapters/utilities) even if the first version is minimal.

## Implemented

- Root CLI command tree in `src/command.ts`
- No-args default to interactive mode (TTY-aware)
- Explicit `interactive` command
- `doctor` command with text and `--json` output for `pandoc`/`ffmpeg`
- `data json-to-csv`
- `data csv-to-json`
- `md to-docx` via `pandoc`
- `rename batch` with deterministic naming and `--dry-run`
- `batch-rename` alias
- `video convert`, `video resize`, `video gif` ffmpeg-backed wrappers
- Deferred placeholders for `docx to-pdf` and `pdf` subcommands
- `package.json` build script wiring for embedded version generation + `tsdown`

## Verification

Manual smoke tests executed successfully:

- `bun run src/bin.ts --help`
- `bun run src/bin.ts doctor --json`
- `bun run src/bin.ts data json-to-csv ...`
- `bun run src/bin.ts data csv-to-json ...`
- `bun run src/bin.ts md to-docx ...`
- `bun run src/bin.ts rename batch ... --dry-run`
- `bun run src/bin.ts video gif ...`

Build/typing notes:

- `bun run build` succeeded
- `bunx tsc --noEmit` still reports a pre-existing unrelated error in `src/markdown/types.ts` (`../wc/types` missing)
