---
title: "Markdown PDF render bundle Phase 4 render integration"
created-date: 2026-07-10
status: in-progress
agent: codex
---

## Goal

Integrate bundle discovery and resolution into `md to-pdf` while preserving the
existing profile, template, stylesheet, asset, override, dependency, and output
safety paths.

## Scope

Phase 4 covers:

- early bundle discovery and explicit-role resolution
- reuse of the existing action profile/template/CSS variables
- selected-file validation before dependency probes
- concise resolved-input summaries with explicit provenance when relevant
- action coverage for every single-role, partial, and complete bundle shape
- no-output failures for ambiguity and invalid selected files
- profile, recipe, CSS-order, code-highlight, and default-CSS precedence
- template-relative managed asset compatibility

Helper follow-up command adoption and public guide updates remain owned by
later phases.

## Implementation Checklist

- [x] Remove the temporary Phase 1 fail-closed guard.
- [x] Invoke discovery and resolution when `--bundle` is supplied.
- [x] Feed resolved paths into the existing renderer action variables.
- [x] Preserve the explicit-only command path.
- [x] Validate selected files and output paths before summary/dependency probes.
- [x] Print a concise bundle summary and omit absent roles.
- [x] Mark explicit-role provenance in mixed commands.
- [x] Cover profile-only, template-only, stylesheet-only, partial, and complete
      rendering.
- [x] Cover ambiguity and invalid-profile failures before dependency probes and
      output writes.
- [x] Preserve profile/recipe/CSS/code/default-CSS precedence.
- [x] Preserve template-relative managed assets.
- [x] Pass the Phase 4 validation gates.
- [ ] Review the Phase 4 commit range and resolve actionable findings.

## Verification

| Command                                                                                                                                                                                                                                                               | Result                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `bun test test/cli-actions-md-to-pdf-bundle.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts test/cli-actions-md-to-pdf-actions-assets.test.ts` | Passed: 93 tests, 0 failures |
| `bun run lint`                                                                                                                                                                                                                                                        | Passed                       |
| `bun run format:check`                                                                                                                                                                                                                                                | Passed                       |
| `bun run build`                                                                                                                                                                                                                                                       | Passed                       |
| `bun test`                                                                                                                                                                                                                                                            | Passed                       |
| `git diff --check`                                                                                                                                                                                                                                                    | Passed                       |

## Manual Smoke

`cdx-chores doctor --json` reported Pandoc `3.9` available and WeasyPrint
unavailable, so a live PDF smoke was not run. This is an environment limitation,
not a product-test failure. Injected-runner integration coverage exercises the
complete render handoff without external tool availability.

## Review

The concrete Phase 4 commit range and review result will be recorded after the
checkpoint commit exists.

## Related Plan

- [Markdown PDF render bundle directory implementation](../plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Render Bundle Directory](../../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
