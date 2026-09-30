---
title: "Video Frame Extraction and Sequence Export"
created-date: 2026-09-30
status: draft
agent: codex
---

## Goal, Scope, and Settled Direction

Research `cdx-chores video frames` for extracting one source frame or exporting a sequence of still images. The feature should support direct CLI invocation and a guided Interactive flow, with PNG, JPG, and WebP output.

This is a design draft. Repository observations below describe existing code; new command examples, prompts, defaults, and algorithms are proposals unless identified as agreed direction. No frame-extraction implementation, terminal prototype, encoder smoke test, or visual validation has been completed for this feature.

Agreed direction from the design discussion:

| Area                   | Direction                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Command                | `video frames`; “frame picker” names the Interactive selection control                     |
| Single-frame selectors | Explicit `--first-frame` and `--last-frame`, plus custom selection                         |
| Custom selection       | Fixed wave timeline, source frame-number input, and timestamp input                        |
| Wave appearance        | Mirrored bars; highlighted tallest selected bar; inward-pointing triangles above and below |
| Terminal adaptation    | Full wave, compact mirrored wave, and direct-input fallback                                |
| Sequence               | Whole video, sampled by FPS or interval; interval has guided suggestions and custom input  |
| Outputs                | Default beside the source, or custom `--output`; selection determines file versus folder   |
| Interval language      | Positive integer plus lowercase `ms`, `s`, or `m`, matching existing duration syntax       |
| Preview location       | CLI-owned OS temporary session, following the Interactive PDF recipe convention            |
| Scaling                | Preserve aspect ratio; presets and custom scale within `0.1–1`                             |
| Evidence               | Reproducible public synthetic cases and private local visual review                        |

Filename direction is serial-based, using the existing rename-style `{stem}`, `{prefix}`, and `{serial}` placeholders. Sequence defaults start at 1 with minimum width 6. FPS input uses positive integers or ordinary decimals; users do not enter fraction expressions. These input/naming choices are agreed direction, while extraction and sampling behavior still need verification. A timestamp index sidecar is outside this initial scope.

Custom sequence ranges, dual-boundary timeline controls, evenly spaced image counts, and a separate “every source frame” mode are outside this initial scope. Image scaling applies equally to single-frame and sequence exports. A browser timeline, playback editor, scene detection, and cropping are not part of the proposed feature.

## Current Feature and Reusable Patterns

The following baseline was inspected on 2026-09-30:

| Existing surface                                                                | Observed behavior                                                                            | Reuse direction                                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Video commands](../../src/cli/commands/video.ts)                               | Registers `convert`, `resize`, and `gif`; no `frames` command                                | Add a peer command without changing existing contracts                     |
| [GIF action](../../src/cli/actions/video.ts)                                    | Omitted output derives a `.gif` file beside the resolved input                               | Derive frame destinations from the input rather than the working directory |
| [Video Interactive flow](../../src/cli/interactive/video.ts)                    | GIF offers default output or custom file path                                                | Keep the same destination-choice pattern                                   |
| [Rename template prompts](../../src/cli/interactive/rename/pattern.ts)          | Presets/custom templates, completion, and conditional serial prompts                         | Reuse the interaction and compatible filename validation                   |
| [PDF output review](../../src/cli/interactive/markdown/to-pdf/output-review.ts) | Default/custom output, preparation, final review, and change actions                         | Resolve outputs before export and retain choices when revisiting review    |
| [Markdown command outputs](../../src/cli/commands/markdown.ts)                  | `--output` names a PDF/profile file or template/project directory according to the operation | Use one operation-aware output option                                      |
| [Duration parser](../../src/cli/options/codex-timeout.ts)                       | Positive integer `ms`/`s`/`m` syntax with request-specific bounds                            | Share duration language without inheriting the timeout cap                 |
| [Owned PDF recipe session](../../src/cli/interactive/markdown/lifecycle.ts)     | Unique child of `os.tmpdir()`, canonical path, and owned cleanup/retention                   | Follow the location and ownership model for preview sessions               |
| [Path prompts](../../src/cli/prompts/path.ts)                                   | File/directory prompts and default/custom output choices                                     | Use explicit destination kinds and existing completion                     |
| [Terminal helpers](../../src/cli/tui/index.ts)                                  | Raw sessions, key parsing, cursor operations, and inline redraw support                      | Evaluate a small multi-line picker using the existing foundation           |

[Video resize](../guides/video-resize-usage-and-ux.md) already has a scale-first model. Its action rounds video dimensions to even values; that is not evidence that image exports require the same rounding. Existing GIF numeric fallback behavior also should not determine validation for the proposed command.

[Filename languages](../guides/patterns-placeholders-and-templates.md) have feature-specific semantics. Reusing their UI does not imply that every rename placeholder or ordering option is meaningful for extracted frames.

## Command Surface and Interactive Flow

### Direct CLI Proposal

