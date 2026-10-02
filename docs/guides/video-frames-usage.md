---
title: "Video Frames Usage"
created-date: 2026-10-01
modified-date: 2026-10-02
status: completed
agent: codex
---

## Export Frames

`video frames` exports one displayed source frame, a named frame set, or a whole-video image sequence. All examples below use synthetic filenames.

```bash
cdx-chores video frames -i ./clip.mp4 --first-frame
cdx-chores video frames -i ./clip.mp4 --frame-set first-middle-last
cdx-chores video frames -i ./clip.mp4 --interval 2s --format webp
```

Choose exactly one selection or cadence. Use `cdx-chores video frames --help` for the complete flag list.

## Dependencies and Doctor

Frames requires `ffmpeg` and `ffprobe` on `PATH`, plus the encoder for the selected image format. The command chooses an eligible video stream marked default, or the lowest-index eligible video stream. Attached pictures and timed thumbnails are excluded.

```bash
cdx-chores doctor --details
cdx-chores doctor --json
```

Doctor reports executable availability separately from advertised image-encoder support:

| Requested output | Required advertised capability |
| --- | --- |
| PNG | `png` encoder |
| JPG | `mjpeg` encoder |
| Still WebP | `libwebp` encoder with BGRA input |
| WebP `full` | Still WebP requirements plus the `lossless` option |

Capabilities can be supported, unsupported or unknown. An unknown result is not proof of support. Frames rejects a requested mode whose required capabilities cannot be verified. Interactive format/quality choices explain unavailable modes.

Doctor inspects tool metadata. It does not encode a test image or prove that a particular source can be decoded and exported. Successful extraction and output inspection establish that result for the tested source and mode. A package name or FFmpeg version alone does not guarantee WebP support. Use an encoder-enabled FFmpeg build for the required modes and check the executable selected by `PATH`.

## Selection and Sampling

| Flag | Meaning |
| --- | --- |
| `--first-frame` | First displayed frame |
| `--last-frame` | Final displayed frame, verified through clean end of input |
| `--frame-number 25` | Displayed source frame 25, counted from 1 |
| `--at 00:00:02.500` | Frame displayed at 2.5 seconds from the first displayed frame |
| `--frame-set first-last` | Two named images: first and last |
| `--frame-set first-middle-last` | Three named images: first, time midpoint and last |
| `--fps 2.5` | Whole-video sequence sampled at 2.5 images per second |
| `--interval 500ms` | Whole-video sequence sampled every 500 milliseconds |

Source frame numbers follow presentation order rather than encoded packet order or an FPS estimate. A timestamp selects the latest displayed frame starting at or before that position. The midpoint is half the verified display duration, not half the source-frame count. Frame-set roles remain separate images even when they resolve to the same source frame.

Timestamp grammar is `HH:MM:SS[.mmm]`: at least two hour digits, exactly two minute/second digits from `00` to `59`, and an optional one-to-three-digit fraction. For example, `.5` means 500 milliseconds. Bare seconds, negative values and timestamps at or beyond the verified end are invalid. Use `--last-frame` for the final frame. Frame numbers must be positive safe integers.

FPS accepts positive integers or decimals such as `24` or `23.976`, without signs, exponent notation or fractions such as `24000/1001`. Intervals accept a positive integer immediately followed by lowercase `ms`, `s` or `m`: `500ms`, `2s`, `1m`. Decimal, compound, spaced or hour-unit intervals are invalid. Interval amounts and resulting milliseconds must fit safe integers. Valued frames flags may be supplied only once.

Sequences start at time zero and sample each cadence target strictly before the verified display end. Faster sampling can write the same source frame more than once. Repeats receive separate export serials, and the result reports repeated selections. An interval matching or exceeding the duration normally produces the starting image, still in a sequence folder.

Counts based on inspected duration are estimates until export completes. For an estimated 5.1-second source, `500ms` gives approximately 11 images, `1s` gives approximately 6 and `10s` gives approximately 1. Missing duration leaves the estimate unavailable. Interactive interval rows show compact counts, with duration qualifications and boundary hints below the choices. Custom input shows estimates or validation feedback. Final results report confirmed completed writes.

Timestamp, midpoint and sequence selection require reliable, strictly increasing presentation times. Missing, duplicate or decreasing starts fail these operations instead of inventing timing. Frame-number selection can remain usable. An unreliable final display end makes sequence completion fail, with completed images retained. Initial timestamp validation, last-frame resolution and frame sets can require a full scan. Export can require additional decoding after resolution.

## Image Format, Quality and Size

