---
title: "GIF profile and color-tuning follow-up for video conversion"
created-date: 2026-04-10
modified-date: 2026-04-10
status: in-progress
agent: codex
---

## Goal

Define the follow-up spec for improving color fidelity in `video gif` quality mode, with a small public surface that stays understandable for typical users.

## Current Status

- the first public `gif-profile` surface is implemented
- the current `video`, `motion`, and `screen` profiles are useful, but they do not yet create a strong enough visible separation on every source
- this research is open again because the next tuning pass now needs a second public dimension for visual intent
- stronger tuning should cover both source type and look, rather than only adding more source-type presets

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

### 3. `--gif-profile` should be scoped to `quality` mode, and profile selection should imply `quality` when mode is omitted

- The compressed one-pass path does not use `palettegen` / `paletteuse`, so a profile flag would either do nothing there or imply hidden behavior that the mode does not actually support.
- Letting the flag silently do nothing in compressed mode would be confusing.
- Requiring users to type both `--mode quality` and `--gif-profile ...` every time would add redundant syntax when the profile already implies a palette-based conversion path.

Recommendation:

- document `--gif-profile` as a quality-mode option
- when `--gif-profile` is provided without `--mode`, infer `quality`
- reject explicit `--gif-profile` when `--mode compressed` is explicit

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
- treat direct CLI `--gif-profile <profile>` with no `--mode` as `quality` plus the selected profile
- reject explicit `--gif-profile` when `--mode compressed` is explicit

### 5. The first profile set should map to opinionated internal recipes

Recommended first-pass mapping:

- `video`:
  - intended for normal camera or mixed-content clips
  - best default for:
    - camera video
    - product clips
    - mixed motion plus natural scenery
    - general-purpose use when the source type is unclear
  - `palettegen=stats_mode=full:reserve_transparent=0:max_colors=256`
  - `paletteuse=dither=sierra2_4a`
- `motion`:
  - intended for motion-heavy clips where colors shift frame to frame
  - best for:
    - fast-moving gameplay
    - sports or action clips
    - clips with frequent scene changes
    - motion-heavy captures where frame-to-frame color reuse is weak
  - `palettegen=stats_mode=diff:reserve_transparent=0:max_colors=256`
  - `paletteuse=dither=sierra2_4a:diff_mode=rectangle`
- `screen`:
  - intended for screen recordings, UI demos, and flatter-color assets
  - best for:
    - app walkthroughs
    - product UI demos
    - terminal captures
    - screen recordings with text, icons, and flat backgrounds
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

Suggested user-facing framing:

- `video`: best default for most clips
- `motion`: best for fast movement and rapidly changing scenes
- `screen`: best for screen recordings, UI, and flatter graphics

### 7. The current profile set should be treated as a first-pass tuning surface, not the final design

- Early manual checks show that `video`, `motion`, and `screen` do not always produce a dramatic visible difference.
- On some sources, `compressed` can still appear more vivid or punchier even though it is not the more controlled palette path.
- A local-only smoke pass with the current playground media confirmed that all three quality profiles execute correctly, but their visible separation remains modest enough that users can reasonably expect stronger differentiation in a later pass.
- That does not make the profile feature invalid, but it does mean the tuning story is not finished yet.

Implication:

- documentation should describe the current profiles honestly as source-type presets, not as guaranteed large visual style changes
- the next tuning pass should investigate whether the public surface needs:
  - stronger recipe separation
  - more aggressive preprocessing
  - additional presets that describe visual intent rather than only source type

Recommended next direction:

- keep the current public `video`, `motion`, and `screen` profiles as the shipped first pass
- treat source-type tuning and look/intensity tuning as separate concerns
- if a stronger public surface is added later, prefer visual-intent presets such as a more faithful path versus a more vivid path rather than only adding more source-type labels

### 8. Visual-intent tuning should be a second flag, not a profile overload

- `video`, `motion`, and `screen` describe source type.
- `faithful` and `vibrant` describe desired look.
- Folding both ideas into one `--gif-profile` surface would make the option set harder to explain and harder to scale.

Recommendation:

- keep `--gif-profile` for source type:
  - `video`
  - `motion`
  - `screen`
- add a second flag for visual intent:
  - `--gif-look faithful|vibrant`

Suggested usage:

- `faithful`:
  - best for:
    - product demos
    - UI recordings
    - brand-sensitive output
    - docs and walkthroughs where color accuracy matters more than punch
  - expected outcome:
    - more restrained color shaping
    - closer-to-source look
- `vibrant`:
  - best for:
    - promo clips
    - social sharing
    - cases where compressed currently feels more attractive than quality
    - clips where mild color lift is desirable before palette reduction
  - expected outcome:
    - more punchy output
    - mild saturation or contrast shaping before palette generation

Interactive recommendation:

- keep asking for `GIF mode`
- if `quality` is selected:
  - ask for `GIF profile`
  - then ask for `GIF look`
- default `gif-look` to `faithful` when quality mode is selected and no explicit look is provided

## Implications or Recommendations

Recommended public spec:

1. Add `--gif-profile video|motion|screen`.
2. Default the profile to `video`.
3. Make `--gif-profile` imply `quality` when `--mode` is omitted.
4. Apply profiles only when the resolved mode is `quality`.
5. In interactive mode, prompt for `GIF profile` only after `quality` is selected.
6. Reject explicit `--gif-profile` with explicit `--mode compressed`.
7. Keep `compressed` as the overall CLI default mode when neither quality mode nor profile is requested.
8. Keep profile tuning internal and recipe-based rather than exposing raw palette flags.
9. Update the GIF guide to explain profile selection by source type and expected output characteristics.
10. Treat the current public profiles as a first shipped pass while follow-up tuning remains open.
11. Add a second public flag for visual intent rather than overloading `--gif-profile`.
12. Document `faithful` as the closer-to-source path and `vibrant` as the more punchy path.

Recommended implementation shape:

1. Add one internal helper that resolves a quality profile into:
   - palettegen flags
   - paletteuse flags
2. Keep the profile lookup separate from command registration so the surface stays centralized.
3. Add one interactive prompt branch for `GIF profile` only under the `quality` path.
4. Resolve direct CLI `--gif-profile` input into `quality` plus the selected profile before ffmpeg argument generation.
5. Preserve the existing `quality` mode path shape:
   - palette generation
   - GIF render from palette
   - temp palette cleanup
6. Add a second internal helper or config branch for `gif-look` so source-type tuning and visual-intent tuning remain separate.

## Related Plans

- `docs/plans/plan-2026-04-10-video-gif-high-quality-mode-implementation.md`

## References

[^current-research]: [`docs/researches/research-2026-04-10-video-gif-high-quality-mode.md`](./research-2026-04-10-video-gif-high-quality-mode.md)
[^video-action]: [`src/cli/actions/video.ts`](../../src/cli/actions/video.ts)
[^video-command]: [`src/cli/commands/video.ts`](../../src/cli/commands/video.ts)
