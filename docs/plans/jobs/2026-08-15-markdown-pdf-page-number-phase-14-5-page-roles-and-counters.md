---
title: "Markdown PDF page-number Phase 14.5 page roles and counters"
created-date: 2026-08-15
status: active
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Complete Phase 14.5 by making cover, metadata-title, table-of-contents,
document-body, and inserted-blank page roles explicit, then proving and
implementing distinct logical and physical page-number placeholders.

Production semantics remain behind the renderer evidence gate. If the frozen
WeasyPrint matrix cannot support the intended contract safely, this job must
record a **Constrain** or **Stop** verdict and return to research instead of
shipping an approximation.

## Starting Boundary

- Starting commit and exact review base: `6b1b9bba`.
- The worktree was clean before this job record was created.
- Phase 14 and its reopened refinement are completed and retain their recorded
  historical ranges.
- The parent plan remains `active`; Phase 15 stays pending until this phase is
  implemented, renderer-proven, reviewed, and closed.
- Profile `schemaVersion` remains `3`. The phase number does not create a new
  Profile revision.

## Frozen Scope

### Evidence before production changes

- Freeze the current built-in cover, metadata-title, ToC, body, blank-page,
  repeating-content, and page-number behavior in deterministic tests.
- Extend the existing guarded renderer evidence catalog and harness. Add no
  second renderer spike, cleanup mechanism, or public artifact store.
- Run the frozen WeasyPrint `65.1`, `68.0`, and `69.0` candidates and compare
  extracted values by physical page with representative temporary page-image
  inspection.
- Prefer a one-pass counter mechanism. If that cannot satisfy the contract,
  accept a bounded second pass only after tests prove pagination stability,
  maximum-pass ownership, failure safety, and temporary-artifact cleanup.

### Page roles

- Settle cover, metadata-title, ToC, body, and inserted-blank ownership before
  changing the built-in template or page CSS.
- Compare a body-owned metadata title with an explicit title-page role. Record
  the accepted `metadataTitle: auto`, `show`, and `hide` behavior with and
  without a dedicated cover.
- Audit every `toc.pageBreak` value against actual named-page transitions and
  settle whether configured repeating content applies to ToC pages.
- Keep the dedicated cover as the explicit protected chrome-free role.
- Preserve Custom Template body-hook compatibility and Project bundle
  equivalence.

### Counter and compatibility contract

- Implement one intended meaning for each accepted token only after renderer
  proof:

  ```text
  {page}      current logical number in the countFrom domain
  {pages}     final logical number in the same sequence
  {pdfPage}   current physical PDF page
  {pdfPages}  physical PDF page count
  ```

- Keep `scope` responsible only for label visibility. Keep `countFrom`,
  `start`, and `increment` responsible for the logical sequence.
- Add revision-3 token metadata and renderer-capability relationships without
  making render behavior depend on `schemaVersion` or rewriting input
  Profiles.
- Replace the historical physical-`{pages}` diagnostic with one successful
  migration warning for an effectively enabled Profile that explicitly
  declares revision `1` or `2` and uses exact `{pages}`.
- Use shared stream-aware color presentation for terminal warnings while
  keeping redirected and structured output free of ANSI escapes.
- Teach all four tokens through the existing Interactive ghost-input contract
  without adding advanced sequence questions or expanding Codex Assistant
  authoring.

## Permanent File Boundary

The expected Phase 14.5 boundary is limited to:

- this job record, the parent plan, the page-role research, and directly
  affected current guidance
- the built-in Markdown PDF recipe and Profile page-role/page-label modules
- Profile feature and renderer-capability registries
- Markdown PDF diagnostics, render orchestration, and shared warning-color
  presentation when required by the proven mechanism
- the existing Interactive Markdown PDF formal-guide and shared template
  completion modules
- the existing page-number renderer contract catalog, guarded evidence
  harness, and their split tests
- focused existing Markdown PDF, Interactive, Project, and command tests

Any expansion into a second evidence harness, a new public artifact format,
general Codex Assistant policy, or unrelated CLI behavior requires a recorded
boundary review before editing.

