---
title: "Markdown PDF Interactive Phase 6.7 repeatable font-hint flow"
created-date: 2026-07-22
status: draft
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Flatten the implemented font-hint editor so guided and complete-custom additions
are direct collection actions, repeated entry remains visible, and the ordered
direct `fontHints: string[]` contract stays unchanged.

## Implementation Checklist

- [ ] Replace the nested add-mode prompt with direct guided and complete-custom
      collection actions.
- [ ] Re-render the ordered collection after every accepted change.
- [ ] Keep sequential add, edit, remove, move, `Done`, and exact-duplicate
      behavior.
- [ ] Remove the manual discovery-retry action while preserving one cached
      discovery attempt and ordinary preference fallback.
- [ ] Preserve search keyboard behavior, cancellation, privacy, intended-use
      compilation, consent, and candidate invalidation.
- [ ] Pass focused, repository, and public-safe manual verification.
- [ ] Review the exact implementation range and resolve actionable findings.

## Traceability

- Current phase: [Phase 6.7: Interactive Authoring Follow-up](../plan-2026-07-21-markdown-pdf-interactive-mode.md#phase-67-interactive-authoring-follow-up)
- Current track: [Track B: Repeatable Font-Hint Flow](../plan-2026-07-21-markdown-pdf-interactive-mode.md#track-b-repeatable-font-hint-flow)
- Parent phase: [Phase 6.6: Font Hint Input Suggestions](../plan-2026-07-21-markdown-pdf-interactive-mode.md#phase-66-font-hint-input-suggestions)
- Parent job: [Phase 6.6 font hint suggestions](2026-07-22-markdown-pdf-interactive-phase-6-6-font-hint-suggestions.md)
- Research: [Markdown PDF Interactive Font Hint Suggestions](../../researches/research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md)

## Public Record Boundary

Record only user-visible behavior, sanitized validation outcomes, and reviewed
commit ranges. Do not record the host font inventory, local development setup,
or machine-specific paths.
