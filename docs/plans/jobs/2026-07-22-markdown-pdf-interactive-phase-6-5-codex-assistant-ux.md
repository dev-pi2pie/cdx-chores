---
title: "Markdown PDF Interactive Mode Phase 6.5 Codex Assistant UX"
created-date: 2026-07-22
status: completed
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

- [x] Expose Codex Assistant for Profile, Template bundle, and Project bundle
      from both Interactive entry paths.
- [x] Preserve Project's direct Codex transition without deterministic Project
      modes or a one-option preparation menu.
- [x] Add optional single-line and multiline PDF intent entry.
- [x] Present artifact-specific setup in the settled signal order.
- [x] Keep the baseline repeatable free-text font-hint editor.
- [x] Move output selection after prepared-candidate review and lifecycle
      choice.
- [x] Keep consent aligned with the visible setup and request payload.
- [x] Present one Interactive waiting status without nested direct-helper
      progress output.
- [x] Update one Project status across its Profile and Template request stages.
- [x] Add focused matrix, setup, consent, output, progress, and
      no-regeneration coverage.
- [x] Pass focused, repository, and live-render verification.
- [x] Review the exact Phase 6.5 commit range and resolve actionable findings.

## Verification Plan

Focused verification will cover both entry matrices, optional intent modes,
signal ordering, delayed output selection, consent, prepared-candidate reuse,
single-request behavior, and TTY/non-TTY progress cleanup. Repository gates and
a real renderer smoke will follow before closeout.

Public evidence will record only capability and outcome. It will not include
machine-specific paths, local environment activation, or terminal setup.

## Implementation Result

- Both Interactive entry paths expose Codex Assistant for Profile, Template
  bundle, and Project bundle while retaining Project's direct transition.
- PDF intent supports optional single-line or multiline entry, and setup review
  follows the settled signal order without collecting an output destination.
- Artifact and PDF outputs are selected only after candidate review; accepted
  candidates remain reusable without an implicit Codex request.
- Interactive preparation injects one artifact-aware progress presenter.
  Project preparation updates the same status from Profile to Template, while
  direct helpers retain their existing progress behavior.

## Verification Evidence

- Focused Interactive authoring, lifecycle, handoff, and progress tests passed.
- Focused Profile, Template, and Project direct-helper progress tests passed.
- The full test suite passed: 1,647 tests with no failures.
- TypeScript, build, lint, formatting, and diff checks passed.
- A live Interactive Profile preparation displayed and cleared one waiting
  status before the recovery review when the assistant request was unavailable.
- A controlled live Project presenter transcript changed one status from
  Profile preparation to Template preparation and cleared it on completion.
- A real CJK Markdown fixture rendered to a one-page A4 PDF; visual inspection
  confirmed readable English, Japanese, Traditional Chinese, and code text.

## Commit Range Review

Reviewed `2457f917f45ae272e9b05f0f47490c92c985c048..447f6d3` after the phase
implementation and verification commits landed. The review covered prompt
sequencing, output deferral, prepared-candidate reuse, progress ownership and
cleanup, direct-command compatibility, and focused regression coverage. No
actionable findings remained.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)

## Follow-up Jobs

- [Intent prompt layout hotfix](2026-07-22-markdown-pdf-interactive-intent-prompt-layout-hotfix.md)
