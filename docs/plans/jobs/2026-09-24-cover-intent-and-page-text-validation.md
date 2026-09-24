---
title: "Cover intent and interactive page-text validation"
created-date: 2026-09-24
status: completed
agent: codex
---

## Scope

Starting commit: `61450fecd96063ed557107c17103652ebe1cfd03`.

- Preserve requested Project covers expressed outside the local intent matcher's vocabulary, while retaining explicit base/image constraints and the no-request default.
- Enforce the Codex page-information text limit during editing, preserve answers during correction, and display validation feedback in advanced prompts using the existing diagnostic presentation.
- Use independently authored synthetic regression and rendering cases. Keep local resources and environment setup out of this record.

## Verification

- Unit suite: 1,405 passed / 5,262 assertions.
- Application suite: 2,147 passed / 13,633 assertions; result and fixture-output validation passed.
- Pandoc suite: 5 passed / 162 assertions. All three suites completed without failures or skips.
- TypeScript, repository lint and formatting, build, and `git diff --check` passed.
- Independently authored synthetic cases produced four PDFs through the built Node CLI with Pandoc and WeasyPrint. A multilingual requested cover produced a cover and body page; unspecified and unwanted covers each produced one body page despite an enabled model Profile.
- An advanced-prompt case rejected a 513-character draft, retained the editing session, accepted a correction, and rendered the corrected header and page number. Committed tests separately check acceptance at exactly 512 characters and isolation from ordinary Formal Guide input.
- PDF.js verified page counts and text for all four PDFs. All five rasterized pages were inspected without clipping, overlap, or missing glyphs.
- Smoke preparation used injected responses, not live model calls. These checks verify the structured response contract and downstream behavior, not live model interpretation quality.

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
- Commit: `72fe0846` (`fix(cli): keep page text validation recoverable`).

## Commit-range review

Reviewed the complete implementation range
`61450fecd96063ed557107c17103652ebe1cfd03..72fe084698f398c444cfa008687f921498b65e82`,
including adapter contracts, policy precedence, prompt recovery and color handling,
call sites, and regression coverage. No actionable findings remained.

The final documentation checkpoint records the verified implementation and review.
Public evidence consists of synthetic scenarios and committed tests; no private
resource content, identifiers, or environment setup is included.
