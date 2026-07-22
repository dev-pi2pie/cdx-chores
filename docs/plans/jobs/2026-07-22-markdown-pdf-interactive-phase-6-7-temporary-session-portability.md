---
title: "Markdown PDF Interactive Phase 6.7 temporary-session portability"
created-date: 2026-07-22
status: draft
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Keep CLI-owned temporary recipes in the operating system's temporary directory
while making their ownership path canonical, portable, actionable on failure,
and compatible with existing symlink-aware output validation.

## Implementation Checklist

- [ ] Canonicalize the exact directory returned for every newly created owned
      temporary session.
- [ ] Use that path consistently for materialization, retention, display, and
      cleanup.
- [ ] Keep temporary recipes out of the current working directory.
- [ ] Preserve exact-session ownership and cleanup while retaining failures for
      diagnosis.
- [ ] Preserve symlink rejection for user-selected durable and PDF outputs.
- [ ] Cover aliased and ordinary temporary roots without assuming one operating
      system's path syntax.
- [ ] Pass focused, repository, and public-safe manual render verification.
- [ ] Review the exact implementation range and resolve actionable findings.

## Traceability

- Current phase: [Phase 6.7: Interactive Authoring Follow-up](../plan-2026-07-21-markdown-pdf-interactive-mode.md#phase-67-interactive-authoring-follow-up)
- Current track: [Track A: Portable Temporary Recipe Sessions](../plan-2026-07-21-markdown-pdf-interactive-mode.md#track-a-portable-temporary-recipe-sessions)
- Parent phase: [Phase 6: Materialization, Recovery, And Handoff](../plan-2026-07-21-markdown-pdf-interactive-mode.md#phase-6-materialization-recovery-and-handoff)
- Parent job: [Phase 6 lifecycle and handoff](2026-07-22-markdown-pdf-interactive-phase-6-lifecycle-handoff.md)
- Research: [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)

## Public Record Boundary

Record only portable behavior, sanitized validation outcomes, and reviewed
commit ranges. Do not record machine-specific temporary paths or local
development setup.
