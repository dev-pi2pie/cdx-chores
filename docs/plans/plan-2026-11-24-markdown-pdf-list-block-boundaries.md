---
title: "Markdown PDF list block boundaries implementation"
created-date: 2026-11-24
modified-date: 2026-11-24
status: completed
agent: codex
---

## Goal and scope

A four-space-indented Python fence under `1. Item` can lose its language hint and contribute a spurious table row to Markdown PDF authoring. The same four spaces at the document margin introduce literal code. Profile, Template, and Project need one way to determine which list item or document block owns a line before interpreting its fence, inspecting a possible HTML close, or counting visible source rows.

Change the shared offline source scanner. For the list cases where Pandoc 2.0 and 3.9 disagree, use the 3.9 fence interpretation for authoring hints. Preserve the helpers’ existing HTML recovery behavior and source-based metrics. Rendering continues to follow the installed Pandoc reader. A successful run can therefore report a Python authoring hint even when Pandoc 2.0 renders the example without a code block.

The five original phases verified that scanner and render behavior. A later canary comparison exposed two regressions in automatic title selection with author CSS. The [follow-up phase](#follow-up--automatic-metadata-titles-under-author-css) records their correction and verification.

## Related Research

- [Markdown PDF list block boundaries](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md)

## Unified job record

The [unified job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md) tracks the five original phases from baseline `60df6caf` and the title follow-up. For each phase, record the change, fixture or command, expected and observed result, and review disposition. Identify the reviewed commit range, or the baseline and scope of the reviewed diff for uncommitted work. After a correction, rerun the affected checks and re-review the full revised phase. Mark checklist items complete when the corresponding evidence is recorded. Use fixture names, tool versions, and behavioral results that another contributor can reproduce.

## Phase 1 — Establish the compatibility fixtures

- [x] Create the unified job record. Reproduce the current scanner’s behavior from the implementation baseline. Record which cases already pass and which need correction. The unpublished prototype in the research is historical evidence.
- [x] Encode the six inputs in the research table and its unindented and four-space top-level controls as named Markdown fixtures. Preserve tabs, blank lines, and the difference between zero and one trailing space using explicit strings. Use the same fixture bytes for scanner and reader checks. [Paired observations](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#paired-observations)
- [x] Baseline the Phase 3 HTML fixtures before changing the scanner. Include the top-level and list-nested comment and `textarea` pairs, genuine closes before and after the example, the closer moved to a sibling, and the complete closed-`textarea` control. For each, record the current scanner’s signals, the target offline signals, and each reader’s visible headings and code blocks separately. [HTML recovery observations](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#html-recovery-at-a-list-boundary)
- [x] Specify offline expectations for language hints, visible headings, and source rows. For a pipe-shaped fence body, replace just that line with plain text to measure the row it contributes. Keep the actual close delimiter in the HTML recovery fixtures. Reuse the existing [source-boundary tests](../../test/markdown-pdf/actions/profile-codex/source-boundaries.unit.test.ts).
- [x] Verify each reader with `pandoc --version`, then run the fixtures through `pandoc --from=markdown --to=json` on 2.0 and 3.9. Record the block kind, list ancestry, language, and literal delimiter text where applicable. For the numbered item, expect no code block on 2.0 and a Python block inside the item on 3.9. Both should preserve the backticks as literal code in the four-space top-level control.

**Checkpoint** — Each fixture has a reader expectation per version and a single offline expectation. The baseline identifies the failures that Phases 2 and 3 must correct.

Independent code review cleared `60df6caf..4a4c0627`. The [Phase 1 job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-1--establish-the-compatibility-fixtures) records the 21 scanner targets and both reader results.

## Phase 2 — Resolve list ownership and match fences

- [x] In the shared fence scanner, measure the marker end, actual separator width, and content margin in columns, including tab stops. Keep that margin and the preceding block kind with their owning container. Cover bullets, decimal, lettered, Roman, and automatic markers, excess padding, empty markers, and two markers on one line. [Fence scanner](../../src/cli/markdown-pdf/profile/fence-signals.ts)
- [x] Resolve whether a line continues the current item, starts a sibling, returns to its parent, or belongs to the document. Distinguish lazy paragraph continuation from a fence that can interrupt prose. Exercise fences on the marker line and after headings, literal lines, Div delimiters, inline HTML, comments, dashed paragraph continuations, pipe tables, and verse. Replay the earlier failures by varying one boundary at a time. [Cases from successive reviews](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#what-successive-reviews-found)
- [x] Match an opener to a compatible closer in its container. A closer needs the same marker, a sufficient run length, and empty closing info. Contrast an in-item closer with one moved to a sibling and assert that an unmatched opener leaves a later heading and table visible. Preserve efficient matching for repeated unmatched candidates.
- [x] Drive both the hint and the fenced-body exclusion from the matched span. Preserve unlabeled and raw-fence behavior, and keep visible source lines at their original widths for the row collector. Cover returns from child verse and pipe tables to both the parent item and the document. [Document signal collection](../../src/cli/markdown-pdf/profile/signals.ts)

**Checkpoint** — All six offline expectations and both top-level controls pass. A one-space tilde fence after nested verse contributes a Python hint and zero body rows. After top-level verse it contributes no hint and one body row. At seven spaces under an empty nested marker, changing only its trailing separator from absent to one space changes the result from no hint and four total rows to `python` and three.

Independent implementation and test reviews cleared `b66bc6df..2bb809a6`. The [Phase 2 job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-2--resolve-list-ownership-and-match-fences) records both reader results, regression checks and review corrections.

### Reopened after branch review

The [follow-up record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-2-follow-up-and-separate-title-correction) tracks the baseline at `f9f80fdd`, the reader differences, and the review corrections.

- [x] Correct ownership for a definition continuation, a partially outdented fence after compact markers, and a quote inside a list item. Verified shared offline signals and both application render routes against Pandoc 2.0 and 3.9 at `a39cd9e7`.
- [x] Verify that a definition can own an outdented closer until a blank line ends its continuation. Both reader and render controls passed at `c2f11532`.

### Ordinary list and document quote follow-up

- [x] Preserve the Python hint and exclude the pipe row when either the bullet fence body or its closer outdents. Cover an aligned fence and a blank before the outdented closer. `1b5e334b`
- [x] Recognize the fence that continues a document-level quote and verify the blank-line control against each reader. `7c1f6724`
- [x] Preserve item ownership across an adjacent heading between two fences. Verify that a blank before the heading ends the item. Independent re-review cleared `f03f5c55..3a60caf5`. [Reader and render results](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#ordinary-list-and-document-quote-follow-up)

### Quote findings during final review

- [x] Resolve a list inside a quote and a compact quoted item with an outdented opener. Verify both readers, both render routes, offline language hints and pipe rows, and HTML recovery. `29f786fd`. [Phase 5 branch review findings](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-5-branch-review-findings)
- [x] Keep physical row widths through tab expansion and share nested quote scopes across lazy prose. Verify that inline code and unmatched backticks preserve sharing while a complete outer fence still interrupts the quote. `8edefe95`, `4b4baa5e`.

### Canary review follow-up

- [x] Resolve verse continuation before opening a quote. Verify the indented, flush, and blank-separated variants in the three offline helpers and on Pandoc 2.0 and 3.9. `f430c285`.
- [x] Complete the separate title correction. Compare CSS whitespace with a nonbreaking space, and distinguish a custom property set to `initial` from one that is absent. Verify a single printed title with each reader. `03faefbf`.
- [x] Verify automatic title selection when an author stylesheet hides the matching H1 or reveals an earlier H1. Verify the final HTML and printed PDF with both readers. `f5992378`.

The next review reproduced a missing title and a duplicate title with author CSS. The [dedicated phase](#follow-up--automatic-metadata-titles-under-author-css) continues from those results. [Canary verification record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#open-title-findings-after-the-third-canary-review)

## Phase 3 — Use the same fence spans during HTML recovery

- [x] Supply the container-relative candidate spans to HTML delimiter recovery and ordinary fence recognition. Decide which matched fences are visible after resolving the HTML region. Preserve original source offsets across tabs and line endings so a recovered suffix resumes at the correct character. [Source cursor](../../src/cli/markdown-pdf/profile/source-cursor.ts)
- [x] In both the comment and `textarea` recovery fixtures, put the apparent close inside a matched `sh` fence, first at the top level and then under a numbered item. Keep the H1 between the HTML opener and the fence. Repeat with a genuine close immediately after the HTML opener. Every variant should expose the recovered and trailing H1s, the `sh` and `js` hints, and three table rows. [Recovery fixtures](../../test/markdown-pdf/actions/fixtures/markdown-source-fixtures.ts)
- [x] In the nested `textarea` case, add a second item (`2. Sibling`) after the matched fence. Move only the four-space-indented closing tildes from the first item to a separate paragraph inside the second. The first opener now lacks a closer in its item, so its `</textarea>` closes the element and hides the earlier H1. Expect only `# Visible heading`, the `js` hint, and three source rows. Moving the closer back restores the two-H1, two-hint result.
- [x] Keep the genuine close *after* the apparent Python fence in `real-close-after-fenced-textarea-delimiter`. Test both placements of the fence. Only the trailing visible H1, `js`, and three rows should survive. Also retain the complete `closed-textarea-with-apparent-fence` control, whose apparent `text` fence contributes no hint.

**Checkpoint** — Moving a fence into a list preserves each recovery fixture’s expected signals. Moving the genuine HTML close before or after the example gives the corresponding visible or literal contents.

Independent implementation and test reviews cleared `f786aff5..e10250e0`. The [Phase 3 job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-3--use-the-same-fence-spans-during-html-recovery) records the offline signals, both reader results, and the fixes verified in re-review.

## Phase 4 — Verify authoring and rendering through the application

- [x] Run the boundary fixtures through Profile, Template, and Project. Compare each helper’s signals to the fixture expectations and to the other helpers. Run once with a detectable Pandoc stub that records any invocation and once with Pandoc absent. Require zero Pandoc calls, including the version probe. Retain coverage for language and row limits, overflow, and source row widths. [Authoring integration test](../../test/markdown-pdf/actions/authoring-source-signals.app.test.ts)
- [x] With real Pandoc 2.0 and 3.9, render representative list, literal-code, and HTML recovery inputs through the shared application service. For the numbered item, run the same body with an eligible built-in front-matter title (Markdown → JSON → HTML) and without a title (Markdown → HTML). On both routes, require 3.9’s Python-classified block containing `| fenced | sample |` inside the numbered item, and require 2.0 to render that example without a code block. For the literal and HTML recovery cases, compare block content and surviving headings with that version’s Phase 1 reader results. [Render integration fixtures](../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts)
- [x] Run `bun run test:unit`, `bun run test:integration:app`, and `bun run test:integration:pandoc`. Record suite results and identify which targeted cases ran on each verified Pandoc version. Recheck any mismatch against the Phase 1 input and expectation.

**Checkpoint** — All three helpers agree offline. Both render routes preserve each real reader’s interpretation, including the known 2.0 and 3.9 difference for the same list fence.

Independent code and test reviews cleared `e9b5e7f9..a8ecd37b`. The [Phase 4 job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-4--verify-authoring-and-rendering-through-the-application) records offline agreement, both render routes on each reader, and the full suite results.

## Separate render correction before Phase 5

- [x] Preserve the metadata title for a hidden matching H1, and suppress it for a later visible match. Verify inline visibility inheritance and display overrides on both readers. `7de799cf`, `cdb0f4d9`, `4b7244cf`.
- [x] Cover visible and hidden variable values, nested fallbacks, and empty substitutions on both readers. `89eebc89`, `cda63100`, `c61355cf`.
- [x] Verify plain, positioned, and floated table columns. Compare title eligibility with printed text in 600 display cases, 320 position and float cases, and 42 application PDFs. `6a1d2d0c`, `4ffacebe`.
- [x] Keep running elements out of body-title matching, including floated columns and column groups. Verify literal positions and positions supplied by variables or fallbacks. All 54 final title PDFs printed one H1. `9a87c949`, `eb360181`.
- [x] Record the regression suite results and independent clearance of `f9f80fdd..eb360181`. [Unified job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-2-follow-up-and-separate-title-correction)

## Phase 5 — Validate documentation and close the record

- [x] Check the authoring and rendering guides against the verified outcomes. Update affected wording or examples where users need to distinguish a source hint from rendered output. Validate changed examples against the Phase 4 results. [Profile guide](../guides/markdown-pdf-codex-profile-helper.md) · [Template guide](../guides/markdown-pdf-codex-template-helper.md) · [Project guide](../guides/markdown-pdf-codex-project-helper.md) · [Markdown PDF usage](../guides/markdown-pdf-usage.md)
- [x] Review Markdown formatting, relative links, and traceability among research, plan, and unified record. Check `git diff --check` and review the documentation diff. If a claim disagrees with the implementation, reopen its phase, resolve the discrepancy, and repeat the affected validation.
- [x] Match every completed item to evidence in the unified record, including both Pandoc versions and the final reviewed scope. Record the docs review and resolution of findings. Mark the plan and job record `completed` when all five checkpoints pass, then update the research status according to the evidence and link its outcome.

**Checkpoint** — A reader can trace each documented behavior to a fixture, a verified result, and its phase in the single job record.

All five original checkpoints passed at `2759ec4a`. Independent code review cleared `c15c6467...4b4baa5e`. The [final verification and review record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#phase-5--validate-documentation-and-close-the-record) covers both readers, the guide example at `c053bca8`, and the corrections made during branch review.

## Follow-Up — Automatic metadata titles under author CSS

With the built-in template, the cover off, and an eligible frontmatter title, the accepted direction puts the author-CSS visibility check in `titleBlock.metadataTitle: auto`. A partial title or inconclusive evidence keeps the metadata block. Explicit `show` and `hide` bypass the check. [Accepted direction](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#accepted-direction-for-automatic-title-selection) · [Failing baselines](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#open-title-findings-after-the-third-canary-review)

- [x] **Test the per-glyph pixel comparison.** Compared the two reported cases with explicit `show` and `hide` on Pandoc 2.0 and 3.9 at `f0cf7591`. The extra print distinguished those cases but accepted two cut-off titles. Canary comparison cleared the experiment at `35a1ab3c`. [Experiment and timings](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#follow-up-experiment-on-complete-title-visibility)
- [x] **Test whether the complete heading is unobscured.** At baseline `ec6e5a9a`, all 11 prototype decisions per reader matched the expected pages on Pandoc 2.0 and 3.9. The letter-spaced title matched `hide` when clear and `show` when clipped or covered. Both missing-evidence controls matched `show`. [Results and proof cost](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#unobscured-title-experiment)
- [x] **Test source identity and visibility in Node.js.** All 14 prototype decisions per reader matched their explicit controls on Pandoc 2.0 and 3.9. [Node.js results and cost](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#nodejs-title-visibility-experiment)
- [x] **Group the four title-selection files.** Moved the modules and updated imports and documentation links at `73306696`. The build and 412 focused tests passed.
- [x] **Verify and record the module layout.** Traced source matching from `pandoc-source.ts` and printed-title selection from `render.ts`. [Before and after](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#title-selection-module-layout)
- [x] **Test the bounded extension before changing production selection.** Nine decisions per reader covered the plain and formatted first H1, hidden and revealed earlier headings, and missing, transparent, or generated suffixes. [Compatibility results](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#earlier-hidden-heading-compatibility)
- [x] **Implement styled `auto` for a matching visible first H1.** Source substitution identifies the printed runs, and original glyph outlines establish complete visibility at `81bae1a1`. [Implementation and controls](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#production-verification-of-styled-auto)
- [x] **Check PDF inspection availability.** With optional canvas unavailable, the built CLI retained the metadata title and rendered successfully on both readers. No new runtime dependency was needed.
- [x] **Verify heading order through the built CLI.** Plain and emphasized matching headings printed once, including after a wholly hidden H1. Revealing the earlier nonmatch kept the metadata block on both readers.
- [x] **Verify the final output.** Rasterized pages matched the explicit controls and debug HTML agreed on both readers. The unstyled comparison and explicit modes retained their existing behavior. [Built-CLI results](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#production-verification-of-styled-auto)
- [x] **Verify missing source identity.** With the substitution unable to establish identity on the fully visible fixture, both readers’ `auto` pages matched `show`.
- [x] **Verify missing visibility evidence.** On the same fixture, disabling glyph inspection after source identification kept the block. Both readers’ `auto` pages matched `show`.
- [x] **Measure the built CLI’s proof cost.** Including the initial fallback print at `2a58ed11`, median title-selection time for the one-page letter-spaced heading was 1,200 ms on Pandoc 2.0 and 1,121 ms on 3.9. [Method and baseline](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#canary-review-of-the-production-title-check)
- [x] **Align the guide with verified behavior.** The [usage guide](../guides/markdown-pdf-usage.md#automatic-metadata-titles) covers the matching first H1, incomplete text, and both missing-evidence outcomes. The research links to the verified pages and regression tests.
- [x] **Correct the first canary review findings.** Publish the inspected title PDF and preserve source words across case changes and line wraps. All 40 page comparisons per reader and both missing-evidence checks passed at `fbb447e0`. [Review record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#canary-review-of-the-production-title-check)
- [x] **Correct the second canary review findings.** Preserve an asset that disappears during inspection and recognize Unicode case expansions in the identified H1. Six additional page comparisons per reader passed at `2a58ed11`. [Review record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#canary-review-of-the-production-title-check)
- [x] **Correct repeated font warnings.** At `23baabf9`, a stable warning kept one title. An extra occurrence in either proof selected the saved PDF with the regular font. [Two-reader verification](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#font-loading-in-the-third-title-review)
- [x] **Distinguish failed font sources.** At `e70be8a1`, switching the failed face within a family selected the PDF with the original regular font. A stable failure preserved one title. [Source and output checks](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#font-source-verification)
- [x] **Review and close.** Independent code review cleared the full canary comparison `9d578d9d...61a001a1` with no actionable findings. The guide, research and unified record agree with the verified output. [Closing verification](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md#follow-up-closure)
