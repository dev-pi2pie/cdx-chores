---
title: "Fix release workflow branch gating and stable notes grouping"
created-date: 2026-02-27
modified-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Fix the release workflow and stable release notes script issues found during review so releases are validated against the intended branch policy and stable notes stay correctly grouped and deduplicated.

## Why It Matters

- The current branch gate can accept non-release branches whose names merely contain `dev`, `alpha`, `beta`, or `canary`, which weakens the release policy.
- Stable releases currently run the notes generator in `hybrid` mode, but the grouped `## What's Changed` section still lists every commit, so multi-commit pull requests show up multiple times.
- PR-based grouping currently derives the section category from the original commit subject even when a resolved PR title would place the entry in a different section.

## Fix Plan

- Extract the allowed release branch detection into a scriptable, testable helper and anchor matching to the intended branch prefixes.
- Update stable release note generation so `hybrid` mode reuses the deduplicated PR-or-commit item list for grouped output.
- Recompute the release-note group from the final resolved subject or PR title before persisting grouped entries.
- Add focused tests for the branch policy helper and release notes rendering edge cases.

## Files In Scope

- `.github/workflows/release.yml`
- `scripts/generate-stable-release-notes.sh`
- `scripts/filter-allowed-release-branches.sh`
- `test/release-scripts.test.ts`

## Implemented

- Added `scripts/filter-allowed-release-branches.sh` and updated the workflow to use it so allowed release branches are matched by `origin/(beta|alpha|canary|dev)...` prefix instead of any branch name that merely contains those substrings.
- Updated `scripts/generate-stable-release-notes.sh` so `hybrid` mode renders grouped `## What's Changed` sections from the deduplicated PR-or-commit item list instead of emitting every commit.
- Updated PR-mode grouping to derive the section key from the final resolved item subject or PR title before persisting grouped entries.
- Added focused regression coverage in `test/release-scripts.test.ts` for:
  - allowed release branch filtering
  - hybrid-mode multi-commit PR deduplication
  - PR-title-based regrouping

## Result

- Release branch validation now enforces the intended policy without accepting unrelated branches such as `feature/devtools-*`.
- Stable release notes no longer duplicate grouped entries for multi-commit pull requests in `hybrid` mode.
- PR-backed release notes are grouped according to the final displayed PR title when one is resolved.

## Verification

- `bun test test/release-scripts.test.ts` ✅ (`3 pass`, `0 fail`)
