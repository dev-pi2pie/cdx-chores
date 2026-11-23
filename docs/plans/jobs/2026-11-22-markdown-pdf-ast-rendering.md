---
title: "Markdown PDF AST rendering"
created-date: 2026-11-22
modified-date: 2026-11-23
status: completed
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

To reproduce the cross-version checks with the tracked tests, select Pandoc 2.0 or 3.9 on `PATH`, verify `pandoc --version`, and run `bun test ./test/markdown-pdf/direct/ast-title.pandoc.test.ts --path-ignore-patterns '**/fixtures/**'`.

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

To reproduce the cross-version checks with the tracked tests, select the expected binary on `PATH`, verify `pandoc --version`, and run `bun test ./test/markdown-pdf/actions/rendering/ast-render.pandoc.test.ts --path-ignore-patterns '**/fixtures/**'`. These cases run the production service with real Pandoc and a WeasyPrint fixture boundary. PDF layout and timing are Phase 4 checks.

Focused reviews verified the race fixture for the untitled direct fallback and preservation of both Pandoc diagnostics when WeasyPrint returns a failure.

**Independent review** — Clear for `3444cb8f..66655a56`. The reviewer inspected all 13 changed files, passed `git diff --check 3444cb8f..66655a56`, and reran 30 focused AST-render, composition, and shared interactive app tests successfully. No findings.

## Phase 3 — Offline Source Scanning

**Status** — Verified and independently reviewed. Baseline `b5c195ad` and source and test checkpoint `64d7f6fb`.

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

The focused unit run used `bun test ./test/markdown-pdf/actions/profile-codex/{signals,source-boundaries}.unit.test.ts`. The version-locked comparison verified the Pandoc executable and read each shared fixture with `--from markdown --to json`.

Focused review added recovery tests for a closing delimiter inside a later fence, a complete literal body, a wrapped attribute with Markdown-looking lines, and preservation of inline HTML in source metrics.

Review of `b5c195ad..d70f4188` found two boundary defects. A complete comment can now contain a second opener. Recovery still preserves an intervening heading or pipe table before a separate later comment. Both Pandoc versions kept the adjacent JavaScript block in the complete-comment fixture. Closed `textarea` and `pre` regions after prose now keep their bodies literal. Pandoc 2.0 exposed the inner `textarea` heading, while 3.9 hid it. Both hid it in the `pre` control. Inline code and quoted attributes still shield apparent openers. All three corrected cases retained the later H1, JavaScript fence, and pipe rows.

The follow-up passed 66 focused source cases, the focused authoring app test, and 2,251 managed unit cases. The expanded 36-fixture matrix ran on both real Pandoc versions. The four actual PATH runs again returned byte-identical Profile, Template, and Project signals. The full app suite rerun is part of Phase 4.

**Independent review** — Clear for `b5c195ad..c00a8f30` after both findings from `b5c195ad..d70f4188` were fixed. The reviewer inspected all eight changed files, checked the new regressions and recovery behavior, reran the 66 focused scanner and source-signal cases, and passed `git diff --check b5c195ad..c00a8f30`. No outstanding findings.

## Phase 4 — Integrated Renderer Validation

**Status** — Verified and independently reviewed for `02106060..f2041cb6`.

| Verification | Result |
| --- | --- |
| `bun run test:unit` | 2,251 passed. |
| `bun run test:integration:pandoc` | 26 passed on Pandoc 3.9. |
| `bun run test:integration:app` | 2,767 passed in the serial run, including the shared interactive routes and offline authoring case. |
| Shared rendering | Real Pandoc 2.0 and 3.9 and WeasyPrint 70.0 rendered all five compatibility fixtures. The eligible route wrote HTML from the same JSON checkpoint that the reader produced. Explicit show and hide, cover, untitled, and custom-template renders used direct conversion. The custom fixture received one original `$sourcefile$` entry and `context` as fallback `$pagetitle$`. Temporary checkpoints were cleaned up. |
| Standalone HTML | Matching links suppressed the metadata block. Distinct links kept the metadata title destination `https://example.com/quickstart` and body H1 destination `https://example.com/reference`. Both also appeared as PDF link annotations. Unsupported math kept the title block. Both versions resolved `#visible` and `#included` in the depth-2 TOC and excluded the depth-3 entry. Only 3.9 listed the nested `#guide` entry, and both rendered its linked body H1. The relative SVG, highlighted code, and table cells survived. |
| Real PDF parity | On each Pandoc version, direct and AST output matched in HTML, exact per-page extracted text, and title metadata for the 1-page and 21-page reports. Poppler rasters matched on the small page and large pages 1, 11, and 21. The relative SVG passed a pixel check on both versions. Visual inspection covered the title, cover, SVG, highlighted code, and tables. |
| Duplicate title control | With the TOC disabled, the one-page PDF went from two visible copies under explicit show to one under automatic title handling. Both retained `Title sentinel 957` as PDF Title metadata and preserved the remaining text. The cover control produced a two-page PDF with the same metadata title. |

