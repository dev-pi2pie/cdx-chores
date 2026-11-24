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
| Reader compatibility | `pandoc --version` confirmed 2.0 and 3.9. All 25 reader cases passed on each. The four added cases check code text and list ancestry after verse, after a table with a blank line, and across adjacent sibling openers. [Reader checks](../../../test/markdown-pdf/actions/rendering/list-block-boundaries.pandoc.test.ts) |
| Regression checks | `bun run test:unit` passed 2,407 tests. `bun run test:integration:pandoc` passed 27 tests on 3.9. TypeScript, lint, formatting, and whitespace checks passed. |

## Phase 3 — Use the same fence spans during HTML recovery

Pending.

## Phase 4 — Verify authoring and rendering through the application

Pending.

## Phase 5 — Validate documentation and close the record

Pending.