The command name `frames`, single-frame selectors `--first-frame`, `--last-frame`, `--frame-number`, and `--at`, and reuse of `-o, --output` are agreed naming direction. Filename controls use `--pattern`, `--prefix`, `--serial-start`, and `--serial-width`, following rename terminology. Their supported grammar and semantics are specified below; encoder-specific quality controls remain open. These are design contracts for an unimplemented command.

| Option                    | Proposed role                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `-i, --input <path>`      | Source video                                                                                 |
| `--first-frame`           | First decoded frame of the selected video stream                                             |
| `--last-frame`            | Final decoded frame of that stream                                                           |
| `--frame-number <number>` | Positive integer source-frame number, starting at 1                                          |
| `--at <timestamp>`        | Video-relative position in `HH:MM:SS[.mmm]` form; zero is valid                              |
| `--fps <rate>`            | Whole-video sequence sampled at a positive integer or decimal images-per-second rate         |
| `--interval <duration>`   | Whole-video sequence sampled at a positive integer duration with lowercase `ms`, `s`, or `m` |
| `--format <format>`       | PNG, JPG, or WebP                                                                            |
| `--scale <factor>`        | Finite factor within `0.1–1`, inclusive                                                      |
| `-o, --output <path>`     | Final image file for single-frame selection; output directory for FPS or interval sequence   |
| `--pattern <template>`    | Sequence filename template using the supported rename-style subset below                     |
| `--prefix <value>`        | Optional value for `{prefix}`, following rename terminology                                  |
| `--serial-start <number>` | Non-negative integer export serial start, default 1                                          |
| `--serial-width <digits>` | Positive integer minimum digit width, default 6                                              |
| `--overwrite`             | Explicit permission to replace conflicting output files                                      |

Require exactly one selection method in direct CLI use. Single-frame selectors are mutually exclusive, FPS and interval are mutually exclusive, and a single-frame selector cannot be combined with a sequence method. Validate explicit invalid values instead of silently substituting defaults. Missing selection should explain the supported choices without starting a picker.

Illustrative proposed usage; these commands are not implemented:

```text
cdx-chores video frames -i ./clip.mp4 --first-frame
cdx-chores video frames -i ./clip.mp4 --last-frame
cdx-chores video frames -i ./clip.mp4 --frame-number 25
cdx-chores video frames -i ./clip.mp4 --at 00:00:12.500
cdx-chores video frames -i ./clip.mp4 --fps 24
cdx-chores video frames -i ./clip.mp4 --fps 23.976
cdx-chores video frames -i ./clip.mp4 --interval 2s
cdx-chores video frames -i ./clip.mp4 --first-frame --output ./cover.png
cdx-chores video frames -i ./clip.mp4 --fps 24 --output ./clip-frames/
cdx-chores video frames -i ./clip.mp4 --fps 24 --pattern '{stem}-{serial}' --serial-width 6
```

### Interactive Proposal

```text
Video -> Frames -> Select source video
  |
  +-- Single frame
  |     +-- First frame
  |     +-- Last frame
  |     `-- Custom: wave / frame number / timestamp
  |           `-- Resolve and preview -> Accept / Adjust / Cancel
  |
  `-- Sequence: whole video
        +-- FPS: presets / custom rate
        `-- Interval: suggestions / custom duration
              `-- Show estimated count
  |
  `-- Format -> Scale -> Default/custom destination -> Applicable naming
        `-- Final review -> Export / Change choices / Cancel
```

Changing output or scaling should retain the source and selection. Returning from an image preview should retain the exact selected position. Cancellation performs no final export; preview cleanup follows the owned-session lifecycle below.

## Single-Frame Selection

First and last mean the first and final decoded source frames, not an estimate based on container duration and nominal FPS. Frame numbers are 1-based in CLI options, prompts, validation, and preview/review information; frame 1 is the first frame. Any decoder's internal index conversion stays behind that interface. Filename serials describe export order, not source frame identity.

Custom selection must offer all three entry methods:

- Wave navigation for a coarse position within the full video.
- Frame-number input for a specific source frame.
- Timestamp input for a known position, with the valid time range displayed.

### Custom Selector Grammar

`--frame-number` accepts a positive, safely representable integer. Reject zero, negatives, decimals, and malformed values; source frame 1 is the first displayed frame. Frame numbers follow presentation order within the selected video stream, rather than packet/decode scheduling order. The upper bound is verified when resolving the request; unavailable metadata must not become an invented exact count.

`--at` accepts `HH:MM:SS[.mmm]`: at least two hour digits, exactly two minute/second digits in the range `00–59`, and an optional fraction of one to three digits. Hours may exceed 23 for long sources. Zero is valid as `00:00:00` or `00:00:00.000`. Bare numbers and duration-unit values are not timestamp inputs in this initial grammar. Keep the position grammar distinct from positive integer-unit intervals and integer/decimal FPS rates.

### Timestamp Mapping, Origin, and Stream

Select the frame visible at the requested time: the most recent source frame with a presentation start at or before the target. At an exact next-frame start, select that next frame. Between frame starts, retain the earlier frame; do not jump forward to a nearest future frame. This specifies custom single-frame selection, while sequence resampling/repetition policy remains separately unresolved.

```text
Frame 1 starts at 00:00:00.000
Frame 2 starts at 00:00:00.040
Frame 3 starts at 00:00:00.120

