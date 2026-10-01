---
title: "Video Frame Selection, Frame Sets, and Sequence Export"
created-date: 2026-09-30
modified-date: 2026-10-01
status: in-progress
agent: codex
---

## Goal, Scope, and Settled Direction

Research `cdx-chores video frames` for extracting one source frame, a fixed frame set, or a whole-video sequence of still images. The feature should support direct CLI invocation and a guided Interactive flow, with PNG, JPG, and WebP output.

This research is in progress. Repository observations below describe the implementation baseline; new command examples, prompts, defaults, and algorithms are proposals unless identified as agreed direction or verified implementation. Accepted Phases 1–7, including verified backend image/sequence export, destinations/naming, private processing, direct CLI/doctor and guided Interactive integration, are recorded in the [implementation record](../plans/jobs/2026-10-01-video-frames-implementation.md). Phase 8's integrated verification, documentation and research closure remain pending.

Agreed direction from the design discussion:

| Area                   | Direction                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Command                | `video frames`; “frame picker” names the Interactive selection control                                |
| Single-frame selectors | Explicit `--first-frame` and `--last-frame`, plus custom selection                                    |
| Frame-set picker       | Fixed first + last or first + middle + last presets; resolve all selected identities before review    |
| Custom selection       | Fixed wave timeline, source frame-number input, and timestamp input                                   |
| Wave appearance        | Mirrored bars; highlighted tallest selected bar; inward-pointing triangles above and below            |
| Terminal adaptation    | Fit full/compact mirrored layouts by usable rows/columns; preserve selection in direct-input fallback |
| Sequence               | Whole video, sampled by FPS or interval; interval has guided suggestions and custom input             |
| Outputs                | Default beside the source, or custom `--output`; selection determines file versus folder              |
| Interval language      | Positive integer plus lowercase `ms`, `s`, or `m`, matching existing duration syntax                  |
| Review                 | Text review of resolved frame identity or sequence settings; export after acceptance                  |
| Dependencies           | FFmpeg and FFprobe required for every `frames` selection method; doctor checks both                   |
| Counts and indexing    | Metadata first; streaming sequential baseline; bounded session reuse; cancellable scans               |
| Sampling policy        | Preserve requested cadence; disclose repeated source-frame selections                                 |
| Large sources          | No blanket size cap; bounded records/cache, resource diagnostics, and phase progress                  |
| Quality                | `low` / `medium` / `high` / `full`, default `full`; PNG supports only `full`                          |
| Color                  | Source-faithful conversion; no look selector or creative color adjustments                            |
| Scaling                | Preserve displayed aspect ratio; presets and custom scale within `0.1–1`                              |
| Evidence               | Reproducible public synthetic cases and private local visual review                                   |

Naming uses a normalized source `{stem}`, named `{selection}` labels for single frames/frame sets, optional verified source `{frame}` numbers, and export `{serial...}` values for sequences. Sequence templates require one serial; the default start is 1 and minimum width is 6. FPS input uses positive integers or ordinary decimals; users do not enter fraction expressions. These input/naming choices are agreed direction. Backend extraction and sampling have passed the scoped synthetic checks in the [implementation record](../plans/jobs/2026-10-01-video-frames-implementation.md); direct CLI and guided Interactive integration are accepted in Phases 6–7. A timestamp index sidecar is outside this initial scope.

Custom sequence ranges, dual-boundary timeline controls, arbitrary image-count sampling, and a separate “every source frame” mode are outside this initial scope. The two fixed frame-set presets are included; format, quality, color, and scale apply uniformly within every export. Seek/checkpoint/tail optimizations are excluded from this scope; sequential resolution and bounded session reuse are the chosen approach.

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

The [GIF look configuration](../../src/cli/video-gif.ts) separates `faithful` (`format=rgba`) from `vibrant` saturation, contrast, brightness, and channel adjustments. Its quality path also generates and applies a palette with dithering. Frames should reuse the source-faithful intent, while still-image encoding has its own conversion requirements. Existing [GIF action tests](../../test/video/actions/gif.app.test.ts) verify arguments and lifecycle through a fake tool; they do not establish pixel/color fidelity for frame export.

[Filename languages](../guides/patterns-placeholders-and-templates.md) have feature-specific semantics. Reusing their UI does not imply that every rename placeholder or ordering option is meaningful for extracted frames.

## Command Surface and Interactive Flow

### Direct CLI Contract

Use `frames` with single-frame selectors `--first-frame`, `--last-frame`, `--frame-number`, and `--at`, fixed presets through `--frame-set`, or FPS/interval sampling. Reuse `-o, --output`. Multi-image naming uses `--pattern`; sequence serial controls follow rename terminology. Interactive single-image naming resolves a final file path for the same export action. Quality uses `--quality low|medium|high|full`, defaults to `full`, and permits only `full` for PNG; tested native mappings and encoder support boundaries are recorded in [Phase 4](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-4). Direct and guided Interactive command integration implement these contracts, with scoped verification in Phases 6–7.

| Option                    | Proposed role                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `-i, --input <path>`      | Source video                                                                                 |
| `--first-frame`           | First decoded frame of the selected video stream                                             |
| `--last-frame`            | Final decoded frame of that stream                                                           |
| `--frame-number <number>` | Positive integer source-frame number, starting at 1                                          |
| `--at <timestamp>`        | Video-relative position in `HH:MM:SS[.mmm]` form; zero is valid                              |
| `--frame-set <preset>`    | Fixed `first-last` or `first-middle-last` selection                                          |
| `--fps <rate>`            | Whole-video sequence sampled at a positive integer or decimal images-per-second rate         |
| `--interval <duration>`   | Whole-video sequence sampled at a positive integer duration with lowercase `ms`, `s`, or `m` |
| `--format <format>`       | PNG, JPG, or WebP                                                                            |
| `--quality <preset>`      | `low`, `medium`, `high`, or `full` (default); PNG accepts only `full`                        |
| `--scale <factor>`        | Finite factor within `0.1–1`, inclusive                                                      |
| `-o, --output <path>`     | Final image file for one frame; output folder for a frame set or sequence                    |
| `--pattern <template>`    | Frame-set or sequence basename template using the mode-specific placeholders below           |
| `--serial-start <number>` | Sequence export serial start: non-negative integer, default 1                                |
| `--serial-width <digits>` | Sequence minimum digit width: positive integer, fallback 6                                   |
| `--overwrite`             | Explicit permission to replace conflicting output files                                      |

Require exactly one selection method: one single-frame selector, one `--frame-set` preset, or one FPS/interval method. Presets cannot be combined with individual selectors or sampling options; combining `--first-frame` and `--last-frame` is still invalid. Validate explicit invalid values instead of silently substituting defaults. Missing selection should explain the supported choices without starting a picker. Direct single-frame CLI uses `--output` for an explicit filename and rejects naming flags; `--serial-start`/`--serial-width` apply only to sequences. Interactive templates for one image are the explicit convenience described below.

Implemented direct CLI examples:

```text
cdx-chores video frames -i ./clip.mp4 --first-frame
cdx-chores video frames -i ./clip.mp4 --last-frame
cdx-chores video frames -i ./clip.mp4 --frame-number 25
cdx-chores video frames -i ./clip.mp4 --at 00:00:12.500
cdx-chores video frames -i ./clip.mp4 --frame-set first-last
cdx-chores video frames -i ./clip.mp4 --frame-set first-middle-last --output ./clip-frames/
cdx-chores video frames -i ./clip.mp4 --frame-set first-last --pattern '{stem}-{selection}-frame'
cdx-chores video frames -i ./clip.mp4 --fps 24
cdx-chores video frames -i ./clip.mp4 --fps 23.976
cdx-chores video frames -i ./clip.mp4 --interval 2s
cdx-chores video frames -i ./clip.mp4 --first-frame --output ./cover.png
cdx-chores video frames -i ./clip.mp4 --first-frame --format png --quality full
cdx-chores video frames -i ./clip.mp4 --first-frame --format jpg --quality high --scale 0.5
cdx-chores video frames -i ./clip.mp4 --fps 24 --format webp --quality full
cdx-chores video frames -i ./clip.mp4 --fps 24 --output ./clip-frames/
cdx-chores video frames -i ./clip.mp4 --fps 24 --pattern '{stem}-{serial}' --serial-width 6
```

### Interactive Proposal

```text
Video -> Frames -> Select source video
  |
  +-- One frame
  |   First / Last / Custom: wave, frame number, or timestamp
  |   Resolve one exact source identity
  |
  +-- Frame set
  |   First + last / First + middle + last
  |   Resolve every role; show repeated selections if present
  |
  `-- Sequence: whole video
      FPS presets/custom / Interval suggestions/custom
      Show estimated count and repetition notice

