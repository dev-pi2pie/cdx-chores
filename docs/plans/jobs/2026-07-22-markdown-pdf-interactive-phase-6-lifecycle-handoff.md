---
title: "Markdown PDF Interactive Mode Phase 6 lifecycle and handoff"
created-date: 2026-07-22
modified-date: 2026-07-22
status: completed
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 6 of the Markdown PDF Interactive Mode plan by materializing
the exact accepted Phase 5 candidate, rendering through the shared prepared
renderer, enforcing ownership-based temporary cleanup and failure recovery,
and handing durable `pdf-recipes` artifacts into `to-pdf` with an explicitly
selected Markdown input.

Phase base: `ceb4e264a8dbd42342a8d3f5149bd76f2c5c63d0`.

## Implementation Checklist

- [x] Add an opaque CLI-owned temporary-session boundary.
- [x] Materialize deterministic and Codex Profile, Template, and Project
      candidates without regeneration.
- [x] Render temporary candidates through the shared prepared renderer and
      remove only the exact owned session after success.
- [x] Retain and print owned sessions after materialization,
      renderer-preparation, render, or cleanup failure.
- [x] Retry rendering from the same written artifact and prepared render plan.
- [x] Retry durable materialization from the same bound candidate and retry
      renderer preparation without rewriting a successful artifact.
- [x] Support revise-with-diagnostics, keep-and-exit, and confirmed
      delete-and-exit recovery.
- [x] Render durable saved candidates without making them cleanup targets.
- [x] Commit completed PDFs through the shared symlink-aware safe-write
      boundary.
- [x] Hand saved `pdf-recipes` artifacts to `to-pdf` with the recipe source
      preselected.
- [x] Require explicit sample reuse or another Markdown selection before
      handoff rendering.
- [x] Add ownership, recovery, no-regeneration, collision, symlink, and handoff
      coverage.
- [x] Pass focused and repository validation.
- [x] Review the exact Phase 6 commit range and resolve actionable findings.

## Changes

- Added opaque CLI-owned temporary sessions and exact-session cleanup.
- Materialized accepted deterministic and Codex candidates once for temporary
  or durable rendering without regeneration.
- Added stage-aware recovery for materialization, renderer preparation, render,
  and cleanup failures while retaining diagnostic artifacts.
- Added saved-recipe handoff into `to-pdf` with explicit Markdown sample reuse
  or replacement.
- Moved final PDF writes behind CLI-owned render storage and the shared
  symlink-aware safe-write boundary.

## Verification

Passed:

```bash
bun test test/cli-interactive-markdown-pdf test/cli-interactive-routing.test.ts
bun test test/cli-actions-md-to-pdf-*.test.ts test/cli-actions-md-to-pdf-template-codex test/cli-actions-md-to-pdf-project-codex test/cli-interactive-markdown-pdf test/cli-interactive-routing.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

The final Interactive and routing slice passed with 105 tests and zero
failures. The widened Markdown PDF and Interactive regression slice passed with
579 tests and zero failures. The full repository suite passed with 1,638 tests
and zero failures.

A real renderer smoke produced a one-page A4 PDF. Metadata inspection, page
rasterization, and visual inspection confirmed readable English, Japanese,
Traditional Chinese, and code content after the safe final-write change.

Implementation checkpoints:

- `9d350a7` — lifecycle-owned materialization, recovery, and saved-recipe
  handoff
- `476329a` — canonical paths, durable-stage recovery, typed adapters, and
  focused lifecycle modules
- `78fe730` — CLI-owned renderer output and symlink-safe final PDF commit

## Review

Reviewed the exact Phase 6 implementation range `ceb4e26..78fe730`.
Correctness, security, maintainability, test, and documentation reviews
approved the final widened range after accepted fixes.

Accepted fixes added canonical deterministic Profile paths, durable write and
renderer-preparation recovery, collision and failed-write retry coverage,
smaller lifecycle modules, typed materialization adapters, and a safe final PDF
commit that rejects dangling output links and symlinked parent directories.
The final review found no remaining actionable issues.

## Artifact Safety

Cleanup must accept only an opaque session created by this flow. User-owned
durable artifacts, external reports, existing recipe inputs, and successful PDF
outputs must never become automatic cleanup targets. Failure recovery must
retain diagnostics and must not repeat Codex preparation.
WeasyPrint writes only to CLI-owned temporary storage; the completed PDF is
committed through the shared safe-write boundary so symlink aliases are not
followed.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)

## Follow-up Jobs

- [Phase 6.7 temporary-session portability](2026-07-22-markdown-pdf-interactive-phase-6-7-temporary-session-portability.md)
