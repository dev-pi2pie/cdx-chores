---
title: "Markdown PDF Codex font patch phase 1 schema and types"
created-date: 2026-06-16
status: completed
agent: codex
plan: ../plan-2026-06-16-markdown-pdf-codex-font-patch-contract.md
---

## Scope

Phase 1 activated the branch plan and added the strict structured-output shape for
`accepted_font_patches`.

## Changes

- Added `accepted_font_patches` to the Markdown PDF Codex output schema as a required array.
- Kept the root and nested patch schemas strict with `additionalProperties: false`.
- Added shared TypeScript types for font patch role and payload.
- Parsed `accepted_font_patches` into `decision.acceptedFontPatches`.
- Required `accepted_font_patches` to be empty for `no-usable-profile`.

## Verification

```bash
bun test test/adapters-codex-markdown-pdf-profile.test.ts
```

Result: 13 tests passed.

## Artifact Safety

No generated profile, report, PDF, local resource, or replay artifacts were created or staged.