Format -> Quality (JPG/WebP) -> Scale -> Destination -> Applicable naming
Text review -> Export / Change choices / Cancel
```

Single frames and frame sets resolve exact identities before final review. The wave updates a candidate position; Enter selects it and starts resolution. Show the requested position, resolved frame number, and actual frame start when reliable. Review includes format, quality, dimensions, destination, and concrete filenames. Frame-set review lists each role and its resolved identity; sequence review also shows cadence and estimated count.

Changing format, quality, scale, destination, naming, or terminal layout retains the source and selection. Changing selection resolves the new request; changing the source clears its cached identities and timing validation. No image is generated merely to review a selection. Cancellation before export creates no final output; cancellation during export follows the partial-output rules below.

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

Select the frame visible at the requested time: the most recent source frame with a presentation start at or before the target. At an exact next-frame start, select that next frame. Between frame starts, retain the earlier frame; do not jump forward to a nearest future frame. The same mapping applies to the frame-set midpoint and FPS/interval targets; their rules are specified below.

```text
Frame 1 starts at 00:00:00.000
Frame 2 starts at 00:00:00.040
Frame 3 starts at 00:00:00.120

Requested: 00:00:00.070
Selected: Frame 2 — actual position 00:00:00.040
```

The first displayed source frame defines video-relative time zero. Subtract its presentation start from source timestamps for user-facing positions; do not use an unrelated audio/container start as the origin. Show requested position, resolved source frame number, and actual frame start in text review when they differ. Preserve that frame identity for final output. Do not derive exact identity from nominal FPS, including for variable-frame-rate sources.

Prefer the default eligible video stream; otherwise choose the first eligible stream by stream index. Exclude attached pictures, thumbnails, and cover images. If multiple eligible streams are marked default, use the lowest stream index to keep selection deterministic. All single-frame, frame-set, and sequence operations use that same chosen stream for frame numbering, timing, dimensions, and extraction. Show the chosen stream in review when multiple eligible video streams exist. A manual stream-selection control is outside the initial scope.

Validate positions against the selected stream's known end: an explicit timestamp at or after that end is out of range, and `--last-frame` selects the actual final frame without an EOF timestamp guess. If timing/bounds cannot be established reliably, surface that limitation rather than silently clamping or manufacturing an exact mapping. Unreliable timing rejection and buffered final-frame handling passed the cases recorded in [Phase 3](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-3); broader source-codec behavior requires equivalent evidence.

Display an exact numeric frame upper bound only when verified. Otherwise say the exact count is unavailable and validate the requested frame when resolving it. Metadata estimates do not establish an exact upper bound. The metadata-first, sequential resolution, and bounded session reuse policy has scoped correctness/resource evidence in [Phase 3](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-3). Heavy real-content performance, minimum-Node execution, and other platforms remain unverified.

The exported image must represent the resolved source frame identified in text review. Selection identity survives format, scale, destination, and layout changes. If frame-number selection is valid but presentation timing is unavailable, show the verified frame number and say the actual time is unavailable; do not manufacture a timestamp.

## Fixed Frame Sets

The frame-set picker offers two presets, also available through `--frame-set <preset>`:

| Preset              | Ordered positions   | Image count |
| ------------------- | ------------------- | ----------- |
| `first-last`        | First, last         | 2           |
| `first-middle-last` | First, middle, last | 3           |

This is a preset selector, not an editable range or wave picker. Values must be one of these two names; a missing/invalid argument fails validation. Custom position lists and arbitrary image counts remain outside scope.

First and last use the actual decoded endpoint frames. Middle targets exactly half the reliable video-relative duration `D / 2`, using checked timestamp/time-base arithmetic and the existing frame-at-time rule. Its selected frame may start earlier than the midpoint; review shows the target and actual start. Middle is defined by duration, not half the source-frame count.

Resolve every role before review or final writes. First + last requires clean EOF and buffered-frame handling, but does not require reliable presentation timing. First + middle + last additionally requires validated strictly increasing starts and a reliable end. If those cannot be established, fail the whole preset and offer first + last or custom single selection; do not silently export a reduced set.

Retain the requested two or three outputs when roles select the same source frame, including a one-frame video. Assign distinct selection-label names and disclose the repeated identities. All outputs share the selected format, quality, and scale; later encoding/write failure uses the common partial-output rules.

Endpoint resolution scans through EOF. If a reliable end is already available, retain the midpoint candidate during that scan. Otherwise establish the end first, then resolve the midpoint in another forward pass using the verified ordering. Revalidate any earlier duration against the scan's reliable end; if it changes, resolve the new midpoint before review. Reuse only verified results for an unchanged source. Progress and cancellation apply to every pass; no full frame table or per-image process is needed.

## Wave Picker and Adaptive Terminal Layout

The layout selection, glyph fallback, coarse movement, and controls below are settled direction. Renderer geometry and terminal behavior passed the real-terminal prototype cases recorded in [Phase 1](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-1). Production integration and the dedicated TUI review passed the scoped terminal cases in [Phase 7](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-7); the sketches are not fixed screen layouts.

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
Positions: 9 | Step: ~7.5s
Timeline is a coarse overview. Use frame/time input for precision.
Left/Right Move   F Frame   T Time
A ASCII   Enter Select   Esc Back
```

**Sketch only:** This illustrates the visual idea, not a required rendering. Prototype the exact spacing, bar counts, heights, and wrapping within the settled fit/selection rules below.

Use the same thin stroke for selected and neighboring bars. An orange/amber accent highlights the selected bar and triangles, with muted neighboring bars; markers and labels retain selection information without color. Follow [CLI output and color](../guides/cli-output-and-color.md): global color settings remove styling without changing selection, controls, wording, or layout behavior.

### Glyphs and Fallback

Prefer the Unicode drawing `▼ │ ▲`. The wave's `A` control toggles the drawing to ASCII `v | ^` and back, replacing corresponding markers/bars while preserving geometry and exact selection. Keep the glyph choice for the current Interactive frames flow across redraws, input-editor round trips, and full/compact layout changes. Show `A ASCII` when Unicode is active and `A Unicode` when ASCII is active.

Automatic font/glyph-support detection is outside this scope. The explicit toggle provides a predictable fallback; disabling color does not switch glyphs. Both drawings use the same thin bars and preserve their mirrored halves. Direct-input layouts have no wave or glyph-toggle control.

### Controls and Precision Notice

| Control      | Behavior while the wave is active                                           |
| ------------ | --------------------------------------------------------------------------- |
| Left / Right | Move to the preceding/following visible timeline position in that direction |
| `F`          | Open source frame-number input                                              |
| `T`          | Open timestamp input                                                        |
| `A`          | Toggle Unicode/ASCII wave glyphs                                            |
| Enter        | Select the current candidate and resolve its source-frame identity          |
| Escape       | Return to the selection choices without starting an export                  |

Accept either letter case for `F`, `T`, and `A`. Bind these controls only while the wave is active. Frame/time editors own their input and cursor keys; letters are entered as text there. Enter submits the editor's selector through the normal resolution flow, and Escape cancels the editor and returns to the wave with the previous selection and glyph choice intact. Suspend wave handlers while an editor or resolution operation owns input. Resolution cancellation follows the existing scan rules. Whole-flow interruption follows normal cancellation and terminal restoration.

Skip Home/End, modified-key acceleration, and previous/next source-frame refinement in this scope. First/last remain dedicated selection choices, and frame/time input supplies precision. The triangles are indicators rather than Up/Down controls.

For a known positive duration `D` and `N` visible positions, positions are `k × D / (N − 1)` for `k = 0 … N − 1`. A usable wave has at least three positions: both endpoints and an interior position. Show the position count and approximate division time `D / (N − 1)`; 60 seconds with 21 positions gives approximately three seconds per division.

Left/Right chooses the nearest visible position strictly before/after the current requested position. At an endpoint, movement further outward leaves the selection unchanged; it never wraps. An exact frame/time input can lie between visible positions: display the nearest indicator while retaining the actual request or resolved identity. A subsequent arrow intentionally replaces that selection with the next coarse position in its requested direction.

Label unresolved positions as candidates; arrow movement does not establish an exact frame number. Show resolved frame identity and actual start when available. The leftmost wave position selects the first source frame; the rightmost uses last-frame semantics and shows the final frame's actual start after resolution. A duration label at the right edge does not make an EOF timestamp valid for explicit `--at` input. Use the endpoint selection role when navigating rather than turning the right-edge marker into an explicit EOF timestamp. If a resolved frame number has no reliable time, retain that identity and use direct input instead of inventing a wave position.

### Adaptive Layout and Fallback

