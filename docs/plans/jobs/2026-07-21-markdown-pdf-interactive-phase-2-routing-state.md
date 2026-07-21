---
title: "Markdown PDF Interactive Mode Phase 2 routing and state"
created-date: 2026-07-21
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 2 of the Markdown PDF Interactive Mode plan by establishing
the Markdown feature-module boundary, registering the two PDF entry routes,
and defining their initial typed state without exposing an incomplete flow.

Phase base: `48ffde96ca271f8dd3a4e4e0a4b31185495fe00f`.

## Implementation Checklist

- [x] Add `md:to-pdf` and `md:pdf-recipes` menu keys and descriptions.
- [x] Move the existing Markdown handler to
      `src/cli/interactive/markdown/index.ts` without changing existing routes.
- [x] Add Markdown PDF entry, source, preparation, review, lifecycle, and
      materialization state types.
- [x] Reuse current menu and checkpoint helpers without widening shared state.
- [x] Add menu-order and fail-closed route coverage.
- [x] Keep incomplete Markdown PDF routes fail-closed before prompts or writes.
- [x] Pass focused and repository validation.
- [ ] Review the exact Phase 2 commit range and resolve actionable findings.

## Changes

- Registered `to-pdf` and `pdf-recipes` before the existing Markdown actions.
- Moved Markdown Interactive dispatch into a feature folder.
- Added typed Markdown PDF route and lifecycle vocabulary for later phases.
- Added deterministic not-ready shells so incomplete routes cannot collect
  input, write artifacts, invoke Codex, or render.

## Verification

Passed:

```bash
bun test test/cli-interactive-routing.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

The focused routing suite passed with 10 tests and zero failures. The full
suite passed with 1,528 tests and zero failures.

Implementation checkpoints:

- `271fd6b` — Markdown PDF menu routes, module move, typed shells, and tests
- `74eed27` — shell-route and entry-state simplification
- `4e54c21` — narrowed state vocabulary, route parity coverage, and job record

## Review

Pending a validated Phase 2 commit range.

## Artifact Safety

Phase 2 route tests stop before path prompts, action calls, Codex calls,
renderer calls, or filesystem writes. No Profile, Template, Project, report,
HTML, or PDF artifact was created by this phase.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
