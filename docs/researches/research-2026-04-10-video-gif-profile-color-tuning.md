---
title: "GIF profile and color-tuning follow-up for video conversion"
created-date: 2026-04-10
status: draft
agent: codex
---

## Goal

Define the follow-up spec for improving color fidelity in `video gif` quality mode, with a small public surface that stays understandable for typical users.

## Key Findings

### 1. `quality` mode alone does not fully solve GIF color loss

- The current `quality` mode adds the expected two-pass palette workflow, but GIF is still fundamentally limited to a 256-color palette.
- Color loss now depends more on palette-generation and palette-application settings than on the existence of a palette pass by itself.
- Different source types want different tradeoffs:
  - natural video wants smoother dithering and balanced palette statistics
  - motion-heavy clips often benefit from difference-aware palette behavior
  - screen/UI capture often benefits from more deterministic dithering and crisper flat-color handling

Implication:

- one `quality` recipe is a useful baseline, but it is not the best final product surface if color fidelity is a priority

### 2. A profile flag is a better user-facing surface than many raw ffmpeg knobs

- Exposing low-level palette flags directly would create a large option surface that most users cannot tune confidently.
- A small profile selector keeps the CLI understandable while still allowing the implementation to map each profile to a better `ffmpeg` recipe.

Recommendation:

- add `--gif-profile <profile>`
- keep the public profile set small:
  - `video`
  - `motion`
  - `screen`
- make `video` the default profile

### 3. `--gif-profile` should be scoped to `quality` mode

- The compressed one-pass path does not use `palettegen` / `paletteuse`, so a profile flag would either do nothing there or imply hidden behavior that the mode does not actually support.
- Letting the flag silently do nothing in compressed mode would be confusing.

Recommendation:

- document `--gif-profile` as a quality-mode option
- either:
  - reject `--gif-profile` when `--mode compressed` is explicit, or
  - ignore the flag unless `mode === quality` but explain that clearly in help/docs

Preferred direction:

- reject it for explicit `compressed` mode so the contract stays honest

### 4. Interactive mode should prompt for `gif-profile` only after `quality` is chosen

- `gif-profile` is only meaningful for the palette-based path.
- Prompting for it during compressed-mode flows would add noise and imply unsupported tuning behavior.
- Hiding the prompt after `quality` while still silently defaulting to `video` would keep the surface smaller, but it would also make the interactive path less explicit than the current design direction for GIF mode selection.

Recommendation:

- in interactive `video gif`:
  - ask for `GIF mode`
  - if the user selects `compressed`, do not ask for `gif-profile`
  - if the user selects `quality`, ask for `GIF profile`
- keep `video` as the CLI default profile when no profile is provided directly
- reject explicit `--gif-profile` when `--mode compressed` is explicit

### 5. The first profile set should map to opinionated internal recipes

Recommended first-pass mapping:

- `video`:
  - intended for normal camera or mixed-content clips
  - `palettegen=stats_mode=full:reserve_transparent=0:max_colors=256`
  - `paletteuse=dither=sierra2_4a`
- `motion`:
  - intended for motion-heavy clips where colors shift frame to frame
  - `palettegen=stats_mode=diff:reserve_transparent=0:max_colors=256`
  - `paletteuse=dither=sierra2_4a:diff_mode=rectangle`
- `screen`:
  - intended for screen recordings, UI demos, and flatter-color assets
  - `palettegen=stats_mode=diff:reserve_transparent=0:max_colors=256`
  - `paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle`

Implication:

- the public CLI stays simple while the implementation keeps room to refine the exact recipes later

### 6. Documentation should explain profiles in user terms, not ffmpeg jargon first

- Most users care about outcomes such as:
  - better color
  - smoother gradients
  - sharper UI edges
  - smaller or larger files
- They usually do not start from `stats_mode` or `diff_mode`.

Recommendation:

- in README and the future GIF guide, describe profiles by use case first
- keep the low-level `ffmpeg` recipe details as secondary explanation
- include a short comparison table:
  - `video` -> default / balanced
  - `motion` -> better for dynamic scenes
  - `screen` -> better for UI and screen capture

## Implications or Recommendations

Recommended public spec:

1. Add `--gif-profile video|motion|screen`.
2. Default the profile to `video`.
3. Apply profiles only when `mode === quality`.
4. In interactive mode, prompt for `GIF profile` only after `quality` is selected.
5. Reject explicit `--gif-profile` with explicit `--mode compressed`.
6. Keep `compressed` as the overall CLI default mode.
7. Keep profile tuning internal and recipe-based rather than exposing raw palette flags.
8. Update the GIF guide to explain profile selection by source type and expected output characteristics.

Recommended implementation shape:

1. Add one internal helper that resolves a quality profile into:
   - palettegen flags
   - paletteuse flags
2. Keep the profile lookup separate from command registration so the surface stays centralized.
3. Add one interactive prompt branch for `GIF profile` only under the `quality` path.
4. Preserve the existing `quality` mode path shape:
   - palette generation
   - GIF render from palette
   - temp palette cleanup

## Open Questions

1. Should `motion` ship in the first public slice, or should the first release start with only `video` and `screen`?

## Related Plans

- `docs/plans/plan-2026-04-10-video-gif-high-quality-mode-implementation.md`

## References

[^current-research]: [`docs/researches/research-2026-04-10-video-gif-high-quality-mode.md`](./research-2026-04-10-video-gif-high-quality-mode.md)
[^video-action]: [`src/cli/actions/video.ts`](../../src/cli/actions/video.ts)
[^video-command]: [`src/cli/commands/video.ts`](../../src/cli/commands/video.ts)
