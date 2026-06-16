---
title: "Markdown PDF Codex profile Phase 6.5.1 title cover deduplication"
created-date: 2026-06-16
status: completed
agent: codex
---

## Scope

Complete Phase 6.5.1 of the Markdown PDF Codex profile helper by making title source and cover intent a bounded prompt policy.

## Failure Cause

A CJK font smoke replay showed that font selection could succeed while the rendered PDF still displayed the same document title twice. The Markdown input had both frontmatter `title` and a matching first H1. The renderer template can emit metadata title chrome, while the Markdown body keeps the H1, so profile generation must not blindly add cover or title treatment when the document already has a visible title.

This is not a profile schema expansion. The profile helper cannot remove the body H1, mutate frontmatter, or invent title-suppression fields. Richer cover media, local cover images, and exact title-block behavior remain template/custom HTML concerns.

## Fix

- Added bounded document title signals:
  - frontmatter title presence and character count
  - first H1 presence and character count
  - normalized title match
  - duplicate visible title risk
- Preserved the existing privacy boundary by not serializing raw frontmatter title text or raw H1 text into document signals, prompt facts, or Codex reports.
- Added a derived `titleDecisionSignal` to the Codex prompt.
- Added prompt policy for:
  - duplicate title structure without explicit cover intent
  - explicit cover intent with duplicate-H1 warning guidance
  - explicit no-cover or no-title-page intent
  - no Markdown rewriting, no frontmatter mutation, and no unsupported title-suppression fields
- Kept the strict patch schema unchanged.

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts`
  - 18 pass, 0 fail
- `bun test test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts`
  - 8 pass, 0 fail
- `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 38 pass, 0 fail
- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 64 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `bun run build`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun test`
  - 1184 pass, 0 fail

## Smoke

- `node dist/esm/bin.mjs md pdf-profile codex examples/playground/md-pdf/cjk-font-smoke.md --intent "mixed-language PDF with readable CJK body text and no cover page or duplicate title page" --dry-run`
  - sandboxed smoke reached Codex initialization and stopped at the app-server permission boundary before a live Codex response:

```text
Codex Markdown PDF profile helper is unavailable. Codex Exec exited with code 1: WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Reading prompt from stdin...
Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)
```

- The same `--dry-run` command succeeded outside the sandbox:

```text
Decision: adapted
Based on: article
Preset: article
Profile: examples/playground/md-pdf/cjk-font-smoke-md-pdf-profile-20260616T063445Z-0e66244e.yml
Dry run only. No profile was written.
```

## Artifact Safety

- The successful smoke used `--dry-run` without report flags, so no profile or report artifact was requested.
- `examples/playground/md-pdf/` contained only the existing ignored `cjk-font-smoke.md` input after the smoke run.
- `git status --short --untracked-files=all` after the smoke run showed only source, test, and documentation changes.
- No generated Markdown PDF profile, Codex report, PDF, local resource, or replay artifact was staged or committed.