| Format | Quality | Transparency |
| --- | --- | --- |
| PNG, default | `full` only, lossless | Preserved within the supported RGBA path |
| JPG | `low`, `medium`, `high`, `full` | Transparent pixels are rejected |
| WebP | `low`, `medium`, `high`, `full` | Supported, with the `full` caveat below |

Quality defaults to `full`. JPG `full` is the highest JPEG preset and remains lossy. WebP `full` uses lossless encoding, but the supported FFmpeg encoder cannot preserve RGB beneath fully transparent pixels. This mode rejects any fully transparent pixel. Choose PNG when exact RGBA is required. Lossless image encoding does not reverse source-video loss or color/display conversion.

```bash
cdx-chores video frames -i ./clip.mp4 --first-frame --format jpg --quality high -o ./cover.jpg
cdx-chores video frames -i ./clip.mp4 --interval 1s --scale 0.5 -o ./frames
```

`--scale` accepts `0.1` through `1`, defaulting to `1`. It scales the display-corrected dimensions, preserving the displayed shape with square pixels and rounded positive output dimensions. Supported right-angle rotations and reflections are applied. Unknown pixel aspect ratio is disclosed and assumed square. Unsupported or conflicting transforms fail.

The image path supports selected 8-bit RGB/YUV formats with BT.709 primaries and BT.709 or sRGB transfer. Source matrix/range decoding retains RGB samples without grading or automatic normalization to sRGB. PNG, JPG and WebP receive an embedded ICC profile: BT.709 transfer selects the CoreMedia709-compatible image interpretation, and sRGB transfer selects sRGB. The profile is generated by shared Node.js code without Apple runtime dependencies. This is a bounded interpretation policy; different video players and image viewers can render the same declarations differently.

Missing color fields use disclosed defaults: BT.709 primaries for both RGB and YUV, sRGB transfer/GBR matrix/full range for packed RGB, and BT.709 transfer/SMPTE170M matrix/limited range for YUV, with full range for `yuvj` formats. HDR, wider primaries, higher bit depths, conflicting fields and source ICC profiles reported at stream or frame inspection are rejected. Decoder-unreported profiles and custom gamma descriptions remain outside verified support. Decoder-exposed alpha must agree with declared source alpha. These limits apply to each processed image, including later images in a sequence. See the [color research](../researches/research-2026-10-02-video-frames-color-space-preservation.md) for definitions and evidence.

Decoded and display-corrected images are guarded at 16,777,216 pixels per image. Scaling reduces output dimensions and storage cost after decoding. It does not guarantee lower decoder memory or bypass the decoded-image guard. Sources stream through the tools without a blanket input-file-size cap. Child-tool memory still depends on the decoder and source.

