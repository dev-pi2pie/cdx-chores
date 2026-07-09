---
title: "Markdown PDF render bundle Phase 1 command surface"
created-date: 2026-07-10
modified-date: 2026-07-10
status: completed
agent: codex
---

## Goal

Add the public `md to-pdf --bundle <directory>` command surface and the bounded
resolver types needed by later phases without allowing the incomplete flag to
be silently ignored.

## Scope

Phase 1 covers:

- command help and option forwarding
- action option typing and working-directory path resolution
- render-bundle role, candidate, provenance, and resolved-input types
- a temporary fail-closed action guard until Phase 4 integrates rendering
- focused command and validation tests

Bundle discovery, conflict resolution, and rendering remain owned by later
phases.

## Implementation Checklist

- [x] Register `--bundle <directory>` on `md to-pdf`.
- [x] Add and forward `bundle?: string` through command and action types.
- [x] Resolve non-empty bundle input from the CLI working directory.
- [x] Define the initial renderer-side bundle types.
- [x] Fail closed while bundle discovery is not integrated.
- [x] Cover help output, command forwarding, empty input, and the temporary
      guard.
- [x] Pass the Phase 1 validation gates.
- [x] Review the Phase 1 commit range and resolve actionable findings.

## Verification

| Command                                                                                                                                                        | Result                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `bun test test/cli-actions-md-to-pdf-command-wiring.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts` | Passed: 44 tests, 0 failures |
| `bun run lint`                                                                                                                                                 | Passed                       |
| `bun run format:check`                                                                                                                                         | Passed                       |
| `bun run build`                                                                                                                                                | Passed                       |
| `bun test`                                                                                                                                                     | Passed                       |
| `git diff --check`                                                                                                                                             | Passed                       |

## Review

The independent code review covered
`3829eaf0df3e3ed1c2e38464f8fb4c8f3720f6c8..b4d624c`.

Verdict: `APPROVE` with no actionable findings.

The reviewer independently confirmed:

- 44 focused tests passed
- `bun run lint` passed
- `bun run build` passed
- the working tree remained clean after verification

## Outcome

Phase 1 is complete. The CLI surface, action forwarding, resolver types, and
temporary fail-closed guard are committed and verified. Phase 2 can implement
top-level discovery without weakening the Phase 1 command boundary.

## Related Plan

- [Markdown PDF render bundle directory implementation](../plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Render Bundle Directory](../../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
