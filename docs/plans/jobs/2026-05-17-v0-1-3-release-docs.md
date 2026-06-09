---
title: "Prepare v0.1.3 release docs"
created-date: 2026-05-17
status: completed
agent: codex
---

## Goal

Prepare the public wording, documentation-status audit, and stable changelog for the formal `v0.1.3` release.

## Scope

- Review `RELEASE_NOTES_POLICY.md` and `DOCUMENTATION_POLICY.md`.
- Review public guides for stale `v0.1.2` and canary-era wording.
- Review current research and plan statuses before writing the stable changelog.
- Add the curated stable release body at `CHANGELOGS/v0.1.3.md`.
- Add the release Codex SDK baseline label in user-facing docs.

## Changes

- Updated public guide labels that still described current stable behavior as `v0.1.2`.
- Added the label `Codex SDK baseline for v0.1.3: 0.130.0` to the README and CLI action integration guide.
- Added a Markdown PDF release-boundary note that keeps Interactive mode and Codex-assisted PDF helper flows deferred to a later release.
- Added `CHANGELOGS/v0.1.3.md` as the stable release-note override body for the release workflow.

## Documentation Status Audit

- Relevant `v0.1.3` Markdown PDF, font, and Shiki research/plan docs are already marked `completed` and include related-plan, related-research, implementation-evidence, or verification sections.
- Current non-completed research and plan docs remain unrelated older working references, so this release pass did not change their lifecycle status.
- Historical canary references inside research, plan, and job records were left intact as evidence of earlier development phases.

## Evidence

- Generated the raw stable-note candidate with `scripts/generate-stable-release-notes.sh --mode commit --range v0.1.2..HEAD --current-tag v0.1.3 --previous-tag v0.1.2 --repository dev-pi2pie/cdx-chores`.
- Searched `README.md`, `docs/guides/`, `docs/researches/`, `docs/plans/`, and `CHANGELOGS/` for stale `v0.1.2`, `v0.1.3-canary`, and canary wording before editing.
- Reviewed non-completed current research and plan docs and kept their statuses unchanged because they are not part of the `v0.1.3` release surface.

## Verification

- `rg -n "v0\.1\.2|0\.1\.2|v0\.1\.3-canary|canary" README.md docs/guides CHANGELOGS/v0.1.3.md`
  - returned only the expected `v0.1.2...v0.1.3` compare URL in `CHANGELOGS/v0.1.3.md`
- `git diff --check`
  - passed
- `bun test test/release-scripts.test.ts`
  - passed, 7 tests
