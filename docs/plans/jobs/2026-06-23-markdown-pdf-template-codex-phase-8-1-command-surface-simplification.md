---
title: "Markdown PDF template Codex phase 8.1 command surface simplification"
created-date: 2026-06-23
modified-date: 2026-06-23
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.1 of the direct `md pdf-template codex` plan.

This phase reduces the over-expanded public CLI surface for
`md pdf-template codex`. The command now stays closer to
`md pdf-profile codex`: bounded Codex/template signals plus output and report
controls. Direct recipe controls remain on `md pdf-template init`, reusable
base profiles, and the later `md to-pdf` render command.

## Sequence

1. Compared the existing `md pdf-template codex --help` surface with
   `md pdf-profile codex --help`.
2. Classified the recipe flags as an over-expanded public surface for this
   Codex helper.
3. Removed the recipe flags from `md pdf-template codex` command registration
   instead of hiding them.
4. Proved representative removed flags reject as unknown options.
5. Pruned command-layer pass-through assertions that only existed for removed
   recipe flags.
6. Verified the simplified help output from the built CLI.
7. Verified `md pdf-template init` still exposes the direct recipe-control
   flags.
8. Ran focused and full repository gates.

## Changes

- Removed the `applyMarkdownPdfRecipeOptions` wrapper from the
  `md pdf-template codex` command registration.
- Kept recipe flags on `md to-pdf`, `md pdf-template init`, and
  `md pdf-profile init`.
- Narrowed `MdPdfTemplateCodexCliOptions` so direct CLI options cannot include
  the removed recipe fields.
- Kept internal/action recipe support for base-profile-derived signals,
  renderer defaults, and deterministic synthesis seams.
- Updated command help tests to assert the simplified `md pdf-template codex`
  surface.
- Added command-layer unknown-option coverage for representative removed flags:
  `--preset`, `--margin`, and `--toc`.
- Updated command-layer deterministic bundle coverage to use a base profile
  instead of public recipe flags.
- Pruned the old command-layer recipe pass-through assertions while preserving
  coverage for supported public signals.

## Verification

- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed after implementation: 89 tests.
- `bunx tsc --noEmit`
  - Passed after implementation and after closeout.
- `bun run format:check`
  - Passed after implementation and after closeout.
- `bun run lint`
  - Passed after implementation and after closeout.
- `git diff --check`
  - Passed after implementation and after closeout.
- `bun run build`
  - Passed during closeout.
- `node dist/esm/bin.mjs md pdf-template codex --help`
  - Confirmed the simplified help surface omits recipe flags.
- `node dist/esm/bin.mjs md pdf-template init --help`
  - Confirmed direct recipe flags remain on the deterministic init command.
- `node dist/esm/bin.mjs md pdf-template codex --preset report`
  - Confirmed removed recipe flags are rejected as unknown options.
- `bun test --timeout 30000`
  - Passed during closeout: 1287 tests.

## Review

- Phase implementation range review requested as `c2f2a4b..49fc479`.
- Review requests were sent to `Plainspoken the 6th` and `Probe the 6th`.
- `auto_commit_notification` was requested before the implementation commit;
  the thread limit blocked a fresh advisor, so the existing `Commit Scout the
  9th` thread was reused.

Phase 8.1 implementation commit:

- `49fc479` `refactor(template-codex): simplify public command surface`
