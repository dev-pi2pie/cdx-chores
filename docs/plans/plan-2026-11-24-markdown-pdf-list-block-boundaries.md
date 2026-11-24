---
title: "Markdown PDF list block boundaries implementation"
created-date: 2026-11-24
status: active
agent: codex
---

## Goal and scope

A four-space-indented Python fence under `1. Item` can lose its language hint and contribute a spurious table row to Markdown PDF authoring. The same four spaces at the document margin introduce literal code. Profile, Template, and Project need one way to determine which list item or document block owns a line before interpreting its fence, inspecting a possible HTML close, or counting visible source rows.

Change the shared offline source scanner. For the list cases where Pandoc 2.0 and 3.9 disagree, use the 3.9 fence interpretation for authoring hints. Preserve the helpers’ existing HTML recovery behavior and source-based metrics. Rendering continues to follow the installed Pandoc reader. A successful run can therefore report a Python authoring hint even when Pandoc 2.0 renders the example without a code block.

## Related Research

- [Markdown PDF list block boundaries](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md)

## Unified job record

The [unified job record](jobs/2026-11-24-markdown-pdf-list-block-boundaries.md) tracks all five phases from baseline `60df6caf`. For each phase, record the change, fixture or command, expected and observed result, and review disposition. Identify the reviewed commit range, or the baseline and scope of the reviewed diff for uncommitted work. After a correction, rerun the affected checks and re-review the full revised phase. Mark checklist items complete when the corresponding evidence is recorded. Use fixture names, tool versions, and behavioral results that another contributor can reproduce.

## Phase 1 — Establish the compatibility fixtures

