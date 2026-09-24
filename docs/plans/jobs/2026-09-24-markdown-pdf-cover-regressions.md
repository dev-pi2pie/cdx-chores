---
title: "Markdown PDF cover text and intent regressions"
created-date: 2026-09-24
status: in-progress
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
- Pending synthetic PDF smoke, full static checks,
  and review of the complete new commit range. All reproduction inputs and
  public evidence are independently authored synthetic examples.

## Checkpoints and Review

- `fd377ede`: shared cover escaping and real-Pandoc regressions.
- Pending negation checkpoint and final range review.
