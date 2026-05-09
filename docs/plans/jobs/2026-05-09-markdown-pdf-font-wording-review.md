---
title: "Markdown PDF Font Wording Review"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Review the Markdown PDF usage guide font wording after checking Google Fonts specimen naming and the current default Markdown PDF font settings.

## Changes

- Updated [Markdown PDF Usage](../../guides/markdown-pdf-usage.md) to use Google Fonts-style CJK family examples such as `Noto Serif JP`, `Noto Serif TC`, and `Noto Sans JP` instead of implying that Google Fonts specimen names include `CJK`.
- Added a note distinguishing Google Fonts display names such as `Noto Sans Japanese` from CSS/local family names such as `Noto Sans JP`.
- Kept the guide explicit that local OS font packages may still expose `CJK` family names and that profiles should use the exact family discovered locally.
- Aligned Markdown PDF profile/recipe tests and generic `font inspect` matching/output tests with the short CSS family examples (`Noto Serif TC`, `Noto Serif JP`, `Noto Sans TC`), while leaving local discovery fixtures that intentionally simulate OS-reported `CJK` package names.

## Default Font Check

- Profile init defaults remain generic: `serif` for body and `monospace` for code in [defaults.ts](../../../src/cli/markdown-pdf/profile/defaults.ts).
- Built-in recipe CSS still uses broad defaults: `Noto Serif` for article/report/reader body text, `Noto Sans` for wide-table/compact body text and headings, and `Noto Sans Mono` for code in [recipe.ts](../../../src/cli/markdown-pdf/recipe.ts).
- No runtime default font change was needed for this wording pass.

## Verification

- Checked Google Fonts specimen titles for `Noto Sans JP`, `Noto Serif JP`, `Noto Serif TC`, `Noto Serif SC`, and `Noto Serif KR`.
- `rg -n "Noto Sans CJK|Noto Serif CJK|noto\s+sans\s+cjk|noto\s+serif\s+cjk|CJK TC|CJK SC|CJK JP|CJK KR" test` was reviewed; remaining test hits are local discovery/list/coverage fixtures, not user-facing profile examples.
- `bun test test/fonts-cli-inspect-matching.test.ts test/fonts-cli-inspect-output.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts test/cli-actions-md-to-pdf-recipe-fonts.test.ts test/cli-actions-md-to-pdf-profile.test.ts` passed with `19` passing tests and `0` failures.
