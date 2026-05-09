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

## Default Font Check

- Profile init defaults remain generic: `serif` for body and `monospace` for code in [defaults.ts](../../../src/cli/markdown-pdf/profile/defaults.ts).
- Built-in recipe CSS still uses broad defaults: `Noto Serif` for article/report/reader body text, `Noto Sans` for wide-table/compact body text and headings, and `Noto Sans Mono` for code in [recipe.ts](../../../src/cli/markdown-pdf/recipe.ts).
- No runtime default font change was needed for this wording pass.

## Verification

- Checked Google Fonts specimen titles for `Noto Sans JP`, `Noto Serif JP`, `Noto Serif TC`, `Noto Serif SC`, and `Noto Serif KR`.
