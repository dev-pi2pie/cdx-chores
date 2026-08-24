---
title: "Prepare v0.1.7 release docs"
created-date: 2026-08-24
status: completed
agent: Codex
---

## Goal

Prepare the current public wording and complete stable release-note body for the
formal `v0.1.7` release.

## Scope

- Review `RELEASE_NOTES_POLICY.md` and `DOCUMENTATION_POLICY.md`.
- Review the complete `v0.1.6..HEAD` release range.
- Check `README.md`, current guides, and current references for stale
  `v0.1.6`, `v0.1.7-canary`, and earlier Codex SDK baseline wording.
- Add the curated stable release body at `CHANGELOGS/v0.1.7.md`.
- Preserve historical canary wording in research, plans, and job records.

## Changes

- Added `CHANGELOGS/v0.1.7.md` as the complete stable release-note override
  body for the release workflow.
- Curated the release around final shipped behavior rather than the large
  canary commit sequence:
  - Markdown PDF page numbers, page chrome, covers, and compatibility checks
  - Codex request timeout and recovery controls
  - compact/detailed `doctor` output and Interactive view selection
  - stream-aware CLI diagnostic emphasis
  - Codex SDK `0.149.1` and reviewed dependency maintenance
- Confirmed that `README.md` and current guides already use stable `v0.1.7`
  wording and describe the shipped command contracts, so no duplicate wording
  changes were required.
- Omitted the optional Contributors section because the release range contains
  only the existing project maintainer identity after author normalization.

## Evidence

- Generated the raw stable-note candidate with
  `scripts/generate-stable-release-notes.sh --mode commit --range v0.1.6..HEAD --current-tag v0.1.7 --previous-tag v0.1.6 --repository dev-pi2pie/cdx-chores`.
- Reviewed all `feat` and `fix` commits in `v0.1.6..HEAD` and collapsed their
  iterative sequences into the final shipped contracts.
- Reviewed `README.md` and the public guides changed in the release range as
  contract evidence.
- Confirmed that public version sweeps contain no stale `v0.1.6`,
  `v0.1.7-canary`, Codex SDK `0.146.0`, or Codex SDK `0.149.0` baseline wording.

## Verification

- `bun test test/release-tooling`
  - passed with 9 tests across 3 files and 0 failures
- Public wording sweep across `README.md`, `docs/guides/`, `docs/references/`,
  and `CHANGELOGS/v0.1.7.md`
  - found no stale `v0.1.7-canary`, Codex SDK `0.146.0`, or Codex SDK
    `0.149.0` wording
  - found `v0.1.6` only in the required `v0.1.6...v0.1.7` compare URL
- Release-note structure checks
  - confirmed `## What's Changed` is the first line
  - confirmed the required full changelog compare URL is the final line
- Contributor audit
  - normalized both release-range author emails to the same existing maintainer
    identity and confirmed that identity appears before `v0.1.6`
- `git diff --check`
  - passed