Measure usable columns and rows on the stream that renders the picker. Reserve space for source/duration labels, selection details, controls, notices, and the precision warning before sizing the wave. Count actual display widths and wrapped rows; character count alone does not establish fit. Keep all essential instructions visible.

Try the full mirrored layout, then a compact mirrored layout with fewer bars/height levels, then direct frame/time input. A wave candidate must fit both dimensions, both markers/halves, and at least three visible positions. This fit rule replaces guessed fixed terminal-size breakpoints.

| Condition                                                                                                                 | Presentation                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Full layout and reserved content fit                                                                                      | Full mirrored wave                                                             |
| Full fails, compact layout and reserved content fit                                                                       | Compact mirrored wave                                                          |
| Neither wave fits                                                                                                         | Direct frame/time input with selection information and range/precision notices |
| Usable dimensions are unavailable, simple-prompt mode is selected, or raw input is unsupported in an Interactive terminal | Direct frame/time input using existing simple prompts                          |
| Duration is unavailable/unusable                                                                                          | Direct input; timestamp selection still requires reliable timing               |
| No interactive terminal                                                                                                   | Direct CLI options; no attempted visual prompt                                 |

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
Positions: 7 | Step: ~10s
Coarse timeline; use frame/time input for precision.
Left/Right Move
F Frame   T Time   A ASCII
Enter Select   Esc Back
```

**Sketch only:** This compact version illustrates the same idea; its dimensions and character arrangement are not a fixed layout. Instructions may wrap as long as the complete layout still fits.

Resize changes presentation only: preserve the requested selector and any resolved identity, recalculate visible positions/step information, and project the same selection onto its nearest indicator. First/last selection roles stay anchored to their endpoints; their labels show actual decoded starts. Custom frame identities use their reliable start times for projection. Do not round or replace the selection during projection. Restore a richer layout when it fits again. Direct-input fallback keeps the selection and glyph preference so returning to a wave retains both.

Redraw only on state/layout changes; arrow movement, glyph toggling, and resize do not start video decoding. If an editor is active during resize, retain its draft and input ownership; redraw the picker after control returns. Restore terminal input and cursor visibility on completion, cancellation, or failure.

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

Millisecond input precision does not guarantee distinct source frames. Interval follows the same repetition policy as FPS: preserve cadence, export a separately numbered image for every valid target, and disclose repeated selections. Actual counts and boundaries passed the independent synthetic cases recorded in [Phase 5](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-5); direct and Interactive reporting have scoped verification in Phases 6–7.

### Sampling Boundaries, Repetition, and Counts

Both methods use the first displayed frame as time zero. For output index `k = 0, 1, 2, …`, FPS targets are `k / rate`; interval targets are `k × interval`. Export targets strictly before the reliable selected-stream end. For 20 seconds at a 5-second interval, targets are 0, 5, 10, and 15 seconds. Do not append an extra final frame outside the cadence.

Map each target to the most recent source frame whose start is at or before it, using the same rule as custom timestamp selection. A later frame starting exactly at the target wins. Sparse/variable-rate sources can map several targets to one frame; keep all those images and assign consecutive export serials. Show a review notice such as “Sampling positions may select the same source frame; each position still exports an image.” Direct CLI prints the notice to stderr before processing. Use a stronger expected-repeat notice when reliable timing establishes it; otherwise do not claim an exact repeat count. Report actual images written and repeated selections on successful completion.

Preserve decimal FPS exactly as an internal rational value and intervals as integer milliseconds. Calculate each target from its index rather than repeatedly adding a floating-point step. Compare targets with integer source timestamps and their time base using checked exact arithmetic. Reject values that the chosen backend cannot represent safely, with a specific validation error; do not silently approximate a rate or round targets to whole milliseconds. The checked numeric boundaries and exact cadence behavior passed the unit/Node cases recorded in [Phases 3–5](../plans/jobs/2026-10-01-video-frames-implementation.md).

For non-final frames, the next presentation start defines the mapping boundary. Establish the final end from a reliable final-frame display duration or a corroborated selected-stream end. A container duration or nominal-FPS product alone is insufficient. If the final end cannot be established, stop with a timing-limitation error, retain any completed images, and report the export as incomplete; do not invent tail padding. A target exactly at the end is excluded.

Sequence timing is validated incrementally during forward processing. Missing, duplicate, or decreasing presentation starts stop the export with a clear timing error and a partial-output report. Successful completion requires clean EOF, buffered-frame handling, reliable end verification, and completed writes. This permits bounded processing without a mandatory full timing-validation pass before every sequence. Custom single-frame timestamp selection keeps its full initial ordering-validation requirement because it must establish one exact identity before review.

Counts derived from metadata stay labeled estimates. Show chronological filename examples and large estimated counts in the existing review; completion reports actual written images. A known reliable end establishes one target for an equal/longer interval, while an unverified duration only supports a preliminary estimate.

## Image Formats and Output Scaling

PNG is the default format, with JPG and still WebP alternatives. Quality, source-faithful color, transparency, orientation, and dimension rules below are settled direction. Concrete encoder/filter configurations passed the initial 8-bit SDR and transform cases in [Phase 4](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-4), with additional alpha support boundaries recorded in Phase 5. Broader color/source paths remain unverified. WebP here is one still image per cadence target, not an animated sequence file.

### Encoder Availability

Check the selected format's encoder and requested mode before extraction/final writes. Interactive choices explain unavailable formats/modes; direct CLI reports an actionable error. Both paths retain the requested format and quality rather than substituting another encoder behavior. In particular, WebP `full` requires a verified lossless mode. Doctor separately reports executable availability and advertised encoder capabilities; its inspection does not establish actual encoding or pixel fidelity.

### Quality Presets

Use one `--quality <preset>` option with canonical values `low|medium|high|full`. The default is `full` for both single-frame and sequence export. Normalize letter case and surrounding whitespace following existing option-value parsing, then require one supported preset. Reject numeric/custom values, unknown names, empty values, and a missing argument to an explicit option rather than substituting a default. `lossless` describes encoding behavior; it is not a second CLI preset or alias.

| Format | Accepted presets                | Meaning of `full`                                                          | Review label for `full`            |
| ------ | ------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| PNG    | `full` only                     | Lossless PNG encoding of the post-transform pixels                         | Full (lossless)                    |
| JPG    | `low`, `medium`, `high`, `full` | Highest supported image quality for the selected JPEG encoder; still lossy | Full (highest JPEG quality; lossy) |
| WebP   | `low`, `medium`, `high`, `full` | Lossless WebP encoding                                                     | Full (lossless)                    |

For JPG/WebP, `low`, `medium`, and `high` select increasing lossy-quality presets with encoder-specific mappings. These are named tradeoffs, not percentages or a claim that two formats produce equivalent fidelity or file sizes. WebP `full` explicitly selects lossless encoding rather than merely increasing a lossy quality number; FFmpeg's WebP encoder supports both modes.[^webp-quality]

PNG compression preserves the pixel values supplied to its encoder.[^png-lossless] Resizing, color conversion, or bit-depth conversion before encoding can change those values. `full` therefore describes image encoding, not preservation of the original video's encoded data or the absence of image transformations.

Keep PNG compression separate from the user-facing quality preset. Use a fixed internal compression policy with FFmpeg's documented compression level 9 as the initial setting; this controls encoding effort/file size while retaining lossless pixels.[^png-compression] Verify its cost during encoder experiments. The initial scope exposes no compression-level, palette-reduction, or custom numeric-quality control; `full` remains PNG's sole quality value.

Interactive mode skips the quality selector for PNG and shows `Quality: Full (lossless)` in final review. JPG/WebP offer all four choices, initially selecting `full`; review identifies lossless/lossy behavior. If a user switches to PNG from a lower-quality setting, resolve the quality to `full` and show that effective value; source-frame identity stays unchanged.

Direct CLI accepts an explicit PNG `--quality full` or its omitted default. PNG with `low`, `medium`, or `high` fails validation before extraction/final writes with wording such as “PNG supports only --quality full; choose JPG or WebP for lower-quality presets.” Do not ignore an incompatible quality setting or silently change format.

Quality applies uniformly to every output in a single-frame, frame-set, or sequence export. Scale remains independent: `--quality full --scale 0.5` exports a half-size image using that format's full-quality encoding behavior. Confirm that the selected encoder supports the requested behavior before final writes; unavailable lossless WebP must not fall back to lossy output.

### Source-Faithful Color and Transparency

Frame export preserves the source's intended appearance through necessary pixel/color conversion, without creative adjustments. Expose no color-look option or Interactive styling prompt. Do not add saturation, contrast, brightness, or channel boosts, and do not reuse GIF palette generation or palette dithering. `--quality` controls encoding fidelity and `--scale` controls size; neither selects a color style.

Honor reliable source matrix, range, primaries, and transfer metadata during conversion; output color metadata must describe the encoded pixels. Selecting `format=rgba` alone specifies a pixel representation, not a complete color-management policy.[^image-color] When color fields are missing, use only the tested, documented interpretation of the supported FFmpeg conversion path and disclose inferred values in review/CLI diagnostics. Conflicting metadata or an unsupported conversion produces a specific error rather than a silent color reinterpretation. HDR-to-SDR tone mapping and archival preservation of source bit depth/profiles are outside this scope; a source that requires such a transformation fails clearly.

Preserve non-opaque alpha in PNG and WebP using a supported encoder mode. JPG accepts opaque selected frames, including opaque frames stored in an alpha-capable format. If a selected frame has non-opaque pixels, report that JPG cannot preserve transparency and suggest PNG/WebP; do not choose a background or discard alpha. For a frame set or sequence, a later incompatible frame stops export and retains completed images under the partial-output contract.

The initial backend rejects sources that declare alpha when the default decoded format does not expose it. Its supported FFmpeg WebP `full` path also rejects fully transparent pixels because it cannot preserve their hidden RGB values; PNG preserves exact RGBA in that case. These are explicit unsupported-path failures, with no decoder/format substitution or weakening of lossless semantics. Independent synthetic verification is recorded in the [Phase 5 execution record](../plans/jobs/2026-10-01-video-frames-implementation.md#phase-5).

Source-faithful describes visual intent, not identical decoded values across formats. Lossy encoding, chroma sampling, scaling, and required representation conversion can change pixels; lossless `full` compares against the agreed post-transform reference.

### Output Scaling

Proposed size menu for a synthetic 1920 × 1080 source:

| Choice             | Factor             | Output dimensions                      |
| ------------------ | ------------------ | -------------------------------------- |
| Original (default) | 1                  | 1920 × 1080                            |
| Three-quarter      | 0.75               | 1440 × 810                             |
| Half               | 0.5                | 960 × 540                              |
| Quarter            | 0.25               | 480 × 270                              |
| Custom             | `0.1–1`, inclusive | Calculated and shown before acceptance |

First establish the square-pixel displayed image: normalize a reliable source sample aspect ratio (pixel width versus height), then apply supported display rotation/reflection once. For normalization, retain decoded height and use `max(1, floor(decoded width × sample aspect ratio + 0.5))` for width. When the ratio is unspecified, assume `1:1` and disclose “Pixel aspect ratio unavailable; assuming square pixels” in review and direct CLI diagnostics. An explicitly invalid or conflicting ratio fails rather than receiving that fallback; interpret FFprobe's unspecified-value markers according to its documented representation. Support quarter-turn rotations and horizontal/vertical reflections; reject unsupported display transforms rather than changing framing. FFmpeg applies autorotation at the filtering stage, so verify transform order and avoid applying it twice.[^image-orientation] Saved pixels and review dimensions must agree; remove/reset orientation metadata that would repeat the transform in a viewer.

Use one scale factor for both displayed dimensions, rounding each with `max(1, floor(dimension × scale + 0.5))`. Keep the entire image and displayed aspect ratio subject to this integer rounding. Do not round to even dimensions, crop, or pad silently; an unsupported encoder size receives an explicit error. For example, square-pixel 101 × 51 at half scale becomes 51 × 26. One selected scale applies throughout a frame set or sequence, with effective dimensions shown in review.

`--scale 1` preserves displayed size. Pixel-aspect normalization can increase the stored width to represent that size correctly; this is separate from user upscaling, which remains unavailable. Verify aspect correction with FFmpeg's square-pixel scaling support.[^image-scaling] Validate computed dimensions against the applicable pixel guard and encoder constraints. A later frame-set or sequence image that cannot satisfy these rules stops with completed outputs retained.

## Output Destinations and Filename Templates

### Destinations

Defaults for a synthetic input `./videos/clip.mp4`:

| Mode      | Default destination       | Meaning of `--output` |
| --------- | ------------------------- | --------------------- |
| One frame | `./videos/clip-frame.png` | Final image file      |
| Frame set | `./videos/clip-frames/`   | Output folder         |
| Sequence  | `./videos/clip-frames/`   | Output folder         |

Defaults are beside the selected source; custom relative paths resolve from the invocation's working directory. Use one operation-aware `--output`, following existing GIF/PDF and template/project conventions. Selection determines file versus folder, including a one-image sequence. Reject an existing path of the wrong kind; do not infer kind from extension, trailing separator, or existence.

Treat source media as read-only. Reject any final target resolving to the source file, including detected symlink or hard-link aliases, regardless of `--overwrite`. Check before export and again before each final write, using canonical paths and available file identity rather than path strings alone. This applies to explicit single-image paths and every generated frame-set/sequence target.

Interactive one-frame destination choices are default location, custom folder with a generated filename, or an explicit image file. The first two use the naming controls below; an explicit file skips templates and shows “Naming: Explicit filename.” Pass the resolved file path to the same single-image action. Changing its naming requires returning to a generated-filename choice. Frame sets and sequences choose default/custom folders and always review generated names.

Create missing destinations and owned staging only after final export acceptance. Text selection/review creates no image folder. Cleanup must never remove source media, completed exports, or user-owned folders.

### Explicit Image Filenames and Format

The selected format determines the encoded image: direct CLI uses `--format`, defaulting to PNG when omitted, and Interactive uses its format choice. An explicit single-image filename must have a matching final extension, compared case-insensitively: `.png` for PNG, `.jpg` or `.jpeg` for JPG, and `.webp` for WebP. The `.jpeg` extension does not add a `--format jpeg` alias. Generated filenames use `.png`, `.jpg`, or `.webp`.

Reject missing, unsupported, or mismatched extensions before extraction or final writes. Keep explicit paths literal: do not infer the format from the extension, append an extension, or rename the target. Explain how to correct the filename or select its matching format. For example:

| Direct single-frame options                  | Result                                                        |
| -------------------------------------------- | ------------------------------------------------------------- |
| `--output cover.png`                         | PNG, using the default format                                 |
| `--output cover.jpg`                         | Error: select `--format jpg` or use a `.png` filename           |
| `--format jpg --output cover.JPEG`           | JPG; preserve the explicit filename's spelling                 |
| `--format webp --output cover.png`           | Error: filename extension conflicts with the selected format   |
| `--output cover` or `--output cover.gif`     | Error: require an extension supported by the selected format   |

Interactive validates an explicit filename against its format choice and shows the error at the destination prompt. If a later format change makes the retained filename incompatible, require a corrected filename or matching format before export acceptance. Generated names update their extension when the format changes. These filename checks do not apply to frame-set/sequence output folders or Interactive custom folders; selection still determines destination kind.

### Stem and Placeholder Meaning

Resolve `{stem}` once from the selected input video's basename: remove its final extension, apply [rename's filename normalization](../../src/utils/slug.ts), then take the first 48 characters, matching the [rename planner](../../src/cli/rename/planner/index.ts). Normalization uses NFKD, removes non-ASCII characters, lowercases, converts non-alphanumeric runs to hyphens, trims edge hyphens, and falls back to `file` if empty. Use the source filename, without a generated title or output-folder substitution. Thus `My Trip.v2.mp4` resolves to `my-trip-v2` for every image from that source.

| Placeholder   | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `{stem}`      | Shared normalized source-video name                                |
| `{selection}` | Requested selection label, independent of source frame number      |
| `{frame}`     | Verified 1-based source-frame number, independent of export serial |
| `{serial...}` | Sequence export order, independent of source frame number          |

`{selection}` is a named label, not a timestamp, percentage, or source frame number. For one frame it is `first`/`last` for the dedicated selectors and `custom` for wave/frame-number/timestamp selection, even if the result is an endpoint. Frame sets use their preset's `first`, `middle`, and `last` labels. FPS/interval sequences use serials for every output; they do not assign these labels. Review shows exact source frame numbers/times when available; optional `{frame}` also includes the verified frame number in a generated filename.

`{frame}` is the actual presentation-order source ordinal: count displayed frames from the selected stream's beginning, with the first frame numbered 1. FPS multiplied by duration estimates a total; it cannot establish this identity. Timestamp/wave selections use the resolved frame's ordinal, and last-frame selection uses the final ordinal verified through clean EOF and buffered-frame handling.

Single frames and frame sets reuse identities already resolved before review. Sequences resolve the ordinal incrementally for each sampled image under the shared streaming contract; naming adds no full-count pass. If identity cannot be verified, stop rather than substituting an FPS estimate, requested time, or export counter. `{frame}` renders an unpadded decimal such as `25`, accepts no parameters, and is unaffected by serial start/width settings.

### Naming Rules by Export Mode

| Mode                       | Available placeholders             | Required naming token     | Default template           |
| -------------------------- | ---------------------------------- | ------------------------- | -------------------------- |
| Single frame (Interactive) | `{stem}`, `{selection}`, `{frame}` | None                      | `{stem}-frame`             |
| Frame set                  | `{stem}`, `{selection}`, `{frame}` | `{selection}`             | `{stem}-{selection}-frame` |
| Sequence                   | `{stem}`, `{serial...}`, `{frame}` | Exactly one `{serial...}` | `{stem}-{serial}`          |

Every sequence template must contain exactly one `{serial...}` placeholder, including parameterized forms. This applies even when the cadence exports only one image; the output stays a sequence folder. Single-frame and frame-set templates reject serial placeholders, and their CLI modes reject serial flags. Frame sets require `{selection}` to distinguish their named images. Sequences reject `{selection}`. `{frame}` is optional in every generated-name mode and replaces neither requirement: two roles or cadence targets can resolve to the same source frame.

These requirements are validated before export, with messages such as “Sequence template must contain exactly one {serial...} placeholder” or “{selection} is available only for single-frame and frame-set naming.” Missing tokens are errors; do not silently append a serial or label.

Direct CLI `--pattern` configures frame sets or sequences. Direct single-image naming uses the final `--output` file path; Interactive generated-name templates resolve that same file path. An explicit image file bypasses template controls and its path is literal, subject to the [filename/format validation](#explicit-image-filenames-and-format) above. Custom template grammar is shared across modes; permitted values and required tokens follow the table.

For generated names, the template constructs a basename and the selected format appends its extension. Validate safe, unique names and filesystem length limits; do not silently alter names to avoid collisions. Reject unknown/malformed placeholders, path components, duplicate serials/parameters, and rename `order_*` modifiers. Source date/time tokens, serial ordering, and directory scope remain outside this filename language.

Interactive mode offers default and custom templates appropriate to the mode. Follow [rename's template interaction](../guides/rename-common-usage.md#pattern-and-template-usage): completion includes only permitted tokens and serial prompts appear only for sequences. Templates may contain literal text. Show only applicable controls and display the resolved stem, effective template/settings, and concrete names before acceptance. Normalize rendered separators using rename's basename rules and show the actual result.

### How Naming Works

1. Check the template's allowed and required tokens for the selected export mode.
2. Resolve the shared source stem, optional verified source frame number, and the per-image selection label or sequence serial.
3. Render/normalize the basename and append the selected format's extension.
4. Validate names and collisions in the chosen destination; Interactive mode reviews full filenames before acceptance. A sequence with an unknown final count continues checks per output.

Source identity and export order are separate. For example, a custom single-frame pick of source frame 25 defaults to `clip-frame.png`; the second sampled image may come from source frame 49 and is named `clip-000002.png` with default serial settings. Serial values never stand in for source frame numbers. The optional token can expose both values, as these illustrative custom templates show:

```text
Single frame 25: {stem}-frame-{frame}
  clip-frame-25.png