Requested: 00:00:00.070
Selected: Frame 2 — actual position 00:00:00.040
```

The first displayed source frame defines video-relative time zero. Subtract its presentation start from source timestamps for user-facing positions; do not use an unrelated audio/container start as the origin. Show requested position, resolved source frame number, and actual frame start in preview/review when they differ. Preserve that frame identity for final output. Do not derive exact identity from nominal FPS, including for variable-frame-rate sources.

Prefer the default eligible video stream; otherwise choose the first eligible stream by stream index. Exclude attached pictures, thumbnails, and cover images. If multiple eligible streams are marked default, use the lowest stream index to keep selection deterministic. All single-frame and sequence operations use that same chosen stream for frame numbering, timing, dimensions, and extraction. Show the chosen stream in review when multiple eligible video streams exist. A manual stream-selection control is outside the initial scope.

Validate positions against the selected stream's known end: an explicit timestamp at or after that end is out of range, and `--last-frame` selects the actual final frame without an EOF timestamp guess. If timing/bounds cannot be established reliably, surface that limitation rather than silently clamping or manufacturing an exact mapping. Missing/ambiguous/non-monotonic presentation timing and buffered final frames require decoder verification; the design rules above are not runtime evidence.

Display a numeric frame upper bound only when trustworthy. Otherwise say the count is unavailable and validate the requested frame when resolving it. An expensive full count should have visible progress/cancellation rather than silently blocking picker entry. Exact-count and indexing policy remains open.

The image shown in preview and the saved output must represent the same resolved source frame. Selection identity should survive format, scale, destination, and layout changes. Preview display could use a local image viewer or a terminal image facility; portability and fallback behavior need an experiment. Generating a preview alone is not proof that the user can view it.

### Preview Location and Ownership

Follow the existing [Interactive PDF temporary recipe convention](../guides/markdown-pdf-interactive-usage.md#temporary-render-lifecycle). That implementation creates a uniquely named, canonicalized child of Node.js `os.tmpdir()`; the actual root follows operating-system and environment configuration. Preview should use that location convention rather than a source-adjacent cache or a new temp-root setting. Propose a feature-specific prefix such as `cdx-chores-video-frames-`.

Reuse the creation, canonicalization, and ownership principles, not the Markdown-specific session type or recipe recovery workflow. Create a session only when a preview is requested. Keep it through adjustment and repeated previews for the same source; changing layout, scale, or destination should not discard selection identity or create a session for each keypress.

Recommended lifecycle, still requiring preview/recovery verification:

```text
Request image preview
  -> create/reuse CLI-owned OS temporary session
  -> generate preview for the resolved source frame
  -> inspect / adjust / choose export
  -> export image outside the temporary session
       success -> attempt cleanup of the exact owned session
       failure -> retain session and show its canonical path

Ordinary cancellation -> clean up owned previews
Exit after failure    -> retain the failed session unless deletion is chosen
```

The reference [PDF lifecycle](../guides/markdown-pdf-interactive-usage.md#temporary-render-lifecycle) cleans up after successful rendering and retains the recipe session after failure. Apply those ownership principles to preview/export recovery while deciding the minimal preview-specific actions separately. A retained failure session should not be silently deleted by a later cancellation. Explicit retention likewise survives normal exit.

Final images and sequence folders must remain outside the preview session, including custom destinations. Cleanup targets only the exact owned session, never source media, saved exports, or user-owned folders. If cleanup fails after a successful export, keep the output valid and report the retained session path. Verify viewer handoff before deleting files that might still be in use. Direct CLI export without preview does not create this Interactive preview session.

## Wave Picker and Adaptive Terminal Layout

### Fixed Timeline and Selection

The horizontal axis represents the entire video's relative time span. Bar count comes from available terminal space, not source frame count. Bar heights are a visual distance cue around the selected position, not measured audio, motion, or scene data. The selected bar is tallest and nearby bars taper with distance.

Keep start and end anchored. Move the highlight and both inward-pointing triangles together. Near an endpoint, the wave tapers only where bars remain; it does not wrap around or scroll the selected position back to the center.

Simplified full sketch with independent thin vertical bars. The triangles identify the selected bar; terminal color supplies the accent without changing its width:

```text
Pick a frame · Duration 01:00.000

                  ▼
                  │
              │   │   │
          │   │   │   │   │
  │   │   │   │   │   │   │   │   │
          │   │   │   │   │
              │   │   │
                  │
                  ▲