The managed suites ran serially with zero failures or skips. The version-locked checks verified the tools and captured subprocess routes for the five shared render fixtures through the implemented service. PDF assertions used pdfplumber and Poppler. [Render fixtures](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts) · [Prepare, plan, and execute service](../../../src/cli/actions/markdown/to-pdf-service.ts)

### Native timing

The small fixture was one section and 744 bytes. The larger fixture was 30 sections and 42,450 bytes. Native Pandoc 3.9 ran two warm-up pairs and seven measured pairs per size, alternating direct explicit show and eligible automatic title handling. Both routes used the same source, working directory, options, and stylesheet. Every pair produced identical standalone HTML, including its title block. Pandoc time sums conversion subprocesses and excludes version probes. Full time starts from the prepared plan and includes probes, rendering, and publishing. Values are milliseconds, median [min–max]. The delta is calculated within each pair.

| Fixture | Scope | Direct | AST | Paired AST increase |
| --- | --- | ---: | ---: | ---: |
| Small | Pandoc | 28.4 [25.8–29.0] | 55.7 [52.5–56.2] | 26.9 [24.3–30.3] |
| Small | Full PDF | 1,640.5 [1,630.9–1,651.9] | 1,668.6 [1,662.8–1,680.2] | 32.2 [10.9–39.7] |
| Larger | Pandoc | 69.5 [66.5–74.7] | 108.0 [96.1–119.3] | 41.5 [21.3–47.0] |
| Larger | Full PDF | 2,066.7 [2,050.3–2,073.8] | 2,102.0 [2,082.9–2,139.3] | 37.2 [9.3–89.0] |

Pandoc 2.0 ran one parity pair per size. Timing covers one native 3.9 series, and pixel parity covers the sampled pages.

**Independent review** — Clear for `02106060..f2041cb6`. The reviewer inspected both changed documentation files, checked range whitespace, and cross-checked the 2.0 and 3.9 results, PDF assertions, and timing summaries. No findings.

### Canary review follow-up

Independent canary review of `0dd77cf5..f2041cb6` found two offline scanner regressions. Both fixes and their fixtures are in `62f5f6f1..af2a673a`. [Scanner](../../../src/cli/markdown-pdf/profile/fence-signals.ts) · [Boundary fixtures](../../../test/markdown-pdf/actions/fixtures/markdown-source-fixtures.ts)

| Finding | Verified correction |
| --- | --- |
| A matched fenced Div close left paragraph context and suppressed the next tilde fence. | The close of a recognized Div restores the block boundary. The fixtures cover nested Divs, single classes with internal or trailing colons, and braced attributes with adjacent colons. An unmatched `:::`, a split class, and Div-looking text inside code or a verbatim body stay outside Div matching. |
| A real HTML block close after prose was missed, including a wrapped opening tag followed by a close. | The closing tag restores the boundary. Inline code, quoted attributes, and trailing prose preserve paragraph context. The summary blank-line and paragraph/comment controls still pass. |

The retest passed 81 focused source cases, the focused authoring app case, and all 2,266 managed unit cases. The 51-case matrix ran on both real Pandoc versions. The 15 new cases matched both readers on code classes and headings, with a visible H1 and pipe table in every case. Profile, Template, and Project returned byte-identical signals across all four actual Pandoc-present and Pandoc-absent runs. The full app, HTML/PDF, and timing results above cover `02106060..f2041cb6`. Post-fix retests cover offline scanning and authoring.

