---
title: "Markdown PDF Codex font patch phase 2 validation and application"
created-date: 2026-06-16
status: complete
agent: codex
plan: ../plan-2026-06-16-markdown-pdf-codex-font-patch-contract.md
---

## Scope

Phase 2 routed profile font writes through `accepted_font_patches` instead of
normal enum-backed JSON Pointer patches.

## Changes

- Removed fixed `/fonts/...` paths from normal `accepted_patches`.
- Added font patch role/key validation for body, heading, code, and page chrome fonts.
- Reused the profile body language-tag validator for body font language keys.
- Materialized missing `profile.fonts` and role objects only as plain objects.
- Rejected scalar and array `fonts` or role parents before applying font values.
- Applied font patches before final profile shape validation and normalization.

## Verification

```bash
bun test test/adapters-codex-markdown-pdf-profile.test.ts
bun run build
```

Results:

- Adapter suite: 15 tests passed.
- Build: passed.

## Artifact Safety

No generated profile, report, PDF, local resource, or replay artifacts were created or staged.
