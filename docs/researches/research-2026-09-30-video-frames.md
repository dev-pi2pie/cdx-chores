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
| Review                 | Text review of resolved frame identity or sequence settings; export after acceptance       |
| Dependencies           | FFmpeg and FFprobe required for every `frames` selection method; doctor checks both        |
| Counts and indexing    | Metadata first; streaming sequential baseline; bounded session reuse; cancellable scans    |
| Sampling policy        | Preserve requested cadence; disclose repeated source-frame selections                      |
| Large sources          | No blanket size cap; bounded records/cache, resource diagnostics, and phase progress       |
| Scaling                | Preserve aspect ratio; presets and custom scale within `0.1–1`                             |
| Evidence               | Reproducible public synthetic cases and private local visual review                        |

Filename direction is serial-based, using the existing rename-style `{stem}`, `{prefix}`, and `{serial}` placeholders. Sequence defaults start at 1 with minimum width 6. FPS input uses positive integers or ordinary decimals; users do not enter fraction expressions. These input/naming choices are agreed direction, while extraction and sampling behavior still need verification. A timestamp index sidecar is outside this initial scope.

Custom sequence ranges, dual-boundary timeline controls, evenly spaced image counts, and a separate “every source frame” mode are outside this initial scope. Image scaling applies equally to single-frame and sequence exports. Seek/checkpoint/tail optimizations are excluded from this scope; sequential resolution and bounded session reuse are the chosen approach.

The Interactive flow uses a position picker and text review. Image thumbnails, terminal image protocols, external viewer launches, and preview temporary sessions are outside this CLI scope. A web interface with visual scrubbing is a possible separate future direction. Playback editing, scene detection, and cropping are also excluded.

## Current Feature and Reusable Patterns

The following baseline was inspected on 2026-09-30:

| Existing surface                                                                                                  | Observed behavior                                                                            | Reuse direction                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Video commands](../../src/cli/commands/video.ts)                                                                 | Registers `convert`, `resize`, and `gif`; no `frames` command                                | Add a peer command without changing existing contracts                           |
| [GIF action](../../src/cli/actions/video.ts)                                                                      | Omitted output derives a `.gif` file beside the resolved input                               | Derive frame destinations from the input rather than the working directory       |
| [Video Interactive flow](../../src/cli/interactive/video.ts)                                                      | GIF offers default output or custom file path                                                | Keep the same destination-choice pattern                                         |
| [Rename template prompts](../../src/cli/interactive/rename/pattern.ts)                                            | Presets/custom templates, completion, and conditional serial prompts                         | Reuse the interaction and compatible filename validation                         |
| [PDF output review](../../src/cli/interactive/markdown/to-pdf/output-review.ts)                                   | Default/custom output, preparation, final review, and change actions                         | Resolve outputs before export and retain choices when revisiting review          |
| [Markdown command outputs](../../src/cli/commands/markdown.ts)                                                    | `--output` names a PDF/profile file or template/project directory according to the operation | Use one operation-aware output option                                            |
| [Duration parser](../../src/cli/options/codex-timeout.ts)                                                         | Positive integer `ms`/`s`/`m` syntax with request-specific bounds                            | Share duration language without inheriting the timeout cap                       |
| [Doctor inspection](../../src/cli/doctor/inspect.ts) and [Video workflow](../../src/cli/doctor/workflow/video.ts) | Inspect FFmpeg and derive Video readiness from its availability; no FFprobe check            | Add an FFprobe tool check and `video.frames` capability when implementing frames |
| [Path prompts](../../src/cli/prompts/path.ts)                                                                     | File/directory prompts and default/custom output choices                                     | Use explicit destination kinds and existing completion                           |
| [Terminal helpers](../../src/cli/tui/index.ts)                                                                    | Raw sessions, key parsing, cursor operations, and inline redraw support                      | Evaluate a small multi-line picker using the existing foundation                 |

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
  |           |
  |     Resolve exact source frame
  |
  `-- Sequence: whole video
        +-- FPS: presets / custom rate
        `-- Interval: suggestions / custom duration
              |
        Show estimated count and repetition notice
  |
  `-- Format -> Scale -> Default/custom destination -> Applicable naming
        `-- Text review -> Export / Change choices / Cancel
```

All single-frame methods resolve exact identity before final review. The wave updates a candidate position; Enter selects it and starts resolution. Show the requested position, resolved frame number, and actual frame start when reliable. Sequence review shows cadence, estimated image count, dimensions, destination, and naming examples.

Changing format, scale, destination, naming, or terminal layout retains the source and selection. Changing selection resolves the new request; changing the source clears its cached identities and timing validation. No image is generated merely to review a selection. Cancellation before export creates no final output; cancellation during export follows the partial-output rules below.

## Single-Frame Selection

First and last mean the first and final decoded source frames, not an estimate based on container duration and nominal FPS. Frame numbers are 1-based in CLI options, prompts, validation, and review information; frame 1 is the first frame. Any decoder's internal index conversion stays behind that interface. Filename serials describe export order, not source frame identity.

Custom selection must offer all three entry methods:

- Wave navigation for a coarse position within the full video.
- Frame-number input for a specific source frame.
- Timestamp input for a known position, with the valid time range displayed.

### Custom Selector Grammar

`--frame-number` accepts a positive, safely representable integer. Reject zero, negatives, decimals, and malformed values; source frame 1 is the first displayed frame. Frame numbers follow presentation order within the selected video stream, rather than packet/decode scheduling order. The upper bound is verified when resolving the request; unavailable metadata must not become an invented exact count.

`--at` accepts `HH:MM:SS[.mmm]`: at least two hour digits, exactly two minute/second digits in the range `00–59`, and an optional fraction of one to three digits. Hours may exceed 23 for long sources. Zero is valid as `00:00:00` or `00:00:00.000`. Bare numbers and duration-unit values are not timestamp inputs in this initial grammar. Keep the position grammar distinct from positive integer-unit intervals and integer/decimal FPS rates.

### Timestamp Mapping, Origin, and Stream

Select the frame visible at the requested time: the most recent source frame with a presentation start at or before the target. At an exact next-frame start, select that next frame. Between frame starts, retain the earlier frame; do not jump forward to a nearest future frame. The same mapping applies to FPS and interval targets; their cadence and repetition rules are specified below.

```text
Frame 1 starts at 00:00:00.000
Frame 2 starts at 00:00:00.040
Frame 3 starts at 00:00:00.120