00:00           00:30           01:00
Selected: 00:30.000
Timeline is a coarse overview. Use frame input for exact selection.
```

**Sketch only:** This illustrates the visual idea, not a required rendering. Final spacing, glyphs, bar counts, and heights should be determined through terminal prototyping.

Use the same thin stroke for selected and neighboring bars. Propose an orange/amber accent for the selected bar and triangles, and muted neighboring bars. The triangles and selection label retain position information without color. Follow [CLI output and color](../guides/cli-output-and-color.md) for styling controls and provide plain-character alternatives if the chosen glyphs cannot be rendered reliably.

### Controls and Precision Notice

Proposed controls are Left/Right to move one visible division, `F` for source frame input, `T` for timestamp input, Enter to preview, and Escape to return. Home/End and previous/next source-frame refinement are candidates for a later prototype decision, not additional selection modes.

Show visible position count and approximate seconds per coarse step when duration is known. Directly entering a frame can place it between displayed positions: highlight the nearest bar while retaining the exact resolved frame and actual timestamp in the label. Subsequent coarse movement intentionally changes that exact selection. Triangles are indicators, not Up/Down controls.

The leftmost wave position resolves the first source frame; the rightmost resolves the final source frame using last-frame semantics and shows its actual start. A duration label at the right edge does not make an EOF timestamp valid for explicit `--at` input.

### Adaptive Layout and Fallback

| Space/capability                     | Proposed presentation                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| Comfortable usable columns and rows  | Full mirrored wave and labels                                |
| Limited width or height              | Fewer bars/height levels; compact wave still has both halves |
| Insufficient space for a useful wave | Text selection through frame number or timestamp             |
| No interactive terminal              | Direct CLI options; no attempted visual prompt               |

Compact sketch:

```text
        ▼
        │
      │ │ │
  │ │ │ │ │ │ │
      │ │ │
        │
        ▲

Selected: 00:30.000
F Frame   T Time   Enter Preview
```

**Sketch only:** This compact version illustrates the same idea; its dimensions and character arrangement are not a fixed layout.

The intended mirrored shape and selection should remain clear at every size. A terminal prototype must verify glyph widths, wrapping, symmetry, and triangle alignment. Choose breakpoints from usable rows and columns, accounting for controls and notices. Do not fix thresholds based on these sketches alone.

Resize changes presentation only: preserve selected time/frame, recalculate positions, and restore a richer layout when space permits. Keep direct input available in every layout. Redraw on state/layout changes; no continuous animation or video decoding is needed merely to move the wave. Restore terminal input and cursor visibility on completion, cancellation, or failure.

## Whole-Video Sequence Export

Sequence always covers the whole selected video stream. Interactive mode offers exactly FPS and interval; no range controls or fixed-image-count method.

### FPS

Offer familiar presets such as 24, 25, 30, and 60 plus Custom FPS. Direct CLI and custom Interactive input accept positive integers or ordinary decimals, such as `24`, `30`, and `23.976`. Reject zero, negatives, non-finite or malformed values, and fraction expressions such as `24000/1001`. Use validation wording such as “FPS must be a positive number, for example 24 or 23.976.” FPS is a rate, so decimal input here does not change the integer-unit interval grammar.

The implementation may represent rates as rational values internally, but it must preserve the user-supplied value. Do not silently reinterpret a decimal as a nearby standard fractional rate. Source-rate information can be displayed as a readable decimal, labeled approximate when rounded; variable frame rates must not be presented as constant. Requested output FPS and source FPS remain separately labeled.

A synthetic one-second, constant-24-FPS video with 24 decoded frames should export 24 images at 24 FPS. This is a required verification case, not a promise that arbitrary container metadata yields exactly `duration × rate` images.

FFmpeg's `fps` filter can duplicate or drop source frames.[^fps] Research must resolve requests above available frame density and repeated selection on variable frame rates. Preferred direction is no silent repeated source-frame export, but rejecting the request, offering a lower rate, or permitting explicitly disclosed repetition is still unresolved. Do not silently lower a requested rate.

### Interval

Offer useful suggestions with estimated counts, adapted to duration. Short clips may suggest 0.5, 1, 2, and 5 seconds; longer clips may add 10, 30, and 60 seconds. Keep the menu bounded rather than always listing every possible interval.

Illustrative prompt for a synthetic 20-second source:

```text
Export one image
  Every 0.5 seconds — approximately 40 images
  Every 1 second    — approximately 20 images
  Every 2 seconds  — approximately 10 images
  Every 5 seconds  — approximately 4 images
  Custom interval…
