---
title: "Markdown PDF cover text and intent regressions"
created-date: 2026-09-24
status: completed
agent: codex
---

## Scope

Address literal dollar signs in cover text and negated text-cover requests.
The shared cover escaping omission predates this change; managed Project
text covers introduced another affected rendering path.

Starting commit: `046949cd155b73ad5790bc7cd0741168b685f1c7`.
Implementation base: `205bc290` (subsequent canary version update).

## Changes

- Escape literal dollars with Pandoc's doubled-dollar syntax in the shared
  helper, preserving cover text in built-in and managed Project templates.
- Consume recognized negative cover phrases before positive matching, including
  text-only, textual, typographic, and trailing-text forms. A separate positive
  cover request still produces a conflict; existing image and base-Profile
  conflict checks remain in force.

## Verification

- Added real-Pandoc regressions for both cover paths covering currency,
  template-like literals, HTML-sensitive text, all cover fields, and normal
  body substitution. Both cases reproduced template-compilation failures
  before the fix.
- Escaping checkpoint: the Pandoc lane passed all 5 cases, including both new
  regressions. TypeScript, focused lint/format checks, and `git diff --check`
  passed.
- Negation checkpoint: 54 policy unit cases and 6 Project handoff cases passed.
  The new negative intents now reach the Template phase with text-cover support
  disabled and save a Profile and Template without a cover. TypeScript,
  focused lint/format checks, and `git diff --check` passed.
- Full validation passed: 1,368 unit cases / 5,194 assertions; 2,133 application
  cases / 13,558 assertions; and 5 Pandoc cases / 162 assertions, with no
  failures, errors, or skips. TypeScript, repository lint/format checks, build,
  and `git diff --check` passed. The build retained the existing TypeScript 7
  experimental-API warning. The built Node CLI reports `0.1.9-canary.5`.
- Fresh synthetic smoke under
  `examples/playground/md-pdf/smoke/2026-09-24-cover-regressions/` includes
  preparation, built-CLI rendering, and PDF text/page verification scripts.
  The folder remains local playground evidence; the committed regression tests
  are the durable reproduction coverage.
- Real Pandoc and WeasyPrint rendered four PDFs through the built Node CLI.
  Built-in and managed covers each produced one cover plus one body page;
  currency, template-like literals, and HTML-sensitive text survived. Both
  negated requests produced one body page with no cover. Extracted PDF text
  assertions passed, and all six rasterized pages were visually inspected
  without clipping, overlap, or missing glyphs.
- The negative smoke cases use injected model responses; positive Project
  preparation is deterministic. No live model call was needed for these
  regressions. All reproduction content is independently authored and synthetic.

## Checkpoints and Review

- `fd377ede`: shared cover escaping and real-Pandoc regressions.
- `fac3de51`: negated cover classification and Project handoff regressions.
- Reviewed the complete implementation range `205bc290..fac3de51` for
  correctness, maintainability, and regression coverage. No actionable findings
  remained. The preceding canary version update is outside that range.
- Final documentation review found no material issues; verification and
  closeout are complete.
