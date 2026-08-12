---
title: "Markdown PDF page-number Phase 6 diagnostics, capabilities, and doctor"
created-date: 2026-08-12
status: active
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Define one public-safe diagnostic contract for page-number warnings and hard
failures, evaluate effective renderer capabilities after Profile and direct
override precedence, and make `doctor --json` agree with pre-render gating.
The phase does not add a direct `md to-pdf --json` mode or duplicate the
Phase 3 structural body validator.

## Starting Boundary

- Starting commit: `7052f52a`.
- Phase 5 is completed; the parent plan remains `active`.
- The related research remains `in-progress` while later phases continue.
- The worktree is expected to be clean before Phase 6 implementation begins.

## Permanent File Boundary

- Production changes remain in the shared Markdown PDF diagnostic,
  capability-evaluation, pre-render validation, and `doctor` seams.
- Tests extend existing Markdown PDF action, renderer, diagnostic, and doctor
  coverage.
- No generated HTML, CSS, PDF, PNG, renderer environment, or raw report is
  committed by this phase.
- Local activation commands, environment names, and resolved temporary paths
  remain private and are not recorded here.

## Subphase Checkpoints

- [x] Activate Phase 6 and record the clean starting boundary.
- [x] 6A: Freeze condition IDs, structured payload fields, occupied-slot trim
      semantics, and one-warning-per-render lifecycle.
- [x] 6B: Implement the effective-control matrix, capability evaluator,
      unknown-state handling, and no-output pre-render gates.
- [x] 6C: Reuse the evaluator and diagnostic IDs in `doctor --json` and prove
      parity with plain rendering and pre-render validation.
- [x] Record an implementation commit and focused evidence for 6A, 6B, and 6C
      separately before the aggregate Phase 6 review.
- [x] Run focused validation and the Markdown PDF regression slice.
- [x] Run the full repository suite plus TypeScript, lint, format, build, and
      `git diff --check`; record public-safe results.
- [ ] Review the exact Phase 6 implementation/evidence range, resolve all
      actionable findings, widen the range, and record the final verdict.

## Diagnostic Contract

Use one structured diagnostic shape with stable condition IDs, severity, a
public-safe message, and optional context such as selected slot, capability,
renderer version, or source scope. Freeze identifiers for selected-slot
replacement, physical `{pages}` semantics, legacy body visibility, missing body
boundary, missing renderer, unverified renderer version, renderer probe
failure, unknown capability, and unsupported capability. Warnings are
successful diagnostics emitted to `stderr` in plain rendering and carried in
structured collections for Project reports and later Interactive review.
Hard render-gate errors use the command's normal nonzero path and the same
identifier in structured error surfaces. `doctor --json` emits JSON-only
structured output on `stdout`, including the nested capability snapshot;
neither errors nor warnings mix prose into that JSON output.

The warning accumulator emits each condition at most once per rendered
document and resets for each new render. Occupied-slot detection trims the
configured selected area before deciding whether it is non-empty; tests cover
literal, whitespace-only, and metadata-resolving-empty values.

Phase 3 remains the source of truth for proving the `.document-body` and live
`$body$` boundary. Phase 6 maps a failed proof to the stable missing-boundary
diagnostic and does not implement a second structural check.

Implemented warning IDs are
`MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED`,
`MARKDOWN_PDF_PHYSICAL_PAGE_TOTAL_WITH_LOGICAL_SEQUENCE`, and
`MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK`. Capability states use
`MARKDOWN_PDF_RENDERER_CAPABILITY_MISSING`,
`MARKDOWN_PDF_RENDERER_CAPABILITY_UNSUPPORTED`,
`MARKDOWN_PDF_RENDERER_CAPABILITY_UNVERIFIED`,
`MARKDOWN_PDF_RENDERER_CAPABILITY_PROBE_FAILED`, and
`MARKDOWN_PDF_RENDERER_CAPABILITY_UNKNOWN`. The Phase 3 structural failure
retains its existing stable `MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED` code.

## Capability Evidence

