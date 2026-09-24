---
title: "Cover intent and interactive page-text validation"
created-date: 2026-09-24
status: in-progress
agent: codex
---

## Scope

Starting commit: `61450fecd96063ed557107c17103652ebe1cfd03`.

- Preserve requested Project covers expressed outside the local intent matcher's vocabulary, while retaining explicit base/image constraints and the no-request default.
- Enforce the Codex page-information text limit during editing, preserve answers during correction, and display validation feedback in advanced prompts using the existing diagnostic presentation.
- Use independently authored synthetic regression and rendering cases. Keep local resources and environment setup out of this record.

## Verification

Pending focused regression tests, static checks, combined suites, synthetic PDF rendering and visual inspection, and review of the complete implementation commit range.

## Checkpoints

### Cover intent

- Project Profile responses require a structured interpretation of advisory cover intent in the existing request. Standalone Profile responses retain their existing schema.
- Bounded local cover rules and explicit base/image conflicts remain authoritative. Other prose uses the structured interpretation; absent intent cannot enable a cover through model inference.
- Focused adapter, Project, and Interactive preparation tests: 287 passed / 2,372 assertions. TypeScript, lint, formatting, build, and `git diff --check` passed.
- Commit: `7336efa5` (`fix(markdown-pdf): preserve Project cover intent`).

### Interactive page text

- Codex page-information prompts enforce the 512-character bound while editing. The ordinary Formal Guide retains its existing input contract.
- Advanced text prompts show the shared error-label styling and retain editable input after rejection. Runtime color preferences flow to the prompt; diagnostics remain plain when colors are disabled.
- Focused prompt and collector tests: 67 passed / 218 assertions, including 512/513 boundaries, correction, wrapped rows, and color-disabled output. TypeScript, lint, formatting, and build passed.
- Commit, combined validation, and final review pending.