Frame-set middle resolving to frame 25: {stem}-{selection}-frame-{frame}
  clip-middle-frame-25.png

Second sampled image resolving to frame 49: {stem}-{serial}-frame-{frame}
  clip-000002-frame-49.png
```

The default templates below remain unchanged.

```text
Source: My Trip.v2.mp4
Stem:   my-trip-v2

One frame: {stem}-frame
  my-trip-v2-frame.png

Frame set: {stem}-{selection}-frame
  my-trip-v2-first-frame.png
  my-trip-v2-middle-frame.png
  my-trip-v2-last-frame.png

Sequence: {stem}-{serial}
  my-trip-v2-000001.png
  my-trip-v2-000002.png
```

### Sequence Serial Grammar

Share rename's start/width syntax and parameter-order independence:

| Form                    | Meaning without explicit flags |
| ----------------------- | ------------------------------ |
| `{serial}`              | Start 1, minimum width 6       |
| `{serial_####}`         | Start 1, minimum width 4       |
| `{serial_start_3}`      | Start 3, minimum width 6       |
| `{serial_####_start_3}` | Start 3, minimum width 4       |

Resolve each setting as explicit `--serial-start`/`--serial-width`, then an embedded parameter, then frames defaults of 1/6. Interactive effective values follow the same precedence; opening a prompt does not overwrite an embedded parameter. Width input is a digit count, such as `3`, rather than `###`. Start accepts a non-negative safe integer; width accepts a positive safe integer within basename limits. Zero is a valid export serial start while source frame numbers begin at 1.

Serials follow sampling/export order, including separate serials for repeated source frames. Width is a minimum and grows with the current serial's digits; earlier filenames remain unchanged. Unlike [rename's known-batch padding](../../src/cli/rename/planner/serial.ts), streaming frames do not scan for a final count solely to calculate uniform padding. Detect unsafe serial increments and filename-length exhaustion before writing; do not import path/mtime ordering or directory scope.

