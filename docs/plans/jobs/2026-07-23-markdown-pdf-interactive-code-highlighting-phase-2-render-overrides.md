---
title: "Markdown PDF Interactive code highlighting Phase 2 render overrides"
created-date: 2026-07-23
status: in-progress
agent: codex
plan: ../plan-2026-07-23-markdown-pdf-interactive-code-highlighting.md
---

## Scope

Implement Phase 2 one-render code-highlighting overrides for existing,
built-in, Custom, and saved-recipe handoff sources. Keep reusable Theme, line
numbers, and transformer notation Profile-owned while passing only the
existing optional `codeHighlight` boolean to renderer preparation.

Generated candidate lifecycle state remains Phase 3 scope.

## Review Boundary

- Phase base: `7568734`.
- Implementation review range: pending validated implementation commits.

The implementation range will end at the final code, test, or review-fix
commit. A later documentation-only closeout records the accepted evidence.

## Implementation Checklist

- [ ] Add the shared override choice and compiler.
- [ ] Separate source selection from authoritative preparation.
- [ ] Collect the override for every Phase 2 source before preparation.
- [ ] Pass only the compiled optional boolean into renderer preparation.
- [ ] Add reusable, override, and effective review blocks.
- [ ] Add change, Back, Cancel, and reset behavior without writes or renders.
- [ ] Keep saved-recipe handoff ordering and navigation explicit.
- [ ] Add focused source-matrix and navigation coverage.

## Validation Checklist

- [ ] Run focused prompt, source, handoff, and review regressions.
- [ ] Run TypeScript, lint, format, build, full tests, and whitespace checks.
- [ ] Complete representative real-render and visual PDF verification.
- [ ] Record only repository-relative and sanitized evidence.

## Review Checklist

- [ ] Review the exact Phase 2 implementation range.
- [ ] Resolve actionable findings and review any widened range.
- [ ] Complete focused test-coverage review.
- [ ] Complete documentation closeout review.

## Evidence

Implementation, validation, commit, and review evidence will be added only
after the corresponding checkpoints pass.

## Related Research

- [Markdown PDF Interactive Code Highlighting](../../researches/research-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
