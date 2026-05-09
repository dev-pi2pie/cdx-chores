---
title: "TypeScript size refactor phase 7"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Implement Phase 7 from `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md` by handling secondary source cleanups without changing CLI behavior, prompt wording, output contracts, or public import surfaces.

## What Changed

- Replaced `src/cli/actions/markdown.ts` with a facade that re-exports focused Markdown action modules.
- Added per-command Markdown action modules for DOCX rendering, PDF rendering, PDF template initialization, PDF profile initialization, and frontmatter JSON conversion.
- Split `src/cli/duckdb/xlsx-sources.ts` into ZIP container helpers, XML helpers, workbook metadata helpers, worksheet snapshot helpers, shared types, and a public facade.
- Preserved existing public imports through the original `src/cli/actions/markdown.ts` and `src/cli/duckdb/xlsx-sources.ts` paths.

## Review Decisions

- `src/cli/duckdb/xlsx-sources.ts` remained a bottleneck for data-query source-shape work, so it was split in Phase 7.
- `src/cli/commands/rename.ts`, `src/cli/rename-plan-csv.ts`, and `src/cli/rename-preview.ts` were reviewed after the earlier rename phases. They remain behavior-specific and covered by existing rename command, apply, and preview tests, so Phase 7 leaves them for the final over-300-line exception review instead of mixing additional rename churn into this source-cleanup slice.
- `src/cli/prompts/path-inline.ts` and `src/cli/prompts/text-inline.ts` stayed untouched because they are prompt state machines and no surrounding test cleanup required movement.
- `ts_structure_refactorer` was started for the Markdown action split and wrote the per-command module split before shutdown; the resulting patch was reviewed locally and integrated with the XLSX split.

## Review

- `maintainability_reviewer` found that DOCX output preflight still had a local overwrite guard instead of using the new shared Markdown helper. The follow-up routes DOCX output checks through `ensureOutputDoesNotExist`.
- `test_reviewer` found missing negative-path coverage for malformed XLSX ZIP/workbook metadata, missing/non-file Markdown PDF assets, and DOCX render/overwrite behavior. The follow-up added targeted regression tests for those paths.
- Final test re-review found additional branch coverage gaps for DOCX overwrite-enabled rendering, XLSX snapshot failures, and Markdown PDF profile-path wiring. The follow-up added targeted regression tests for those branches.
- Final docs re-review found checklist and reviewer-closure wording gaps. The follow-up made the XLSX checklist outcome concrete and recorded final reviewer closure.
- `docs_reviewer` returned `findings: []` on the initial pass; the final docs wording findings were addressed before closeout.

## Verification

```text
bun test test/data-query-xlsx-sources.test.ts test/cli-actions-data-query-shape.test.ts test/cli-actions-data-extract-sources.test.ts
bun test test/cli-actions-md-to-pdf*.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts
bun test
bun run lint
bun run format:check
bun run build
git diff --check
```

Results:

- XLSX/source-shape focused tests: 24 pass, 0 fail
- Markdown focused tests: 78 pass, 0 fail
- Full test suite: 1057 pass, 0 fail
- Lint: 0 warnings, 0 errors
- Format check: passed
- Build: passed; embedded version unchanged at `0.1.3-canary.4`
- Diff whitespace check: passed

## Related Research

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
