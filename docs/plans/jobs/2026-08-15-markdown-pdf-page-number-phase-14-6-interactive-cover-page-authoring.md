---
title: "Markdown PDF page-number Phase 14.6 interactive cover page authoring"
created-date: 2026-08-15
status: completed
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Complete Phase 14.6 by adding one ordinary cover-page decision to Profile
Formal Guide authoring, preserving advanced Profile values during revision,
and enforcing the settled cover, Template, metadata, CSS, and page-number
boundaries without changing Profile `schemaVersion: 3`.

## Starting Boundary

- Starting commit and exact review base: `82241026`.
- The worktree was clean before this job record was created.
- Phase 14 and Phase 14.5 remain completed with their recorded historical
  evidence and review ranges.
- The parent plan remains `active`; Phase 15 remains pending.
- The related cover-page research remains `in-progress` until implementation,
  renderer evidence, and review are recorded.

## Frozen Scope

### Formal Guide authoring

- Ask `Add a cover page?` after layout and margins and before ToC.
- Keep fresh authoring disabled by default and use the existing normalized
  metadata-based cover when enabled.
- Add an independent `Revise cover page` action.
- Preserve valid advanced `cover.style` and `cover.fields` values while the
  simplified flow changes only `cover.enabled`.
- Keep Template Formal Guide, Project preparation, Codex Assistant authority,
  image-cover ownership, and Profile revision `3` unchanged.

### Render and compatibility contract

- Support the built-in Template with generated cover HTML and CSS.
- Reject a cover-enabled arbitrary custom Template without a proven cover hook
  before final output.
- Require managed Project compatibility validation to prove cover markup and
  ownership.
- Allow a cover with `--no-default-css` as an advanced override with one
  warning that custom CSS owns the page break and chrome reset.
- Preserve the existing hard error and no-output behavior when any effective
  page-number request, whether Profile-sourced or directly enabled for one
  render, is combined with `--no-default-css`.
- Emit one non-blocking warning when every configured cover field resolves to
  empty text after effective metadata precedence.
- Render company exactly once in its own cover line and keep the compact
  metadata line limited to author and date.

### Page roles and evidence

- Generated CSS keeps the visible cover free of page numbers and repeating
  content; equivalent styling becomes user-owned under `--no-default-css`.
- Document-origin arithmetic includes the cover without displaying a cover
  label; body-origin arithmetic excludes cover and ToC.
- Physical page tokens retain PDF positions and counts.
- Reuse the guarded renderer catalog, evidence harness, inspection, and cleanup
  paths; introduce no second smoke mechanism or public artifact store.

## Permanent File Boundary

The expected Phase 14.6 boundary is limited to:

- this job record, the parent plan, and the cover-page research
- Profile Formal Guide types, prompts, collection, compilation, authoring
  review, revision routing, and directly related Interactive tests
- built-in cover composition and metadata resolution
- Markdown PDF diagnostics, warning presentation, Template compatibility, and
  managed Project compatibility where required by the settled matrix
- the existing renderer evidence catalog, guarded harness, and their focused
  tests
- focused existing recipe, cover, page-chrome, Profile rendering, Project,
  action, lifecycle, and recovery tests

Any expansion into a general custom-Template cover-hook protocol, image-cover
authoring, Codex Assistant cover policy, a saved-Profile revision entry point,
or a second renderer harness requires a recorded boundary review before edits.

Temporary HTML, CSS, PDFs, PNGs, raw reports, and local launch details remain
uncommitted. Durable evidence records only repository-relative commands,
public renderer versions, sanitized extracted facts, visual conclusions,
cleanup status, commit checkpoints, and review outcomes.

## Checklist

- [x] Establish the clean `82241026` starting and review boundary, activate
      this job, link the parent plan and research, and freeze the scope and
      evidence gates.
- [x] Freeze current Formal Guide order, disabled-cover output, built-in cover
      HTML/CSS, metadata-title behavior, compatibility outcomes, and
      cover/ToC/body rendering before production changes.
- [x] Implement and verify fresh and revision cover-page authoring while
      preserving advanced values and revision `3`.
- [x] Implement and verify review wording, document order, metadata-title
      behavior, and empty-cover diagnostics.
- [x] Enforce the custom-Template, managed Project, and `--no-default-css`
      compatibility matrix with warning, error, and no-output coverage.
- [x] Correct and verify single-occurrence company rendering.
- [x] Verify cover chrome suppression, logical origins, physical tokens, and
      ToC/body repeating-content invariants.
- [x] Run focused and broad Interactive, Markdown PDF, Project, renderer
      evidence, full repository, TypeScript, lint, format, build, worktree, and
      exact-range diff gates.
- [x] Run the guarded renderer matrix, inspect representative pages, record
      public-safe evidence, and confirm temporary-artifact cleanup.