**Independent canary re-review** — Clear for `0dd77cf5..1e040ace`, including fix `af2a673a`. The reviewer checked the full committed diff and range whitespace, inspected the post-review changes and all 15 regression fixtures, and independently reran all 81 focused source tests successfully. No further actionable findings. [Phase 4 plan](../plan-2026-11-22-markdown-pdf-ast-rendering.md#phase-4--integrated-renderer-validation)

## Phase 5 — Docs Validation

**Status** — Verified and independently reviewed for `bcb013fe..db49046c`.

The usage guide defines built-in title comparison, controls, and the Pandoc inputs for custom templates. The Interactive and three authoring guides link to the shared behavior and describe the distinction between bounded source summaries during preparation and the parsed heading decision during export. [Automatic Metadata Titles](../../guides/markdown-pdf-usage.md#automatic-metadata-titles) · [Custom Template And CSS](../../guides/markdown-pdf-usage.md#custom-template-and-css) · [Phase 5 plan](../plan-2026-11-22-markdown-pdf-ast-rendering.md#phase-5--docs-validation)

| Verification             | Result                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI help                 | Help matched the documented flags for `md to-pdf`, `interactive`, and the three Codex helpers via `bun ./src/bin.ts`.                                                         |
| Examples and schema      | Both Profile YAML examples passed production validation. All three title modes were accepted, and the Debug HTML command matched CLI help.                                    |
| Existing render evidence | The title example matched the `distinct-links` fixture and both saved Phase 4 inputs byte for byte. HTML and PDFs kept both links on Pandoc 2.0 and 3.9 with WeasyPrint 70.0. |
| Focused Bun tests        | 102 unit and 72 app cases passed.                                                                                                                                             |
| Links and formatting     | Validated 108 relative links and anchors across eight documents. Oxfmt found zero new deviations from the baseline. `git diff --check bcb013fe` passed.                       |

The focused `bun test` runs selected the `ast-title`, `signals`, and `source-boundaries` unit suites and the `ast-render`, `authoring-source-signals`, `shared-render`, and `generated-lifecycle` app suites. The app run used `--path-ignore-patterns '**/fixtures/**'`.

Documentation review of all seven files identified a missing explanation of the `auto` fallback. The guide now explains that direct conversion applies when the cover is disabled and the frontmatter title is absent, empty, or non-string. The focused app tests and the example, link, formatting, and whitespace checks passed after the edit, and the updated diff cleared review.

**Independent review** — Clear for `bcb013fe..db49046c`. The reviewer checked every changed line in all seven documentation files against the title projection, service routing and fallback, template variables, and `distinct-links` fixture. The 102 focused unit cases, `md to-pdf --help`, 108 relative links and anchors across eight documents, and `git diff --check bcb013fe..db49046c` all passed. No outstanding findings.

All 21 checklist items across the five phases have matching job evidence.

## Post-merge canary review follow-up

Both P3s from the review of `0dd77cf5..355edb56` were addressed in `355edb56..e6507d50`.

| Checkpoint | Change and verification |
| --- | --- |
| `7b2a7082` | Render preparation uses front matter for profile metadata. The template uses a single AST suppression decision during eligible export. Passed 125 focused recipe, renderer, and interactive tests. Pandoc 2.0 and 3.9 each passed 16 AST title fixtures and the HTML/PDF smoke with WeasyPrint 70.0. The smoke verified title count and metadata, both distinct links, direct title and cover modes, and custom-template variables. |
| `e6507d50` | The source scanner uses shared ordinary, contextual, standalone, and verbatim HTML rules, including the distinction between adjacent and spaced tokens after a matched close. Passed 128 boundary comparisons per Pandoc version and 122 focused source and authoring tests. Profile, Template, and Project produced identical signals with Pandoc 2.0, Pandoc 3.9, and an empty `PATH`, with zero Pandoc calls. |

The offline policy requires a blank line before a tilde fence in the tested `summary`, `nav`, and `track` forms where the readers disagree. Complete `textarea` bodies are literal. The boundary fixtures check that fenced headings and rows are excluded and the following visible Markdown still contributes signals. [Source boundary tests](../../../test/markdown-pdf/actions/profile-codex/source-boundaries.unit.test.ts) · [Render route tests](../../../test/markdown-pdf/actions/rendering/ast-render.app.test.ts)

Node 26.13.1 timed `prepareMarkdownPdfRender` on the same inputs, with three warm-up pairs and nine measured pairs in alternating order. Values are medians in milliseconds. The reduction is calculated within each pair.

| Input | Before | After | Paired reduction |
| --- | ---: | ---: | ---: |
| 3,213 bytes | 0.26 | 0.22 | 0.03 |
| 3,555,053 bytes | 48.26 | 2.97 | 45.57 |

`bun run test:all` passed 2,768 app, 41 Codex, and 26 Pandoc cases. The final `bun run test:unit` rerun passed 2,306 cases, including the last three boundary controls. Scoped Oxfmt, Oxlint, and `git diff --check` passed. An additional scoped TypeScript check reproduced the existing readonly CLI metadata fixture error at `355edb56`.

Test coverage review cleared both fixes after the HTML boundary cases were added. Review of `355edb56..7b2a7082`, `7b2a7082..e6507d50`, and the full `0dd77cf5..e6507d50` diff found no remaining actionable issues.
