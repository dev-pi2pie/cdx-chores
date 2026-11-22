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

**Status** — Pending.

## Phase 3 — Offline Source Scanning

**Status** — Pending.

## Phase 4 — Integrated Renderer Validation

**Status** — Pending.

## Phase 5 — Docs Validation

**Status** — Pending.
