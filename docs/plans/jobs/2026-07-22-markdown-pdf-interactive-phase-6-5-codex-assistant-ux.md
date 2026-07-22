---
title: "Markdown PDF Interactive Mode Phase 6.5 Codex Assistant UX"
created-date: 2026-07-22
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 6.5 of the Markdown PDF Interactive Mode plan by aligning both
entry paths with the direct Codex helper matrix, tightening optional-signal
collection, delaying output selection until lifecycle choice, and presenting
one correctly cleared Interactive waiting status per Codex request.

Phase base: `2457f917f45ae272e9b05f0f47490c92c985c048`.

## Implementation Checklist

- [ ] Expose Codex Assistant for Profile, Template bundle, and Project bundle
      from both Interactive entry paths.
- [ ] Preserve Project's direct Codex transition without deterministic Project
      modes or a one-option preparation menu.
- [ ] Add optional single-line and multiline PDF intent entry.
- [ ] Present artifact-specific setup in the settled signal order.
- [ ] Keep the baseline repeatable free-text font-hint editor.
- [ ] Move output selection after prepared-candidate review and lifecycle
      choice.
- [ ] Keep consent aligned with the visible setup and request payload.
- [ ] Present one Interactive waiting status without nested direct-helper
      progress output.
- [ ] Update one Project status across its Profile and Template request stages.
- [ ] Add focused matrix, setup, consent, output, progress, and
      no-regeneration coverage.
- [ ] Pass focused, repository, and live-render verification.
- [ ] Review the exact Phase 6.5 commit range and resolve actionable findings.

## Verification Plan

Focused verification will cover both entry matrices, optional intent modes,
signal ordering, delayed output selection, consent, prepared-candidate reuse,
single-request behavior, and TTY/non-TTY progress cleanup. Repository gates and
a real renderer smoke will follow before closeout.

Public evidence will record only capability and outcome. It will not include
machine-specific paths, local environment activation, or terminal setup.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
