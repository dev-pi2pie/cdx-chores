---
title: "Markdown PDF page-number Phase 14.5 page roles and counters"
created-date: 2026-08-15
status: completed
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Complete Phase 14.5 by making cover, metadata-title, table-of-contents,
document-body, and inserted-blank page roles explicit, then proving and
implementing distinct logical and physical page-number placeholders.

Production semantics were held behind the renderer evidence gate during this
job. The frozen WeasyPrint matrix passed the intended contract, so the final
verdict is **Continue**; the recorded fallback would have been **Constrain** or
**Stop** rather than shipping an approximation.

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
- [x] Run the renderer experiment and record an accepted one-pass or bounded
      two-pass counter mechanism plus an explicit Continue, Constrain, or Stop
      verdict.
- [x] Settle and implement the accepted cover, metadata-title, ToC, body, and
      inserted-blank role matrix.
- [x] Implement and verify the four-token logical/physical counter contract.
- [x] Keep revision `3`, add token-aware feature inference and capability
      requests, and preserve non-rewriting renders.
- [x] Implement and verify the bounded revision-1/revision-2 migration warning
      and stream-aware ANSI/plain presentation.
- [x] Update Interactive completion, help, validation, save/reload, and
      lifecycle coverage for all four tokens.
- [x] Verify direct, Interactive, saved Profile, Project bundle, explicit-role,
      and Custom Template rendering.
- [x] Rerun the affected renderer matrix, inspect representative pages, record
      public-safe evidence, and close every successful or resolved laboratory
      through the guarded cleanup path.
- [x] Run focused, broad Markdown PDF, full repository, TypeScript, lint,
      format, build, worktree, and exact-range diff gates.
- [x] Review the exact `6b1b9bba..<implementation-and-evidence-tip>` range for
      maintainability and test quality, resolve accepted findings, widen the
      range, and re-review when fixes land.
- [x] Review the completed job, research, and parent checklist, then prepare
      the documentation-only closeout checkpoint before Phase 15.

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
  and diff integrity passed. The baseline-only pre-production review found no
  material concerns in that checkpoint; the later final-range review and its
  two accepted evidence gaps are recorded separately below.
- Renderer mechanism verdict: **Continue with one pass**. WeasyPrint `65.1`,
  `68.0`, and `69.0` each produced five A5 pages with cover, ToC, then three
  body pages. The body values were logical `5 / 7 / 9`, logical final `9`,
  physical `3 / 4 / 5`, and physical total `5`. Every historical renderer,
  product-compatibility, Project, dependency, and actual-launch boundary also
  passed. Those historical product paths did not yet exercise the new
  logical-final target and body-group contract. Visual
  inspection found the combined labels unclipped and fixture page order stable;
  PDF page-label metadata remained the default physical sequence. A second
  render is not required. The successful laboratory and both resolved failed
  attempts were closed through the ownership-guarded cleanup command after
  review. The accepted catalog digest was
  `c11864a4248ec151dce7c98f4f2bfd32d29fd06d67f88e836e11dcc4ed5d66bc` and
  the harness digest was
  `246473afb35a3c95bb8e1c7fd60f0163e658d55e99e37e028615071b1e08c2c5`.
  Temporary visual review covered experiment pages 1, 2, 3, and 5 plus
  built-in product pages 1, 2, and 5. The public invocation is
  `bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts run --live --keep --python <python-launcher>`;
  no machine-specific launcher or laboratory path is recorded. The catalog
  digest covers the stable fixture payload, while the harness digest covers
  stable scenario, stage, and process-boundary metadata; both are SHA-256
  values exported by the existing contract modules. The production boundary
  still requires one unambiguous body page group and one logical-final target
  across built-in and Custom Template paths; missing or ambiguous ownership
  must fail rather than fall back.
- Page-role implementation: built-in and newly managed Templates now compose
  cover, ToC, then one body group. An automatic metadata title is body-owned
  and suppressed by a dedicated cover; explicit `show` remains body-owned and
  `hide` remains absent. Configured repeating content applies to ToC and body
  pages, document-scoped page numbers may appear on the ToC, body-scoped page
  numbers remain hidden there, and the cover remains chrome-free. Custom
  Template body-hook compatibility and Project bundle equivalence remain
  covered.
