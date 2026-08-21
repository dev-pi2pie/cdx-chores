---
title: "Codex request timeout Phase 5"
created-date: 2026-08-21
status: active
agent: codex
---

## Goal

Apply the shared duration-based Codex request-timeout contract to the selected
data and Markdown direct commands, as defined by Phase 5 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `a69f251ffa7b174184a7aed0d86f6ff175c1d529`

Phase 4 is complete and reviewed. The working tree was clean at this boundary.

## Implementation Boundary

- reuse one Commander timeout-option helper across rename, data, and Markdown
  command registration
- add the shared option only to the five approved direct command surfaces
- preserve the 30-second default and existing numeric action or prepared-service
  injection seams
- keep timeout options from enabling optional Codex assistance
- give each Markdown profile, template, project, and repair request its own
  timeout window with the same configured value
- preserve current report schemas, artifacts, recovery behavior, and generic
  failures

## Validation

Validation evidence will be recorded after the implementation and review range
are complete.

## Review

The exact Phase 5 implementation range and review result will be recorded after
the phase validation gate passes.
