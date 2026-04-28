---
title: "Prepare v0.1.2 release docs"
created-date: 2026-04-28
status: completed
agent: Codex
---

## Goal

Prepare the public wording and stable changelog for the formal `v0.1.2` release.

## Scope

- review `RELEASE_NOTES_POLICY.md`
- review the release delta from `v0.1.1` to `HEAD`
- refresh stale stable-version wording in `README.md` and public guides under `docs/guides/`
- add the curated stable release body at `CHANGELOGS/v0.1.2.md`

## Changes

- Updated `README.md` from `v0.1.1` stable scope to `v0.1.2` stable scope.
- Added `data stack` and `data stack replay` to the README command overview and data notes.
- Updated guide wording that still described current stable behavior as `v0.1.1`.
- Removed canary-specific wording from the public `data stack` compatibility-alias note.
- Added `CHANGELOGS/v0.1.2.md` as the stable release-note override body for the release workflow.

## Evidence

- Reviewed the policy requirements in `RELEASE_NOTES_POLICY.md`.
- Generated the raw stable-note candidate with `scripts/generate-stable-release-notes.sh --mode commit --range v0.1.1..HEAD --current-tag v0.1.2 --previous-tag v0.1.1 --repository dev-pi2pie/cdx-chores`.
- Searched `README.md` and `docs/guides/` for stale `v0.1.1`, `0.1.1`, and `v0.1.2-canary` references before editing.

## Verification

- `rg -n "v0\.1\.1|0\.1\.1|v0\.1\.2-canary|canary" README.md docs/guides CHANGELOGS/v0.1.2.md`
- `git diff --check`
- `bun test test/release-scripts.test.ts`

Results:

- Stale stable/canary wording search returned only the expected `v0.1.1...v0.1.2` full changelog compare URL in `CHANGELOGS/v0.1.2.md`.
- `git diff --check` passed.
- Release-script tests passed with `7` tests and `0` failures.
