---
title: "Video GIF Usage and Quality Modes"
created-date: 2026-04-10
status: completed
agent: codex
---

## Goal

Document the current `video gif` contract, including compressed versus quality mode, profile selection, look selection, interactive prompt behavior, processing-phase messages, and the internal palette cleanup model.

## Recommended Workflow

Start with the default compressed path when you want the simplest command and do not need the best possible color fidelity.

Example:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --width 480 --fps 10
```

Use quality mode when color fidelity matters more than the simplest processing path.

Example:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip-quality.gif --mode quality --width 480 --fps 10
```

Use a GIF profile when you already know the source type.

Example:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip-screen.gif --gif-profile screen --width 480 --fps 10
```

Use a GIF look when you want to control whether quality mode stays closer to the source or feels more punchy.

Example:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip-vibrant.gif --mode quality --gif-profile video --gif-look vibrant --width 480 --fps 10
```

## Modes

### Default: compressed

Compressed mode is the direct CLI default when neither quality mode nor a GIF profile is requested.

Example:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --width 480 --fps 10
```

Behavior:

- uses one-pass `ffmpeg` conversion
- keeps the surface simple
- does not use GIF profiles
- usually produces smaller output, but with lower color fidelity than quality mode

### Quality

Quality mode uses a two-pass palette workflow.

Example:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip-quality.gif --mode quality --width 480 --fps 10
```

Behavior:

- generates a temporary palette image
- renders the GIF using that palette
- cleans up the temporary palette automatically
- supports GIF profiles
- supports GIF looks

## GIF Profiles

Profiles are quality-mode tuning presets.

Current public profiles:

- `video`: best default for most clips
- `motion`: best for fast movement and rapidly changing scenes
- `screen`: best for UI, terminal, and screen recordings

Important note:

- the current profile differences are real, but they can still look subtle on some sources
- visible differences depend heavily on:
  - source content
  - output width
  - output fps
  - how aggressively the source already needs color reduction
- at smaller outputs such as low width and low fps, the difference between profiles may be minor

### Choosing a Profile

Use `video` when the clip is mostly natural footage or mixed content and you just want the safest starting point.

Typical cases:

- camera footage
- product clips
- scenery
- mixed clips where you are not sure which preset fits best

Use `motion` when the clip changes heavily from frame to frame and you want the quality-mode path tuned more toward rapid motion.

Typical cases:

- gameplay
- sports
- action shots
- clips with frequent scene changes

Use `screen` when the source is mostly UI, text, icons, windows, or flat-color application surfaces.

Typical cases:

- app walkthroughs
- terminal recordings
- product demos
- screen captures with text and controls

Practical note:

- these profiles are source-type presets, not guaranteed dramatic look presets
- if you want the simplest and sometimes more visually punchy result, `compressed` can still be the better starting point
- if you want the more controlled palette-based path, start with `quality` and then choose both a profile and a look

## GIF Looks

Looks are quality-mode presets for visual intent rather than source type.

Current public looks:

- `faithful`: normalized closer-to-source output with restrained shaping
- `vibrant`: more punchy output with a stronger color lift before palette generation

### Choosing a Look

Use `faithful` when keeping the result closer to the source matters more than making it pop.

Typical cases:

- product demos
- UI recordings
- brand-sensitive captures
- walkthroughs where accuracy matters more than punch

Use `vibrant` when you want the quality-mode path to feel more lively or visually punchy.

Typical cases:

- promo clips
- social sharing
- clips where `compressed` feels more attractive than the default quality look
- sources that benefit from stronger saturation and contrast lift before palette reduction

Current implementation note:

- `faithful` now runs the quality path through an explicit RGB normalization step before palette generation
- `vibrant` builds on that normalized base and then applies a noticeably stronger pre-palette lift
- the goal is to make `faithful` and `vibrant` feel materially different, not just technically different

### CLI rules

