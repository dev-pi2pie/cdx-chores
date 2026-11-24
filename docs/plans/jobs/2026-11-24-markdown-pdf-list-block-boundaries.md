---
title: "Markdown PDF list block boundaries implementation record"
created-date: 2026-11-24
modified-date: 2026-11-24
status: in-progress
agent: codex
---

The [implementation plan](../plan-2026-11-24-markdown-pdf-list-block-boundaries.md) defines the five original checkpoints and the subsequent title follow-up. Implementation started from `60df6caf`.

## Phase 1 — Establish the compatibility fixtures

Measured 21 named fixtures from the same Markdown bytes with the offline scanner and both readers. Nine scanner results differ from their offline target. The [shared fixtures](../../../test/markdown-pdf/actions/fixtures/list-block-boundaries.ts) preserve the marker padding and blank lines. The [source checks](../../../test/markdown-pdf/actions/profile-codex/source-boundaries.unit.test.ts) assert each target independently for headings, hints, rows, and pipe-body contribution. Bun marks the 19 known failing checks with `test.failing`. Promote each to an ordinary check when the target passes.

### Lists and top-level controls

All three consumers saw only the final H1, `Visible heading`, in these eight inputs. Scanner cells give language hint, total source rows, and rows added by replacing a plain body line with the pipe line. Reader cells describe `CodeBlock` nodes. “Literal” means an unclassified block retaining both fence delimiters in its text. “None” means no code block.

| Fixture | Scanner at `60df6caf` | Offline target | Pandoc 2.0 | Pandoc 3.9 |
| --- | --- | --- | --- | --- |
| numbered | —, 4, +1 | python, 3, +0 | None | Python in ordered item |
| nested-verse | python, 4, +0 | python, 4, +0 | None | Python at document level |
| document-verse | —, 4, +1 | —, 4, +1 | None | None |
| empty-six | —, 4, +1 | python, 3, +0 | None | Python in nested bullet item |
| empty-seven | —, 4, +1 | —, 4, +1 | Literal in nested bullet item | Literal in nested bullet item |
| padded-seven | —, 4, +1 | python, 3, +0 | None | Python in nested bullet item |
| document-fence | python, 3, +0 | python, 3, +0 | Python at document level | Python at document level |
| document-literal | —, 4, +1 | —, 4, +1 | Literal at document level | Literal at document level |

### HTML recovery

Every input ends with the visible H1. Each cell lists any **additional H1s** before the slash and the ordered hints or code blocks after it. “Recovered”, “Before”, and “Literal” refer to `Recovered heading`, `Literal heading before apparent fence`, and `Literal heading`. All scanner results have three source rows except the indicated five. An asterisk identifies a code block in the ordered item. All other reader blocks are at document level. “Unlabeled” denotes a real block with an empty class list. The [reader assertions](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) also check its exact text, including any embedded delimiters.

| Fixture | Scanner at `60df6caf` | Offline target | Pandoc 2.0 | Pandoc 3.9 |
| --- | --- | --- | --- | --- |
| comment-document | Recovered / sh, js | Recovered / sh, js | — / js | — / unlabeled |
| comment-document-early-close | Recovered / sh, js | Recovered / sh, js | Recovered / sh, js | Recovered / sh, js |
| comment-item | — / js | Recovered / sh, js | — / unlabeled, js | — / unlabeled, js |
| comment-item-early-close | Recovered / js | Recovered / sh, js | Recovered / js | Recovered / sh\*, js |
| textarea-document | Recovered / sh, js | Recovered / sh, js | Recovered / sh, js | — / unlabeled |
| textarea-document-early-close | Recovered / sh, js | Recovered / sh, js | Recovered / sh, js | Recovered / sh, js |
| textarea-item | — / js | Recovered / sh, js | Recovered / js | — / unlabeled, js |
| textarea-item-early-close | Recovered / js | Recovered / sh, js | Recovered / js | Recovered / sh\*, js |
| closer-in-item | — / js | Recovered / sh, js | Recovered / js | — / unlabeled, js |
| closer-in-sibling | — / js | — / js | Recovered / js | — / js |
| genuine-close-after-document | — / js | — / js | Before, Literal / python, js | — / unlabeled |
| genuine-close-after-item | Literal / js (5 rows) | — / js | Before, Literal / js | Literal / unlabeled, js |
| closed-textarea | — / — | — / — | — / text | — / — |

