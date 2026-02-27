---
title: "Make video resize scale-first"
created-date: 2026-02-27
status: completed
agent: codex
---

Changed `video resize` so the default UX is ratio-preserving scale instead of raw width/height entry.

Why:
- Interactive mode previously asked for width and height separately, which pushed users toward aspect-ratio mistakes.
- The CLI flag contract also implied that explicit dimensions were the only supported mode, even though scale is the more common intent.
- Help output did not explain the preferred path versus the explicit override path.

What changed:
- Updated `src/cli/interactive.ts` so interactive `video resize` asks for a positive scale factor.
- Updated `src/command.ts` so `video resize` supports `--scale` as the primary mode and keeps `--width` plus `--height` as a paired explicit override.
- Updated `src/cli/actions/video.ts` to validate resize mode combinations explicitly and to generate ffmpeg scale filters for both scale-based and fixed-dimension resizing.
- Updated `test/cli-actions-doctor-markdown-video-deferred.test.ts` with validation coverage for missing, mixed, and incomplete resize inputs.
- Updated `test/cli-ux.test.ts` with help-text coverage and CLI contract checks for the new resize flags.
- Updated `README.md` examples to show both the preferred `--scale` flow and the explicit-dimension override flow.

Verification:
- `bunx tsc --noEmit`
- `bun test test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