Generated candidate environments, intermediate HTML/CSS, PDFs, PNGs, and raw
reports remain temporary and uncommitted. Durable evidence contains only
repository-relative commands, public renderer versions, sanitized extracted
facts, visual conclusions, cleanup status, and review results.

## Checklist

- [x] Establish the clean `6b1b9bba` starting and review boundary, activate
      this job, link the parent plan and research, and freeze the execution
      scope and evidence gates.
- [x] Freeze current page-role, page-break, repeating-content, and counter
      behavior before production changes.
- [x] Extend and validate the existing renderer evidence catalog, extraction,
      visual-review boundary, and guarded cleanup for Phase 14.5 scenarios.
- [ ] Run the renderer experiment and record an accepted one-pass or bounded
      two-pass counter mechanism plus an explicit Continue, Constrain, or Stop
      verdict.
- [ ] Settle and implement the accepted cover, metadata-title, ToC, body, and
      inserted-blank role matrix.
- [ ] Implement and verify the four-token logical/physical counter contract.
- [ ] Keep revision `3`, add token-aware feature inference and capability
      requests, and preserve non-rewriting renders.
- [ ] Implement and verify the bounded revision-1/revision-2 migration warning
      and stream-aware ANSI/plain presentation.
- [ ] Update Interactive completion, help, validation, save/reload, and
      lifecycle coverage for all four tokens.
- [ ] Verify direct, Interactive, saved Profile, Project bundle, explicit-role,
      and Custom Template rendering.
- [ ] Rerun the affected renderer matrix, inspect representative pages, record
      public-safe evidence, and close every successful or resolved laboratory
      through the guarded cleanup path.
- [ ] Run focused, broad Markdown PDF, full repository, TypeScript, lint,
      format, build, worktree, and exact-range diff gates.
- [ ] Review the exact `6b1b9bba..<implementation-and-evidence-tip>` range for
      maintainability and test quality, resolve accepted findings, widen the
      range, and re-review when fixes land.
- [ ] Review the completed job, research, and parent checklist, then commit a
      documentation-only closeout before Phase 15.

## Validation Plan

Focused validation owns page composition, page CSS, token parsing, revision
inference, diagnostics, renderer capabilities, warning presentation,
Interactive completion, Project handoff, and renderer evidence. Broader gates
then cover the complete Markdown PDF surface and repository:

```bash
rg --files test/markdown-pdf-page-number-renderer-evidence | xargs bun test
bun test test/markdown-pdf-page-number-project-renderer-contract.test.ts
rg --files test | rg 'page-number|page-chrome|template-compatibility|project-codex|cli-interactive-markdown-pdf' | xargs bun test --timeout 30000
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
git diff --check 6b1b9bba..<implementation-and-evidence-tip>
```

Renderer-sensitive checkpoints additionally require extracted real-PDF values
and representative visual inspection. A renderer-sensitive commit is not
accepted from CSS string assertions alone.

## Evidence Ledger

- Starting and exact review base: `6b1b9bba`.
- Activation checkpoint: `08399c47`.
- Current-behavior baseline: the built-in role order, metadata-title state,
  ToC break CSS, ordinary ToC repeating-content suppression, page-number
  visibility, and historical physical-`{pages}` mapping are frozen without
  production changes. The existing renderer catalog now records explicit
  physical-page roles and a non-gating one-pass four-counter experiment with
  contract-owned extraction and all-field assessment.
- Baseline validation: 38 recipe/page-chrome tests passed with 199 assertions;
  33 evidence-harness tests passed with 1,078 assertions; two deterministic
  Project contract tests also passed. TypeScript, scoped lint and formatting,
  and diff integrity passed. Pre-commit maintainability and test-quality
  re-review found no remaining material concerns.
- Renderer mechanism verdict: pending.
- Page-role implementation: pending.
- Counter implementation: pending.
- Diagnostics and Interactive implementation: pending.
- Integrated renderer evidence and validation: pending.
- Exact-range review and accepted fixes: pending.
- Documentation closeout: pending.

## Verdict

**In progress.** Production work may begin only through the frozen-baseline and
renderer-evidence gates above.

## Related Research

- [Markdown PDF Page Roles And Counter Semantics](../../researches/research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)
- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
