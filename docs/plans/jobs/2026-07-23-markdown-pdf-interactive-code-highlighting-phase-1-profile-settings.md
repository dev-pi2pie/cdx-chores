---
title: "Markdown PDF Interactive code highlighting Phase 1 Profile settings"
created-date: 2026-07-23
status: in-progress
agent: codex
plan: ../plan-2026-07-23-markdown-pdf-interactive-code-highlighting.md
---

## Scope

Implement Phase 1 reusable code-highlighting settings for Interactive Profile
`formal-guide`, including conditional prompts, deterministic serialization,
candidate reviews, and direct Profile-initialization compatibility.

Template authoring must not gain reusable code settings. Project preparation
must remain Codex Assistant-only without a preparation-mode prompt.

## Review Boundary

- Phase-start revision: pending the phase-start documentation commit.
- Implementation review range: pending validated implementation commits.

The implementation range will end at the final code, test, or review-fix
commit. A later documentation-only closeout records the accepted evidence.

## Implementation Checklist

- [ ] Add typed Profile code answers and artifact-aware collection.
- [ ] Add conditional prompts and revision behavior.
- [ ] Serialize all four Profile code fields through a narrow prepared input.
- [ ] Preserve direct Profile initialization output when that input is omitted.
- [ ] Add deterministic Profile, Profile Codex Assistant, and Project Codex
      Assistant review output.
- [ ] Keep Template review and Project routing boundaries unchanged.
- [ ] Add focused automated coverage.

## Validation Checklist

- [ ] Run focused formal-guide, deterministic, Codex, and Profile regressions.
- [ ] Run lint, format checking, build, full tests, and whitespace checks.
- [ ] Complete representative real-render and visual PDF verification.
- [ ] Record only repository-relative and sanitized evidence.

## Review Checklist

- [ ] Review the exact Phase 1 implementation range.
- [ ] Resolve actionable findings and review any widened range.
- [ ] Complete focused test-coverage review.
- [ ] Complete documentation closeout review.

## Evidence

Implementation, validation, commit, and review evidence will be added only
after the corresponding checkpoints pass.

## Related Research

- [Markdown PDF Interactive Code Highlighting](../../researches/research-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