Verification covers built direct and Interactive exports on macOS with Node.js 26.5.0, plus ESM/CommonJS loading and PNG/JPG/WebP exports on the minimum Node.js 22.23.0. Independent synthetic pixel/profile checks and controlled lifecycle tests establish the tested boundary. Native Linux/Windows execution, viewer behavior elsewhere, larger-file I/O, demanding codecs, heavy real content and network filesystems remain unverified. The [original record](../plans/jobs/2026-10-01-video-frames-implementation.md#support-scope) and [enhancement verification](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#integrated-verification) record the evidence and limits.

## Destinations and Filenames

For `./clip.mp4` with PNG selected:

| Mode | Default destination | `--output` meaning |
| --- | --- | --- |
| One frame | `./clip-frame.png` | Literal final image file |
| Frame set | `./clip-frames/` | Output folder |
| Sequence, including one image | `./clip-frames/` | Output folder |

Defaults are beside the source. Relative custom paths resolve from the invocation directory. Missing output folders and image-file parents are created during export. Selection determines file versus folder, regardless of extension or trailing separator. A destination of the wrong existing kind is rejected. Source media is protected from replacement, including detected symlink/hard-link aliases, even with `--overwrite`.

An explicit single-image filename must match the selected format, case-insensitively: `.png`, `.jpg`/`.jpeg`, or `.webp`. Names stay literal. The command does not infer format, append an extension or rename an incompatible target. For example, `--output cover.jpg` also needs `--format jpg`. `--format jpeg` is not an alias. Interactive mode returns a retained incompatible filename to the destination editor after a format change.

Generated names use the normalized source basename as `{stem}`: remove the final extension, normalize to a lowercase ASCII slug and limit it to 48 characters. An empty result uses `file`. The selected format appends the extension.

| Mode | Default template | Allowed tokens and requirements |
| --- | --- | --- |
| Single frame, Interactive generated name | `{stem}-frame` | `{stem}`, `{selection}`, `{frame}` |
| Frame set | `{stem}-{selection}-frame` | Same tokens, with required `{selection}` |
| Sequence | `{stem}-{serial}` | `{stem}`, `{frame}`, exactly one `{serial...}` |

`{selection}` is `first`/`last`, a frame-set role, or `custom` for frame/time/timeline input. `{frame}` is the verified unpadded source-frame number. `{serial...}` follows export order and is independent of source-frame identity. Templates construct a basename without directories or an added format extension. Invalid, unsafe, unknown or mode-incompatible tokens fail rather than being silently repaired.

Direct CLI `--pattern` is available for sets/sequences. Single-frame CLI naming uses `--output`; template and serial flags are unavailable. Interactive generated filenames offer naming controls, while an explicit image file bypasses them.

```bash
cdx-chores video frames -i ./clip.mp4 --interval 2s \
  --pattern '{stem}-{serial_####_start_3}-frame-{frame}' -o ./frames
```

Sequence serial defaults are start `1`, minimum width `6`. Embedded forms include `{serial_####}`, `{serial_start_3}` and `{serial_####_start_3}`; parameter order is interchangeable. Explicit `--serial-start` and `--serial-width` take precedence over embedded settings, then defaults. Start is a non-negative safe integer, including zero. Width is a positive digit count, at most 250 and subject to total filename limits. Width grows when the serial needs more digits, without renaming earlier images or scanning solely to determine padding. Serial flags apply only to sequences.

Naming prompts show the effective template, stem, extension, applicable serial settings and concrete examples. Unresolved `{frame}` values are identified rather than estimated. Settings changes refresh generated names before review.

## Existing Files and Partial Results

By default, a matching filename stops export. `--overwrite` permits replacement of matching export images. It never clears the destination folder or removes unrelated/stale images. Reusing a nonempty folder is disclosed. A shorter rerun can leave older images beyond its new serial range; use a fresh folder for a clean sequence. Each invocation restarts its serial, without retry/resume support.

The command does not inspect or report destination volume capacity. Image size depends on content and encoding; space is not reserved. Resource/staging guards and actual disk-full or quota failures remain enforced. Reduce sampling rate, increase interval, reduce scale or change format to reduce output cost without a guaranteed reduction in decoding work.

Completed staged images are published individually and then counted as written. Failure or cancellation retains completed images and reports their count and destination. An incomplete current output or retained staging is identified separately. Cleanup removes owned scratch only after tool shutdown is confirmed. A shutdown failure preserves affected scratch and prevents a replacement operation.

## Interactive Workflow and Progress

Run `cdx-chores` with a terminal and choose **video → frames**:

```text
Source → One frame / Frame set / Sequence
Selection or cadence → Format → Quality → Scale
Destination → Applicable naming → Review → Export
```

Menus use Up/Down and Enter. Escape goes Back or cancels the active operation; Ctrl+C exits the flow. Back retains applicable drafts/settings. Changing source invalidates resolved identities. Merely navigating choices or moving the timeline does not decode or create final outputs.

The custom timeline is a coarse position overview, not an audio waveform or image preview. Left/Right moves the candidate, `F` opens frame-number input, `T` opens timestamp input, `A` switches Unicode/ASCII, and Enter resolves the chosen position. Escape cancels an editor or returns from the picker. Small terminals, missing duration or unavailable raw controls use direct frame/time input. Requested and resolved identities remain distinct in review. Selection descriptions refresh after resize on the next navigation key.

Frames and GIF share the `Use default output` choice. Its below-list hint describes only the location: `Image beside the source`, `Frames folder beside the source` or `GIF file beside the source`. Review/results show concrete paths on separate indented lines, using cyan where color is enabled. Short hints/result lines omit trailing periods. Plain output carries the same information. See [CLI output and color](cli-output-and-color.md).

One frame offers `Use default output` or `Custom image file`. A custom path includes the literal filename and skips naming prompts. Frame set and Sequence offer `Use default output` or `Custom folder`, followed by applicable filename-pattern settings. Path hints explain that relative paths start from the invocation directory.

Applicable processing phases report inspected frames, extracted frames and confirmed writes with elapsed time. Estimated totals are qualified. Quiet phases retain an activity cue without a fabricated overall percentage or ETA. Terminal progress updates in place and adapts to width. Redirected progress uses throttled plain stderr lines. Final successful results go to stdout; incomplete-output diagnostics go to stderr. Progress is stopped before final reporting or the next prompt.

## Related Guides

- [Video GIF usage and quality modes](video-gif-usage-and-quality-modes.md)
- [Video resize usage and UX](video-resize-usage-and-ux.md)
- [Interactive path prompts](interactive-path-prompt-ux.md)
- [Contributor testing](testing.md)
