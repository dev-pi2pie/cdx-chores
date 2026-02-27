---
title: "Audit and trim redundant rename action tests after file split"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Perform a second-pass audit on the newly split rename action tests, merge repeated setup where safe, and remove truly redundant cases without weakening behavior coverage.

## Implemented

- Merged repeated route/fallback setup into table-driven cases where the contract stayed the same:
  - `test/cli-actions-rename-batch-codex-auto.test.ts`
  - `test/cli-actions-rename-batch-codex-docs.test.ts`
- Reduced repeated single-file markdown analyzer coverage in:
  - `test/cli-actions-rename-file.test.ts`
- Removed one genuinely redundant action-layer test:
  - explicit single-file `codex-docs` markdown success path
  - retained single-file doc analyzer coverage through:
    - `--codex` auto-routing markdown path
    - explicit `codex-docs` DOCX-specific paths
- Preserved distinct contracts that are still worth keeping:
  - single-file vs batch behavior
  - explicit both-analyzers vs `--codex` auto behavior
  - explicit override precedence over `--codex`
  - subtype-specific DOCX/PDF/text fallback reasons

## Result

- Total test files remained feature-scoped after the earlier split.
- Total test lines reduced from `3017` to `2953` across `test/*.test.ts`.
- Full-suite test count reduced from `100` to `99` while preserving behavior coverage.

Largest test files after this audit:

- `test/cli-actions-rename-batch-core.test.ts` (`463` lines)
- `test/cli-actions-rename-file.test.ts` (`360` lines)
- `test/cli-actions-md-frontmatter-to-json.test.ts` (`297` lines)

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`99 pass`, `0 fail`)

## Related Jobs

- `docs/plans/jobs/2026-02-27-test-suite-rename-action-split-refactor.md`
