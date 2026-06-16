---
title: "Markdown PDF Codex font patch phase 4 action coverage and smoke"
created-date: 2026-06-16
status: completed
agent: codex
plan: ../plan-2026-06-16-markdown-pdf-codex-font-patch-contract.md
---

## Scope

Phase 4 added action-level coverage for the dedicated font patch contract and
ran the broader validation ladder.

## Changes

- Added a write-path action test proving dedicated font patches serialize as
  normal `profile.fonts` YAML.
- Covered body default, body language tag, code default, code symbols, heading
  default, and pageChrome default font patches through the action layer.
- Asserted report retention writes `acceptedFontPatches` separately from normal
  `acceptedPatches`.
- Added action failure coverage for invalid font patch role and key combinations.
- Added dry-run report retention coverage for accepted font patches.

## Verification

```bash
bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts
bun test
bun run format:check
bun run lint
bun run build
git diff --check
node dist/esm/bin.mjs md pdf-profile codex README.md --intent "font-friendly reusable profile" --dry-run
```

Results:

- Focused adapter/action suites: 52 tests passed.
- Full test suite: 1178 tests passed.
- Format, lint, build, and diff checks: passed.
- Dry-run smoke reached the known local Codex app-server permission boundary:
  `failed to initialize in-process app-server client: Operation not permitted`.

## Artifact Safety

The dry-run smoke used no Codex report flags and created no generated profile,
report, PDF, local resource, or replay artifacts. No generated artifacts were
staged.
