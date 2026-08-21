---
title: "Codex request timeout Phase 6"
created-date: 2026-08-21
status: active
agent: codex
---

## Goal

Add one session-owned timeout to explicit Interactive mode and route it through
every current Interactive Codex request path, as defined by Phase 6 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `61bc886e`

Phase 5 is complete and reviewed. The working tree was clean at this boundary.

## Implementation Boundary

- register `--codex-timeout <duration>` only on the explicit `interactive`
  command
- resolve one numeric session value without mutating runtime or path-prompt
  configuration
- keep no-argument Interactive entry on the shared 30-second default without a
  new setup prompt
- pass the same value through rename, cleanup, data, and Markdown Codex helpers
- preserve user-controlled regeneration, workflow-owned recovery, saved recipe
  identity, and generated artifact schemas

## Validation

Validation evidence will be recorded after the implementation and review range
are complete.

## Review

The exact Phase 6 implementation range and review result will be recorded after
the phase validation gate passes.