Record a concrete capability matrix mapping non-default `start`, non-default
`increment`, `scope: document`, `countFrom: body`, header/footer `fontSize`,
`fontWeight`, `lineHeight`, and `color`, plus separator `width`, `style`,
`color`, and `gap`, to the Phase 1 baseline, evaluator status, and stable
failure identifier. Record the `.document-body` hook separately as a Phase 3
structural prerequisite rather than a renderer capability. Baseline controls
remain on the existing path exactly as specified by the research matrix.

Distinguish installed-version parse failure, missing renderer,
dependency/native probe failure, and unknown capability from a proven
unsupported capability. An effectively requested unsupported or unknown
capability fails closed before intermediate, PDF, report, or other output
writes; omitted or ineffective advanced controls retain the existing render
path.

`doctor` is request-neutral: it evaluates the installed renderer against the
same baseline matrix and reports every capability status and stable identifier.
Pre-render validation uses that same evaluator, then filters the snapshot by
the current Profile/direct-override effective controls. Parity tests compare
the shared baseline, statuses, and identifiers rather than pretending doctor
has a render request. Human doctor output remains readable, `doctor --json`
remains JSON-only on `stdout`, and existing basic `md.to-pdf` readiness does
not become synonymous with advanced page-number availability.

Every retained advanced field maps to one of twelve explicit capability IDs.
All twelve currently use the Phase 1-proven WeasyPrint `65.1` baseline:
non-default start, non-default increment, document scope, body count origin,
the four bounded typography properties, and the four bounded separator
properties. The matrix retains header/footer field provenance even when both
areas share the same renderer capability.

## Checkpoint Commits

- `b7242e90` — Phase 6 activation and shared warning diagnostics.
- `fad15c13` — effective capability matrix and pre-render gates.
- `2ed0a3da` — request-neutral doctor parity and human/JSON coverage.

## Validation Record

- Phase 6A diagnostics and integration validation passed 93 tests with 0
  failures across diagnostics, Template compatibility, preparation, and action
  suites, using
  `bun test test/cli-actions-md-to-pdf-diagnostics.test.ts test/cli-actions-md-to-pdf-template-compatibility.test.ts test/cli-actions-md-to-pdf-prepared-render.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts test/cli-actions-md-to-pdf-actions-assets.test.ts --timeout 30000`.
- Phase 6B capability validation passed 137 tests with 0 failures across the
  field matrix, effective precedence, status taxonomy, and pre-output gates,
  using
  `bun test test/cli-markdown-pdf-renderer-capabilities.test.ts test/cli-actions-md-to-pdf-diagnostics.test.ts test/cli-actions-md-to-pdf-template-compatibility.test.ts test/cli-actions-md-to-pdf-prepared-render.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts test/cli-actions-md-to-pdf-actions-assets.test.ts --timeout 30000`.
- Phase 6C doctor/requirements validation passed 79 tests with 0 failures and
  556 assertions after human-output review fixes, using
  `bun test test/cli-markdown-pdf-renderer-capabilities.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts --timeout 30000`.
- Broad Markdown PDF and doctor regression validation passed 1,017 tests with
  0 failures and 7,403 assertions, using
  `rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000`.
- Full repository validation passed 2,037 tests with 0 failures and 11,630
  assertions, using `bun test --timeout 30000`.
- `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
  `bun run build`, and `git diff --check` passed at the Phase 6 implementation
  tip.
- No renderer laboratory or generated HTML, CSS, PDF, PNG, or raw report was
  created or retained by this phase.

## Exact-Range Review

To be completed after implementation and evidence commits. Review the named
Phase 6 starting boundary through the final evidence tip, resolve every
actionable finding, record the widened range, and confirm that `doctor` and
pre-render validation use the same evaluator before Phase 7 begins. This one
aggregate review must include the recorded 6A, 6B, and 6C checkpoints.

## Final Verdict

**Provisional Continue.** Phase 6A/6B/6C implementation and validation are
complete. The aggregate exact-range review remains required before Phase 7.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
