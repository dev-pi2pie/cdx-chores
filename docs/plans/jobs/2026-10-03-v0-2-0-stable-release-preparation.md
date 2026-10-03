---
title: "v0.2.0 Stable Release Preparation"
created-date: 2026-10-03
status: completed
agent: codex
---

## Scope

Prepare the [v0.2.0 release body](../../../CHANGELOGS/v0.2.0.md) and current
version wording under the [release-note policy](../../../RELEASE_NOTES_POLICY.md).

## Evidence And Changes

- Generated commit-mode candidates with the current script for
  `v0.1.9..4c9cd332647e056d99cc1cee5f63702ee07566ca`.
  Curated final outcomes from the current [frames guide](../../guides/video-frames-usage.md),
  [enhancement verification](2026-10-02-video-frames-enhancement-follow-up.md#integrated-verification)
  and [PNG correction](2026-10-02-png-idat-chunk-limit-fix.md).
- Added the stable note with the `v0.1.9...v0.2.0` compare URL. It describes shipped
  behavior, with one source line per bullet and no semicolons. Updated SDK-baseline
  wording in [README](../../../README.md) and the
  [integration guide](../../guides/cli-action-tool-integration-guide.md).
- Simplified the frames guide's verification paragraph while preserving its
  coverage limits. Detailed evidence remains in the linked implementation records.
- Clarified the quick timeline picker in the guide and release note. The guide
  retains precise input, controls and fallback details.
- Package and embedded CLI version already say `0.2.0`. SDK baseline remains
  `0.160.0` and Node.js remains `>=22.23.0`. The range contains one returning
  maintainer identity, so the optional Contributors section is omitted.

## Validation And Outcome

- Stable-note override and embedded-version checks: 8 passed across two files.
- Node-target build, built CLI version `0.2.0` and ESM/CJS imports passed.
  The build retains its existing TypeScript 7 experimental-API warning.
- All 20 local links/anchors, release-note structure, version wording and
  `git diff --check` passed. The note, integration guide and job record pass Oxfmt.
  README and the frames guide retain formatting issues present at the pre-change commit.
- Documentation review corrected the source-ICC rejection wording and found
  no remaining material issues. Full runtime suites and native frame-export
  smoke checks were not rerun for this documentation change.

Documentation preparation is complete and uncommitted. The reviewed note must
be included in the eventual `v0.2.0` tagged tree. Tagging and publication remain
pending.