```

Use the existing [duration language](../guides/codex-timeouts-retries-and-recovery.md#duration-syntax): one positive integer immediately followed by lowercase `ms`, `s`, or `m`. Accept values such as `500ms`, `2s`, and `1m`; reject bare numbers, zero, negatives, decimals, whitespace, uppercase units, compound values, repeated interval options, and unsafe numeric conversions. A preset displayed as “Every 0.5 seconds” resolves to `500ms`; custom input uses `500ms`, not `0.5s`.

Reuse the grammar and validation approach rather than the Codex request-timeout policy. The existing timeout parser owns a ten-minute per-request maximum; that maximum is not an interval restriction. An interval such as `15m` is meaningful for a sufficiently long source. The minimum is `1ms`; there is no fixed video-duration upper bound, provided the amount and normalized milliseconds remain safely representable integers. The scale limit `0.1–1` does not apply. If implementation extracts shared duration parsing, preserve all current timeout bounds and behavior.

Show the estimated result before accepting custom input. Keep duration, timestamp position, and FPS language distinct: an interval is a positive integer-unit duration, a video position uses the timestamp grammar specified above and may be zero, and FPS accepts a positive integer or decimal rate. Fraction-expression FPS input is excluded.

### Interval Limits and Feedback

Use expected sampling positions to explain the effect of an interval instead of an arbitrary “almost too large” percentage. For a synthetic video with a known eight-second duration, the proposed cadence gives:

| Interval               | Target positions   | Feedback                                             |
| ---------------------- | ------------------ | ---------------------------------------------------- |
| `2s`                   | 0, 2, 4, 6 seconds | Approximately four images                            |
| `7s`                   | 0, 7 seconds       | Approximately two images                             |
| `8s`                   | 0 seconds          | Notice that only the first frame will be exported    |
| `10s`                  | 0 seconds          | Same one-image notice; the value is valid            |
| `0ms`, `0s`, or `0m`   | Not generated      | Reject: a zero interval cannot advance sampling time |
| Empty/missing duration | Not generated      | Reject: interval sampling requires a duration value  |

An interval equal to or longer than a known positive video duration has one target at the start. For a usable source, allow the export with a clear notice rather than silently reducing the interval or rejecting it:

```text
Video duration: 8 seconds
Interval: 10 seconds

This interval produces one sampling position at the start
of the video. Only the first frame will be exported.
```

This remains sequence mode, with an image inside the sequence output folder. The number of images must not change the mode-aware meaning of `--output`. A near-duration interval that still gives two positions needs count information, not an extra warning merely because it is close to the end.

An interval is the time between successive sampling targets. With `2s`, targets advance from 0 to 2 to 4 seconds; with a zero interval, every target stays at 0, so no advancing cadence can be formed. Reject `0`, `0ms`, `0s`, and `0m`. This differs from a timestamp position of zero, which validly selects the start of the video.

When interval sampling is selected, require a supplied positive duration. Empty input, a missing value, `null`, and `undefined` do not provide that duration and must fail validation, including literal strings such as `"null"` or `"undefined"`. Do not coerce these values to zero or interpret them as automatic selection, every frame, or a hidden default. This requirement applies to interval mode; other selection methods do not require an interval. Suggested validation wording:

```text
Interval must be a positive duration greater than zero.
Use a positive integer followed by ms, s, or m:
1ms, 500ms, 2s, or 1m.
```

Interactive mode keeps invalid input in the editor and shows valid-input estimates or the one-image notice beside it and in the existing export review. Do not add a second confirmation step. Direct CLI invalid input fails before writing; a valid oversized interval prints the notice to stderr and proceeds. When duration is unavailable, say the count estimate is unavailable and defer the comparison; do not treat unknown duration as zero or invent a one-image guarantee.

Millisecond input precision does not guarantee distinct source frames. When known source timing indicates that targets may resolve to the same frame, explain that limitation; repetition handling remains an open sampling-policy decision. Actual image counts and boundary behavior still require the synthetic verification below.

### Sampling Boundaries and Counts

Propose normalizing the first displayed video position to zero and taking cadence targets from that origin while the target is before the video end. For 20 seconds at a 5-second interval, targets are 0, 5, 10, and 15 seconds; do not append a final frame outside the cadence. Mapping targets to actual frames, timestamp offsets, and EOF rounding need verification for both sampling methods.

Counts remain labeled estimates until selection is verified. Preview the chronological naming order, then report the actual written image count on completion. Verify the one-target behavior for equal/longer intervals without changing sequence destination semantics. Show large estimated export counts in review before starting processing.

## Image Formats and Output Scaling

Propose PNG by default, with JPG and still WebP alternatives. JPG and WebP quality controls and their defaults need encoder verification; do not reuse a numeric quality scale across formats without checking its meaning. WebP here is a still image per selected frame, not an animated sequence file.

Proposed size menu for a synthetic 1920 × 1080 source:

| Choice             | Factor             | Output dimensions                      |
| ------------------ | ------------------ | -------------------------------------- |
| Original (default) | 1                  | 1920 × 1080                            |
| Three-quarter      | 0.75               | 1440 × 810                             |
| Half               | 0.5                | 960 × 540                              |
| Quarter            | 0.25               | 480 × 270                              |
| Custom             | `0.1–1`, inclusive | Calculated and shown before acceptance |

Use one factor for both dimensions, keeping the whole image and source aspect ratio subject to integer-pixel rounding. Propose nearest-pixel rounding and a minimum dimension of one pixel; odd/small sources and display orientation need verification. No automatic upscaling or cropping. Use one selected scale across a sequence, and show effective dimensions in final review. Image-output encoder requirements determine any additional dimension constraints.

## Output Destinations and Filename Templates

### Destinations

Propose the following for a synthetic input `./videos/clip.mp4`:

| Export    | Default output            | Custom choices                                         |
| --------- | ------------------------- | ------------------------------------------------------ |
| One frame | `./videos/clip-frame.png` | Explicit image file, or folder with generated filename |
| Sequence  | `./videos/clip-frames/`   | Output folder plus filename template                   |

Default paths are beside the source. Custom relative paths resolve from the invocation's working directory. Reuse default/custom choice and inline completion. One `--output` option follows the project's existing language: GIF/PDF exports use it for files, while Markdown template/project operations use it for directories. For `frames`, the explicit selection method determines its meaning:

| Selection                                                        | Meaning of `--output`                 | Interactive destination prompt |
| ---------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| `--first-frame`, `--last-frame`, or custom single-frame selector | Final image file                      | Output image file              |
| `--fps` or `--interval`                                          | Directory containing generated images | Sequence output folder         |

Do not infer destination kind from filename extension, a trailing separator, or whether the path already exists. A single-frame output that names an existing directory, or a sequence output that names an existing file, should receive a mode-specific validation error. For a new path, the selection method still determines whether to create a file or directory. Help and final review must state that kind explicitly; a separate `--output-dir` option is unnecessary for this scope.

Interactive single-frame selection may offer a custom folder as an explicit convenience: choose the directory, derive/review the image filename, and pass the resolved file path to the same export action. The directory choice does not change the direct CLI's single-image `--output` meaning. Exact single-frame naming defaults remain proposals.

Create missing final destination directories only after final export acceptance. Preview sessions can be created earlier for an explicit preview request and remain separate from final destinations. Validate that no final target is inside the owned temporary session so successful cleanup cannot remove an export.

### Filename Presets and Tokens

Use serial-based numbered, prefixed-numbered, and custom template presets. Default sequence naming is `{stem}-{serial}` with start 1 and minimum width 6, producing `clip-000001.png`. The format supplies the extension; the template generates a basename.

| Token      | Proposed meaning                                                                             |
| ---------- | -------------------------------------------------------------------------------------------- |
| `{stem}`   | Input video's filename without extension                                                     |
| `{prefix}` | Optional supplied prefix                                                                     |
| `{serial}` | Chronological export order; configurable start, default 1; distinct from source frame number |

The initial filename language is limited to these existing placeholder families. Source frame numbers and timestamps remain available in preview/review information. Chronological export order determines serials, including separate serials for any repeated source frame if repetition is adopted. Do not import rename's wall-clock naming, file modification/path ordering, or directory serial scope into video export.

Reuse [rename's template interaction and serial terminology](../guides/rename-common-usage.md#pattern-and-template-usage): conditional prefix/start/width prompts, digit-count width input, and completion limited to the supported placeholder subset. Only ask serial questions when the template uses serials, and render concrete filename examples:

```text
Template: {stem}-{serial}
Serial start: 1
Serial minimum width: 6

