---
title: "Markdown PDF Codex profile Phase 6.5.3 title block deduplication"
created-date: 2026-06-16
status: completed
agent: codex
plan: ../plan-2026-06-15-markdown-pdf-codex-profile-helper.md
---

## Scope

Complete Phase 6.5.3 of the Markdown PDF Codex profile helper by adding a
renderer-owned profile contract for metadata title-block deduplication.

## Issue

A CJK Markdown PDF smoke case had both frontmatter `title` and a first Markdown
H1 with the same normalized text. The default Pandoc template rendered the
frontmatter title block, and the Markdown body still rendered the H1, producing
two visible document titles.

Phase 6.5.1 gave Codex bounded title signals and prompt guidance to avoid extra
cover/title chrome, but the renderer had no supported profile field that could
control the built-in metadata title block. Stronger hints could reduce bad cover
choices, but they could not reliably fix the renderer-level duplicate.

## Fix

- Added `titleBlock.metadataTitle: auto | show | hide` to the Markdown PDF
  profile contract.
- Made `auto` the normalized default.
- Added schema and normalization validation for `profile.titleBlock`.
- Reused bounded title signal detection in the direct `md to-pdf` render path.
- Updated recipe/template generation:
  - `auto` suppresses the metadata title block only when frontmatter title and
    first H1 normalize to the same text.
  - `show` preserves the metadata title block.
  - `hide` suppresses the metadata title block.
- Added `/titleBlock/metadataTitle` to the Codex accepted patch path enum,
  materializable parent list, strict output schema, and patch value domains.
- Updated the Codex prompt so duplicate-title risk is handled with the supported
  title-block profile field instead of unsupported title-suppression fields or
  Markdown/frontmatter rewrites.
- Added regression coverage for normalization, template output, direct
  `md to-pdf --profile` behavior, Codex prompt facts, Codex patch application,
  and Codex action report/profile output.
- Added regression coverage that Pandoc-style heading attributes are ignored
  when comparing frontmatter title to the visible first H1 text.

## Evidence

- `bun test test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-recipe.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts`
  - 36 pass, 0 fail
- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 58 pass, 0 fail
- `bun test test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
  - 34 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `bun run build`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun test`
  - 1194 pass, 0 fail

## Smoke

- Live `md pdf-profile codex` smoke was run with an ignored local CJK Markdown
  sample, mixed-language intent, no-duplicate-title intent, multilingual font
  hint, explicit profile output, explicit Codex report output, and overwrite
  enabled.
- The first live attempt inside the sandbox reached the helper but failed at the
  Codex app-server initialization boundary.
- The same smoke succeeded outside the sandbox.
- Codex returned an applicable profile decision:
  - decision mode: `adapted`
  - selected base: `article`
  - accepted patch: `/titleBlock/metadataTitle` -> `auto`
  - accepted patch: `/pdf/content-langs` -> `en`, `ja`, `zh-Hant`
  - accepted patch: `/code/highlight` -> `true`
  - accepted font patches:
    - `body.default` -> `Source Serif 4`
    - `body.ja` -> `Noto Serif JP`
    - `body.zh-Hant` -> `Noto Serif TC`
    - `code.default` -> `JetBrains Mono`
    - `code.symbols` -> `Noto Sans Symbols 2`
  - warnings: none
  - unmatched directions: none
- The generated profile was passed to the real `md to-pdf` path and accepted by
  profile parsing and normalization.
- Full PDF rendering could not complete in this environment because the local
  `weasyprint` command is not installed. The command stopped at the documented
  external dependency boundary:

```text
Missing required dependency: weasyprint. Install suggestion: brew install weasyprint
```

## Artifact Safety

- Smoke profile, Codex report, HTML, and PDF output paths were placed under the
  ignored playground area.
- Generated smoke artifacts were removed before commit.
- `git status --short --untracked-files=all` after cleanup showed only source,
  test, plan, and job-record changes.
- No generated Markdown PDF profile, Codex report, PDF, local resource, or replay
  artifact was staged or committed.

## Review

The phase-range code review is performed after the commit that includes this job
record, so the review result is recorded in the thread closeout rather than in a
second recursive job-record update.
