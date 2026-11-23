---
title: "Markdown PDF AST rendering implementation"
created-date: 2026-11-22
modified-date: 2026-11-23
status: completed
agent: codex
---

## Goal and scope

Use Pandoc’s parsed document for built-in automatic title deduplication. Keep fence-only counts, source table metrics, and offline authoring on the shared source scanner. Use direct Markdown-to-HTML conversion for custom templates so Pandoc receives the original source path and preserves `$sourcefile$` and fallback `$pagetitle$`.

## Related Research

- [Markdown PDF AST-based rendering](../researches/research-2026-11-22-markdown-pdf-html-boundaries.md)

## Unified job record

Implementation started at `ddc5d119` and is tracked in the [unified job record](jobs/2026-11-22-markdown-pdf-ast-rendering.md). The settled research is recorded at `0f260243`.

Give the record the same five phase headings as this plan. Under each heading, record status, a short outcome, verification commands and results, and review evidence. Use short Git SHAs for the reviewed range when commits exist. For uncommitted work, record the baseline SHA and the reviewed diff. Use repository-relative links and public-safe wording.

| Job record section | Evidence to capture |
| --- | --- |
| Phase 1 — AST Title Comparison | Heading eligibility, title comparison, and same-link and distinct-link outcomes on both Pandoc versions. |
| Phase 2 — Shared Render Execution | Paths taken by CLI and interactive renders, custom-template variables, warnings, and failure and cleanup behavior. |
| Phase 3 — Offline Source Scanning | Boundary and recovery fixtures, source metrics, and authoring results with Pandoc available and unavailable. |
| Phase 4 — Integrated Renderer Validation | Suite results, Pandoc versions, HTML and PDF outcomes, and timing measurements. |
| Phase 5 — Docs Validation | Guides and examples checked, link and Markdown validation, review findings and resolutions, and final status. |

Check off a task once its verification is recorded. Review each phase against its recorded baseline. If a review fix changes the diff, rerun the affected checks and record the updated review scope.

## Phase 1 — AST Title Comparison

- [x] Create and link the unified job record, populate its five phase sections, and record the implementation baseline.
- [x] Read the Pandoc document shapes needed by the title decision. Select the first Markdown H1 in document order at the top level or inside native Divs. ATX and Setext headings qualify. Cover raw HTML, verbatim bodies, quotes, lists, tables, and footnotes in the heading selection fixtures.
- [x] Compare displayed text from the parsed metadata title and eligible H1 with the same projection. Fold case and whitespace and preserve punctuation, including in inline code. Keep the metadata block when either projection is unsupported, including when a later H1 would match.
- [x] Require a matching label and destination in the H1 for every metadata title link. Verify that matching destinations allow deduplication, while the distinct-link fixture keeps the metadata title and both destinations.
- [x] Verify the contract with unit fixtures and actual Pandoc 2.0 and 3.9 output. Cover formatted titles, a false heading inside `<pre>` before a matching Div heading, and an earlier eligible H1 followed by a later match.

**Checkpoint** — Both versions agree on the comparison result for the documented cases.

