---
title: "Markdown PDF Interactive Mode Phase 6.6 Font Hint Suggestions"
created-date: 2026-07-22
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 6.6 of the Markdown PDF Interactive Mode plan by enhancing the
repeatable free-text font-hint editor with an optional structured builder and
local fontconfig family suggestions while preserving the direct
`--font-hint <text>` contract, custom input, privacy, and cancellation.

Phase base: `95817df`.

## Implementation Checklist

- [ ] Add shared additive discovery cancellation and timeout controls without
      changing direct-command defaults.
- [ ] Add a session-owned, fontconfig-only, lazy suggestion source with a
      one-second deadline, delayed status, caching, retry, and silent abort.
- [ ] Add deterministic custom-first family filtering with at most six
      case-insensitively deduplicated suggestions.
- [ ] Add builder and complete-custom paths with artifact-aware intended uses,
      one user-authored language value, preview, editing, removal, ordering,
      and visible exact-duplicate handling.
- [ ] Compile every accepted draft to one ordered direct-equivalent string and
      send only those strings through consent, Codex, and reports.
- [ ] Show validated post-Codex font mappings and unmatched directions without
      treating intended use as a guaranteed assignment.
- [ ] Invalidate prepared candidates only when accepted hint input changes.
- [ ] Add focused discovery, cancellation, interaction, mapping, privacy, and
      direct-helper regression tests.
- [ ] Pass focused, repository, and public-safe manual verification.
- [ ] Review the exact Phase 6.6 commit range and resolve actionable findings.

## Verification Plan

Use injected inventories and runners for deterministic filtering, fallback,
timeout, retry, and cancellation tests. Exercise the real prompt keyboard
contract and both suggestion-capable and forced-fallback paths manually without
recording the host font inventory or development environment.

## Related Research

- [Markdown PDF Interactive Font Hint Suggestions](../../researches/research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md)
