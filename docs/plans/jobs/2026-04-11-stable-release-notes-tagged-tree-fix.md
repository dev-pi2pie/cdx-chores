---
title: "Fix stable release notes override to read from tagged tree"
created-date: 2026-04-11
modified-date: 2026-04-11
status: completed
agent: codex
---

## Goal

Fix the stable release-notes manual override so release-note content is read from the tagged revision being released instead of from the current checked-out branch head.

## What Changed

- updated `scripts/generate-stable-release-notes.sh` to resolve `CHANGELOGS/${CURRENT_TAG}.md` through `git` object lookup on `CURRENT_TAG`
- stopped reading manual override content directly from the current worktree path
- preserved the existing empty-override failure behavior after loading the tagged file content
- expanded `test/release-scripts.test.ts` with a regression case where the branch head rewrites `CHANGELOGS/v0.2.0.md` after the `v0.2.0` tag is created
- updated the existing stable-override tests so the override fixture is committed into the tagged tree, matching the release workflow contract

## Why

The review finding showed that `workflow_dispatch` releases can run with the branch head checked out while still targeting an older tag. In that path, reading `CHANGELOGS/${CURRENT_TAG}.md` from the worktree could publish newer branch-head release notes, or miss the tagged note entirely, instead of using the release body that actually shipped with the tag.

## Verification

- `bun test test/release-scripts.test.ts`

## Related Documents

- `docs/plans/jobs/2026-04-11-stable-release-notes-manual-override-implementation.md`
- `docs/plans/plan-2026-04-11-stable-release-notes-manual-override.md`
- `RELEASE_NOTES_POLICY.md`