Independent review cleared `ddc5d119..79cff61f`. The [Phase 1 job record](jobs/2026-11-22-markdown-pdf-ast-rendering.md#phase-1--ast-title-comparison) records the checks and outcome.

## Phase 2 — Shared Render Execution

- [x] Route shared CLI and interactive render execution through `Markdown → Pandoc JSON → standalone HTML` when the template is built-in, `metadataTitle` is `auto`, front matter supplies a nonempty string title, and the cover is disabled. Preparation stays independent of Pandoc. Use the installed Pandoc’s `--from=markdown` reader once and pass that same AST to the HTML writer.
- [x] Keep direct conversion for custom templates, explicit `show` and `hide` modes, cover-driven titles, and inputs without an eligible front-matter title. Verify route selection and process calls in the shared service, including prepared and resumed interactive renders.
- [x] Preserve the Markdown working directory, writer and TOC options, relative assets and asset restrictions, highlighting, and the existing HTML and PDF output handling. Verify a direct custom-template render receives the original single `$sourcefile$` entry and expected fallback `$pagetitle$`.
- [x] Preserve warning order from the reader and writer. Exercise reader failure, invalid AST output, and writer failure. Verify stage-specific diagnostics, temporary file cleanup, and preservation of existing output files on those failures.

**Checkpoint** — Both entry points use the intended render path and preserve their output and failure contracts.

Independent review cleared `3444cb8f..66655a56`. The [Phase 2 job record](jobs/2026-11-22-markdown-pdf-ast-rendering.md#phase-2--shared-render-execution) records the checks and outcome.

## Phase 3 — Offline Source Scanning

- [x] Refine the shared collector with a quote-aware cursor and block context. Use exact end offsets for tags, comments, verbatim regions, and inline code spans so the scanner can resume on the same line.
- [x] Treat closed `textarea` bodies as literal, require a blank line before a tilde fence after `</summary>`, and continue scanning Markdown inside an unclosed `div`. Verify the same policy across Pandoc availability and version.
- [x] Cover matched and bare closing tags, adjacent and spaced comments, wrapped or quoted attributes, and incomplete markup. Assert that a visible H1 and pipe table after the apparent fence still contribute source signals.
- [x] Verify Profile, Template, and Project authoring with Pandoc available and unavailable. Compare their bounded signals and exercise fence-only counts, source table row widths and counts, and overflow limits.

**Checkpoint** — All three authoring entry points agree on source signals in both environments.

Independent review of `b5c195ad..d70f4188` found two boundary defects. Re-review cleared the widened range `b5c195ad..c00a8f30` after both fixes. The [Phase 3 job record](jobs/2026-11-22-markdown-pdf-ast-rendering.md#phase-3--offline-source-scanning) records the findings and verification.

## Phase 4 — Integrated Renderer Validation

- [x] Run `bun run test:unit`, `bun run test:integration:app`, and `bun run test:integration:pandoc`. Run the targeted renderer compatibility cases with actual Pandoc 2.0 and 3.9 through the implemented path.
- [x] Check standalone HTML for title behavior, TOC targets, relative assets, tables, and highlighting. Verify both links survive in the distinct-link case.
- [x] Render representative PDFs with WeasyPrint. Compare page counts and extracted text for parity inputs. Verify the corrected PDF has one visible title and retains its PDF title metadata.
- [x] Compare eligible built-in renders on small and larger inputs, using equivalent output for timing. Record Pandoc time and full PDF wall time separately, with the sample count and observed variation.

**Checkpoint** — The integrated renderer evidence covers both Pandoc versions, output parity, and the intended title correction.

Independent review cleared `02106060..f2041cb6`. The [Phase 4 job record](jobs/2026-11-22-markdown-pdf-ast-rendering.md#phase-4--integrated-renderer-validation) records the checks, timing, and review outcome.

Independent canary re-review cleared `0dd77cf5..1e040ace`. The [canary follow-up](jobs/2026-11-22-markdown-pdf-ast-rendering.md#canary-review-follow-up) records the fixes and review checks.

## Phase 5 — Docs Validation

- [x] Check the [Markdown PDF usage guide](../guides/markdown-pdf-usage.md), [interactive guide](../guides/markdown-pdf-interactive-usage.md), and related authoring guidance against the validated behavior. Update guidance where the user-visible contract changes.
- [x] Verify changed examples against the implemented commands or schema. Check Markdown formatting, relative links, and traceability between the research, plan, and unified job record.
- [x] Run `git diff --check` and review the complete documentation diff. Resolve accepted findings and rerun the affected checks. If documentation validation exposes an implementation mismatch, reopen the relevant phase and revalidate before closing the docs phase.
- [x] Record the documentation checks and review outcome in Phase 5 of the unified job record. Confirm every phase checklist has matching evidence, then mark the plan and record `completed`.

**Checkpoint** — The guides describe verified behavior and the plan and unified job record agree on completion.

Independent review cleared `bcb013fe..db49046c`. The [Phase 5 job record](jobs/2026-11-22-markdown-pdf-ast-rendering.md#phase-5--docs-validation) records the checks and review outcome.
