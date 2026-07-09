---
title: "Markdown PDF render bundle Phase 3 conflicts"
created-date: 2026-07-10
status: in-progress
agent: codex
---

## Goal

Resolve discovered bundle candidates deterministically, allow explicit
per-role selection, and fail with one actionable error when unresolved roles
remain ambiguous.

## Scope

Phase 3 covers:

- explicit profile, template, and stylesheet selection before discovery
  resolution
- unique bundle-candidate selection for unspecified roles
- explicit artifact paths outside the bundle directory
- stable aggregated conflict diagnostics
- resolving-flag guidance per ambiguous role
- `bundle` versus `explicit` provenance for later summaries

Renderer integration remains owned by Phase 4, so the temporary action guard
stays active.

## Implementation Checklist

- [x] Resolve explicit artifact paths before bundle candidates for each role.
- [x] Select one bundle candidate for every remaining unique role.
- [x] Aggregate unresolved role conflicts in stable role order.
- [x] Preserve sorted candidate names and resolving flags in errors.
- [x] Use the normal invalid-input `CliError` contract.
- [x] Allow explicit resolution of the only represented bundle role.
- [x] Allow explicit artifact paths outside the bundle directory.
- [x] Return resolution provenance for every selected role.
- [x] Cover unique, mixed, explicit-only, and multi-role conflict behavior.
- [x] Pass the Phase 3 validation gates.
- [ ] Review the Phase 3 commit range and resolve actionable findings.

## Verification

| Command                                              | Result                       |
| ---------------------------------------------------- | ---------------------------- |
| `bun test test/cli-actions-md-to-pdf-bundle.test.ts` | Passed: 22 tests, 0 failures |
| `bun run lint`                                       | Passed                       |
| `bun run format:check`                               | Passed                       |
| `bun run build`                                      | Passed                       |
| `bun test`                                           | Passed                       |
| `git diff --check`                                   | Passed                       |

## Review

The concrete Phase 3 commit range and review result will be recorded after the
checkpoint commit exists.

## Related Plan

- [Markdown PDF render bundle directory implementation](../plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Render Bundle Directory](../../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
