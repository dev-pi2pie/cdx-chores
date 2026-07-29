---
title: "Assess upgrade risk for @inquirer/prompts and mammoth"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Assess the upstream changes between the currently installed versions and the latest available versions of `@inquirer/prompts` and `mammoth`, then evaluate likely impact on this repository.

## Key Findings

### `@inquirer/prompts` `8.3.0 -> 8.3.2`

- The `8.3.1` release note only reports a dependency bump.[^inquirer-831]
- The `8.3.2` release note only reports a fix for a broken `8.3.1` release process.[^inquirer-832]
- The user-facing prompt behavior changes called out in `8.3.0` were:
  - ignore keypresses received before prompt render
  - always include disabled-and-checked checkbox items
  - allow the cursor to hover disabled `select` and `checkbox` options
  - add new theming and localization options[^inquirer-830]
- This repository imports `@inquirer/prompts` across most interactive CLI flows, including data query, rename, rename cleanup, markdown, and video entrypoints in `src/cli/interactive/` and `src/cli/prompts/`.
- Interactive tests mock the module in `test/helpers/interactive-harness.ts`, so full real-terminal behavior is not comprehensively covered by automated tests.

### `mammoth` `1.11.0 -> 1.12.0`

- `mammoth` `1.12.0` adds two document parsing fixes:
  - handle hyperlinked `wp:anchor` and `wp:inline` elements
  - handle hyperlink complex fields with unquoted hrefs[^mammoth-news]
- The tag compare from `1.11.0` to `1.12.0` is small: 6 commits, 4 files changed, 1 contributor.[^mammoth-compare]
- The commit-level change focuses on `lib/docx/body-reader.js`, specifically expanding `HYPERLINK` field parsing to accept quoted and unquoted targets and adding tests for those cases.[^mammoth-unquoted][^mammoth-simplify]
- `mammoth` `1.11.0` had already changed security posture by disabling external file access by default, with opt-in via `externalFileAccess`.[^mammoth-111-security]
- This repository uses `mammoth.convertToHtml()` and `mammoth.extractRawText()` for DOCX evidence extraction in `src/adapters/codex/document-rename-titles.ts`, and in a spike script at `scripts/spikes/docx-pdf-title-evidence-spike.ts`.
- The main production path reads DOCX data from a buffer and does not pass `externalFileAccess`, so it keeps the safer default behavior from `1.11.0`.

## Implications or Recommendations

### Recommendation

- Upgrading `@inquirer/prompts` from `8.3.0` to `8.3.2` looks low risk.
- Upgrading `mammoth` from `1.11.0` to `1.12.0` also looks low risk, with a likely upside for edge-case DOCX hyperlink parsing.

### Likely Repo Impact

- `@inquirer/prompts`
  - Most likely impact is no user-visible change in this repo beyond whatever transitive dependency refresh landed in `8.3.1`.
  - Residual risk is in real TTY rendering, cursor movement, or prompt UX behavior that mocked tests may not catch.
- `mammoth`
  - Most likely impact is improved handling of unusual DOCX hyperlink encodings.
  - Since title extraction strips HTML tags from headings and also reads raw text, additional hyperlink wrappers should have limited impact on extracted title candidates.
  - Residual risk is limited to DOCX files with unusual hyperlink field syntax where output HTML structure or extracted text could shift slightly.

### Suggested Verification

- Run `bun run build`.
- Run interactive smoke checks for one or two prompt-heavy flows, especially rename cleanup and data query.
- Run one DOCX title extraction smoke test using a document that contains hyperlinks, ideally including Word-authored hyperlinks.

## References

[^inquirer-830]: GitHub release: `@inquirer/prompts@8.3.0` (<https://github.com/SBoudrias/Inquirer.js/releases/tag/%40inquirer%2Fprompts%408.3.0>)
[^inquirer-831]: GitHub release: `@inquirer/prompts@8.3.1` (<https://github.com/SBoudrias/Inquirer.js/releases/tag/%40inquirer%2Fprompts%408.3.1>)
[^inquirer-832]: GitHub release: `@inquirer/prompts@8.3.2` (<https://github.com/SBoudrias/Inquirer.js/releases/tag/%40inquirer%2Fprompts%408.3.2>)
[^mammoth-news]: Mammoth `NEWS` at `1.12.0` tag (<https://raw.githubusercontent.com/mwilliamson/mammoth.js/1.12.0/NEWS>)
[^mammoth-compare]: GitHub compare: `1.11.0...1.12.0` (<https://github.com/mwilliamson/mammoth.js/compare/1.11.0...1.12.0>)
[^mammoth-unquoted]: Commit `6cfbe0b` (<https://github.com/mwilliamson/mammoth.js/commit/6cfbe0b>)
[^mammoth-simplify]: Commit `04ac1b9` (<https://github.com/mwilliamson/mammoth.js/commit/04ac1b9>)
[^mammoth-111-security]: Commit `c54aaeb43a7941317c1f3c119ffa92090f988820` (<https://github.com/mwilliamson/mammoth.js/commit/c54aaeb43a7941317c1f3c119ffa92090f988820>)