Requested: 00:00:00.070
Selected: Frame 2 — actual position 00:00:00.040
```

The first displayed source frame defines video-relative time zero. Subtract its presentation start from source timestamps for user-facing positions; do not use an unrelated audio/container start as the origin. Show requested position, resolved source frame number, and actual frame start in text review when they differ. Preserve that frame identity for final output. Do not derive exact identity from nominal FPS, including for variable-frame-rate sources.

Prefer the default eligible video stream; otherwise choose the first eligible stream by stream index. Exclude attached pictures, thumbnails, and cover images. If multiple eligible streams are marked default, use the lowest stream index to keep selection deterministic. All single-frame and sequence operations use that same chosen stream for frame numbering, timing, dimensions, and extraction. Show the chosen stream in review when multiple eligible video streams exist. A manual stream-selection control is outside the initial scope.

Validate positions against the selected stream's known end: an explicit timestamp at or after that end is out of range, and `--last-frame` selects the actual final frame without an EOF timestamp guess. If timing/bounds cannot be established reliably, surface that limitation rather than silently clamping or manufacturing an exact mapping. Missing/ambiguous/non-monotonic presentation timing and buffered final frames require decoder verification; the design rules above are not runtime evidence.

Display an exact numeric frame upper bound only when verified. Otherwise say the exact count is unavailable and validate the requested frame when resolving it. Metadata estimates do not establish an exact upper bound. Follow the metadata-first, sequential resolution, and bounded session reuse policy below; correctness, resource limits, and performance still need verification.

The exported image must represent the resolved source frame identified in text review. Selection identity survives format, scale, destination, and layout changes. If frame-number selection is valid but presentation timing is unavailable, show the verified frame number and say the actual time is unavailable; do not manufacture a timestamp.

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
Position: 00:30.000
Timeline is a coarse overview. Use frame input for exact selection.
```

**Sketch only:** This illustrates the visual idea, not a required rendering. Final spacing, glyphs, bar counts, and heights should be determined through terminal prototyping.

Use the same thin stroke for selected and neighboring bars. Propose an orange/amber accent for the selected bar and triangles, and muted neighboring bars. The triangles and selection label retain position information without color. Follow [CLI output and color](../guides/cli-output-and-color.md) for styling controls and provide plain-character alternatives if the chosen glyphs cannot be rendered reliably.

### Controls and Precision Notice

Proposed controls are Left/Right to move one visible division, `F` for source frame input, `T` for timestamp input, Enter to select and resolve, and Escape to return. Home/End and previous/next source-frame refinement are candidates for a later prototype decision, not additional selection modes.

Show visible position count and approximate seconds per coarse step when duration is known. Label an unresolved wave position as a candidate; arrow movement does not claim an exact source frame. Directly entering a frame can place it between displayed positions: after resolution, highlight the nearest bar while retaining the exact frame and actual timestamp in the label. Subsequent coarse movement intentionally changes that selection. Triangles are indicators, not Up/Down controls.

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

Position: 00:30.000
F Frame   T Time   Enter Select
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

Preserve the requested cadence even when it exceeds source frame density. Allow repeated source-frame exports with distinct serials, and disclose that sampling does not create new visual content. Do not silently lower the rate, deduplicate images, or reject a valid rate merely because frames repeat. A synthetic one-second, constant-12-FPS source sampled at 24 FPS should produce 24 images from 12 distinct source frames.

FFmpeg's `fps` filter can duplicate/drop frames and has rounding/EOF settings.[^fps] Its defaults are not proof of the mapping specified below. Verify an appropriate configuration or another bounded forward-sampling path before choosing the backend.

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

An interval equal to or longer than a reliable positive selected-stream duration has one target at the start. For a usable source, allow the export with a clear notice rather than silently reducing the interval or rejecting it:

```text
Video duration: 8 seconds
Interval: 10 seconds

This interval produces one sampling position at the start
of the video. Only the first frame will be exported.
```

This remains sequence mode, with an image inside the sequence output folder. The number of images must not change the mode-aware meaning of `--output`. A near-duration interval that still gives two positions needs count information, not an extra warning merely because it is close to the end. If duration is only a metadata estimate, label the result “expected” and confirm the end during processing; do not present a one-image guarantee.

An interval is the time between successive sampling targets. With `2s`, targets advance from 0 to 2 to 4 seconds; with a zero interval, every target stays at 0, so no advancing cadence can be formed. Reject `0`, `0ms`, `0s`, and `0m`. This differs from a timestamp position of zero, which validly selects the start of the video.

