---
title: "Cover intent and interactive page-text validation"
created-date: 2026-09-24
status: completed
agent: codex
---

## Scope

Starting commit: `61450fecd96063ed557107c17103652ebe1cfd03`.

- Preserve requested Project covers expressed outside the local intent matcher's vocabulary, while retaining explicit base/image constraints and the no-request default.
- Validate Codex page-information text on submission, keep rejected entries editable for correction, and display feedback in advanced prompts using the existing diagnostic presentation.
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

- The 512-character page-information limit is checked when an entry is submitted, not while it is typed. An overlong entry stays editable for correction. The check uses JavaScript string length (UTF-16 code units), so some visible characters count as more than one.

  | Input                                                      | This 512-character limit          |
  | ---------------------------------------------------------- | --------------------------------- |
  | Codex Assistant custom page-number label                   | Applies to the label              |
  | Codex Assistant repeating header/footer text               | Applies to each selected position |
  | PDF intent, in the single-line prompt or multiline editor  | Does not apply                    |
  | Ordinary Formal Guide page-number label and repeating text | Does not apply                    |

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
