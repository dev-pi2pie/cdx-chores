---
title: "Markdown PDF AST rendering"
created-date: 2026-11-22
modified-date: 2026-11-22
status: in-progress
agent: codex
---

Implementation baseline `ddc5d119`. [Implementation plan](../plan-2026-11-22-markdown-pdf-ast-rendering.md) · [Settled research](../../researches/research-2026-11-22-markdown-pdf-html-boundaries.md)

## Phase 1 — AST Title Comparison

**Status** — Verified and independently reviewed. Checkpoint `ddc5d119..bdabdac2` includes the linked job setup and the title comparison with fixtures.

The comparator requires a nonempty front-matter string, selects the first Markdown H1 at the top level or inside native Divs, and compares supported display text with case and whitespace folded and punctuation preserved. Unsupported formatting in the first eligible H1 or parsed title keeps the title block. Every metadata link needs the same label and literal destination in the H1. [Comparator](../../../src/cli/markdown-pdf/ast-title.ts) · [Shared fixtures](../../../test/markdown-pdf/direct/ast-title-fixtures.ts)

| Verification | Result |
| --- | --- |
| `bun test ./test/markdown-pdf/direct/ast-title.unit.test.ts` | 21 passed. Covers excluded containers, earlier eligible H1, unsupported formatting, punctuation, and label paired with exact destination. |
| `bun run test:unit` | 2,211 passed, zero failures or skips. |
| `bun run test:integration:pandoc` | 21 passed on Pandoc 3.9, including the 16 Phase 1 cases. |
| Shared version-locked matrix | The same 16 cases passed with verified Pandoc 2.0 and 3.9. Real reader output covered ATX and nested Setext, a false H1 in `pre`, earlier eligible H1s, and excluded quote, list, grid-table, and footnote headings. |
| Standalone HTML on both versions | The matching link kept the H1 link and suppressed the metadata block. In the distinct-link case, the metadata title anchor kept `https://example.com/quickstart` and the eligible body H1 anchor kept `https://example.com/reference`. |
| Formatting, lint, and whitespace | The four TypeScript files passed targeted Oxfmt and Oxlint checks. The phase diff passed `git diff --check ddc5d119`. |

The cross-version run used the ignored local driver with `bun examples/playground/markdown-pdf-html-spike/phase-1-title.ts <pandoc-executable> <version>`. To reproduce with the tracked tests, select Pandoc 2.0 or 3.9 on `PATH`, verify `pandoc --version`, and run `bun test ./test/markdown-pdf/direct/ast-title.pandoc.test.ts --path-ignore-patterns '**/fixtures/**'`.

Focused fixture review found no material coverage gaps. The documentation recheck confirmed the version selection and tracked reproduction command. Phase 1 verifies the comparator and its standalone HTML decisions. Shared render routing and full PDF validation belong to later phases.

**Independent review** — Clear for `ddc5d119..79cff61f`. The reviewer inspected all six changed files, reran `bun test ./test/markdown-pdf/direct/ast-title.unit.test.ts` with 21 passing cases, and passed `git diff --check ddc5d119..79cff61f`. No findings.

## Phase 2 — Shared Render Execution

**Status** — Verified and independently reviewed. Baseline `3444cb8f`, implementation checkpoint `25a1e481`, and page-chrome fixture checkpoint `dcd658ff`.

The shared execution service uses the resolved template, title mode, and cover settings. For built-in automatic titles with the cover disabled, each attempt snapshots the current Markdown. The front-matter title check and conversion use those bytes. A nonempty string selects the JSON path. Pandoc's reader writes one checkpoint, the title comparator reads it, and the HTML writer consumes the original checkpoint. Custom, explicit-mode, and cover renders consume the original input directly. [Shared service](../../../src/cli/actions/markdown/to-pdf-service.ts) · [Pandoc source preparation](../../../src/cli/markdown-pdf/pandoc-source.ts)

Prepared interactive execution with Pandoc absent from `PATH` made no dependency calls before confirmation. A durable generated Profile retry kept the existing recipe and PDF through a writer failure, cleaned the failed checkpoint, and used the edited Markdown on its next attempt. Direct CLI fixtures also edited the file after the title check on both conversion paths and verified that the chosen snapshot stayed consistent.

| Verification | Result |
| --- | --- |
| Focused Bun app tests | 149 passed across the shared execution, prepared render, profile rendering, write lifecycle, and interactive source and retry fixtures. Four composition cases passed after the page-chrome test supplied its AST fixture. |
| `bun run test:unit` | 2,211 passed, zero failures or skips. |
| `bun run test:integration:app` | Final serial run passed 2,766 cases with zero failures or skips. |
| `bun run test:integration:pandoc` | 26 passed on Pandoc 3.9, including five shared execution fixtures. |
| Shared version-locked matrix | The same five fixtures passed on verified Pandoc 2.0 and 3.9. Matching links suppressed the duplicate, distinct links retained both destinations, and valid unsupported math retained the title block. The matrix also verified TOC depth, a relative SVG, highlighted code, table cells, and direct untitled and custom-template output. Both versions exposed one original custom-template `$sourcefile$` entry and `context` as the fallback `$pagetitle$`. |
| Diagnostics, cleanup, and output | The app fixtures checked reader, malformed or missing JSON, invalid envelope, and writer errors against both existing HTML and PDF outputs. They verified cleanup, retained reader diagnostics on writer and JSON failures, and ordered warnings from reader through writer and PDF renderer. A subsequent WeasyPrint failure kept both Pandoc diagnostics and the original PDF. The shared asset gate rejected a remote image before publication. |
| Formatting, lint, and whitespace | The changed TypeScript files passed targeted Oxfmt and Oxlint checks. The phase diff passed `git diff --check 3444cb8f`. |