### Review, Collisions, and Partial Output

```text
Sequence export review
Scope: Whole video
Sampling: 24 FPS
Images: Approximately 24
Format: PNG
Quality: Full (lossless)
Scale: 0.5 — 960 × 540
Folder: ./clip-frames/
First name: clip-000001.png
Last name: clip-000024.png (estimated)
Overwrite: Disabled

Export images / Change sampling / Change format/quality / Change size / Change output / Change naming / Cancel
```

Default overwrite is disabled. Validate safe, unique names and check known targets before export without scanning solely to discover the final count. The publication operation below enforces collisions again at write time. A later collision stops the export and reports completed images; an existing folder does not grant overwrite permission.

`--overwrite` permits replacing conflicting output files selected by the current export: the resolved single-image target, including an explicit `--output` filename, or generated frame-set/sequence targets. Source-protection rules still apply. Never clear an existing folder or delete unrelated/stale files. A rerun with fewer images can leave older files beyond the new serial range; disclose this when reusing a nonempty folder. Suggest a fresh output folder when the user wants a clean sequence. Filename serials restart from the configured start on each invocation; retry/resume is outside this scope.

On failure or cancellation, retain completed images and report their count/location. Identify an incomplete current file separately; it does not count as written. Cleanup removes only owned scratch after tool shutdown is confirmed.

### Completed Writes and Publication

```text
Encode -> Complete staged image -> Publish final file -> Written count +1
```

Stage images in an owned private directory on the destination volume. Establish completion through the writer's successful close or FFmpeg's completed-file rename; FFmpeg's image muxer provides `atomic_writing` for the latter.[^image-write] Progress counters, file existence, or stable size alone do not establish completion.

The initial staging limits are two image files and 256 MiB of encoded image data in total, including a file being written. Reserve a file slot before starting an image and enforce the byte limit during streamed writes. When capacity is full, apply backpressure while publishing/removing completed staged files. If one image exceeds the byte limit or capacity cannot be released safely, stop with a staging-limit error and retain published images. The writer must enforce these limits; an uncontrolled encoder-to-directory spool does not satisfy the contract. These are disk-staging limits, separate from source size and CLI/decoder memory.

Publish completed images in selection order: one target for a single frame, preset role order for a frame set, or serial order for a sequence. Repeat source-alias and target-kind checks immediately before publication:

