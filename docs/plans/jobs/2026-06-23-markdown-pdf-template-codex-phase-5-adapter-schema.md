---
title: "Markdown PDF template Codex phase 5 adapter schema"
created-date: 2026-06-23
status: in-progress
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 5 of the direct `md pdf-template codex` plan.

This phase adds the Codex adapter prompt, strict structured-output schema,
decision parsing, and pre-synthesis decision validation for template choices.
It does not write template bundles, copy assets, emit reports, or run final
static bundle validation; those remain later phases.

## Implementation Notes

- Keep the adapter under `src/adapters/codex/markdown-pdf-template/` so it
  follows the existing Codex adapter boundary.
- Keep Codex output as bounded decisions and slots, not generated files.
- Preserve strict structured-output rules: all object properties are required
  by the schema, optional semantics use empty strings or empty arrays, and all
  objects use `additionalProperties: false`.
- Use managed asset summaries and bundle-relative asset references only.
- Treat image sizing as semantic slots such as `contain` or `cover`; source
  pixel dimensions may inform the prompt but must not become raw CSS sizing
  directives in Codex decisions.

## Changes

Pending.

## Verification

Pending.

## Review

Pending.