- `--gif-profile <profile>` implies `quality` when `--mode` is omitted
- `--gif-look <look>` implies `quality` when `--mode` is omitted
- `--mode compressed --gif-profile <profile>` is invalid
- `--mode compressed --gif-look <look>` is invalid
- `video` is the default profile when quality mode is selected and no profile is provided
- `faithful` is the default look when quality mode is selected and no look is provided

Examples:

```bash
# explicit quality, default profile=video, default look=faithful
cdx-chores video gif -i ./clip.mp4 -o ./clip-quality.gif --mode quality

# profile implies quality
cdx-chores video gif -i ./clip.mp4 -o ./clip-screen.gif --gif-profile screen

# look implies quality
cdx-chores video gif -i ./clip.mp4 -o ./clip-vibrant.gif --gif-look vibrant

# invalid
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --mode compressed --gif-profile screen
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --mode compressed --gif-look vibrant
```

## Interactive Flow

Interactive `video gif` follows this shape:

1. input path
2. output path
3. GIF mode
4. if mode is `quality`, prompt for GIF profile
5. if mode is `quality`, prompt for GIF look
6. width
7. fps
8. overwrite behavior

Interactive mode does not prompt for GIF profile or GIF look during compressed-mode flows.

## Processing Messages

Current processing-phase output is explicit rather than frame-by-frame.

Compressed mode:

- `Starting GIF conversion...`
- `Mode: compressed`
- `Rendering GIF...`
- `Wrote GIF: ...`

Quality mode:

- `Starting GIF conversion...`
- `Mode: quality`
- `GIF profile: <profile>`
- `GIF look: <look>`
- `Generating GIF palette...`
- `Rendering GIF from palette...`
- `Wrote GIF: ...`

## Tradeoffs

| Surface | Best for | Tradeoff |
| ------- | -------- | -------- |
| `compressed` | simplest/default conversion | lower color fidelity |
| `quality --gif-profile video --gif-look faithful` | general video clips with normalized closer-to-source output | slower than compressed |
| `quality --gif-profile video --gif-look vibrant` | general clips that need a stronger color lift | more punchy, less restrained than faithful |
| `quality --gif-profile motion --gif-look faithful` | fast movement and dynamic scenes | more processing, tuned for motion |
| `quality --gif-profile screen --gif-look faithful` | UI and screen recordings | larger output is common, but edges/text usually hold up better |

## Interpreting Output

It is normal for `compressed` to sometimes look more vivid than `quality`.

Why that happens:

- compressed mode can produce harsher quantization and stronger-looking color separation
- that can feel more saturated or punchy, even when the GIF is technically less faithful to the source
- quality mode is trying to use the limited 256-color palette more deliberately, which can look smoother but less dramatic

Practical reading:

- if you want the simplest and sometimes more visually punchy output, start with `compressed`
- if you want the more controlled palette-based path, use `quality`
- if the default quality look feels too restrained, try `--gif-look vibrant`
- if the result should stay closer to the source, stick with `--gif-look faithful`
- if red-heavy clips still feel weaker than the source, remember that GIF still has a hard 256-color ceiling even after the stronger look split
- if a clip still looks washed out in quality mode, increasing width or fps can sometimes reveal more of the profile differences than switching profiles alone

## Workflow Sketch

```text
compressed
input video
  -> ffmpeg fps+scale
  -> output.gif

quality
input video
  -> ffmpeg palettegen
  -> temp palette.png
  -> ffmpeg paletteuse
  -> output.gif
  -> cleanup temp palette
```

## Current Scope

This guide describes the current implementation only.

Not implemented in the current contract:

- raw low-level palette flags as public CLI options
- custom palette output paths
- a public `--keep-palette` flag
- real-time parsed `ffmpeg` progress bars
- stronger visual-intent presets beyond `faithful` and `vibrant`

## Related Guides

- `README.md`
- `docs/guides/interactive-path-prompt-ux.md`
- `docs/guides/video-resize-usage-and-ux.md`
