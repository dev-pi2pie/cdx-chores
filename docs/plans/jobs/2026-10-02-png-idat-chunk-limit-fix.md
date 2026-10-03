---
title: "PNG IDAT Chunk Limit Fix"
created-date: 2026-10-02
status: completed
agent: codex
---

## Scope

Follow-up to the [video frames enhancement](2026-10-02-video-frames-enhancement-follow-up.md). The profiled PNG parser counted every container chunk against a 4,096-chunk limit. Valid large FFmpeg exports exceeded that limit through streamed `IDAT` chunks and failed with `FRAME_IMAGE_INCOMPLETE`, despite satisfying pixel and staging-byte guards.

Count non-data chunks separately. `IDAT` bytes, including their container overhead, remain subject to the staging byte limit. Profile validation, animation refusal, dimensions, backpressure and incomplete-image handling retain their existing checks. JPEG and WebP are outside this fix.

## Verification

- The new valid 64 × 64 RGB PNG regression failed before the fix with `FRAME_IMAGE_INCOMPLETE` and passed afterward. Its zlib stream is divided into more than 4,096 nonempty `IDAT` chunks.
- Regression checks preserve compressed payload, inflated scanlines and the inserted profile across fragmented input and consecutive images. Truncation retains only the earlier completed image. Excessive non-data chunks still fail, and their counter resets between images.
- Virtual staging accepts the exact container-plus-profile byte total and rejects one byte below it without publication. The existing exact 256-MiB and one-byte-overflow checks still pass.
- `bun test test/video/frames test/video/interactive`: **144 pass / 0 fail**, across 16 unit files.
- Exact Node app selection for `frames-menus`, `frames-workflow`, `action` and `smoke-workspace`, with the fixture-only ignore pattern: **16 pass / 0 fail**, across four files.
- `bunx tsc --noEmit`, lint, format, build and diff checks passed. The build retains its existing experimental TypeScript 7 API warning.
- Focused regression-coverage review found no material gaps.

### Built Node CLI Export

On macOS, Node.js **26.5.0** and FFmpeg/FFprobe **9.0.2**, one deterministic synthetic 4096 × 4096 RGBA frame was encoded as FFV1/BGRA with explicit full-range RGB, BT.709 primaries and sRGB transfer. Pixel generation used xorshift32 with seed `0x12345678`, shifts 13/17/5 and little-endian 32-bit samples. No private media was used.

The built `video frames --first-frame` command exported a PNG containing **16,391 IDAT chunks** and **67,330,591 encoded bytes**, below the 256-MiB staging limit. The 4096 × 4096 dimensions meet the 16,777,216-pixel guard. FFmpeg-decoded RGBA matched the generated pixel SHA-256, the output carried one sRGB ICC profile, and the source hash was unchanged. Publication removed staging, and the owned synthetic workspace was removed after successful tool closure and verification.

This establishes the tested PNG export boundary; it adds no new platform or viewer-appearance claim.

## Checkpoints

- [x] Reproduce failure before changing the parser.
- [x] Implement the narrow counter fix and regression coverage.
- [x] Pass focused unit/app checks and built native export verification.
- [x] Review the exact implementation commit range and resolve findings.
- [x] Record the accepted implementation review and complete documentation closeout.

Implementation commit: `9a53f2ef57bd88de22a403faf454d13ba72d008c` (`fix(video): allow PNG exports with many IDAT chunks`). Review of `385b654997d3c76d62ef9c125658af82e1151203..9a53f2ef57bd88de22a403faf454d13ba72d008c` found no actionable issues. The two affected unit files were independently rerun: **30 pass / 0 fail**.

The [test ownership catalog](../../references/test-suite-case-matrices.md#video-frames) now identifies the valid segmented-PNG and staging-accounting coverage. The earlier enhancement record, implementation plan and research retain their completed history; this narrow correction changes no accepted user-facing limits or color policy.
