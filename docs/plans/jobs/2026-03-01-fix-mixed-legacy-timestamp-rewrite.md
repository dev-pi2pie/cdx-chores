---
title: "Fix mixed legacy timestamp rewrite"
created-date: 2026-03-01
status: completed
agent: codex
---

## Summary

- Fixed mixed-template timestamp detection so bare `{timestamp}` tokens still participate in timezone rewriting even when a template also includes explicit timestamp placeholders.
- Added regression coverage for template helpers and single-file/batch rename flows using mixed timestamp templates.

## What Changed

- `src/cli/rename-template.ts`
  - changed `templateContainsLegacyTimestamp` to detect any legacy `{timestamp}` token, including mixed templates such as `{timestamp}-{timestamp_utc}-{stem}`
  - updated the interactive timestamp-prompt contract comments to match the mixed-template behavior
- `test/cli-rename-template.test.ts`
  - updated legacy timestamp expectations for mixed templates
  - added rewrite and interactive-flow assertions for mixed legacy + explicit patterns
- `test/cli-actions-rename-batch-core.test.ts`
  - added a regression test proving `--timestamp-timezone` rewrites legacy tokens inside mixed templates
- `test/cli-actions-rename-file.test.ts`
  - added the same mixed-template regression for single-file rename

## Verification

- `bun test test/cli-rename-template.test.ts test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-file.test.ts`
