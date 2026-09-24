---
title: "v0.1.9 Stable Release Preparation"
created-date: 2026-09-24
status: completed
agent: codex
---

## Scope

Prepare the curated stable release body and current version wording for
`v0.1.9` under [release-note policy](../../../RELEASE_NOTES_POLICY.md).

## Evidence

- Reviewed `v0.1.8..9db84b0560ed75bc0a5afb67effaa68381d5c3c5` against
  the current Markdown PDF guides, completed implementation records, and the
  [open custom-sequence research](../../researches/research-2026-09-24-markdown-pdf-interactive-page-number-sequence-ux.md).
- `package.json` and the embedded CLI version already say `0.1.9`. The range
  contains only a returning maintainer identity after author normalization, so
  the optional Contributors section was omitted.

## Changes

- Added [v0.1.9 release notes](../../../CHANGELOGS/v0.1.9.md) with the required
  `v0.1.8...v0.1.9` comparison URL.
- Updated the Codex SDK baseline wording in `README.md` and the
  [CLI integration guide](../../guides/cli-action-tool-integration-guide.md)
  from the latest canary to stable `v0.1.9`. Current Markdown PDF guides already
  describe the shipped behavior.

## Validation

- Stable-note override tests: 6 passed. Embedded-version sync tests: 2 passed.
- Oxfmt, local links, release-note structure, and `git diff --check` passed.
  No current canary-version references remain in README or public guides.
- Final documentation review found no material issues.

## Outcome

Preparation is complete and remains uncommitted. The new note must be in the
eventual `v0.1.9` tagged tree; tagging and publication are pending.