When interval sampling is selected, require a supplied positive duration. Empty input, a missing value, `null`, and `undefined` do not provide that duration and must fail validation, including literal strings such as `"null"` or `"undefined"`. Do not coerce these values to zero or interpret them as automatic selection, every frame, or a hidden default. This requirement applies to interval mode; other selection methods do not require an interval. Suggested validation wording:

```text
Interval must be a positive duration greater than zero.
Use a positive integer followed by ms, s, or m:
1ms, 500ms, 2s, or 1m.
```

Interactive mode keeps invalid input in the editor and shows valid-input estimates or the one-image notice beside it and in the existing export review. Do not add a second confirmation step. Direct CLI invalid input fails before writing; a valid oversized interval prints the notice to stderr and proceeds, labeling metadata-based predictions as expected. When duration is unavailable, say the count estimate is unavailable and defer the comparison; do not treat unknown duration as zero or invent a one-image guarantee.

Millisecond input precision does not guarantee distinct source frames. Interval follows the same repetition policy as FPS: preserve cadence, export a separately numbered image for every valid target, and disclose repeated selections. Actual image counts and boundary behavior still require the synthetic verification below.

### Sampling Boundaries, Repetition, and Counts

Both methods use the first displayed frame as time zero. For output index `k = 0, 1, 2, …`, FPS targets are `k / rate`; interval targets are `k × interval`. Export targets strictly before the reliable selected-stream end. For 20 seconds at a 5-second interval, targets are 0, 5, 10, and 15 seconds. Do not append an extra final frame outside the cadence.

Map each target to the most recent source frame whose start is at or before it, using the same rule as custom timestamp selection. A later frame starting exactly at the target wins. Sparse/variable-rate sources can map several targets to one frame; keep all those images and assign consecutive export serials. Show a review notice such as “Sampling positions may select the same source frame; each position still exports an image.” Direct CLI prints the notice to stderr before processing. Use a stronger expected-repeat notice when reliable timing establishes it; otherwise do not claim an exact repeat count. Report actual images written and repeated selections on successful completion.

Preserve decimal FPS exactly as an internal rational value and intervals as integer milliseconds. Calculate each target from its index rather than repeatedly adding a floating-point step. Compare targets with integer source timestamps and their time base using checked exact arithmetic. Reject values that the chosen backend cannot represent safely, with a specific validation error; do not silently approximate a rate or round targets to whole milliseconds. The numeric/backend boundary still needs verification.

For non-final frames, the next presentation start defines the mapping boundary. Establish the final end from a reliable final-frame display duration or a corroborated selected-stream end. A container duration or nominal-FPS product alone is insufficient. If the final end cannot be established, stop with a timing-limitation error, retain any completed images, and report the export as incomplete; do not invent tail padding. A target exactly at the end is excluded.

Sequence timing is validated incrementally during forward processing. Missing, duplicate, or decreasing presentation starts stop the export with a clear timing error and a partial-output report. Successful completion requires clean EOF, buffered-frame handling, reliable end verification, and completed writes. This permits bounded processing without a mandatory full timing-validation pass before every sequence. Custom single-frame timestamp selection keeps its full initial ordering-validation requirement because it must establish one exact identity before review.

Counts derived from metadata stay labeled estimates. Show chronological filename examples and large estimated counts in the existing review; completion reports actual written images. A known reliable end establishes one target for an equal/longer interval, while an unverified duration only supports a preliminary estimate.

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

Treat source media as read-only. Reject any final target resolving to the source file, including detected symlink or hard-link aliases, regardless of `--overwrite`. Check before export and again before each final write, using canonical paths and available file identity rather than path strings alone. This applies to custom single-image paths and generated sequence targets.

Interactive single-frame selection may offer a custom folder as an explicit convenience: choose the directory, derive/review the image filename, and pass the resolved file path to the same export action. The directory choice does not change the direct CLI's single-image `--output` meaning. The single-frame default is `{stem}-frame` plus the selected format extension, such as `clip-frame.png`; source positions remain in text review.

Create missing final destination directories only after final export acceptance. Selection and text review need no temporary image folder. If the encoder/write implementation needs internal scratch files, keep their ownership separate from the source and final targets; cleanup must never remove saved exports or user-owned folders.

### Filename Presets and Tokens

Use serial-based numbered, prefixed-numbered, and custom template presets. Default sequence naming is `{stem}-{serial}` with start 1 and minimum width 6, producing `clip-000001.png`. The format supplies the extension; the template generates a basename.

| Token      | Proposed meaning                                                                             |
| ---------- | -------------------------------------------------------------------------------------------- |
| `{stem}`   | Input video's filename without extension                                                     |
| `{prefix}` | Optional supplied prefix                                                                     |
| `{serial}` | Chronological export order; configurable start, default 1; distinct from source frame number |

The initial filename language is limited to these existing placeholder families. Source frame numbers and timestamps remain available in review information. Chronological export order determines serials, including separate serials for repeated source-frame selections. Do not import rename's wall-clock naming, file modification/path ordering, or directory serial scope into video export.

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

Default overwrite is disabled. Validate template safety and uniqueness before export, check collisions for the known output set without decoding solely to discover its count, and enforce no-overwrite for each final target at write time. An unknown count can reveal a later collision; stop and report completed images rather than replacing it. A folder's existence alone is not permission to replace its contents.