- Counter implementation: `{page}` and `{pages}` use the Profile-owned logical
  counter and one post-Pandoc logical-final target; `{pdfPage}` and
  `{pdfPages}` retain the renderer's physical counters. `scope` changes only
  visibility. `countFrom`, `start`, and `increment` own logical arithmetic.
  Missing, duplicate, or colliding body/final-target ownership fails before
  final output rather than falling back silently.
- Revision, diagnostics, and Interactive implementation: Profile revision
  remains `3`; exact embedded token inference and capability requests are
  registry-owned. Explicit revision `1` or `2` plus effective exact `{pages}`
  emits one successful migration warning recommending `{pdfPages}`; missing,
  invalid, revision `3`, disabled, and near-miss inputs remain quiet. Only the
  `stderr` warning heading is yellow when that stream is color-eligible.
  Interactive ghost completion, help, validation, fallback, and save/reload
  cover all four tokens without exposing advanced sequence questions.
- Integrated renderer evidence: WeasyPrint `65.1`, `68.0`, and `69.0` passed
  the final product and Project matrix. The final catalog digest is
  `7b3761bff1b9300739936f7ccbb2ab032ea0cd1c525e26a58f451923d987cc59`;
  the harness digest is
  `dbf41562c71ee837861b4e68507fa295613ed98df840c0a4ef90b65ced8718d8`.
  The matrix proved body visibility with document-origin arithmetic, body-
  origin non-default arithmetic, a physical-only label on an inserted blank,
  automatic metadata-title ownership, and Project bundle/explicit parity.
  Representative images showed clean cover, ToC, body, blank, and metadata-
  title transitions without clipping or overlap. Every retained laboratory
  was closed through the guarded cleanup path.
- Supplementary local smoke: a gitignored Formal Guide Profile render produced
  one ToC page without a body-scoped label and four body pages labeled
  `Page 1 of 4` through `Page 4 of 4`. This confirmed that logical `{pages}`
  excludes the ToC for `countFrom: body` while the physical PDF has five pages.
  The smoke remains non-durable local QA rather than public renderer evidence.
- Validation: the final evidence suite passed 39 tests with 1,235 assertions;
  the full repository passed 2,331 tests with 13,942 assertions across 251
  files. TypeScript, lint, formatting for 834 files, build, worktree, diff
  integrity, and the exact-range diff gate passed.
- Checkpoints after activation: `6d0e9751`, `85895d1a`, `ea00e3db`,
  `dc6446bb`, `c6492dfb`, `eeea1a61`, `c004b799`, `92579e76`, and
  `d0961278`.
- Exact-range review: maintainability and test-quality review covered
  `6b1b9bba..92579e76`. Two evidence gaps were accepted: body-scoped
  visibility with document-origin arithmetic, and a physical-only product
  label. `d0961278` added both cases; real renderer evidence passed, and the
  widened `6b1b9bba..d0961278` re-review found no material findings.
- Documentation closeout: this reviewed job, the completed research, and the
  parent Phase 14.5 checklist record the accepted contract. Subsequent planning
  inserted Phase 14.6 cover-page authoring before Phase 15; both remain
  pending. The documentation-only commit containing these changes is the
  durable Phase 14.5 completion boundary; no Phase 14.5 implementation or
  evidence work remains.

## Verdict

**Continue; Phase 14.5 completed.** The one-pass mechanism, page-role policy,
four-token contract, migration warning, Interactive teaching, renderer matrix,
and exact-range reviews are complete. The parent plan remains active because
Phase 14.6 cover-page authoring and Phase 15 guidance closeout are still
pending.

## Related Research

- [Markdown PDF Page Roles And Counter Semantics](../../researches/research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)
- [Markdown PDF Interactive Cover Page Authoring](../../researches/research-2026-08-15-markdown-pdf-interactive-cover-page-authoring.md)
- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
