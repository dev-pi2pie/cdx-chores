---
title: "Video GIF alpha preservation fix"
created-date: 2026-04-10
status: completed
agent: codex
---

## Summary

Adjusted the quality-mode GIF filter pipeline so transparency is preserved instead of being flattened before palette generation and palette application.

## What Changed

- updated the shared GIF profile filter config to reserve a transparent palette entry in quality mode
- updated the shared GIF look filter config to keep frames in `rgba` instead of forcing `rgb24`
- updated focused GIF action tests to lock the shipped filter strings to the alpha-safe variants

## Verification

- `bun test test/cli-actions-video-gif.test.ts`
- `bun test test/cli-interactive-routing.test.ts -t "video flow through gif generation"`
- `bun test test/cli-ux.test.ts -t "video gif"`

## Related Documents

- `docs/plans/jobs/2026-04-10-video-gif-look-implementation-and-docs.md`
- `docs/plans/jobs/2026-04-10-video-gif-look-strength-tuning.md`
- `docs/guides/video-gif-usage-and-quality-modes.md`