clip-000001.png
clip-000002.png
clip-000003.png
```

Support rename's serial start/width forms within this limited filename language:

| Form                    | Meaning without explicit flags |
| ----------------------- | ------------------------------ |
| `{serial}`              | Start 1, minimum width 6       |
| `{serial_####}`         | Minimum width 4                |
| `{serial_start_3}`      | Start 3, minimum width 6       |
| `{serial_####_start_3}` | Start 3, minimum width 4       |

Start and width parameters may appear in either order. Resolve each setting using explicit `--serial-start` / `--serial-width` flags first, then an embedded parameter, then the frames defaults of 1 / 6. Serial start accepts a non-negative, safely representable integer; minimum width accepts a positive, safely representable integer. Zero is a valid export serial start even though source frame numbers begin at 1. Keep rendered basenames within filesystem limits and detect unsafe serial increments before writing.

Allow at most one serial placeholder in a template, following rename's existing validation. Reject duplicate start/width parameters, unknown modifiers, and explicit `order_*` modifiers. Do not expose `--serial-order` or `--serial-scope`: export chronology is fixed, and rename's implicit path ordering must not influence extraction. These forms reuse formatting grammar, not rename's file ordering or directory scope.

If a custom pattern contains no serial placeholder, `--serial-start` and `--serial-width` have no effect, matching rename. Interactive mode omits those prompts, and final review shows the actual rendered names. This does not relax duplicate-name validation for a sequence.

Sequence presets include serials so repeated source frames still have distinct names. Custom templates must produce safe, unique basenames. Reject duplicate rendered names with a clear validation error suggesting serials rather than implicitly renaming outputs. Serial growth beyond the minimum width, unknown final counts, and rerun collisions still need verification.

### Review, Collisions, and Partial Output

```text
Sequence export review
Scope: Whole video
Sampling: 24 FPS
Images: Approximately 24
Format: PNG
Scale: 0.5 — 960 × 540
Folder: ./clip-frames/
First name: clip-000001.png
Last name: clip-000024.png (estimated)
Overwrite: Disabled

Export images / Change sampling / Change size / Change output / Change naming / Cancel
```

Preflight generated-name and existing-file collisions before final writes, then enforce no-overwrite at write time as well. Default overwrite is disabled. A folder's existence alone is not permission to replace its contents. Explicit overwrite applies only to generated target files; never clear an existing folder or delete unrelated files. Define rerun handling for stale sequence files and known versus unknown final output counts.

On failure, report the output location and actual written count and retain partial exports for inspection. Retain any active preview session for the proposed recovery flow; successful export or ordinary cancellation can clean up only owned preview artifacts. Retry/resume semantics for partial sequence exports are not established by this draft.

## Technical Feasibility and Dependencies

Repository review supports reusing the FFmpeg-backed command structure and small terminal helpers. It does not prove exact seeking, decoder indexing performance, multi-line picker behavior, or still-image encoder support.

| Question               | Evidence to gather                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Metadata and indexing  | Compare lightweight stream metadata with decoded counts/frame timestamps; choose when a scan is necessary       |
| Stream and time origin | Verify default/first eligible stream selection, cover exclusion, and first-frame time-zero normalization        |
| Timestamp selection    | Verify most recent frame at/before the target, exact next-frame boundaries, and reported actual position        |
| Final frame            | Verify decoder EOF and buffered-frame handling instead of subtracting nominal frame duration                    |
| FPS and interval       | Verify target mapping, repetition policy, ordering, and end behavior                                            |
| Image output           | Verify PNG/JPG/WebP availability, quality settings, odd sizes, orientation, and relevant pixel/color conversion |
| Terminal prompt        | Verify key ownership, multi-line redraw, resize, fallbacks, and restoration using existing helpers              |
| Preview session        | Verify OS temp selection, canonical ownership, reuse, output separation, cleanup, retention, and viewer handoff |

FFmpeg documents different input/output seek behavior; input seeking may land at an earlier seek point before decoding/discarding to the target.[^seek] A fast seek command alone is therefore insufficient evidence for the proposed identity contract. Frame-number indexing and tail decoding strategies require experiments.

FFprobe can expose streams, frame details, and decoded counts.[^probe] It is a candidate dependency, not an adopted requirement. Current video dependency checks and [doctor workflow](../../src/cli/doctor/workflow/video.ts) cover FFmpeg; if FFprobe is adopted, update availability checks and doctor guidance deliberately. Define behavior when trustworthy duration/count information is unavailable.

Keep runtime execution compatible with Node.js and invoke tools through existing process boundaries. Consider cancellation, bounded metadata output, and avoiding full frame indexing on every arrow press. The existing inline renderer handles wrapping text; a mirrored multi-line wave needs its own layout verification.

Reference designs: tui-wave provides waveform navigation and zoom,[^tui-wave] CAVA illustrates terminal bar rendering,[^cava] and Ratatui has bar-chart examples.[^ratatui] These are design references, not chosen dependencies or exact implementations of the proposed distance-based picker.

## Verification and Research Completion Criteria

### Public Reproducible Evidence

Generate small synthetic videos on demand with visible frame numbers, timestamps, and distinct start/end markers. Keep expected values independent of the extraction algorithm; a fixture generator should establish counts and positions in advance.

| Case                                      | Required observation                                                                                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One second, 24 constant-FPS source frames | 24-FPS export writes 24 images, ordered correctly                                                                                                                                 |
| First/last and frame-number selection     | Export matches the known labeled source frame; number 1 selects first                                                                                                             |
| Timestamp between frames                  | Select the most recent frame starting at/before the target; an exact next-frame start selects that next frame                                                                     |
| Variable FPS/non-zero timestamps          | No nominal-FPS indexing assumptions; time origin and repeated targets are handled                                                                                                 |
| Interval presets/custom input             | Expected cadence, first target, end behavior, and actual counts                                                                                                                   |
| Formats and scaling                       | Files decode in the selected format; dimensions and recognizable content are correct                                                                                              |
| Destination and naming                    | Default/custom paths, unique names, overwrite boundaries, and partial failures                                                                                                    |
| Full/compact/fallback picker              | Alignment and precise selection survive resize and entry-method changes                                                                                                           |
| Keyboard lifecycle                        | Cancel/finish/error restore input/cursor state; the next ordinary prompt works                                                                                                    |
| Invalid combinations                      | Conflicting methods and invalid values fail before final writes                                                                                                                   |
| Duration language                         | Presets normalize to integer-unit values; invalid/repeated intervals fail; timeout caps are not copied                                                                            |
| Interval limits and notices               | `1ms` minimum, zero/empty/missing/null/undefined input rejection, near/equal/longer duration feedback, unknown-duration handling, and one-image sequences retaining folder output |
| Mode-aware output                         | One output option resolves to the correct file/directory kind; wrong existing kinds receive clear errors                                                                          |
| Preview ownership                         | Session reuse and canonical paths; success/cancel cleanup, failure retention, explicit retention, cleanup failure, and exports outside session                                    |

Selector, rate, and naming verification should also cover:

- Positive integer source frame numbers, invalid zero/decimal values, and upper-bound resolution without invented counts.
- Timestamp grammar: valid zero, hours above 23, one-to-three fractional digits, invalid minute/second fields, rejected bare numbers/duration units, and known-end rejection.
- Labeled starts at 0, 40, and 120 ms: 70 ms selects frame 2 at 40 ms, while exactly 120 ms selects frame 3. Verify shifted/negative source timestamps and presentation order with buffered decoding.
- Multiple streams: eligible default selection, lowest-index default ties, fallback to the first eligible stream, and attached-picture/thumbnail/cover exclusion.
- Integer/decimal FPS acceptance, fraction-expression rejection, invalid-rate errors, and preservation of the supplied rate during internal conversion.
- Stem/prefix/serial presets, conditional rename-style controls, parameter order, flag-over-token-over-default precedence, zero serial start, minimum width, no-effect serial flags without a serial placeholder, and rejection of duplicate/ordering/scope controls.
- Chronological serial identity, growth beyond the minimum width, repeated-source uniqueness if repetition is adopted, and duplicate custom-name errors.

Use exact pixel/content assertions where appropriate for lossless output; lossy JPG/WebP verification should use suitable tolerances rather than identical file hashes. Test real key input and resize transitions, not just static wave snapshots. Confirm that previews and exports identify the same frame.

### Local Visual Review and Privacy

Use suitable local-only source material to inspect picker usability and real-video results. Retain local exported images, sequence contact sheets, terminal captures, and a short outcome checklist for development review. Keep sources and derived review artifacts in an ignored local area and confirm they are untracked before retaining them there.

Public research, plans, job records, examples, and PR text must omit private source names, fixture identifiers/locations, source-specific metadata, captured content, and derived images. Publish synthetic reproducible evidence and generic manual review outcomes only. Local source review supplements public verification; it must not become a required CI fixture or the sole support for a correctness claim.

### Completion Criteria

The research is sufficiently answered when selection/sampling/output questions are resolved with evidence, a terminal prototype validates the layouts and fallbacks, real tool experiments establish the extraction/format/scale boundary, and the supported dependency strategy is recorded. Cite public reproducible evidence directly or link the relevant execution records before closing research. Drafting and document review alone do not meet those criteria. No prototype or runtime verification results are claimed by this document.

## Open Questions

- When to compute exact counts/indexes, how to expose progress, and whether FFprobe
  is required or an optional metadata backend.
- FPS repetition policy and sparse-source interval mapping; numeric precision and EOF rounding.
- Portable image preview presentation, viewer lifetime, and the minimal recovery
  actions for an owned temporary preview session; exact failure/cancel transitions.
- Terminal layout breakpoints, glyph fallbacks, step sizes, and optional refinement keys.
- Single-frame filename defaults, serial growth limits, and collision/rerun
  policy when source frames repeat or final counts are unknown.
- PNG/JPG/WebP encoder capabilities, quality option naming/grammar and defaults, orientation, and rounding.

The command name, single-frame selector names/grammar, timestamp mapping and origin, eligible-stream selection, whole-video sequence scope, two sequence methods, single-frame-only wave picker, integer-unit interval syntax and limits, positive integer/decimal FPS input, limited rename-style serial grammar/defaults, mode-aware `--output`, and OS temporary-session location convention are settled direction, not open product-scope questions. Selector behavior, interval feedback, and rate/naming behavior are specified above but still need runtime verification; preview recovery details remain a recommendation to verify.

## Recommendations and Next Steps

Retain this focused scope and `draft` status while the unresolved details are investigated. First prototype the wave with synthetic duration/selection state, then verify exact extraction and sampling using generated labeled videos. Record findings against the questions above without changing existing video behavior.

Once evidence supports a concrete contract, create an implementation plan with reciprocal `Related Plans` / `Related Research` links. The plan should cover shared extraction logic, command/Interactive integration, output ownership, focused verification, and a current usage guide. A later shipped guide should own the reader-facing contract; this research owns rationale and feasibility evidence.

## References

- [Video GIF Usage and Quality Modes](../guides/video-gif-usage-and-quality-modes.md)
- [Video Resize Usage and UX](../guides/video-resize-usage-and-ux.md)
- [Rename Common Usage](../guides/rename-common-usage.md)
- [Patterns, Placeholders, and Templates](../guides/patterns-placeholders-and-templates.md)
- [Markdown PDF Interactive Usage](../guides/markdown-pdf-interactive-usage.md)
- [Codex Timeouts, Retries, and Recovery](../guides/codex-timeouts-retries-and-recovery.md)
- [CLI Output and Color](../guides/cli-output-and-color.md)

[^fps]: [FFmpeg filters: FPS](https://ffmpeg.org/ffmpeg-filters.html#fps).

[^seek]: [FFmpeg command documentation: seeking](https://ffmpeg.org/ffmpeg.html).

[^probe]: [FFprobe documentation](https://ffmpeg.org/ffprobe.html).

[^tui-wave]: [tui-wave: terminal audio editor](https://github.com/biomassa/tui-wave).

[^cava]: [CAVA: terminal bar-spectrum visualizer](https://github.com/karlstav/cava).

[^ratatui]: [Ratatui bar-chart example](https://ratatui.rs/examples/widgets/barchart/).