### Verification

- `pandoc --version` identified 2.0 and 3.9. With each reader selected, `bun test --path-ignore-patterns '**/fixtures/**' ./test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts` exercises the same 21 inputs using `--from=markdown --to=json`. All 42 reader comparisons passed.
- `bun run test:unit` passed 2,377 tests, including the 19 expected failures above. `bun run test:integration:pandoc` passed 27 tests on 3.9. TypeScript and lint checks passed.

Independent code review cleared `60df6caf..4a4c0627` with no findings. All five Phase 1 checklist items are complete. The three list mismatches and six HTML mismatches above provide the starting cases for Phases 2 and 3.

## Phase 2 — Resolve list ownership and match fences

Started from `b66bc6df`. The scanner tracks the content margin and preceding block for each item and the document. One matched span supplies the language and excludes its body. Visible rows retain their source widths. [List ownership tests](../../../test/markdown-pdf/actions/profile-codex/list-ownership.unit.test.ts)

| Check | Observed result |
| --- | --- |
| Eight Phase 1 list and document controls | All offline targets pass. The numbered, six-space, and padded seven-space cases now give `python`, three rows, and zero added body rows. The unpadded seven-space control gives no hint and four rows. |
| Adjacent blocks and closers | A parent fence after child verse and a fence after a child table see the destination’s block state. Moving the only closer into a sibling keeps the earlier body row visible. A sibling with its own complete fence retains its hint. |
| HTML controls | Both genuine early closes under a numbered item now expose `sh` and `js`. Four Phase 3 fixtures still differ from their targets across eight expected-failure assertions. |
| Reader compatibility | `pandoc --version` confirmed 2.0 and 3.9. All 27 reader cases passed on each. The six additions check code text and list ancestry after verse, a table, a sibling opener, or an item fence followed by prose. [Reader checks](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) |
| Regression checks | `bun run test:unit` passed 2,463 tests. `bun run test:integration:pandoc` passed 27 tests on 3.9. All 38 targeted authoring tests passed, including agreement across Profile, Template, and Project with Pandoc available and absent. TypeScript, lint, formatting, and whitespace checks passed. |

| Checkpoint | Correction and reader evidence |
| --- | --- |
| `2f066d01` | Introduced item-relative margins and matched spans. The eight original list and document controls passed. |
| `7100245f` | Kept inline backticks and contextual HTML tags within their item and retained outdented prose in its paragraph. All eight added controls matched the 3.9 language targets. On the three outdented prose cases, 2.0 produced no Python block. |
| `1d709235` | Preserved a following fence after a tight paragraph containing a comment or following a heading. Distinguished an ordered item from text above a Setext underline. All 13 controls matched 3.9. On the bullet and two continuing ordered-list controls, 2.0 produced no Python block. |
| `50124fb3` | Retained the preceding blank line when returning from a child and recognized an underlined title after tight parent prose. Both readers agreed on all four blank-line controls. Only 3.9 produced Python blocks for the two nested title controls. |
| `2d9fe21a` | Kept outdented text in a continuing list paragraph after a fence. In `prose-after-tilde-block`, 3.9 keeps the apparent Python fence in the paragraph and 2.0 emits a document-level Python block. Change only the first fence to backticks and both readers emit the Python block. The offline helper follows 3.9 on both inputs. |
| `ee3086c6` | Applied each enclosing marker width to partially outdented backticks. Under a three-column ordered marker and a two-column bullet, both readers recognize Python at zero, two, three and five spaces. At one and four spaces, the backticks form inline code. Moving the closer to a sibling or past the item leaves the pipe row visible. |
| `2bb809a6` | Used the same ownership decision for tildes before checking whether they interrupt prose. In the same six-width comparison, two-space tildes stay in the child paragraph on both readers and leave the pipe row visible. At one and four spaces only 3.9 recognizes the Python block. |

