---
title: "Markdown PDF Interactive code highlighting Phase 3 generated lifecycle"
created-date: 2026-07-23
status: in-progress
agent: codex
plan: ../plan-2026-07-23-markdown-pdf-interactive-code-highlighting.md
---

## Scope

Add the Phase 2 one-render code-highlighting override to generated Profile,
Template, and Project rendering after lifecycle acceptance. Preserve accepted
candidate identity, output choices, report retention, materialization,
cleanup, and recovery behavior while preventing override-only changes from
repeating deterministic or Codex preparation.

Project preparation remains Codex Assistant-only. The override must not enter
artifact identity, saved-recipe data, or any new Project preparation branch.

## Review Boundary

- Phase base: `59a7c9f`.
- Implementation review range: pending validated implementation commits.

The implementation range will end at the final code, test, or review-fix
commit. A later documentation-only closeout records the accepted evidence.

## Implementation Checklist

- [ ] Add one-render override state to generated lifecycle selection.
- [ ] Collect it after lifecycle acceptance and before output collection.
- [ ] Preserve it for the same accepted candidate and reset it for a new one.
- [ ] Pass only the compiled optional boolean into renderer preparation.
- [ ] Add change, Back, and Cancel behavior without regeneration or early writes.
- [ ] Retain applicable output, report, cleanup, and recovery state.
- [ ] Keep Project preparation Codex Assistant-only.
- [ ] Add focused deterministic and Codex lifecycle coverage.

## Validation Checklist

- [ ] Run focused generated lifecycle and handoff regressions.
- [ ] Run TypeScript, lint, format, build, full tests, and whitespace checks.
- [ ] Complete representative real-render and visual PDF verification.
- [ ] Record only repository-relative and sanitized evidence.

## Review Checklist

- [ ] Review the exact Phase 3 implementation range.
- [ ] Resolve actionable findings and review any widened range.
- [ ] Complete focused test-coverage review.
- [ ] Complete documentation closeout review.

## Evidence

Implementation, validation, commit, and review evidence will be added only
after the corresponding checkpoints pass.

## Related Research

- [Markdown PDF Interactive Code Highlighting](../../researches/research-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