- [x] Review the exact `82241026..0ea0d621` range for
      maintainability and test quality, resolve accepted findings, and re-run
      the widened review when fixes land.
- [x] Review the completed job, research, and parent checklist, then commit the
      documentation closeout before Phase 15.

## Validation Plan

Focused validation owns prompt order, collection, revision, compilation,
persistence, review, metadata resolution, diagnostics, Template compatibility,
Project handoff, final-output safety, cover HTML/CSS, and renderer evidence.
Broader gates then cover the complete Markdown PDF surface and repository:

```bash
rg --files test/cli-interactive-markdown-pdf | xargs bun test --timeout 30000
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
rg --files test/markdown-pdf-page-number-renderer-evidence | xargs bun test
bun test test/markdown-pdf-page-number-project-renderer-contract.test.ts
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
git diff --check 82241026..0ea0d621
```

Renderer-sensitive checkpoints additionally require extracted real-PDF values
and representative visual inspection. CSS-string assertions alone cannot
complete the renderer evidence gate.

## Evidence Ledger

- Starting and exact review base: `82241026`.
- Activation checkpoint: `aa547f1a`.
- Activation evidence: the worktree was clean; the parent plan and cover-page
  research define the settled contract; this record freezes the execution
  boundary and evidence gates.
- Current-behavior baseline: 79 tests passed with 485 assertions across six
  focused Interactive, Profile-rendering, Template-compatibility,
  no-default-CSS, and diagnostic suites. The characterization freezes revision
  `3`, normalized disabled cover defaults, save/reload behavior, Template
  isolation, built-in cover order/chrome/title behavior, duplicate company
  output, permissive arbitrary-Template behavior, cover-only
  `--no-default-css`, and the existing page-number hard-error matrix before
  production changes.
- Implementation checkpoints:
  - `c33f80b7` enforces cover rendering, compatibility, diagnostics, and
    single-company output.
  - `26923d52` adds Profile Formal Guide cover authoring, revision, review, and
    persistence.
  - `73d19609` extends the existing renderer evidence contract with
    single-occurrence extracted cover text.
  - `7a0153b3` aligns the command-layer Project failure contract with the
    managed cover-hook validation.
  - `0ea0d621` resolves the accepted exact-range review findings by sharing the
    cover hook and adding the missing retention and escaping regressions.
- Focused implementation evidence: 142 render, diagnostic, compatibility, and
  Project tests passed with 791 assertions; 346 Interactive and shared Profile
  review tests passed with 1,551 assertions; and 32 renderer-evidence and
  Project-contract tests passed with 1,207 assertions.
- Integrated repository evidence: 2,349 tests passed with 14,055 assertions;
  TypeScript, lint, formatting, build, worktree, and diff checks passed.
- Built-CLI smoke: fresh Profile Formal Guide asked `Add a cover page?` after
  margins and before ToC, exposed `Revise cover page`, and saved a revision-3
  Profile with the complete normalized cover contract. The rendered six-page
  A4 PDF showed a chrome-free cover, ToC second, and body numbering ending at
  logical `Page 4` on physical page 6 without clipping or overlap.
- Guarded renderer evidence: WeasyPrint `65.1`, `68.0`, and `69.0` passed the
  cover -> ToC -> body product and Project matrix. Extracted text proved the
  company marker occurs exactly once on the cover, body-scoped labels remain
  absent from cover and ToC pages, document/body counter origins remain
  correct, and metadata titles stay body-owned. Representative cover, ToC,
  body, custom-style, blank-page, and Project pages passed visual inspection.
- Evidence identities: catalog digest
  `cd39b69a1bb41ff3a1140304ec1e779e81f686870af0dfc750271ffccb116061`;
  harness digest
  `dbf41562c71ee837861b4e68507fa295613ed98df840c0a4ef90b65ced8718d8`.
- Cleanup: the guarded laboratories closed successfully, and temporary smoke
  Profiles, PDFs, PNGs, and raw reports were removed.
- Exact-range review: the initial `82241026..7a0153b3` review found one shared-
  hook maintainability issue and two lower-priority regression gaps. All three
  were accepted and fixed in `0ea0d621`; the widened
  `82241026..0ea0d621` maintainability and test-quality re-review found no
  remaining actionable findings.
- Closeout verdict: **Continue** to Phase 15. Phase 14.6 is complete, Profile
  `schemaVersion` remains `3`, and the parent plan remains active only for the
  final guidance and lifecycle closeout.

## Related Research

- [Markdown PDF Interactive Cover Page Authoring](../../researches/research-2026-08-15-markdown-pdf-interactive-cover-page-authoring.md)
- [Markdown PDF Page Roles And Counter Semantics](../../researches/research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)

## Related Plans

- [Markdown PDF Page-Number Configuration Implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