Explicit overwrite applies only to generated target files. Never clear an existing folder or delete unrelated/stale files. A rerun with fewer images can leave older files beyond the new serial range; disclose this when reusing a nonempty folder. Suggest a fresh output folder when the user wants a clean sequence. Filename serials restart from the configured start on each invocation; retry/resume is outside this scope.

On failure or cancellation during export, report the output location and confirmed written count and retain completed images. Identify any known incomplete current file separately; it does not count as a completed image. Cleanup applies only to internal scratch files owned by the operation. The detailed process/write mechanism needs verification; no image-preview recovery session is part of this feature.

## Technical Feasibility and Dependencies

Repository review supports reusing the FFmpeg-backed command structure and small terminal helpers. It does not prove sequential resolution performance, multi-line picker behavior, or still-image encoder support.

| Question               | Evidence to gather                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Metadata and indexing  | Verify sequential stop conditions, bounded session reuse, invalidation, cancellation, and scan/render cost      |
| Stream and time origin | Verify default/first eligible stream selection, cover exclusion, and first-frame time-zero normalization        |
| Timestamp selection    | Verify most recent frame at/before the target, exact next-frame boundaries, and reported actual position        |
| Final frame            | Verify decoder EOF and buffered-frame handling instead of subtracting nominal frame duration                    |
| FPS and interval       | Verify specified cadence, repeated selection disclosure, exact arithmetic, ordering, and end behavior           |
| Image output           | Verify PNG/JPG/WebP availability, quality settings, odd sizes, orientation, and relevant pixel/color conversion |
| Terminal prompt        | Verify key ownership, multi-line redraw, resize, fallbacks, and restoration using existing helpers              |
| Doctor integration     | Verify independent executable checks, frames capability, Video states, remediation, and additive JSON fields    |

FFmpeg documents different input/output seek behavior; input seeking may land at an earlier seek point before decoding/discarding to the target.[^seek] FFprobe also warns that interval seeking may begin at a different position from the one requested.[^probe] These limitations support choosing resolution and extraction from the selected stream's beginning with the stopping rules below. No seek-path implementation or comparison is required by this research.

### Required Tools

Require both FFmpeg and FFprobe for all `video frames` methods, including first/last-frame export. FFmpeg performs extraction and image encoding; FFprobe supplies structured stream/frame information and can count decoded frames.[^probe] This is an agreed dependency contract for the proposed command, not an implemented check. Using one metadata backend avoids a second path that parses FFmpeg's human-readable output when FFprobe is absent.

Check both executables before source inspection or final writes. A missing/unusable tool should identify the dependency and provide installation/PATH guidance through the existing [dependency-check boundary](../../src/cli/deps.ts). Existing convert, resize, and GIF commands continue to require only FFmpeg. Tool availability does not guarantee that a particular source has trustworthy timing or a supported codec; the frames action must diagnose those source-specific limitations separately.

### Doctor Support for Frames

Add an independent FFprobe availability/version check using `ffprobe -version`, then reuse the existing inspect-once report for Summary, Details, and JSON. Doctor checks the installed tools without reading source media or building frame indexes. Keep the existing compact Video workflow grouping; a separate top-level FFprobe workflow is unnecessary.

| FFmpeg           | FFprobe          | `video.frames` capability | Compact Video state                                        |
| ---------------- | ---------------- | ------------------------- | ---------------------------------------------------------- |
| Available        | Available        | Available                 | Ready                                                      |
| Available        | Missing/unusable | Unavailable               | Limited — frames unavailable; convert/resize/GIF available |
| Missing/unusable | Available        | Unavailable               | Unavailable                                                |
| Missing/unusable | Missing/unusable | Unavailable               | Unavailable                                                |

Detailed output shows FFprobe availability and detected version as a separate tool entry. Missing FFprobe creates a required remediation action for frames, with wording such as “FFprobe is required for video frames; check its installation and PATH.” This action affects the existing Video grouping while naming the affected subcommand explicitly. When both tools are missing, retain both tool findings and combine shared installation guidance where appropriate. A version that cannot be parsed must remain visibly unknown rather than fabricated; minimum-version/build requirements, if needed, require evidence.

Extend the [normalized report](../../src/cli/doctor/report.ts) and [JSON projection](../../src/cli/doctor/json.ts) deliberately with `tools.ffprobe` and `capabilities["video.frames"]`. The new capability requires both tools; existing `video.convert`, `video.resize`, and `video.gif` capability values remain based on FFmpeg alone. Preserve existing field meanings and exit behavior; test the new fields as additive changes, including consumers/fixtures that previously assumed an exact tool/capability key set. Doctor readiness describes dependency availability, while source/encoder support remains checked during frames execution.

Keep runtime execution compatible with Node.js and extend the existing process boundary for the streaming requirements below. The existing inline renderer handles wrapping text; a mirrored multi-line wave needs its own layout verification.

Reference designs: tui-wave provides waveform navigation and zoom,[^tui-wave] CAVA illustrates terminal bar rendering,[^cava] and Ratatui has bar-chart examples.[^ratatui] These are design references, not chosen dependencies or exact implementations of the proposed distance-based picker.

## Streaming Frame Resolution

### Settled Execution Contract

Use one FFprobe/FFmpeg execution path for all frames methods:

| Responsibility | Chosen approach                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FFprobe        | Inspect required stream metadata and emit only required frame fields incrementally for the chosen stream                                                        |
| CLI            | Parse bounded records/queues, count presentation-order frames, preserve exact target arithmetic, and retain bounded verified identities                         |
| FFmpeg         | Decode the same selected stream from its beginning, extract the resolved single frame or process sequence cadence forward, and encode/write the selected format |

Tool arguments and record serialization must implement the existing frame-identity, cadence, timing, and end contracts. Use structured records; do not introduce a second metadata backend or parse human-readable diagnostics for identity/progress. The implementation prototype records the exact tested arguments and tool builds as verification evidence.

Adopt checked exact arithmetic for decimal-rate rational values, integer-millisecond intervals, and source timestamps/time bases. Values outside the implementation's supported representation receive specific validation errors. Unreliable timing or decoder failure follows the specified stop/partial-output rules; changing tool configuration must not silently approximate targets, clamp positions, or convert an incomplete scan into success.

This execution direction is settled. The verification work below proves that the selected tool configuration implements it; no successful runtime result is claimed here.

### Metadata, Counts, and Scan Stop Conditions

An exact count is the verified number of displayed source frames. An internal frame index links presentation-order numbers and start times; it need not contain the whole video or become an exported sidecar. Read lightweight eligible-stream metadata first, establish the first displayed frame's origin when needed, then resolve the requested operation. No full scan is required merely to enter the picker or move its highlight.

Container-reported counts remain unverified; duration multiplied by nominal FPS is never an exact count. Missing duration uses direct input instead of an invented full-span wave. An unavailable count does not prevent resolving a requested frame number; timestamps still require reliable timing.

| Operation                            | Required work                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter picker / move highlight        | Metadata inspection / candidate update; no full count or decoding per keypress                                                                            |
| First frame                          | Scan from the beginning; stop at the first displayed frame                                                                                                |
| Frame number N                       | Count displayed frames from the beginning; stop at the requested 1-based number                                                                           |
| Timestamp / interior wave position   | Initially validate timing through clean EOF; after verified ordering, stop at the first later start or EOF and keep the latest start at/before the target |
| Last frame / rightmost wave position | Scan through clean EOF, drain buffered frames, and retain the final displayed identity                                                                    |
| Sequence                             | Process cadence forward; validate timing incrementally, verify the end, and report actual completed writes                                                |

Streaming sequential resolution is the correctness baseline. Consume selected frame records incrementally in presentation order, keeping a running ordinal and the candidate/timing needed for the request. A target-stopped scan verifies only that prefix. Only successful EOF with buffered frames accounted for establishes an exact total; truncation or decoder failure cannot establish a valid final frame.

Early stopping for timestamp selection requires verified, strictly increasing presentation starts across the unchanged selected stream. On its first timestamp request, scan through clean EOF, validate starts, and retain the requested candidate. Missing, duplicate, or decreasing starts reject timestamp selection; offer explicit frame-number input instead of sorting or guessing. Cache successful ordering validation for later requests. Metadata and an observed prefix alone do not prove full-stream ordering.

Near-end selection and initial timestamp validation can be costly on long sources. Moving the wave stays independent of decoding. Identity resolution and final image extraction may require separate passes; measure their combined cost. Cached identity avoids repeating its resolution, but does not guarantee an immediate export.

### Resolution Flow

Single-frame flow; direct CLI supplies configuration and skips Interactive review:

```text
Select first / last / frame N / time
                  |
       Recheck source and stream
                  |
       Verified identity cached?
             /         \
           Yes          No
            |            |
            |   Scan from beginning
            |   - first / frame N: stop at target
            |   - time: clean EOF initially;
            |     first later start if ordering verified
            |   - last: clean EOF + buffered frames
            |            |
            |   Verify identity; recheck source
            |   Cache valid result
            |            |
            +------+-----+
                   |
         Configure format / scale / output
                   |
               Text review
                   |
         Recheck source -> Export -> Finish

Changed source -> Invalidate reuse; require fresh selection
Scan failure   -> Report limitation; return or stop
Cancel scan    -> Stop children; await exit; return or stop
```

**Sketch only:** This shows processing decisions, not a literal screen layout. Interactive failure/cancellation returns to selection; direct CLI reports the outcome and stops. Any detected source change stops the current resolution/export and requires fresh selection. Export failure/cancellation follows the partial-output rules, including preservation of completed images.

### Session Cache and Source Changes

Keep a bounded in-memory cache of minimal verified identities and timing-validation state. Key reuse by canonical source path, selected stream, and available file identity, size, and modification information. Recheck before reuse, after scanning, and before export; source/stream changes invalidate both identities and ordering validation. These checks detect observable file changes; they do not guarantee immutability against undetectable changes during decoding.

Format/scale changes retain identity. Evict older entries at the limit and resolve a cache miss again. Do not cache decoded image buffers or retain a full-video frame table. Persistent indexes and disk caches remain outside this scope.

### Large Sources and Resource Limits

Do not adopt a blanket input-file-size cap such as 2 GB. Existing [video actions](../../src/cli/actions/video.ts) pass the source path to FFmpeg, and [file validation](../../src/cli/actions/shared.ts) checks existence/type without imposing a size cap. Source bytes affect I/O; duration, frame count, resolution, codec, bit depth, and decoder buffering also affect work and memory. The frames design must stream the source through its tools instead of copying/loading the entire file into the CLI.

Adopt these initial internal defaults for the implementation prototype. They are policy choices to verify and calibrate, not measured performance guarantees:

| Resource                                  | Initial default                                    |
| ----------------------------------------- | -------------------------------------------------- |
| Minimal cached frame identities           | 128 records per Interactive session                |
| Initial selected-field metadata response  | 1 MiB                                              |
| Individual streamed frame/progress record | 64 KiB                                             |
| Retained diagnostic stderr                | Last 64 KiB, with a truncation notice              |
| Cooperative child termination grace       | 2 seconds, then force termination if still running |

Metadata limits apply to selected fields, not arbitrary embedded tags or thumbnails. Frame-record streams may exceed 1 MiB cumulatively; consume them incrementally with bounded queues/backpressure. Limit failures identify the exhausted resource, stop affected processing, and preserve completed outputs. Do not label every limit failure “video too large.” These initial defaults come from this design discussion. Change a default only when recorded measurements justify it, preserving bounded-state and failure-reporting requirements.

CLI record/cache limits do not cap FFmpeg/FFprobe memory. The decoder policy is to apply a per-image pixel guard consistently in both tools. Establish and record its numeric value and supported-build behavior during implementation verification, including acceptance below the limit and a specific failure above it. FFmpeg documents `max_pixels` as a per-image guard against very large images.[^codec-limits] Treat decoder buffering and peak child-process memory separately. Output scaling happens after decoding in the usual pipeline, so it can reduce image encoding/storage costs without guaranteeing lower decode memory.[^pipeline]

Review estimated image count and effective dimensions before export. If storage estimation is available, label its assumptions and uncertainty; do not perform extra image extraction solely to manufacture an estimate. For illustration, one hour at 24 FPS is approximately 86,400 images; assuming 2 MiB per image would require approximately 169 GiB. Actual image sizes depend on content and encoding. These values are synthetic planning examples, not a restriction or measured result.

Check available space on the destination volume, and on any scratch volume actually used by the implementation, where the platform exposes it. Known insufficient space should give a specific error; an uncertain estimate is informational. Recheck/report write failures because free space can change. No extra confirmation or silent changes to cadence/scale are needed.

For excessive output/storage cost, offer ordinary choices: lower FPS, a longer interval, smaller output scale, or another format. Those choices may still require decoding the full source. Decoder-memory failures can suggest a separately prepared lower-resolution source; it becomes a new source with its own frame numbering. Do not promise that output scaling or a preliminary resize always makes an otherwise undecodable source usable.

Long work remains cancellable; do not inherit the Codex per-request timeout or introduce an unmeasured universal scan-duration cap. Disk-full, decoder, parser-limit, and encoding failures stop processing with specific diagnostics and the actual completed-output report.

### Processing Phases and Progress

Use applicable phases: inspect source, resolve one frame or validate sequence timing, export image(s), and finish. Sequence timing validation, selection, encoding, and writing can share one forward phase. Reusing verified timestamp ordering should say “Timing validation reused”; it must not imply a new scan ran.

```text
Inspect source
  |
  +-- Single -> Resolve identity -> Text review -> Export image
  |
  `-- Sequence -> Review settings -> Decode / sample / encode / write
                                                     |
                                                Verify EOF/end
  |
  `-- Finish: confirm writes and process exit -> Report actual result
```

Process bounded batches within the continuing stream. Global frame numbers, time origin, cadence index, and filename serials carry across batches. This is an internal consumption strategy, not a requirement to split the source into physical clips or start a process for every exported image. Batching does not establish checkpoints or resume support.

Show phase progress with its basis: inspected frames toward frame N, elapsed media position against an available duration, or confirmed images written against an estimated count. Label metadata-based percentages approximate; do not invent an overall weighted percentage across phases. Unknown totals use a spinner, count, and elapsed time. Show an ETA only when the basis is stable enough, and keep it an estimate.

Illustrative synthetic layouts:

```text
Checking video timing
Media scanned: 04:00 / approximately 10:00 (~40%)
Frames inspected: 5,760
Elapsed: 00:18     Esc Cancel

Exporting images
Images written: 960 / approximately 2,400
Elapsed: 00:32     Esc Cancel
Output: ./clip-frames/
```

Inspected source frames and written images are different units. Count an image only after its completed write is confirmed; encoding counters alone are not proof. Reaching an estimated total shows “Finishing” until required EOF/end validation, writes, and process exit are confirmed. Do not show successful 100% or announce completion solely because an estimate was reached.

Use FFmpeg's structured `-progress` records and `-stats_period` where appropriate; they provide periodic key/value updates.[^progress] FFprobe scan progress comes from parsed frame records. Start with approximately two UI updates per second, then verify responsiveness and output volume. Terminal progress adapts to available space; non-interactive output uses throttled plain stderr lines, leaving stdout for the final result. Avoid parsing human-readable FFmpeg statistics as the progress contract.

The current [process helper](../../src/cli/process.ts) buffers complete stdout/stderr and exposes no cancellation signal. Extend that execution boundary for incremental parsing, bounded diagnostics/queues, progress, and cancellation while preserving Node.js compatibility. These are required implementation capabilities, not existing behavior.

### Cancellation and Partial Output

Run at most one resolution/export operation in a flow. Escape cancels the active Interactive operation; direct CLI interruption also stops every child owned by that operation. Show “Stopping…” while requesting termination, applying the initial grace/force policy, and waiting for confirmed child exit and stream closure. Sending a kill signal alone does not prove termination.[^child-cancel] Verify supported-platform behavior and a bounded forced-exit confirmation deadline; never start a replacement scan while an earlier child may still be running. If termination cannot be confirmed, report the failure and stop the flow.

