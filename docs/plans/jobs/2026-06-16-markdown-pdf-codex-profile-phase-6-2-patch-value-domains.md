---
title: "Markdown PDF Codex profile Phase 6.2 patch value domains"
created-date: 2026-06-16
status: completed
agent: codex
---

## Scope

Complete Phase 6.2 of the Markdown PDF Codex profile helper by constraining enum-like patch values before profile application and adding visible direct CLI progress while Codex runs.

## Failure Cause

After Phase 6.1 fixed the strict structured-output schema, live `md pdf-profile codex` runs reached profile application and exposed semantic patch-value failures:

```text
profile.cover.style must be one of: plain, report.
profile.pageNumbers.position must be one of: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right.
```

The response schema constrained patch paths, but each patch value still used a broad primitive union. Codex could therefore return a syntactically valid patch with a value outside the selected profile field's domain. The action also printed only static progress text while waiting for Codex.

## Fix

- Added a Markdown PDF Codex patch value-domain table for enum-like paths:
  - `/page/size`
  - `/page/orientation`
  - `/toc/pageBreak`
  - `/cover/style`
  - `/pageNumbers/position`
  - `/pageNumbers/scope`
  - `/code/theme`
- Included those allowed values in the bounded prompt facts as `patchValueDomains`.
- Validated enum-sensitive patch values before profile merge/application with path-specific error messages.
- Kept invalid patch handling fail-closed so a bad Codex decision does not silently write a different profile.
- Preserved fail-closed behavior for unknown selected candidates.
- Extracted a shared direct Codex progress helper from the rename spinner pattern.
- Wired `md pdf-profile codex` to show TTY progress while waiting for Codex and stop it with `done`, `fallback`, or `error`.
- Preserved rename spinner output compatibility by keeping its existing no-clear-line behavior.

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-rename-codex-internals.test.ts`
  - 46 pass, 0 fail
  - covers prompt value-domain facts, invalid `/cover/style`, invalid `/pageNumbers/position`, unknown candidate fail-closed behavior, direct Markdown PDF TTY progress success/error cleanup, and rename spinner compatibility
- `bun test`
  - 1166 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun run build`
  - completed successfully

## Final Review Follow-Up

The final full-range review found two additional test coverage gaps:

- The baseline non-TTY success path did not assert the plain request-progress line after progress output moved behind the shared helper.
- Value-domain rejection coverage did not exercise every finite-domain path.

Final follow-up changes:

- Added a non-TTY success assertion for `Requesting Codex Markdown PDF profile recommendation...`.
- Parameterized invalid string-value rejection across every `MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS` entry.

Final follow-up evidence:

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-rename-codex-internals.test.ts`
  - 49 pass, 0 fail
  - 304 assertions
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun run build`
  - completed successfully
- `node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with a proper cover page" --dry-run`
  - used `--dry-run` without report flags, so no profile or report artifact was requested
  - sandboxed smoke reached Codex initialization and stopped at the app-server permission boundary: `failed to initialize in-process app-server client: Operation not permitted`

## Artifact Safety

- `git status --short --untracked-files=all` after the smoke run showed only source, test, and documentation changes plus the new source files.
- No generated Markdown PDF profile, Codex report, or replay artifact was staged or committed.

## Post-Commit Review Follow-Up

The Phase 6.2 post-commit review found missing coverage around progress status branches and non-string invalid patch values, plus a maintainability concern about branch-local progress stopping.

Follow-up changes:

- Centralized direct Codex progress stopping around the Codex request with one `finally` block.
- Added TTY progress coverage for conservative fallback decisions.
- Added TTY progress coverage for no-usable-profile decisions, including a single `error` stop.
- Added non-TTY progress coverage through the shared rename progress surface.
- Added value-domain coverage for non-string invalid values.
- Added a contract assertion that the current finite-domain patch paths stay explicit and remain accepted patch paths.

Follow-up evidence:

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-rename-codex-internals.test.ts`
  - 49 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun run build`
  - completed successfully
