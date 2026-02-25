---
title: "CLI UX tweaks for version alias and path display"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Apply small CLI UX improvements after the initial launch foundation:

- prefer `-v` for version output while keeping `-V` as a compatibility alias
- display relative result paths by default
- add `--absolute` / `--abs` to opt into absolute path output
- improve interactive optional-output prompts with derived default path hints

## Implemented

- Root version help output now uses `-v, --version` in `src/command.ts`
- Backward-compatible `-V` alias is preserved via argument normalization in `src/command.ts`
- Added `--absolute` and `--abs` CLI aliases (documented in help output)
- Added CLI argument normalization so `--absolute` / `--abs` works in any position (including after subcommands)
- Added `displayPathStyle` to CLI runtime types in `src/cli/types.ts`
- Added shared path formatter (`formatPathForDisplay`) in `src/cli/fs-utils.ts`
- Updated action output messages in `src/cli/actions.ts` to use relative paths by default (no `./` prefix for current-directory files)
- Added derived output-path hints in interactive mode for optional-output commands in `src/cli/interactive.ts`:
  - `data json-to-csv`
  - `data csv-to-json`
  - `md to-docx`
  - `video gif`

## Verification

Manual checks executed successfully:

- `bun src/bin.ts -v`
- `bun src/bin.ts -V`
- `bun src/bin.ts --help` (confirmed `-v, --version` and `--absolute, --abs`)
- `bun src/bin.ts data json-to-csv -i .tmp-codex/sample.json --overwrite`
  - output path displayed as relative
- `bun src/bin.ts data json-to-csv -i .tmp-codex/sample.json --overwrite --abs`
  - output path displayed as absolute

Typing/build notes:

- `bunx tsc --noEmit` still fails due to a pre-existing unrelated error in `src/markdown/types.ts` referencing `../wc/types`