Restore terminal input/cursor state after cancellation, failure, or completion. A cancelled resolution returns to selection without final writes. A cancelled export retains completed images, reports their count/location and any known incomplete file, and allows Interactive choices to be revisited only after children have stopped. Success requires confirmed processing and writes; cancellation is reported as cancellation, never as a successful shorter sequence. Internal scratch cleanup cannot delete source media or completed exports.

## Verification and Research Completion Criteria

### Public Reproducible Evidence

Generate small synthetic videos on demand with visible frame numbers, timestamps, and distinct start/end markers. Keep expected values independent of the extraction algorithm; a fixture generator should establish counts and positions in advance.

| Case                                      | Required observation                                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One second, 24 constant-FPS source frames | 24-FPS export writes 24 images, ordered correctly                                                                                                                                              |
| One second, 12 constant-FPS source frames | 24-FPS export writes 24 images from 12 distinct source frames, with disclosed repetition                                                                                                       |
| First/last and frame-number selection     | Export matches the known labeled source frame; number 1 selects first                                                                                                                          |
| Timestamp between frames                  | Select the most recent frame starting at/before the target; an exact next-frame start selects that next frame                                                                                  |
| Variable FPS/non-zero timestamps          | No nominal-FPS indexing assumptions; time origin and repeated targets are handled                                                                                                              |
| Interval presets/custom input             | Expected cadence, first target, end behavior, and actual counts                                                                                                                                |
| Formats and scaling                       | Files decode in the selected format; dimensions and recognizable content are correct                                                                                                           |
| Destination and naming                    | Default/custom paths, unique names, overwrite boundaries, and partial failures                                                                                                                 |
| Full/compact/fallback picker              | Alignment and precise selection survive resize and entry-method changes                                                                                                                        |
| Keyboard lifecycle                        | Cancel/finish/error restore input/cursor state; the next ordinary prompt works                                                                                                                 |
| Invalid combinations                      | Conflicting methods and invalid values fail before final writes                                                                                                                                |
| Duration language                         | Presets normalize to integer-unit values; invalid/repeated intervals fail; timeout caps are not copied                                                                                         |
| Interval limits and notices               | `1ms` minimum, zero/empty/missing/null/undefined input rejection, near/equal/longer duration feedback, unknown-duration handling, and one-image sequences retaining folder output              |
| Mode-aware output                         | One output option resolves to the correct file/directory kind; wrong existing kinds receive clear errors                                                                                       |
| Metadata and indexing                     | No mandatory full scan at picker entry or highlight movement; estimates distinguished from verified counts; exact identity, bounded reuse, invalidation, and cancellable scans                 |
| Sequential resolution                     | Target/prefix/EOF stop conditions, buffered final frames, decoder failure, bounded cache eviction, and source-change checks                                                                    |
| Frames dependencies and doctor            | Both tools required for every frames method; all four availability combinations, three doctor projections, scoped remediation, unchanged existing video capabilities, and additive JSON fields |

Selector, rate, and naming verification should also cover:

- Positive integer source frame numbers, invalid zero/decimal values, and upper-bound resolution without invented counts.
- Timestamp grammar: valid zero, hours above 23, one-to-three fractional digits, invalid minute/second fields, rejected bare numbers/duration units, and known-end rejection.
- Labeled starts at 0, 40, and 120 ms: 70 ms selects frame 2 at 40 ms, while exactly 120 ms selects frame 3. Verify shifted/negative source timestamps and presentation order with buffered decoding.
- Multiple streams: eligible default selection, lowest-index default ties, fallback to the first eligible stream, and attached-picture/thumbnail/cover exclusion.
- Integer/decimal FPS acceptance, fraction-expression rejection, invalid-rate errors, and preservation of the supplied rate during internal conversion.
- Stem/prefix/serial presets, conditional rename-style controls, parameter order, flag-over-token-over-default precedence, zero serial start, minimum width, no-effect serial flags without a serial placeholder, and rejection of duplicate/ordering/scope controls.
- Chronological serial identity, growth beyond the minimum width, repeated-source uniqueness, and duplicate custom-name errors.
- Source protection: direct, canonical-parent, symlink, and hard-link output aliases are rejected with and without overwrite; the original source remains intact.

Use exact pixel/content assertions where appropriate for lossless output; lossy JPG/WebP verification should use suitable tolerances rather than identical file hashes. Test real key input and resize transitions, not just static wave snapshots. Confirm that text review and exported content identify the same source frame, and that selection/review launches no viewer or thumbnail generation.

Verify sequential resolution using labeled synthetic sources with variable FPS, reordered/buffered frames, shifted timestamps, and known final markers. Include source replacement/modification, malformed/truncated input, and out-of-range requests. Seek/checkpoint/tail implementations and comparative benchmarks are outside the verification workload.

For timestamp ordering, include a later frame whose start falls back below the target after an earlier frame has passed it, as well as duplicate and missing starts. The first request must validate through EOF and reject unreliable timing instead of returning the earlier candidate. Verify cached successful ordering, subsequent early stopping, and ordering-state invalidation after source/stream changes.

Sampling verification must cover sparse/variable starts, targets exactly at boundaries, final-frame duration, unknown or conflicting stream ends, decimal rates, very small intervals, and numeric conversion limits. Successful sequences preserve all targets and report actual repeats; invalid timing/end detection reports incomplete processing and retained images.

