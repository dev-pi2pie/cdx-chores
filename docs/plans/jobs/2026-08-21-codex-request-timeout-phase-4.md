---
title: "Codex request timeout Phase 4"
created-date: 2026-08-21
status: in-progress
agent: codex
---

## Goal

Add bounded timeout-cause recognition and timeout-specific rename fallback
information without changing retry behavior or public report schemas, as defined
by Phase 4 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `39ae43ea58936975c4ab9c4fcefd673e9e81b6e8`

Phase 3 is complete and reviewed. The working tree was clean at this boundary.

## Implementation Boundary

- classify only `timeout`, `aborted`, and `other` through a bounded cause chain
- preserve exhausted batch failure metadata without changing public result or
  report schemas
- add stable analyzer-specific timeout summaries with the effective per-attempt
  duration and retry-exhaustion context
- preserve generic unknown-error summaries, partial suggestions, deterministic
  fallback, retry behavior, and exit behavior
- keep shared classification and formatting reusable by later direct and
  Interactive adoption phases

## Validation

Pending implementation.

## Review

Pending implementation and exact-range review.