- [ ] Create the unified job record. Reproduce the current scanner’s behavior from the implementation baseline. Record which cases already pass and which need correction. The unpublished prototype in the research is historical evidence.
- [ ] Encode the six inputs in the research table and its unindented and four-space top-level controls as named Markdown fixtures. Preserve tabs, blank lines, and the difference between zero and one trailing space using explicit strings. Use the same fixture bytes for scanner and reader checks. [Paired observations](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#paired-observations)
- [ ] Baseline the Phase 3 HTML fixtures before changing the scanner. Include the top-level and list-nested comment and `textarea` pairs, genuine closes before and after the example, the closer moved to a sibling, and the complete closed-`textarea` control. For each, record the current scanner’s signals, the target offline signals, and each reader’s visible headings and code blocks separately. [HTML recovery observations](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#html-recovery-at-a-list-boundary)
- [ ] Specify offline expectations for language hints, visible headings, and source rows. For a pipe-shaped fence body, replace just that line with plain text to measure the row it contributes. Keep the actual close delimiter in the HTML recovery fixtures. Reuse the existing [source-boundary tests](../../test/markdown-pdf/actions/profile-codex/source-boundaries.unit.test.ts).
- [ ] Verify each reader with `pandoc --version`, then run the fixtures through `pandoc --from=markdown --to=json` on 2.0 and 3.9. Record the block kind, list ancestry, language, and literal delimiter text where applicable. For the numbered item, expect no code block on 2.0 and a Python block inside the item on 3.9. Both should preserve the backticks as literal code in the four-space top-level control.

**Checkpoint** — Each fixture has a reader expectation per version and a single offline expectation. The baseline identifies the failures that Phases 2 and 3 must correct.

## Phase 2 — Resolve list ownership and match fences

- [ ] In the shared fence scanner, measure the marker end, actual separator width, and content margin in columns, including tab stops. Keep that margin and the preceding block kind with their owning container. Cover bullets, decimal, lettered, Roman, and automatic markers, excess padding, empty markers, and two markers on one line. [Fence scanner](../../src/cli/markdown-pdf/profile/fence-signals.ts)
- [ ] Resolve whether a line continues the current item, starts a sibling, returns to its parent, or belongs to the document. Distinguish lazy paragraph continuation from a fence that can interrupt prose. Exercise fences on the marker line and after headings, literal lines, Div delimiters, inline HTML, comments, dashed paragraph continuations, pipe tables, and verse. Replay the earlier failures by varying one boundary at a time. [Cases from successive reviews](../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#what-successive-reviews-found)
- [ ] Match an opener to a compatible closer in its container. A closer needs the same marker, a sufficient run length, and empty closing info. Contrast an in-item closer with one moved to a sibling and assert that an unmatched opener leaves a later heading and table visible. Preserve efficient matching for repeated unmatched candidates.
- [ ] Drive both the hint and the fenced-body exclusion from the matched span. Preserve unlabeled and raw-fence behavior, and keep visible source lines at their original widths for the row collector. Cover returns from child verse and pipe tables to both the parent item and the document. [Document signal collection](../../src/cli/markdown-pdf/profile/signals.ts)

**Checkpoint** — All six offline expectations and both top-level controls pass. A one-space tilde fence after nested verse contributes a Python hint and zero body rows. After top-level verse it contributes no hint and one body row. At seven spaces under an empty nested marker, changing only its trailing separator from absent to one space changes the result from no hint and four total rows to `python` and three.

## Phase 3 — Use the same fence spans during HTML recovery

- [ ] Supply the container-relative candidate spans to HTML delimiter recovery and ordinary fence recognition. Decide which matched fences are visible after resolving the HTML region. Preserve original source offsets across tabs and line endings so a recovered suffix resumes at the correct character. [Source cursor](../../src/cli/markdown-pdf/profile/source-cursor.ts)
- [ ] In both the comment and `textarea` recovery fixtures, put the apparent close inside a matched `sh` fence, first at the top level and then under a numbered item. Keep the H1 between the HTML opener and the fence. Repeat with a genuine close immediately after the HTML opener. Every variant should expose the recovered and trailing H1s, the `sh` and `js` hints, and three table rows. [Recovery fixtures](../../test/markdown-pdf/actions/fixtures/markdown-source-fixtures.ts)
- [ ] In the nested `textarea` case, add a second item (`2. Sibling`) after the matched fence. Move only the four-space-indented closing tildes from the first item to a separate paragraph inside the second. The first opener now lacks a closer in its item, so its `</textarea>` closes the element and hides the earlier H1. Expect only `# Visible heading`, the `js` hint, and three source rows. Moving the closer back restores the two-H1, two-hint result.
- [ ] Keep the genuine close *after* the apparent Python fence in `real-close-after-fenced-textarea-delimiter`. Test both placements of the fence. Only the trailing visible H1, `js`, and three rows should survive. Also retain the complete `closed-textarea-with-apparent-fence` control, whose apparent `text` fence contributes no hint.

**Checkpoint** — Moving a fence into a list preserves each recovery fixture’s expected signals. Moving the genuine HTML close before or after the example gives the corresponding visible or literal contents.

## Phase 4 — Verify authoring and rendering through the application

- [ ] Run the boundary fixtures through Profile, Template, and Project. Compare each helper’s signals to the fixture expectations and to the other helpers. Run once with a detectable Pandoc stub that records any invocation and once with Pandoc absent. Require zero Pandoc calls, including the version probe. Retain coverage for language and row limits, overflow, and source row widths. [Authoring integration test](../../test/markdown-pdf/actions/authoring-source-signals.app.test.ts)
- [ ] With real Pandoc 2.0 and 3.9, render representative list, literal-code, and HTML recovery inputs through the shared application service. For the numbered item, run the same body with an eligible built-in front-matter title (Markdown → JSON → HTML) and without a title (Markdown → HTML). On both routes, require 3.9’s Python-classified block containing `| fenced | sample |` inside the numbered item, and require 2.0 to render that example without a code block. For the literal and HTML recovery cases, compare block content and surviving headings with that version’s Phase 1 reader results. [Render integration fixtures](../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts)
- [ ] Run `bun run test:unit`, `bun run test:integration:app`, and `bun run test:integration:pandoc`. Record suite results and identify which targeted cases ran on each verified Pandoc version. Recheck any mismatch against the Phase 1 input and expectation.

**Checkpoint** — All three helpers agree offline. Both render routes preserve each real reader’s interpretation, including the known 2.0 and 3.9 difference for the same list fence.

## Phase 5 — Validate documentation and close the record

- [ ] Check the authoring and rendering guides against the verified outcomes. Update affected wording or examples where users need to distinguish a source hint from rendered output. Validate changed examples against the Phase 4 results. [Profile guide](../guides/markdown-pdf-codex-profile-helper.md) · [Template guide](../guides/markdown-pdf-codex-template-helper.md) · [Project guide](../guides/markdown-pdf-codex-project-helper.md) · [Markdown PDF usage](../guides/markdown-pdf-usage.md)
- [ ] Review Markdown formatting, relative links, and traceability among research, plan, and unified record. Check `git diff --check` and review the documentation diff. If a claim disagrees with the implementation, reopen its phase, resolve the discrepancy, and repeat the affected validation.
- [ ] Match every completed item to evidence in the unified record, including both Pandoc versions and the final reviewed scope. Record the docs review and resolution of findings. Mark the plan and job record `completed` when all five checkpoints pass, then update the research status according to the evidence and link its outcome.

**Checkpoint** — A reader can trace each documented behavior to a fixture, a verified result, and its phase in the single job record.
