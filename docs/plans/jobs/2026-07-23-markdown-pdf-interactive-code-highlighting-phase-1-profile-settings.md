---
title: "Markdown PDF Interactive code highlighting Phase 1 Profile settings"
created-date: 2026-07-23
modified-date: 2026-07-23
status: completed
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

- Phase-start checkpoint: `65ed3ab`.
- Final implementation review range: `65ed3ab..5a2a792`.

This documentation-only closeout follows the final reviewed implementation
range.

## Implementation Checklist

- [x] Add typed Profile code answers and artifact-aware collection.
- [x] Add conditional prompts and revision behavior.
- [x] Serialize all four Profile code fields through a narrow prepared input.
- [x] Preserve direct Profile initialization output when that input is omitted.
- [x] Add deterministic Profile, Profile Codex Assistant, and Project Codex
      Assistant review output.
- [x] Keep Template review and Project routing boundaries unchanged.
- [x] Add focused automated coverage.

## Validation Checklist

- [x] Run focused formal-guide, deterministic, Codex, and Profile regressions.
- [x] Run lint, format checking, build, full tests, and whitespace checks.
- [x] Complete representative real-render and visual PDF verification.
- [x] Record only repository-relative and sanitized evidence.

## Review Checklist

- [x] Review the exact Phase 1 implementation range.
- [x] Resolve actionable findings and review the widened range.
- [x] Complete focused test-coverage review.
- [x] Complete documentation closeout review.

## Evidence

Implementation checkpoints:

- `cced9d3` — Profile-only formal-guide code settings, serialization, candidate
  review, and artifact-matrix coverage
- `6f2ce3c` — standalone TypeScript narrowing and fixture corrections from the
  first exact-range review
- `5a2a792` — shared Profile default sourcing, extension-preserving revision
  helpers, and defensive Codex review normalization

Passed:

```bash
bun test test/cli-interactive-markdown-pdf/formal-guide.test.ts test/cli-interactive-markdown-pdf/deterministic-service.test.ts test/cli-actions-md-to-pdf-profile-init.test.ts test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts test/cli-interactive-markdown-pdf/codex-authoring.test.ts
bunx tsc --noEmit --project tsconfig.json
bun run lint
bun run format:check
bun run build
bun test
git diff --check 65ed3ab..5a2a792
```

The focused implementation slice passed with 81 tests and zero failures. The
full repository suite passed with 1,708 tests and zero failures.

Two one-page A4 render smokes exercised the same fenced-code input with
highlighting enabled and disabled. PDF metadata inspection and page
rasterization passed. Visual inspection confirmed that the enabled output used
the selected light theme with line numbers, the disabled output kept a plain
unnumbered block, and both preserved readable surrounding content. Temporary
smoke artifacts were removed after inspection.

The first exact-range correctness review found two blocking standalone
TypeScript errors. The accepted fix preserved artifact-discriminated answer
narrowing and corrected the affected test fixture annotations. The
maintainability review then led to shared Profile-default sourcing,
extension-preserving common revision helpers, and removal of validation-result
string coupling from candidate review.

Correctness, maintainability, and test-coverage reviews found no remaining
actionable issues in the widened range `65ed3ab..5a2a792`.

## Related Research

- [Markdown PDF Interactive Code Highlighting](../../researches/research-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
