---
title: "Codex request timeout Phase 3"
created-date: 2026-08-21
status: in-progress
agent: codex
---

## Goal

Thread the shared normalized Codex timeout through rename file and batch actions,
resolve effective analyzer values after routing, and preserve existing retry and
fallback behavior as defined by Phase 3 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `6e5b162525927df83d0167e5e907a9c89607aae7`

Phases 1 and 2 are complete and reviewed. The working tree was clean at this
boundary.

## Implementation Boundary

- add one optional shared numeric timeout seam to rename file and batch actions
- preserve existing image and document numeric action fields
- resolve scoped, shared, and default precedence only after analyzer routing
- pass one effective timeout to each enabled analyzer and every retry attempt
- keep timeout options from enabling Codex analysis
- preserve retry counts, delays, ordering, partial suggestions, fallback, and
  exit behavior

## Validation

Pending implementation.

## Review

Pending implementation and exact-range review.