Progress/resource verification must cover phase changes, estimated totals reached before EOF, unknown totals, media progress distinct from completed-write counts, terminal/non-terminal output, resize, saturated queues, oversized records, disk-full errors, and a child that ignores cooperative termination. Verify no source-size-only rejection, no source copying into CLI memory, and global ordinals/cadence/serials across batch boundaries. Internal scratch, if needed, requires separate ownership and cleanup checks.

### Implementation Verification

The execution path and initial internal defaults are settled decisions. Complete the following verification work in order and record public synthetic evidence:

1. Generate labeled constant/variable-rate sources with independently known frame identities, timing boundaries, and final frames. Include sparse starts, shifted timestamps, reordered/buffered output, and invalid timing.
2. Record the exact FFprobe/FFmpeg argument sets, required record fields/serialization, and tool builds. Prove that both tools agree on the selected stream and presentation-order identity, and that extraction implements the specified cadence and reliable-end rules.
3. Exercise numeric boundaries, parser/queue pressure, cache eviction, oversized metadata/records, diagnostic truncation, decoder/timing failure, and cooperative/forced cancellation. Prove that limit failures stop processing and preserve/report completed outputs.
4. Measure first and cached requests, near-end/last-frame resolution, and whole-video sequence export across generated durations, frame rates, dimensions, and codecs. Record scan/extraction latency and parent/child peak memory separately; verify that CLI-held frame data remains bounded as stream length grows. Measurements describe tested cases, not universal speed or process-memory guarantees.
5. Confirm or calibrate the listed defaults with that evidence. Establish the decoder pixel-guard value consistently in both tools, test below/above its boundary, and record the supported builds and forced-exit confirmation deadline.

Configuration and budget verification must pass before claiming those runtime contracts are supported or closing this research. Report a failing prototype case as a verification gap; do not silently change selection/sampling semantics. These tasks require no alternative seek strategy.

### Local Visual Review and Privacy

Use suitable local-only source material to inspect picker usability and real-video results. Retain local exported images, sequence contact sheets, terminal captures, and a short outcome checklist for development review. Keep sources and derived review artifacts in an ignored local area and confirm they are untracked before retaining them there.

Public research, plans, job records, examples, and PR text must omit private source names, fixture identifiers/locations, source-specific metadata, captured content, and derived images. Publish synthetic reproducible evidence and generic manual review outcomes only. Local source review supplements public verification; it must not become a required CI fixture or the sole support for a correctness claim.

### Completion Criteria

The research is sufficiently answered when selection/sampling/output questions are resolved with evidence, a terminal prototype validates the layouts and fallbacks, real tool experiments establish the extraction/format/scale boundary, and the supported dependency strategy is recorded. Cite public reproducible evidence directly or link the relevant execution records before closing research. Drafting and document review alone do not meet those criteria. No prototype or runtime verification results are claimed by this document.

## Open Questions

Remaining unsettled details:

- Terminal layout breakpoints, glyph fallbacks, step sizes, and optional refinement keys.
- PNG/JPG/WebP encoder availability, quality option naming/grammar and defaults, display orientation, dimension rounding, and pixel/color conversion.
- Mechanisms for confirming completed writes, enforcing collision protection across platforms, checking volume space, and terminating all owned tool processes.

Settled direction includes the command/selectors and their grammar, source-relative timestamp mapping, eligible-stream choice, whole-video FPS/interval scope, cadence-preserving repeated selection, exact target arithmetic, reliable-end boundaries, serial naming/defaults, mode-aware output, collision/rerun policy, FFmpeg/FFprobe requirements and doctor projections, one structured FFprobe/FFmpeg execution path, sequential streaming resolution, initial internal defaults and their verification steps, bounded in-memory reuse, large-source handling without a blanket size cap, phase progress, cancellation, and partial-output retention. Image preview and seek/checkpoint/tail optimizations are outside this CLI scope.

Product decisions and starting prototype limits are recorded above; they are not runtime verification. Configuration/resource measurements are tracked under Implementation Verification rather than as open design questions. Document review does not establish measured costs, backend compatibility, or platform behavior.

## Recommendations and Next Steps

Retain this focused scope and `draft` status while the unresolved details are investigated. First prototype the wave with synthetic duration/selection state, then verify exact extraction and sampling using generated labeled videos. Complete the specified implementation-verification tasks and investigate the remaining open details without changing existing video behavior.

Once evidence supports a concrete contract, create an implementation plan with reciprocal `Related Plans` / `Related Research` links. The plan should cover shared streaming extraction/sampling, bounded resource handling and progress/cancellation, command/Interactive integration with text review, FFprobe checks and doctor projections, output ownership, focused verification, and a current usage guide. A later shipped guide should own the reader-facing contract; this research owns rationale and feasibility evidence.

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

[^codec-limits]: [FFmpeg codecs: max_pixels](https://ffmpeg.org/ffmpeg-codecs.html#Codec-Options).

[^pipeline]: [FFmpeg command documentation: transcoding and filtering](https://ffmpeg.org/ffmpeg.html#Detailed-description).

[^progress]: [FFmpeg command documentation: progress and stats period](https://ffmpeg.org/ffmpeg.html#Main-options).

[^child-cancel]: [Node.js child processes: kill and termination](https://nodejs.org/api/child_process.html#subprocesskillsignal).
