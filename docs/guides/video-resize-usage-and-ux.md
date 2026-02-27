---
title: "Video Resize Usage and UX"
created-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Document the current `video resize` UX, including the preferred scale-first workflow, explicit-dimension override mode, and the flag rules that keep the CLI behavior predictable.

## Recommended Workflow

Use scale when the intent is "make this video smaller or larger, but keep the same shape."

Example:

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-small.mp4 --scale 0.5
```

Common scale values:

- `0.5`: halve width and height
- `0.75`: reduce to 75%
- `2`: double width and height

Interactive mode follows the same model and asks for a positive scale factor.

## Resize Modes

### Preferred: scale-first

Use `--scale` when you want ratio-preserving resizing.

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-small.mp4 --scale 0.5
```

Behavior:

- width and height are derived automatically from the input video
- aspect ratio is preserved
- output dimensions are normalized to even values for ffmpeg compatibility

### Explicit override: fixed width and height

Use both `--width` and `--height` only when you intentionally want exact output dimensions.

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-720p.mp4 --width 1280 --height 720
```

Behavior:

- dimensions are applied exactly as given
- aspect ratio is not inferred
- this mode is for users who already know the target frame size

## Flag Rules

Current supported inputs:

- `--scale <factor>`
- `--width <px> --height <px>`

Invalid combinations:

- `--scale` with `--width`
- `--scale` with `--height`
- `--scale` with `--width` and `--height`
- `--width` without `--height`
- `--height` without `--width`
- omitting all resize-mode flags

Validation intent:

- keep the common path simple
- avoid silent aspect-ratio mistakes
- make ambiguous flag combinations fail early with a clear message

## UX Rationale

The command now prefers intent over low-level parameters.

Why scale is the default mental model:

- most resize requests mean "smaller" or "larger", not "set exact dimensions"
- users usually want to preserve aspect ratio
- asking for width and height first invites accidental distortion

Why fixed dimensions still exist:

- some export workflows require exact frame sizes
- advanced users may be targeting a known delivery format

## Current Scope

This guide describes the current implementation only.

Not implemented in the current contract:

- `--max-width`
- `--max-height`
- fit-within-box resizing
- crop or pad policies

If those are added later, they should be introduced as a separate resize mode instead of being mixed into the current scale/dimension contract.

## Related Guides

- `README.md`
- `docs/guides/interactive-path-prompt-ux.md`
