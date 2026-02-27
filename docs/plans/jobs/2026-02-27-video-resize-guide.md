---
title: "Add video resize guide"
created-date: 2026-02-27
status: completed
agent: codex
---

Added a dedicated guide for the current `video resize` UX and linked it from the README.

Why:
- The resize command now has two explicit modes, with `--scale` as the preferred path and `--width` plus `--height` as an expert override.
- That contract should be documented in one place instead of being implied only by help text and examples.
- The next likely UX expansion is max-bound resizing, but that is not implemented yet and should not be implied by the current docs.

What changed:
- Added `docs/guides/video-resize-usage-and-ux.md` with:
  - scale-first usage
  - explicit-dimension override usage
  - flag rules and invalid combinations
  - UX rationale for preferring scale
  - explicit current-scope note excluding max-bound modes for now
- Updated `README.md` to link the new guide from a `Video Guides` section.