- **No overwrite:** link the completed staged file to the final target where supported, following [template output's staging pattern](../../src/cli/markdown-pdf/template/init-service.ts). If hard links are unsupported, exclusively create the final file (`O_EXCL`) and stream-copy into it. A collision stops processing; it never triggers the fallback. An interrupted copy leaves a reported incomplete file.
- **Explicit overwrite:** replace the selected final target from its completed staging file, whether its filename is explicit or generated. If safe replacement fails, stop; do not delete the existing target to make replacement succeed.
- **Written count:** increment only after publication succeeds and any copy handle closes successfully. Scratch cleanup never reverses that count. This confirms ordinary file saving; it does not promise durability through a power failure.

Exclusive creation must enforce the destination's no-overwrite contract. Record supported filesystem behavior, including case-insensitive names and network-filesystem limitations; fail where that protection cannot be provided.[^file-publication] Preserve the existing source-alias, folder ownership, and partial-output rules. Overall success also requires the specified EOF/end validation and tool closure.

## Technical Feasibility and Dependencies

Repository review supports reusing the FFmpeg-backed command structure and small terminal helpers. It does not prove sequential resolution performance, multi-line picker behavior, or still-image encoder support.

| Question               | Evidence to gather                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Metadata and indexing  | Verify sequential stop conditions, bounded session reuse, invalidation, cancellation, and scan/render cost   |
| Stream and time origin | Verify default/first eligible stream selection, cover exclusion, and first-frame time-zero normalization     |
| Timestamp selection    | Verify most recent frame at/before the target, exact next-frame boundaries, and reported actual position     |
| Final frame            | Verify decoder EOF and buffered-frame handling instead of subtracting nominal frame duration                 |
| FPS and interval       | Verify specified cadence, repeated selection disclosure, exact arithmetic, ordering, and end behavior        |
| Image output           | Verify the settled encoder, quality, source-faithful conversion, alpha, orientation, and dimension contracts |
| Terminal prompt        | Verify key ownership, multi-line redraw, resize, fallbacks, and restoration using existing helpers           |
| Doctor integration     | Verify independent executable checks, frames capability, Video states, remediation, and additive JSON fields |

FFmpeg documents different input/output seek behavior; input seeking may land at an earlier seek point before decoding/discarding to the target.[^seek] FFprobe also warns that interval seeking may begin at a different position from the one requested.[^probe] These limitations support choosing resolution and extraction from the selected stream's beginning with the stopping rules below. No seek-path implementation or comparison is required by this research.

### Required Tools

Require both FFmpeg and FFprobe for all `video frames` methods, including first/last-frame export. FFmpeg performs extraction and image encoding; FFprobe supplies structured stream/frame information and can count decoded frames.[^probe] This is an agreed dependency contract for the proposed command, not an implemented check. Using one metadata backend avoids a second path that parses FFmpeg's human-readable output when FFprobe is absent.

Check both executables before source inspection or final writes. A missing/unusable tool should identify the dependency and provide installation/PATH guidance through the existing [dependency-check boundary](../../src/cli/deps.ts). Existing convert, resize, and GIF commands continue to require only FFmpeg. Tool availability does not guarantee that a particular source has trustworthy timing or a supported codec; the frames action must diagnose those source-specific limitations separately.

### Doctor Support for Frames

Add an independent FFprobe availability/version check using `ffprobe -version`. When FFmpeg is available, separately inspect its advertised PNG, JPG, and still-WebP encoder capabilities, including WebP lossless mode. Run bounded inventory/encoder-help probes once per inspection and reuse the normalized result for Summary, Details, and JSON. Check exact encoder names and mode options; a build flag, decoder entry, help exit status, or incidental mention of an option does not establish encoder support. Doctor reads no source media, builds no frame indexes, and generates no images. Keep the existing compact Video workflow grouping; a separate top-level FFprobe workflow is unnecessary.

The table describes base executable availability. Encoder findings refine the compact state without changing those availability values:

| FFmpeg           | FFprobe          | `video.frames` capability | Compact Video state                                        |
| ---------------- | ---------------- | ------------------------- | ---------------------------------------------------------- |
| Available        | Available        | Available                 | Ready                                                      |
| Available        | Missing/unusable | Unavailable               | Limited — frames unavailable; convert/resize/GIF available |
| Missing/unusable | Available        | Unavailable               | Unavailable                                                |
| Missing/unusable | Missing/unusable | Unavailable               | Unavailable                                                |

Detailed output shows FFprobe availability and detected version as a separate tool entry. Missing FFprobe creates a required remediation action for frames, with wording such as “FFprobe is required for video frames; check its installation and PATH.” This action affects the existing Video grouping while naming the affected subcommand explicitly. When both tools are missing, retain both tool findings and combine shared installation guidance where appropriate. A version that cannot be parsed must remain visibly unknown rather than fabricated; minimum-version/build requirements, if needed, require evidence.

Extend the [normalized report](../../src/cli/doctor/report.ts) and [JSON projection](../../src/cli/doctor/json.ts) deliberately with `tools.ffprobe` and `capabilities["video.frames"]`. The new capability describes availability of both tools; existing `video.convert`, `video.resize`, and `video.gif` capability values remain based on FFmpeg alone. Preserve existing field meanings and exit behavior; test the new fields as additive changes, including consumers/fixtures that previously assumed an exact tool/capability key set.

Add separate format/mode assessments to the normalized report and JSON rather than overloading executable availability or existing capability booleans. With both tools available, a missing required image encoder or lossless mode makes Video `limited`, naming the affected frames format/mode and recommending an encoder-enabled FFmpeg build. Known absence is a health finding; an operational probe failure follows the existing exit-2/no-partial-report contract and must not be reported as unsupported. An assessment that cannot be established from otherwise successful probe output remains visibly unknown. Advertised support is not tested encoding or pixel-fidelity evidence. Frames execution rechecks its requested encoder/mode before extraction and final writes; source-dependent support remains an execution check.

Keep runtime execution compatible with Node.js. The adjacent streaming process boundary has closure, cancellation, and backpressure evidence in [Phases 3–4](../plans/jobs/2026-10-01-video-frames-implementation.md). The mirrored multi-line wave passed Phase 1 prototype layout checks and Phase 7 production integration/terminal checks. Minimum-Node execution and other platforms remain unverified.

Reference designs: tui-wave provides waveform navigation and zoom,[^tui-wave] CAVA illustrates terminal bar rendering,[^cava] and Ratatui has bar-chart examples.[^ratatui] These are design references, not chosen dependencies or exact implementations of the proposed distance-based picker.

## Streaming Frame Resolution

### Settled Execution Contract

Use one FFprobe/FFmpeg execution path for all frames methods:

| Responsibility | Chosen approach                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FFprobe        | Inspect required stream metadata and emit only required frame fields incrementally for the chosen stream                                                               |
| CLI            | Parse bounded records/queues, count presentation-order frames, preserve exact target arithmetic, and retain bounded verified identities                                |
| FFmpeg         | Decode the same selected stream from its beginning; extract resolved single/frame-set identities or process sequence cadence forward; encode/write the selected format |

Tool arguments and record serialization must implement the existing frame-identity, cadence, timing, and end contracts. Use structured records; do not introduce a second metadata backend or parse human-readable diagnostics for identity/progress. The implementation prototype records the exact tested arguments and tool builds as verification evidence.

Adopt checked exact arithmetic for frame-set midpoints, decimal-rate rational values, integer-millisecond intervals, and source timestamps/time bases. Values outside the implementation's supported representation receive specific validation errors. Unreliable timing or decoder failure follows the specified stop/partial-output rules; changing tool configuration must not silently approximate targets, clamp positions, or convert an incomplete scan into success.

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
| Frame set                            | Resolve endpoints through clean EOF; middle also validates timing/end and may require another forward pass; retain only needed identities                 |
| Sequence                             | Process cadence forward; validate timing incrementally, verify the end, and report actual completed writes                                                |

Streaming sequential resolution is the correctness baseline. Consume selected frame records incrementally in presentation order, keeping a running ordinal and the candidate/timing needed for the request. A target-stopped scan verifies only that prefix. Only successful EOF with buffered frames accounted for establishes an exact total; truncation or decoder failure cannot establish a valid final frame.

Early stopping for timestamp selection requires verified, strictly increasing presentation starts across the unchanged selected stream. On its first timestamp request, scan through clean EOF, validate starts, and retain the requested candidate. Missing, duplicate, or decreasing starts reject timestamp selection; offer explicit frame-number input instead of sorting or guessing. Cache successful ordering validation for later requests. Metadata and an observed prefix alone do not prove full-stream ordering.

Near-end selection and initial timestamp validation can be costly on long sources. Moving the wave stays independent of decoding. Identity resolution and final image extraction may require separate passes; measure their combined cost. Cached identity avoids repeating its resolution, but does not guarantee an immediate export.

### Resolution Flow

Single-frame flow; frame sets follow the same source checks/review/export lifecycle with all preset roles resolved as specified above. Direct CLI supplies configuration and skips Interactive review:

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
| Owned image staging files                 | 2 files, including a file being written            |
| Total encoded image data in staging       | 256 MiB                                            |
| Cooperative child termination grace       | 2 seconds, then force termination if still running |
| Forced-exit confirmation deadline         | 5 seconds after forcing termination                |

Metadata limits apply to selected fields, not arbitrary embedded tags or thumbnails. Frame-record streams may exceed 1 MiB cumulatively; consume them incrementally with bounded queues/backpressure. Limit failures identify the exhausted resource, stop affected processing, and preserve completed outputs. Do not label every limit failure “video too large.” These initial defaults come from this design discussion. Change a default only when recorded measurements justify it, preserving bounded-state and failure-reporting requirements.

CLI record/cache limits do not cap FFmpeg/FFprobe memory. The decoder policy is to apply a per-image pixel guard consistently in both tools. Establish and record its numeric value and supported-build behavior during implementation verification, including acceptance below the limit and a specific failure above it. FFmpeg documents `max_pixels` as a per-image guard against very large images.[^codec-limits] Treat decoder buffering and peak child-process memory separately. Output scaling happens after decoding in the usual pipeline, so it can reduce image encoding/storage costs without guaranteeing lower decode memory.[^pipeline]

Review estimated image count and effective dimensions before export. If storage estimation is available, label its assumptions and uncertainty; do not perform extra image extraction solely to manufacture an estimate. For illustration, one hour at 24 FPS is approximately 86,400 images; assuming 2 MiB per image would require approximately 169 GiB. Actual image sizes depend on content and encoding. These values are synthetic planning examples, not a restriction or measured result.

Inspect the destination volume through its path or nearest existing parent using `statfs`; available bytes are `bavail × bsize`, calculated without unsafe numeric truncation.[^volume-space] Check any separate scratch volume actually used, and include staging/copy overhead in estimates. If inspection is unavailable, show “Available space unknown” and continue. Estimated total size is advisory, not reserved capacity or a rejection threshold. Actual disk-full/quota failures stop processing and retain completed images; refresh space information where possible for the diagnostic. No extra confirmation or silent cadence/scale changes are needed.

For excessive output/storage cost, offer ordinary choices: lower FPS, a longer interval, smaller output scale, or another format. Those choices may still require decoding the full source. Decoder-memory failures can suggest a separately prepared lower-resolution source; it becomes a new source with its own frame numbering. Do not promise that output scaling or a preliminary resize always makes an otherwise undecodable source usable.

Long work remains cancellable; do not inherit the Codex per-request timeout or introduce an unmeasured universal scan-duration cap. Disk-full, decoder, parser-limit, and encoding failures stop processing with specific diagnostics and the actual completed-output report.

### Processing Phases and Progress

Use applicable phases: inspect source, resolve one frame or all frame-set roles, or validate sequence timing; export image(s); finish. Frame-set resolution reports endpoint scanning and any midpoint pass separately, followed by confirmed images written out of the preset's known 2/3 outputs. Sequence timing validation, selection, encoding, and writing can share one forward phase. Reusing verified timestamp ordering should say “Timing validation reused”; it must not imply a new scan ran.

```text
Inspect source
  |
  +-- Single -> Resolve identity -> Text review -> Export image
  |
  +-- Frame set -> Resolve all roles -> Text review -> Export 2/3 named images
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

Run at most one resolution/export operation in a flow. Spawn FFmpeg/FFprobe directly with `shell: false` and register every child under that operation. Escape or direct CLI interruption stops new publications and settles any in-flight write. Show “Stopping…” while terminating all registered children that remain running.

Allow the initial two-second grace where graceful termination is supported, then force remaining children. Allow five seconds after forcing termination to confirm exit and stream closure through each child's `close` event; a sent signal or `killed` flag is insufficient.[^child-cancel] Windows signal behavior may require immediate force rather than a graceful wait. If closure remains unconfirmed, report termination failure and stop the flow; keep affected scratch intact and start no replacement operation. Verify these platform transitions under the same ownership contract.

Restore terminal input/cursor state on every exit path. After confirmed tool shutdown, cancelled resolution returns to selection; cancelled export retains/reports completed images and any incomplete file, then allows choices to be revisited. Report cancellation distinctly from success. Internal scratch cleanup cannot delete source media or completed exports.

## Verification and Research Completion Criteria

### Public Reproducible Evidence

Generate small synthetic videos on demand with visible frame numbers, timestamps, and distinct start/end markers. Keep expected values independent of the extraction algorithm; a fixture generator should establish counts and positions in advance.

| Case                                      | Required observation                                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One second, 24 constant-FPS source frames | 24-FPS export writes 24 images, ordered correctly                                                                                                                                              |
| One second, 12 constant-FPS source frames | 24-FPS export writes 24 images from 12 distinct source frames, with disclosed repetition                                                                                                       |
| First/last and frame-number selection     | Export matches the known labeled source frame; number 1 selects first                                                                                                                          |
| Fixed frame sets                          | Exact endpoint/midpoint identities, 2/3 selection-named outputs, repeated-role disclosure, and all identities resolved before review/writes                                                    |
| Timestamp between frames                  | Select the most recent frame starting at/before the target; an exact next-frame start selects that next frame                                                                                  |
| Variable FPS/non-zero timestamps          | No nominal-FPS indexing assumptions; time origin and repeated targets are handled                                                                                                              |
| Interval presets/custom input             | Expected cadence, first target, end behavior, and actual counts                                                                                                                                |
| Formats, quality, and scaling             | Files decode in the selected format; full-quality semantics, preset validation/labels, dimensions, and recognizable content are correct                                                        |
| Destination and naming                    | Default/custom paths, unique names, overwrite boundaries, and partial failures                                                                                                                 |
| Full/compact/fallback picker              | Fit-based layout choice, reserved/wrapped content, Unicode/ASCII toggle, and precise selection survive resize and entry-method changes                                                         |
| Keyboard lifecycle                        | Wave/editor/scan key ownership, submit/back/interrupt behavior, and input/cursor restoration; next ordinary prompt works                                                                       |
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
- Explicit-file format validation: omitted format remains PNG; matching extensions are accepted case-insensitively, including `.jpeg` for JPG, without changing the literal path. Reject missing/unsupported extensions and format conflicts before extraction/final writes. Cover Interactive format changes requiring filename correction, generated-name extension updates, and folder names with image-like suffixes remaining valid folders. Decode successful outputs to verify their actual format agrees with the selected format and extension.
- Mode-specific stem/selection/frame/serial templates, conditional prompts/completion, literal text and separator normalization, explicit-file naming bypass, direct single-image naming-flag rejection, required frame-set selection labels/sequence serials, parameter order, flag-over-token-over-default precedence, zero serial start, six-digit fallback, one-image sequences retaining required serials and folder output, verified `{frame}` values versus FPS-derived estimates, unpadded frame-number rendering independent of serial settings, repeated frame identities with distinct required labels/serials, source identity versus export serial, and rejection of unsupported/duplicate/ordering/scope controls.
- Source stem resolution across case, internal dots, NFKD/diacritics, non-ASCII fallback, 48-character truncation, long names, and output-folder changes. Preserve one resolved stem across all roles and show actual normalized names.
- Chronological serial identity, growth beyond the minimum width without renaming earlier exports, repeated-source uniqueness, and duplicate custom-name errors.
- Overwrite scope: conflicting explicit/generated single-image files and generated frame-set/sequence targets fail without `--overwrite` and permit safe replacement with it. Existing output folders grant no overwrite permission; unrelated/stale files remain intact.
- Source protection: direct, canonical-parent, symlink, and hard-link output aliases are rejected with and without overwrite; the original source remains intact.

For PNG and WebP `full`, compare decoded pixels against an independently prepared post-transform reference, accounting for the chosen pixel representation. For JPG at every preset and WebP `low|medium|high`, use suitable content/quality tolerances rather than identical file hashes. Test real key input and resize transitions, not just static wave snapshots. Confirm that text review and exported content identify the same source frame, and that selection/review launches no viewer or thumbnail generation.

Frame-set verification must cover both presets, conflicting/missing/invalid selectors, known and initially unknown duration, variable-rate midpoint mapping, shifted timestamps, unreliable end/timing, buffered final frames, one/two-frame repeated identities, and cancellation in each pass. Verify errors create no reduced preset, preset output remains a folder, all names are validated before export, and later encoder/write failures retain only confirmed completed outputs.

Verify sequential resolution using labeled synthetic sources with variable FPS, reordered/buffered frames, shifted timestamps, and known final markers. Include source replacement/modification, malformed/truncated input, and out-of-range requests. Seek/checkpoint/tail implementations and comparative benchmarks are outside the verification workload.

For timestamp ordering, include a later frame whose start falls back below the target after an earlier frame has passed it, as well as duplicate and missing starts. The first request must validate through EOF and reject unreliable timing instead of returning the earlier candidate. Verify cached successful ordering, subsequent early stopping, and ordering-state invalidation after source/stream changes.

Sampling verification must cover sparse/variable starts, targets exactly at boundaries, final-frame duration, unknown or conflicting stream ends, decimal rates, very small intervals, and numeric conversion limits. Successful sequences preserve all targets and report actual repeats; invalid timing/end detection reports incomplete processing and retained images.

Progress/resource verification must cover phase changes, estimated totals reached before EOF, unknown totals, media progress distinct from completed-write counts, terminal/non-terminal output, resize, saturated queues, oversized records, disk-full errors, and a child that ignores cooperative termination. Verify no source-size-only rejection, no source copying into CLI memory, and global ordinals/cadence/serials across batch boundaries. Internal scratch, if needed, requires separate ownership and cleanup checks.

Quality verification must cover omitted/explicit `full`, all JPG/WebP presets, PNG rejection of lower presets, invalid names/numeric/empty/missing values, case normalization, conditional prompts, format changes, review labels, and the independence of scale. Record exact native encoder mappings and confirm WebP `full` selects lossless mode. Verify that changing PNG compression can change file bytes while preserving decoded pixels; assess compression cost separately from visual fidelity. Encoder availability and unsupported modes must produce explicit failure before final writes.

### Image Output Verification

The image behavior is settled; verify the following implementation details with synthetic sources before claiming support:

1. Record available encoders, supported pixel representations, and native preset/compression mappings for the tested builds. Decode real PNG/JPG/WebP outputs; test unavailable encoders, unsupported dimensions, and unavailable lossless WebP without fallback.
2. Establish an independent color reference using known RGB patches and tagged YUV matrix/range cases. Verify range conversion, color metadata, and the absence of creative adjustments or GIF palette filters. Record the exact supported conversion arguments and any inferred-field defaults/notices; test missing/conflicting fields and explicit rejection of conversions outside scope. A filter-argument assertion alone does not establish fidelity.
3. Compare PNG/WebP alpha against an independent post-transform reference. Test JPG with opaque alpha-capable input and non-opaque selected frames, including a later sequence failure; no implicit background compositing is allowed.
4. Use asymmetric markers to verify quarter-turns/reflections, square-pixel normalization, metadata reset, scale order, and review/export dimension agreement. Cover unspecified/non-square pixel ratios, the square-pixel assumption notice, invalid/conflicting ratio errors, odd and one-pixel dimensions, half-pixel rounding, unsupported transforms, and dimension/pixel limits.
5. Measure PNG compression cost separately from pixel fidelity. Compare lossless outputs to the post-transform reference and lossy outputs using recorded tolerances; retain this evidence alongside exact encoder/filter configurations.

### Implementation Verification

The execution path and initial internal defaults are settled decisions. Complete the following verification work in order and record public synthetic evidence:

1. Generate labeled constant/variable-rate sources with independently known frame identities, timing boundaries, and final frames. Include sparse starts, shifted timestamps, reordered/buffered output, and invalid timing.
2. Record the exact FFprobe/FFmpeg argument sets, required record fields/serialization, and tool builds. Prove that both tools agree on the selected stream and presentation-order identity, and that extraction implements the specified cadence and reliable-end rules.
3. Exercise numeric boundaries, frame-set midpoint resolution with known/unknown initial duration, parser/queue pressure, cache eviction, oversized metadata/records, diagnostic truncation, decoder/timing failure, and cooperative/forced cancellation. Prove that limit failures stop processing and preserve/report completed outputs.
4. Measure first and cached requests, near-end/last-frame resolution, and whole-video sequence export across generated durations, frame rates, dimensions, and codecs. Record scan/extraction latency and parent/child peak memory separately; verify that CLI-held frame data remains bounded as stream length grows. Measurements describe tested cases, not universal speed or process-memory guarantees.
5. Confirm or calibrate the listed defaults with that evidence. Establish the decoder pixel-guard value consistently in both tools and test below/above its boundary. Verify the two-file/256-MiB staging limits before and at capacity, pressure from slow publication, and rejection of a single image that exceeds the byte budget. Record supported builds, limit enforcement, and the tested two-second grace/five-second confirmation policy.

6. Verify completed-file detection, preset-role/serial publication order, exclusive creation/hard-link fallback, safe overwrite, and source-alias checks. Inject competing writers, case-insensitive collisions, interrupted copies, disk-full/quota errors, unknown space, saturated staging, and cleanup failures. Confirm accurate completed/partial counts and retention of existing/source files.
7. On supported platforms, cancel operations with multiple registered tools and a tool that ignores graceful termination. Verify forced shutdown, exit/stdio closure, confirmation timeout, scratch retention on unconfirmed shutdown, terminal restoration, and prevention of replacement operations.

Configuration and budget verification must pass before claiming those runtime contracts are supported or closing this research. Report a failing prototype case as a verification gap; do not silently change selection/sampling semantics. These tasks require no alternative seek strategy.

### Terminal Picker Verification

The picker contract is settled. Verify it with synthetic duration/selection state before integrating video decoding:

- Exercise wide, narrow, short, and rapidly resized viewports. Include boundary cases where a label, instruction, or notice wraps and changes available rows; verify full → compact → direct-input transitions without hiding essential controls.
- Verify unknown dimensions, unusable duration, simple-prompt mode, unsupported raw input, and non-interactive invocation follow their defined fallback paths.
- Verify Unicode/ASCII thin bars, mirrored halves, marker alignment, the toggle's changing hint, and color-disabled output. Glyph choice survives layout/editor round trips and never changes the selected position.
- Verify `D / (N − 1)` spacing, first/last endpoint semantics, outward no-op movement, and a typed position between divisions moving to the next position in the requested direction. Resize projection retains exact requests/identities.
- Verify letter-case handling, editor draft/selection retention, Enter/Escape ownership, scan cancellation, whole-flow interruption, and listener/cursor/raw-mode restoration. Arrows, glyph toggles, and resize must not start decoding.

Record terminal prototype results and any renderer geometry adjustments under this fixed contract. Static sketches and document review alone do not verify terminal behavior.

### Local Visual Review and Privacy

Use suitable local-only source material to inspect picker usability and real-video results. Retain local exported images, sequence contact sheets, terminal captures, and a short outcome checklist for development review. Keep sources and derived review artifacts in an ignored local area and confirm they are untracked before retaining them there.

Public research, plans, job records, examples, and PR text must omit private source names, fixture identifiers/locations, source-specific metadata, captured content, and derived images. Publish synthetic reproducible evidence and generic manual review outcomes only. Local source review supplements public verification; it must not become a required CI fixture or the sole support for a correctness claim.

### Completion Criteria

The research is sufficiently answered when selection/sampling/output questions are resolved with evidence, a terminal prototype validates the layouts and fallbacks, real tool experiments establish the extraction/format/scale boundary, and the supported dependency strategy is recorded. Cite public reproducible evidence directly or link the relevant execution records before closing research. Drafting and document review alone do not meet those criteria. Prototype evidence belongs in the linked implementation record; it does not establish extraction or encoder support.

## Decision Status

Feature scope and behavior are settled above. Remaining work is the [verification](#verification-and-research-completion-criteria) of encoder/filter configurations, file operations, resource budgets, and supported-platform behavior. Keep `in-progress` until reproducible results support all completion criteria; document review alone does not establish runtime support.

## Recommendations and Next Steps

First prototype the wave, frame-set preset picker, and mode-aware naming prompts with synthetic state, then verify extraction, sampling, image output, publication, and cancellation using the specified synthetic cases. Keep this scope and existing video behavior.

The active implementation plan linked below owns that prototype and verification work as opening execution phases before command integration. It also defines bounded, explicitly invoked synthetic stress runs and private real-video smoke checkpoints outside the regular test suites. The [implementation record](../plans/jobs/2026-10-01-video-frames-implementation.md) records verified checkpoints. A later shipped guide should own the reader-facing contract; this research owns rationale and feasibility evidence.

## Related Plans

- [Video Frames Implementation Plan](../plans/plan-2026-09-30-video-frames-implementation.md)

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

[^child-cancel]: [Node.js child processes: kill and termination](https://nodejs.org/api/child_process.html#subprocesskillsignal) and [process/stdio closure](https://nodejs.org/api/child_process.html#event-close).

[^webp-quality]: [FFmpeg codecs: WebP modes and quality options](https://ffmpeg.org/ffmpeg-codecs.html#libwebp).

[^png-lossless]: [PNG specification: lossless compression](https://www.w3.org/TR/png-3/#dfn-lossless).

[^png-compression]: [FFmpeg codecs: PNG compression options](https://ffmpeg.org/ffmpeg-codecs.html#png).

[^image-color]: [FFmpeg filters: pixel format](https://ffmpeg.org/ffmpeg-filters.html#format) and [color conversion](https://ffmpeg.org/ffmpeg-filters.html#colorspace).

[^image-orientation]: [FFmpeg command documentation: display transforms and autorotation](https://ffmpeg.org/ffmpeg.html#Video-Options).

[^image-scaling]: [FFmpeg filters: scale and square-pixel output](https://ffmpeg.org/ffmpeg-filters.html#scale).

[^image-write]: [FFmpeg image muxer: atomic writing](https://ffmpeg.org/ffmpeg-formats.html#image2-2).

[^file-publication]: [Node.js filesystem flags and exclusive creation](https://nodejs.org/docs/latest-v22.x/api/fs.html#file-system-flags) and [hard-link publication](https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromiseslinkexistingpath-newpath).

[^volume-space]: [Node.js filesystem statistics: available bytes](https://nodejs.org/docs/latest-v22.x/api/fs.html#statfsbavail).
