---
title: "Implement stable release notes manual override"
created-date: 2026-04-11
modified-date: 2026-04-11
status: completed
agent: codex
---

## Goal

Implement the stable release-notes manual override flow so `CHANGELOGS/vX.Y.Z.md` can replace generated stable notes, while documenting the policy and contributor-curation rules that govern those files.

## What Changed

- updated `scripts/generate-stable-release-notes.sh` to:
  - resolve stable overrides from `CHANGELOGS/${CURRENT_TAG}.md`
  - use the manual file as the full stable release body when present
  - fail when the matching override file exists but is empty or whitespace-only
- expanded `test/release-scripts.test.ts` with coverage for:
  - successful manual override selection
  - empty-file override failure
  - existing generated fallback behavior
- added `RELEASE_NOTES_POLICY.md` as the root-level release-note policy reference
- updated `AGENTS.md` to point future agents at `RELEASE_NOTES_POLICY.md`
- added `CHANGELOGS/.gitkeep` so the stable release-note directory is tracked before the first real manual release body lands
- updated `docs/plans/plan-2026-04-11-stable-release-notes-manual-override.md` to completed status and checked off the implementation phases

## Verification

- `bun test test/release-scripts.test.ts`

## Related Documents

- `docs/plans/plan-2026-04-11-stable-release-notes-manual-override.md`
- `RELEASE_NOTES_POLICY.md`
- `AGENTS.md`
