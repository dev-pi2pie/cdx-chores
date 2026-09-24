---
title: "Page-information report and cover-intent fixes"
created-date: 2026-09-24
status: completed
agent: codex
---

## Scope

Starting commit: `4d5909fa1be48148912802b331e504c5bce970e8`.

- Accept valid inherited `pageNumbers.start: 0` in final diagnostic-report metadata while keeping guided number-ON requests starting at 1.
- Prevent weak cover-keyword matches from overriding validated model decisions; retain explicit image/base-Profile constraints and recognized cover-conflict checks.

## Verification

Regression tests and independently authored synthetic smoke resources cover both findings. The smoke uses injected model responses and the built Node CLI, with real Pandoc and WeasyPrint rendering. No private resources are copied or identified here.

### Zero-start report checkpoint

- Commit: `2f0dc902` (`fix(md-pdf): accept zero page number in reports`).
- Final report metadata accepts zero, matching the Profile contract. Guided number-ON requests still require start 1.
- Regression coverage saves and reloads Profile and Project artifacts with inherited start zero, numbering enabled or disabled, repeating content OFF, and diagnostic reports.
- Focused report unit tests: 5 passed. Focused helper application tests: 10 passed. TypeScript, lint, formatting, build, and `git diff --check` passed.

### Cover-intent checkpoint

- Commit: `d265a27c` (`fix(md-pdf): preserve profile cover choice for ambiguous intent`).
- Only bounded affirmative request clauses establish a local positive cover choice. Unrecognized cover wording preserves the validated Profile decision when no explicit image/base constraint owns it.
- Recognized negative requests, text/image conflicts, and image/base constraints remain checked. Coordinated affirmative text/image requests still conflict.
- This local matcher is deliberately incomplete: ambiguous means unrecognized by the matcher, not that a human could not interpret the request. It does not replace model interpretation of free-form prose.
- Focused cover policy and saved Project handoff tests: 75 passed. TypeScript, lint, and formatting passed.

### Combined validation and synthetic smoke

- Unit suite: 1,380 passed / 5,218 assertions.
- Application suite: 2,139 passed / 13,602 assertions; harness result and fixture-output checks passed.
- Pandoc suite: 5 passed / 162 assertions, no failures or skips.
- TypeScript, repository lint/format checks, build, and `git diff --check` passed.
- Independently authored resources: `examples/playground/md-pdf/smoke/2026-09-24-review-findings/`. Preparation uses injected responses; rendering uses the built Node CLI with `conda activate base`, Pandoc 3.9, and WeasyPrint 69.0.
- Both zero-start artifacts save their reports; the Project PDF has two body pages numbered 0 and 1 with repeating text cleared. The negative cover request renders one body page; the positive request renders a cover plus one body page.
- PDF.js verified text and page counts for all three PDFs. All five rasterized pages were inspected without clipping, overlap, or missing glyphs. Scripts, verification output, and images remain local smoke evidence; committed regression tests are the durable coverage.

## Commit-range review

Reviewed the complete implementation range
`4d5909fa1be48148912802b331e504c5bce970e8..d265a27c95914e26b31d3951dd23f8a66d542af7`,
including call sites and regression assertions. No actionable findings remained.
The final closeout changes only this job record to record the validated commits
and completed review. Public records and committed tests contain no private
resource content or identifiers.
