---
title: "Video GIF look strength tuning"
created-date: 2026-04-10
status: completed
agent: codex
---

## Summary

Strengthened the shipped `faithful` and `vibrant` GIF look recipes so the visual-intent split is more noticeable in real use, while keeping the public `--gif-look faithful|vibrant` contract unchanged.

## What Changed

- updated the shipped `faithful` recipe to use an explicit normalized RGB path before palette generation
- updated the shipped `vibrant` recipe to build on that normalized base and apply a stronger pre-palette color lift
- updated focused GIF action tests to match the stronger look filter chains
- updated the GIF guide, follow-up research, and implementation plan wording to describe the stronger look separation

## Verification

- `bun test test/cli-actions-video-gif.test.ts test/cli-interactive-routing.test.ts test/cli-ux.test.ts`
- local-only smoke runs with:
  - `--gif-look faithful`
  - `--gif-look vibrant`

## Related Documents

- `docs/researches/research-2026-04-10-video-gif-profile-color-tuning.md`
- `docs/plans/plan-2026-04-10-video-gif-high-quality-mode-implementation.md`
- `docs/guides/video-gif-usage-and-quality-modes.md`
- `docs/plans/jobs/2026-04-10-video-gif-look-implementation-and-docs.md`