The focused app run selected the AST, profile, prepared-render, and write-lifecycle app tests under `test/markdown-pdf/actions/rendering/` and the shared-render, render-sources, and generated-lifecycle app tests under `test/markdown-pdf/interactive/`. It used `bun test` with `--path-ignore-patterns '**/fixtures/**'`.

The cross-version run used the ignored local driver with `bun examples/playground/markdown-pdf-html-spike/phase-2-render.ts <pandoc-executable> <version>`. To reproduce with the tracked tests, select the expected binary on `PATH`, verify `pandoc --version`, and run `bun test ./test/markdown-pdf/actions/rendering/ast-render.pandoc.test.ts --path-ignore-patterns '**/fixtures/**'`. These cases run the production service with real Pandoc and a WeasyPrint fixture boundary. PDF layout and timing are Phase 4 checks.

Focused reviews verified the race fixture for the untitled direct fallback and preservation of both Pandoc diagnostics when WeasyPrint returns a failure.

**Independent review** — Clear for `3444cb8f..66655a56`. The reviewer inspected all 13 changed files, passed `git diff --check 3444cb8f..66655a56`, and reran 30 focused AST-render, composition, and shared interactive app tests successfully. No findings.

## Phase 3 — Offline Source Scanning

**Status** — Implementation verified. Baseline `b5c195ad` and source and test checkpoint `64d7f6fb`.

The shared scanner resumes at exact tag, comment, inline code, and verbatim offsets. Block context determines fence eligibility. When an apparent HTML opener and a later fenced delimiter straddle a heading or table, recovery preserves the intervening Markdown. Ordinary inline HTML keeps its source spelling in heading and table metrics. Profile, Template, and Project continue to share the bounded collector. [Source scanner](../../../src/cli/markdown-pdf/profile/fence-signals.ts) · [Cursor](../../../src/cli/markdown-pdf/profile/source-cursor.ts) · [Boundary fixtures](../../../test/markdown-pdf/actions/fixtures/markdown-source-fixtures.ts)

| Boundary | Actual Pandoc 2.0 and 3.9 | Offline signals |
| --- | --- | --- |
| Closed `textarea` | 2.0 parsed the inner H1 and Python code. 3.9 treated the body as literal. | Counted only the later visible H1, pipe rows, and JavaScript fence. The `pre` control agreed on both versions. |
| Tilde fence after `</summary>` | 3.9 admitted the adjacent fence, including after a wrapped close. Both versions admitted it after a blank line. | Required a blank line. Retained the visible H1 and table after the rejected example. |
| Unclosed `div` | Both parsed subsequent Markdown. The H1s were top-level in 2.0 and nested in 3.9. | Counted both H1s, the fence, and the table rows. |
| Paragraph close and comment | Both admitted a fence after a matched close with an adjacent comment and a bare close with a spaced comment. Both suppressed it after a matched close with a spaced comment. | Matched all three controls. |
| Incomplete markup | A comment closer inside a later fence consumed an earlier H1 in both versions. An unfinished quoted tag before a pipe table produced no Table in either version. | Recovered the H1 and counted the pipe rows. |

| Verification | Result |
| --- | --- |
| Focused source unit tests | 59 passed across `signals.unit.test.ts` and `source-boundaries.unit.test.ts`. Covered wrapped and quoted markup, same-line recovery, fence and inline code precedence, and line endings. |
| Focused authoring app test | `bun test ./test/markdown-pdf/actions/authoring-source-signals.app.test.ts --path-ignore-patterns '**/fixtures/**'` passed. All three normal preparation entries returned the same signals with a discoverable Pandoc sentinel and with an empty `PATH`. |
| `bun run test:unit` | 2,244 passed with zero failures or skips. |
| `bun run test:integration:app` | 2,767 passed with zero failures or skips, including the isolated authoring parity fixture. |
| Version-locked comparison | Ran the same 29 Markdown fixtures through real Pandoc 2.0 and 3.9. The offline scanner retained the final visible H1 and three pipe rows in every fixture. |
| Actual authoring PATH matrix | All three preparation entries agreed with real 2.0 or 3.9 discoverable and on an empty `PATH`. All four runs returned byte-identical signals and made zero Pandoc calls. The fixture checked 50 scanned pipe rows, two overflow rows, source width, 12 distinct languages, one overflow language, one unlabeled fence, and the 20,000-character script cap. |
| Static checks | Scoped TypeScript, targeted Oxfmt and Oxlint, and `git diff --check b5c195ad` passed. |

The focused unit run used `bun test ./test/markdown-pdf/actions/profile-codex/{signals,source-boundaries}.unit.test.ts`. The version-locked comparison used the ignored spike driver `phase-3-source.ts <pandoc-executable> <version>`, which verifies the executable and reads each shared fixture with `--from markdown --to json`.

Focused review added recovery tests for a closing delimiter inside a later fence, a complete literal body, a wrapped attribute with Markdown-looking lines, and preservation of inline HTML in source metrics.

**Independent review** — Pending.

## Phase 4 — Integrated Renderer Validation

**Status** — Pending.

## Phase 5 — Docs Validation

**Status** — Pending.
