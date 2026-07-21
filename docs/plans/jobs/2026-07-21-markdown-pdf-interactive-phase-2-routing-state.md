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
- [ ] Pass focused and repository validation.
- [ ] Review the exact Phase 2 commit range and resolve actionable findings.

## Changes

- Registered `to-pdf` and `pdf-recipes` before the existing Markdown actions.
- Moved Markdown Interactive dispatch into a feature folder.
- Added typed Markdown PDF route and lifecycle vocabulary for later phases.
- Added deterministic not-ready shells so incomplete routes cannot collect
  input, write artifacts, invoke Codex, or render.

## Verification

Pending the complete Phase 2 validation gate.

## Review

Pending a validated Phase 2 commit range.

## Artifact Safety

Phase 2 route tests must stop before path prompts, action calls, Codex calls,
renderer calls, or filesystem writes. No Profile, Template, Project, report,
HTML, or PDF artifact should be created by this phase.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
