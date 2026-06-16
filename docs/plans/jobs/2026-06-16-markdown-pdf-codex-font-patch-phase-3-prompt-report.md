---
title: "Markdown PDF Codex font patch phase 3 prompt and report"
created-date: 2026-06-16
status: completed
agent: codex
plan: ../plan-2026-06-16-markdown-pdf-codex-font-patch-contract.md
---

## Scope

Phase 3 updated the Codex prompt contract and diagnostic report payload for
dedicated font patch decisions.

## Changes

- Added a bounded JSON `fontPatchContract` to deterministic prompt facts.
- Instructed Codex to use `accepted_font_patches` for all font writes and keep
  `/fonts/...` out of normal `accepted_patches`.
- Kept `--font-hint` as the only dedicated font hint signal.
- Bumped the Markdown PDF Codex report artifact version from 3 to 4.
- Added `result.acceptedFontPatches` to success reports.
- Preserved generated profile output as normal `fonts` YAML or JSON.
- Kept unsupported font requests routed to warnings or `unmatched_directions`.

## Verification

```bash
bun test test/adapters-codex-markdown-pdf-profile.test.ts
bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts
```

Results:

- Adapter suite: 15 tests passed.
- Action suite: 35 tests passed.

## Artifact Safety

No generated profile, report, PDF, local resource, or replay artifacts were staged.
