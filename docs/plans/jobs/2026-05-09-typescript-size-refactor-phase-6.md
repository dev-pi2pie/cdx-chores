---
title: "TypeScript size refactor phase 6"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Implement Phase 6 from `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md` by splitting the largest behavior-owned test suites into concise files without changing assertions or production behavior.

## What Changed

- Replaced `test/fonts.test.ts` with focused font discovery, discovery parser, CLI registration, CLI list, CLI check, CLI inspect, and font coverage suites.
- Replaced `test/cli-actions-md-to-pdf.test.ts` with focused Markdown PDF option, profile, recipe, action, template-init, profile-init, command, and Pandoc fixture suites.
- Split `test/cli-interactive-routing.test.ts` into top-level smoke coverage plus route-family suites for data convert, data stack, data extract, data query, data preview, and video flows.
- Added local helpers for Markdown PDF runner setup and interactive routing ANSI/default-output utilities.
- Kept the shared routing suite as smoke coverage for the major top-level routes while preserving feature-specific route assertions in focused files.

## Review

- `ts_structure_refactorer` was started for the font split but did not return a usable result before local work needed to continue, so the font split was completed locally.
- `maintainability_reviewer` found empty suite shells after mechanical splits, an interactive routing helper dependency on an unrelated data-preview helper, and parser/discovery tests still sharing one font discovery bucket.
- The follow-up removed empty suites, moved ANSI stripping into the routing helper, and split font parser tests from discovery integration tests.

## Verification

```text
bun test test/fonts*.test.ts
bun test test/cli-actions-md-to-pdf*.test.ts
bun test test/cli-interactive-routing*.test.ts
bun test test/fonts*.test.ts test/cli-actions-md-to-pdf*.test.ts test/cli-interactive-routing*.test.ts
bun run lint
bun run format:check
```

Results:

- Font split tests: 73 pass, 0 fail
- Markdown PDF split tests: 53 pass, 0 fail
- Interactive routing split tests: 70 pass, 0 fail
- Combined Phase 6 focused validation after review fixes: 196 pass, 0 fail
- Lint: 0 warnings, 0 errors
- Format check: passed

## Related Research

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
