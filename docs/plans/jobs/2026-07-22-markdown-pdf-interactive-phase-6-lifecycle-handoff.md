---
title: "Markdown PDF Interactive Mode Phase 6 lifecycle and handoff"
created-date: 2026-07-22
status: in-progress
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

- [ ] Add an opaque CLI-owned temporary-session boundary.
- [ ] Materialize deterministic and Codex Profile, Template, and Project
      candidates without regeneration.
- [ ] Render temporary candidates through the shared prepared renderer and
      remove only the exact owned session after success.
- [ ] Retain and print owned sessions after materialization, render, or cleanup
      failure.
- [ ] Retry rendering from the same written artifact and prepared render plan.
- [ ] Support revise-with-diagnostics, keep-and-exit, and confirmed
      delete-and-exit recovery.
- [ ] Render durable saved candidates without making them cleanup targets.
- [ ] Hand saved `pdf-recipes` artifacts to `to-pdf` with the recipe source
      preselected.
- [ ] Require explicit sample reuse or another Markdown selection before
      handoff rendering.
- [ ] Add ownership, recovery, no-regeneration, collision, and handoff coverage.
- [ ] Pass focused and repository validation.
- [ ] Review the exact Phase 6 commit range and resolve actionable findings.

## Verification

Pending implementation evidence.

## Review

Pending a validated Phase 6 commit range.

## Artifact Safety

Cleanup must accept only an opaque session created by this flow. User-owned
durable artifacts, external reports, existing recipe inputs, and successful PDF
outputs must never become automatic cleanup targets. Failure recovery must
retain diagnostics and must not repeat Codex preparation.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