The full application suite stopped at its DuckDB extension preflight during Phase 2. The [Phase 4 verification](#phase-4--verify-authoring-and-rendering-through-the-application) records the subsequent full run.

Independent implementation and test reviews cleared `b66bc6df..2bb809a6`. The implementation reviewer compared 384 combinations of marker, margin, body and blank-line placement against Pandoc 3.9. All language hints agreed. All four Phase 2 checklist items are complete.

## Phase 3 — Use the same fence spans during HTML recovery

Started from `f786aff5`. Commit `04927533` exposed the opener and closer selected by the ordinary scanner. Commit `978faaa9` used those spans to decide whether an apparent HTML close belongs to a code example. A genuine close resumes scanning at its original source offset. All eight expected failures across four fixtures became ordinary passing assertions.

| Control | Observed offline result |
| --- | --- |
| Comment and `textarea`, at document level or in the numbered item | The recovered and trailing H1s, hints `sh` then `js`, and three source rows survive. A genuine close before the example gives the same signals. |
| Move the fence closer from the first item to its sibling | Only the trailing H1, `js`, and three rows survive. Moving it back restores both H1s and hints. |
| Genuine `</textarea>` after the apparent Python fence | Both placements expose only the trailing H1, `js`, and three rows. The complete closed-`textarea` control contributes no `text` hint. |
| Pipe suffix after a tab-indented close | Comments and `textarea` preserve the visible pipe suffix and its original source width under LF, CRLF, and CR. [Recovery tests](../../../test/markdown-pdf/actions/profile-codex/html-fence-recovery.unit.test.ts) |

Review found that repeated genuine closes in one item rebuilt its fence index, and that a heading inside a closed `textarea` could change which headings survived an outer comment. Commit `e10250e0` shared the item’s index and resolved the inner element before using its fences for the outer comment. The paired heading and prose fixtures now both expose only the trailing H1 and the `js` hint. Across 60 and 480 repeated regions in one item, indexed lines rose from 1,184 to 9,584.

Verified versions with `pandoc --version`, then ran the [reader checks](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) on identical Markdown bytes. All 29 fixtures passed on both 2.0 and 3.9. For the new nested HTML pair, both readers produced an unlabeled block containing literal tildes, the trailing JavaScript example, and the visible H1. Each reader retained its own expectations for the earlier fixtures.

`bun run test:unit` passed 2,497 tests. The targeted authoring checks passed 38 tests, including Profile, Template, and Project with Pandoc present and absent. `bun run test:integration:pandoc` passed 27 tests on 3.9. TypeScript, lint, formatting, and whitespace checks passed.

Independent implementation and test reviews cleared `f786aff5..e10250e0`. Re-review confirmed both fixes and checked 120 combinations of nested HTML kinds and fence placement. Replacing prose with a heading inside the innermost genuinely closed region preserved the outer signals in every pair. All four Phase 3 checklist items are complete.

## Phase 4 — Verify authoring and rendering through the application

Started from `e9b5e7f9`. At `b7b7911c`, Profile, Template, and Project agreed on all 29 boundary fixtures with Pandoc absent and with a detectable Pandoc stub. All heading, language, and row targets passed. The stub recorded zero invocations, including version probes. The limits control retained 12 languages with one overflow, one unlabeled fence, and 50 source rows with two overflow rows. The widest retained row kept its original width. [Authoring checks](../../../test/markdown-pdf/actions/authoring-source-signals.app.test.ts)

Commit `96ae5f2d` exercised the untitled Markdown → HTML route and the titled Markdown → JSON → HTML route. Both used the same Markdown body. The tests checked the conversion sequence and matched the exported HTML to the input received by the PDF renderer stub. [Render checks](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts)

| Fixture | Pandoc 2.0 on both routes | Pandoc 3.9 on both routes |
| --- | --- | --- |
| `numbered` | The ordered item retains the pipe text as inline code. | The ordered item contains a Python code block with the exact pipe text. |
| `document-literal` | An unclassified document-level code block retains both backtick delimiters. | Same as 2.0. |
| `comment-item-early-close` | Both body H1s survive. Only the document-level `js` block remains. | Both body H1s survive. The ordered item also contains the `sh` block with `-->`. |
| `textarea-item` | The reader emits a recovered H1, but its HTML markup lands inside the textarea as text. Only the trailing H1 survives as a body heading, and `js` is the only code block. | The textarea contains the original Markdown heading as text. An unclassified document-level block contains the closing tildes, followed by the `js` block and the trailing body H1. |

Review led to `a8ecd37b`, which added the ambiguous textarea case and compared each application render with a separate Pandoc conversion of the original input. The comparison covers heading text, code text and language, and ordered or unordered list ancestry. The authoring detector now logs calls even when a subprocess filters its environment. The width control includes indentation, and the shared scanner tests retain all four list transitions after duplicate checks were removed.

`pandoc --version` confirmed 2.0 and 3.9. All 29 [reader fixtures](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) and eight application renders passed on each version. `bun run test:unit` passed 2,509 tests. `bun run test:integration:app` passed 2,768 tests. `bun run test:integration:pandoc` passed 35 tests on 3.9. TypeScript, lint, formatting, and whitespace checks passed.

Independent code and test reviewers cleared the full revised range `e9b5e7f9..a8ecd37b`. All three Phase 4 checklist items are complete.

## Phase 2 follow-up and separate title correction

Branch review reopened Phase 2 at `f9f80fdd`. Profile, Template, and Project missed the Python hint in all three original examples. The definition and compact-list examples also counted a fenced pipe line as a table row. At `a39cd9e7`, each example exposes one trailing H1, the Python hint, and three source rows, all outside the fence. Commit `c2f11532` adds the outdented definition closer and its blank-line control. The authoring helpers agree with Pandoc absent and with a detectable stub that recorded zero calls. [Offline fixtures](../../../test/markdown-pdf/actions/fixtures/list-block-boundaries.ts)

| Fence placement | Pandoc 2.0 | Pandoc 3.9 |
| --- | --- | --- |
| Four-space fence after a blank in a definition | Python in the definition | Python in the definition |
| Two-space fence immediately after `1. - Item` | No code block | Document-level Python block |
| Three-space fence after a quote in a loose bullet item | Python inside the quoted list item | Python inside the quoted list item |
| Two-space definition opener with an adjacent outdented closer | No code block | Python in the definition |
| Same closer moved past a blank line | No code block | No code block |

Both application render routes preserve the installed reader’s interpretation of each body. The checks compare code text and ancestry with an independent Pandoc conversion. [Reader fixtures](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) · [Render fixtures](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts)

The separate title correction came from a matching Setext H1 inside a hidden Div. Both readers preserve the H1 in the AST. Using it as a visible duplicate removed the only visible title.

| Commit | Verified title decision |
| --- | --- |
| `7de799cf` | Keep the metadata title for a hidden match. Suppress it when a later visible H1 matches. |
| `cdb0f4d9` | Honor inherited `visibility:hidden`, a child restoring visibility, and inline `display:block` overriding the HTML `hidden` attribute. |
| `4b7244cf` | Accept reordered display keywords. Ignore the unsupported `revert-layer` override after `display:none`. |
| `89eebc89` | Resolve inline variables and preserve the case of display keywords. A variable-hidden match retains the title. Uppercase `NONE` leaves the matching H1 visible in WeasyPrint 70. |
| `cda63100` | Use a defined inline variable before its nested fallback. Hidden and visible controls both failed before the fix and passed on both readers afterward. Keep the metadata title when inline visibility remains uncertain. |
| `c61355cf` | Preserve the empty substitution in `display:var(--missing,) none`. A variable with an empty computed value uses its supplied fallback. |
| `6a1d2d0c` | Keep the metadata title when the matching H1 belongs to a table column or column group. Both discard their heading content. |
| `4ffacebe` | Suppress the duplicate when floating or absolute positioning turns the column into a visible block. Plain columns still retain the metadata title. |
| `9a87c949` | Keep the metadata title when the matching heading becomes running page material. A floated column can no longer remove the only body title. |
| `eb360181` | Validate the destination property after variable substitution. Both column types keep the metadata title when a variable supplies the running position directly or through a fallback. |

WeasyPrint 70 printed exactly one `Report` H1 in each of 54 application PDFs at `eb360181`, covering 27 title controls from each Pandoc version. The 330 inline variable and fallback cases preserved the metadata title whenever the matching H1 was hidden. The classifier also agreed with printed text in all 600 display cases and all 1,146 position and float cases that produced a PDF. WeasyPrint raised a layout error in six exploratory cases involving an un-floated running table column. [Title controls](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts) · [WeasyPrint display computation](https://github.com/Kozea/WeasyPrint/blob/v70.0/weasyprint/css/computed_values.py#L495-L510)

At `eb360181`, each reader passed all 34 reader fixtures and all 50 application render fixtures, including direct Markdown → HTML and titled Markdown → JSON → HTML conversions. The full suites passed 2,622 unit tests, 2,768 application tests, and 72 Pandoc integration tests on 3.9. An earlier Project dry-run check passed both in isolation and in the final application run. TypeScript, lint, formatting, and whitespace checks passed.

Independent re-review cleared the three original ownership findings, the hidden-title finding, and every reported follow-up over `f9f80fdd..eb360181`. The reviewer independently ran 404 focused unit tests, 50 application render fixtures on Pandoc 3.9, and 27 title PDF checks on WeasyPrint 70. The branch verification supplied the Pandoc 2.0 results.

## Ordinary list and document quote follow-up

At `f03f5c55`, outdenting either the body or the closer of a bullet fence dropped the Python hint and exposed its pipe row. A one-space-indented fence immediately after a top-level quote also lost its language hint. The list fix at `1b5e334b` checks whether the outdented line continues the same item. The quote fix at `7c1f6724` checks the enclosing margin before stripping quote indentation.

| Source placement | Pandoc 2.0 | Pandoc 3.9 |
| --- | --- | --- |
| Bullet fence with an outdented body or closer, or fully aligned | Python in bullet item | Python in bullet item |
| Blank before outdented bullet closer | No code block | No code block |
| One-space fence immediately after quote prose | Python in quote | Python in quote |
| Blank between quote prose and same fence | No code block | Document-level Python block |
| Outdented heading immediately after bullet fence, followed by four-space shell fence | Heading in item, shell example is inline code | Heading and shell code block in item |
| Blank before that heading | Document heading and literal indented code | Document heading and literal indented code |

Re-review found that the scanner released the item at the intervening heading, lost the shell hint, and counted the second fenced row. At `3a60caf5` the scanner applies the same continuation rule between fenced blocks. Profile, Template, and Project agreed on 43 offline inputs with Pandoc absent and with a detectable executable that received zero calls. The adjacent-heading example reports both languages and counts only the three trailing table rows. [Shared fixtures](../../../test/markdown-pdf/actions/fixtures/list-block-boundaries.ts)

Each version passed 42 reader fixtures and 66 application render fixtures covering direct Markdown → HTML and titled Markdown → JSON → HTML. The earlier definition, compact-list, and quoted-list inputs remained covered. All 27 title PDFs per reader printed exactly one matching H1. Independent re-review cleared all three findings over `f03f5c55..3a60caf5`, including neighboring list, quote, and HTML recovery cases. The reviewer independently replayed Pandoc 3.9. [Reader checks](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) · [Render checks](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts)

At `3a60caf5` the regression suites passed 2,659 unit tests, 2,768 application tests, and 88 Pandoc integration tests on 3.9. Type checking, lint, formatting, and whitespace checks passed.

## Phase 5 — Validate documentation and close the record

The Profile, Template, and Project guides already point to the shared [Markdown PDF usage guide](../../guides/markdown-pdf-usage.md#codex-helper-choice). That guide now shows the four-space fence under `1. Item`. Its example matches the opening of the [numbered fixture](../../../test/markdown-pdf/actions/fixtures/list-block-boundaries.ts). The source scanner reports `python` and zero table rows for the excerpt. All three authoring helpers passed the fixture with Pandoc absent and with a detectable executable that received zero calls.

Pandoc 2.0 kept the excerpt in the item without producing a code block. Pandoc 3.9 produced a Python code block inside the ordered item. Both the direct HTML route and the titled JSON-to-HTML route matched each reader on the numbered fixture, including its trailing heading and table controls. [Application render assertions](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts)

Documentation review cleared the guide example and its evidence. Relative links and heading anchors resolved across all four guides, the research, the plan, and this record. Every cited implementation SHA was verified against the branch history. The Markdown diff passed `git diff --check`.

### Phase 5 branch review findings

Full-branch review at `c15c6467...c053bca8` reopened Phase 2. The scanner treated a list marker inside a quote as prose and missed a following tilde fence. It also released a compact quoted item at an outdented backtick opener, even when the closer belonged to the quote. Commit `29f786fd` parses the quote’s contents with the same list rules as the document and checks for a complete fence at the enclosing margin before leaving the item.

Both readers put the first Python block inside the quote, following its bullet list. Both put the second inside the quoted bullet item. Removing the quote marker from its closer moves the block to document scope. All three offline helpers retain the `python` hint and exclude the pipe row for both reported cases. Adjacent prose, explicit quote markers, and a quoted blank line provide the controls. [Regression fixtures](../../../test/markdown-pdf/actions/fixtures/list-block-boundaries.ts)

Re-review at `29f786fd` confirmed both ownership fixes and found two errors in quote projection. A tab after the quote marker inflated a 19-character row to 38 characters and changed its column count from three to five. Deeply marked quotes also retained the same intervening prose at each level. At `8edefe95`, all three helpers report the original 19 characters and three columns. A regression test verifies that 2,048 matching quote markers around 2,048 lazy prose lines use one projected body and preserve the trailing heading. [Source and nesting checks](../../../test/markdown-pdf/actions/profile-codex/source-boundaries.unit.test.ts) · [Authoring checks](../../../test/markdown-pdf/actions/fixtures/authoring-source-signals.ts)

Re-review at `8edefe95` found that a lazy prose line beginning with inline code still rebuilt the nested quote body at each level. Commit `4b4baa5e` checks whether a backtick line actually opens a complete outer fence. The inline-code and unmatched-backtick controls each use one projected body at depth 2,048. A complete fence still interrupts at the outer quote margin.

Independent code review cleared the full `origin/main` comparison `c15c6467...4b4baa5e`, including the guide at `c053bca8` and all quote corrections. It replayed the three offline helpers on 51 inputs with zero Pandoc calls, 49 Pandoc 3.9 reader fixtures, 80 application render fixtures, and 27 title PDFs. The corresponding Pandoc 2.0 reader and render checks passed in implementation verification. Both routes preserved the installed reader’s behavior.

### Final verification

At `4b4baa5e`, the full suites passed 2,696 unit tests, 2,768 application tests, and 102 Pandoc 3.9 integration tests. In earlier concurrent runs, ten benchmark tests and the Pandoc suite reached their time limits. Both suites passed when run separately with their existing limits. TypeScript, lint, formatting, and whitespace checks passed.

Documentation review cleared the guide, the [research outcome](../../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#research-outcome), and the evidence for the [five plan checkpoints](../plan-2026-11-24-markdown-pdf-list-block-boundaries.md). The original five checkpoints were complete at `2759ec4a`.

## Phase 2 follow-up after canary review

Review of `9d578d9d...2759ec4a` found that an indented quote marker after verse produced a false Python hint and hid a source row. Two separate title regressions affected the printed PDF. A nonbreaking space in a display value could remove the only visible title, and a custom property set to `initial` could print it twice. The target is one printed title in both cases.

| Correction | Verification |
| --- | --- |
| Verse ownership, `f430c285` | The indented `>` after verse continues the line block. All three offline helpers retain the pipe row and report no language. Moving the marker to the margin or inserting a blank line produces a Python fence and excludes its body row. Both direct and titled HTML matched Pandoc 2.0 and 3.9 for all three variants. [Boundary fixtures](../../../test/markdown-pdf/actions/fixtures/list-block-boundaries.ts) |
| Title visibility, `03faefbf` | The classifier preserves a nonbreaking space inside a display token and substitutes a defined custom property before interpreting its value. The two failing PDFs went from zero and two printed titles to one each. The ordinary-space, absent-variable, explicit-`none`, and plain-heading controls also printed one title on each reader with WeasyPrint 70.0. All 64 comparisons of visibility predictions to printed pages agreed. [Title checks](../../../test/markdown-pdf/direct/ast-title.unit.test.ts) |

The first re-review cleared those three regressions on `9d578d9d...03faefbf` and found a missing title with author CSS. A stylesheet hid the matching H1 after an inline-hidden earlier H1. Both readers reproduced the missing printed title.

Commit `f5992378` checks the body H1 text in a tagged print when author CSS could change the result. On Pandoc 2.0 and 3.9 with WeasyPrint 70.0, the built CLI kept the metadata title when external, embedded, or imported CSS hid the match. Decorative CSS and a rule hiding an unrelated element preserved deduplication. An earlier H1 revealed by CSS remained the first eligible heading, and a heading printed in a page header did not count as a body H1. All nine stylesheet cases per reader matched their expected PDF text and final HTML. [Title selection tests](../../../test/markdown-pdf/direct/styled-title.unit.test.ts) · [Application render test](../../../test/markdown-pdf/actions/rendering/ast-render.app.test.ts)

At `9e159a3a`, the full suites passed 2,730 unit, 2,769 application, and 110 Pandoc 3.9 integration tests. All 52 reader fixtures passed on each version. The first 2.0 replay reached the 30-second test limit. A batched replay checked the same fixture bytes and assertions. Build, type checking, lint, formatting, and whitespace checks passed.

### Open title findings after the third canary review

The third review covered `9d578d9d...9e159a3a` and `c15c6467...9e159a3a`. It cleared the three original findings and the stylesheet hiding the matching H1. Two regressions remain in automatic title selection with author CSS. Both reproduced on the built CLI with Pandoc 2.0 and 3.9 and WeasyPrint 70.0. Raster comparisons used the same document with explicit `show` and `hide` as controls.

| Author stylesheet | Observed output | Expected output |
| --- | --- | --- |
| `#report { color: transparent }` after an earlier inline-hidden H1 | The tagged PDF contained “Report”. The rendered `auto` page matched `hide` pixel for pixel and showed only the body text. | Keep the visible metadata title. |
| `#report { letter-spacing: 0.25em }` on the first H1 | Extraction inserted spaces into the label. The rendered `auto` page matched `show` pixel for pixel and printed both titles. | Use the visible body heading once. |

These results reopened the research into [automatic title selection](../../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#accepted-direction-for-automatic-title-selection). The [dedicated follow-up phase](../plan-2026-11-24-markdown-pdf-list-block-boundaries.md#follow-up--automatic-metadata-titles-under-author-css) owns the experiment, implementation, guide update, and canary re-review. Both findings remain open.

## Follow-up experiment on complete title visibility

At `f0cf7591`, the built CLI rendered nine single-page fixtures in `auto`, `show`, and `hide` on Pandoc 2.0 and 3.9 with WeasyPrint 70.0 (54 PDFs). The transparent and letter-spaced fixtures reproduced the two failures above. For each fixture, the prototype printed the `hide` HTML and original styles twice. The first raster matched the CLI’s `hide` page. The second print suppressed only the selected H1’s source text at draw time, including text in descendants. Borders, backgrounds, generated content, and layout remained in place.

The prototype compared the source title with the emitted glyphs and checked for changed pixels in every non-space glyph’s bounding box. Both readers gave the same results.

| Fixture | Observation | Proposed omission test |
| --- | --- | --- |
| Transparent text, with or without a visible border | All six glyphs were emitted. Suppressing them changed no pixels. | Correctly retained the metadata title. |
| Letter-spaced title or ordinary navy text | All six glyphs were emitted and visible. | Correctly omitted the block. |
| Hidden emphasis or a heading hidden by `:first-child` | Only “Re” or no glyphs were emitted. | Correctly retained the block. |
| Opaque overlay covering the suffix from `left: 1em` | Some glyph boxes contained no changed pixels. | Correctly retained the block. |
| Opaque overlay covering the bottom half, or `overflow: hidden; height: .65em` | Every glyph box contained changed pixels. Inspection of both rasterized controls showed cut-off letters. | Incorrectly omitted the block in both cases. |

To reproduce the lower-half overlay, give `#report` relative positioning and set `#report::after { content: ""; position: absolute; top: 50%; right: 0; bottom: 0; left: 0; background: white }`. The clipping control needs only the overflow and height declarations in the table. Both use the built-in styles, frontmatter title `Report`, and body heading `# Report {#report}`.

On the two reported fixtures, the existing tagged-PDF check took 213–223 ms and the two-print prototype took 277–300 ms. Each range spans four medians, one per reader and fixture, with three timed runs after warm-up. Timings cover the proof and its inspection on these single-page inputs. The prototype also rasterized and compared the CLI control.

**Decision.** Reject this omission test. Source identity, the full emitted string, and some visible ink in each glyph box still allow a partially covered title to pass. The implementation and guide await a decision on how to establish complete visibility. [Research decision](../../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#why-a-pixel-change-in-every-letter-is-insufficient)

Independent review of `9d578d9d...35a1ab3c` found no new actionable issues. On Pandoc 3.9 and WeasyPrint 70.0, the reviewer reproduced both cut-off titles. Every glyph box changed in the paired prints, although each title retained less than half the changed pixels of its unobscured control. All 2,730 unit tests passed in review. This clears the experiment checkpoint. The two production findings and final canary clearance remain open.

## Unobscured title experiment

At `ec6e5a9a`, the built CLI rendered nine fixtures in `auto`, `show`, and `hide` on each of Pandoc 2.0 and 3.9 with WeasyPrint 70.0. The Markdown and styles were identical across readers. The current CLI produced the `show` page for all four letter-spaced variants and the `hide` page for the transparent title. The results below are from the separate prototype.

The prototype used each reader’s Pandoc JSON and built-in HTML with the metadata header omitted. It compared the complete letter shapes with the printed page on a white background. Clipping, overlapping paint, or missing evidence kept the header. It rendered the selected HTML independently of the explicit controls.

| Fixture | Expected and observed on both readers |
| --- | --- |
| Fully visible letter-spaced `Report`, with and without the overlay in clear space | `hide` for both. The heading supplied the complete title. |
| Letter-spaced heading clipped to `.65em` or covered across its lower half | `show` for both. The glyph bounds extended outside the clip or intersected later paint. |
| Letter-spaced heading with a `2em`-high clip | `hide`. The glyph bounds fit inside the clip. |
| Transparent title after an inline-hidden H1, hidden emphasis, H1 hidden by `:first-child` | `show` for all three. |
| Ordinary visible navy title | `hide`. |
| Visible letter-spaced title with identity evidence withheld, then with identity known but visibility evidence withheld | `show` for each independent injection. |

For the overlay pair, `#report` had relative positioning and `letter-spacing: .25em`. Its white, absolutely positioned `::after` rectangle was `8em` wide with `top: 50%` and `bottom: 0`. Moving only `left` from `0` to `10em` put the same rectangle in clear space on the page. The clipped pair used `overflow: hidden` and varied only the height. [Fixture expectations](../../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#experiment-on-unobscured-title-text)

All 22 candidate PDFs matched only the expected explicit control from their own reader. MuPDF and Poppler independently compared the full rasterized pages. The selected HTML agreed on header presence in every case. The four paired cases each needed one WeasyPrint proof, the same count as the current check. Positive decisions additionally rasterized the original proof and two in-memory PDF variants. Across the eight reader/fixture combinations, median proof time was 211–216 ms for the current check and 265–289 ms for the prototype, including proof inspection and excluding the final print. Each median used three timed runs after warm-up.

**Decision after the experiment.** Accepted the visibility rule for `auto` on the strength of the two-reader experiment recorded at `98276ddf`. Keep the metadata block whenever source identity or complete visibility is uncertain. The positive evidence covers a single opaque text run on white. The built Node.js CLI still needs verification on Pandoc 2.0 and 3.9 when source identity is missing and when identity is known but complete visibility is uncertain. [Accepted direction](../../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#accepted-direction-for-automatic-title-selection) · [Follow-Up checklist](../plan-2026-11-24-markdown-pdf-list-block-boundaries.md#follow-up--automatic-metadata-titles-under-author-css)

## Node.js title visibility experiment

With WeasyPrint 69.0, the Node.js prototype compared 12 fixtures and two independent fallback checks per reader. The built CLI supplied the Pandoc output and explicit `show` and `hide` controls. The prototype selected and printed its own HTML. All 14 full-page rasters per reader matched only the expected control, and the selected HTML agreed on metadata header presence.

| Prototype result on Pandoc 2.0 and 3.9 | Fixtures |
| --- | --- |
| Matched `hide` | Fully visible letter-spaced “Report”, an overlay in clear space, a clip tall enough for every letter, and an ordinary visible navy title. |
| Matched `show` | A clip through the letters, an overlay across them, transparent text alone or after a hidden H1, hidden emphasis, a heading hidden by `:first-child`, coincident same-label headings, and CSS-generated lookalike text. |
| Matched `show` in both fallback checks | On the fully visible letter-spaced fixture, withhold source identity alone, then retain identity and withhold visibility alone. |

For the visible letter-spaced fixture, median proof time rose from 262 to 523 ms on Pandoc 2.0 and from 258 to 532 ms on 3.9. Each median covers three runs after warm-up and excludes the final print. The single-run result supports the [Node.js implementation direction](../../researches/research-2026-11-23-markdown-pdf-list-block-boundaries.md#identifying-a-plain-text-h1-in-nodejs). Production implementation, both built-CLI fallbacks, and the earlier-hidden-H1 compatibility check remain open in the [Follow-Up checklist](../plan-2026-11-24-markdown-pdf-list-block-boundaries.md#follow-up--automatic-metadata-titles-under-author-css).
