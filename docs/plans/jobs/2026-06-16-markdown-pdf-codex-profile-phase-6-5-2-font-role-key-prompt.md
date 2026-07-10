---
title: "Markdown PDF Codex profile Phase 6.5.2 font role-key prompt"
created-date: 2026-06-16
status: completed
agent: codex
plan: ../plan-2026-06-15-markdown-pdf-codex-profile-helper.md
---

## Scope

Complete Phase 6.5.2 of the Markdown PDF Codex profile helper by making the
dedicated font patch prompt contract match the runtime role/key validator.

## Failure Cause

A live CJK font smoke replay returned a Codex decision with a language-keyed
`heading` font patch. The runtime contract correctly rejected it with:

```text
Markdown PDF Codex response accepted_font_patches[4].key must be default for heading fonts.
```

This was a prompt-contract gap. The strict output schema can require
`accepted_font_patches`, but the local validator still owns conditional
role/key rules. Codex needed those rules stated explicitly in the prompt facts.

## Fix

- Added an explicit `accepted_font_patches` role/key matrix to the Codex prompt:
  - `body`: `default` or language tags such as `ja` and `zh-Hant`
  - `code`: `default` or `symbols`
  - `heading`: `default`
  - `pageChrome`: `default`
- Added prompt rules that route language-specific CJK body font requests to
  `body` language keys instead of `heading` or `pageChrome`.
- Added prompt rules that route readable code-symbol requests to `code.symbols`.
- Expanded valid prompt examples to cover English body, Japanese body,
  Traditional Chinese body, code, and symbols.
- Kept the runtime validator unchanged.
- Added regression coverage for the prompt matrix and the exact heading plus
  page-chrome language-key rejection cases.

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts`
  - 19 pass, 0 fail
- `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 38 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `bun run build`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun test`
  - 1185 pass, 0 fail

## Smoke

- Live `md pdf-profile codex` smoke was run with an ignored local CJK Markdown
  sample, mixed-language intent, multilingual font hint, explicit profile
  output, explicit Codex report output, and overwrite enabled.
- Codex returned an applicable profile decision:
  - decision mode: `adapted`
  - selected base: `article`
  - accepted font patches:
    - `body.default` -> `Source Serif 4`
    - `body.ja` -> `Noto Serif JP`
    - `body.zh-Hant` -> `Noto Serif TC`
    - `code.default` -> `JetBrains Mono`
    - `code.symbols` -> `Noto Sans Symbols 2`
  - warnings: none
  - unmatched directions: none
- The generated profile was passed to the real `md to-pdf` path and accepted by
  profile parsing and normalization without font-patch validation errors.
- Full PDF rendering could not complete in this environment because the local
  `weasyprint` command and Python module are not installed. The command stopped
  at the documented external dependency boundary:

```text
Missing required dependency: weasyprint. Install suggestion: brew install weasyprint
```

## Artifact Safety

- Smoke profile, Codex report, and attempted PDF outputs were written to scratch
  paths outside the repository.
- Scratch smoke artifacts were removed before commit.
- `git status --short --untracked-files=all` after cleanup showed only source,
  test, plan, and job-record changes.
- No generated Markdown PDF profile, Codex report, PDF, local resource, or replay
  artifact was staged or committed.

## Review

The phase-range code review is performed after the commit that includes this job
record, so the review result is recorded in the thread closeout rather than in a
second recursive job-record update.
