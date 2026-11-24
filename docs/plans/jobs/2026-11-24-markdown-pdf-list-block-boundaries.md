---
title: "Markdown PDF list block boundaries implementation record"
created-date: 2026-11-24
status: in-progress
agent: codex
---

The [implementation plan](../plan-2026-11-24-markdown-pdf-list-block-boundaries.md) defines the five checkpoints. Implementation started from `60df6caf`.

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

## Phase 5 — Validate documentation and close the record

Pending.
