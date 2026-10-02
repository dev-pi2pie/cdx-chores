---
title: "Video Frames Color Space Preservation"
created-date: 2026-10-02
status: in-progress
agent: codex
---

## Goal and Scope

Investigate preserving a video's color interpretation in exported PNG, JPG and still-WebP frames without grading or automatic normalization to sRGB. This research owns the current color-preservation direction, source/output interpretation rules, encoder/profile feasibility, color support decisions and evidence requirements under the [documentation ownership](research-2026-09-30-video-frames.md#documentation-ownership) rules.

This is the primary design reference for the new preservation approach. The frame research retains the [earlier approach and completed checks](research-2026-09-30-video-frames.md#earlier-color-approach-and-verification-limit) for historical review and continues to own the wider feature contract. The new preservation path needs its own evidence.

The scope is the existing 8-bit source boundary. HDR, wider-gamut/higher-bit-depth support and archival profile preservation require separate scope and evidence. Selection, sampling, quality presets, transparency, scaling and destination behavior remain in the [frame feature research](research-2026-09-30-video-frames.md).

The preservation approach is defined below. Encoder/profile support and appearance fidelity still need evidence. The [follow-up job](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#planning-evidence) holds inspection and experiment results.

## Current Conversion and Evidence

The [color planner](../../src/cli/video-frames/color.ts) converts BT.709 transfer to sRGB, and the [encoder configuration](../../src/cli/video-frames/image-options.ts) supplies fixed RGB tags. The [synthetic observation](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#planning-evidence) shows lighter dark patches than matrix/range conversion alone. It establishes the effect of that choice, not a complete correction. Original equation-based checks validate the conversion they reference, rather than preservation of source transfer or viewer equivalence.

## Source Definitions and Image Representation

Source color information governs interpretation; the saved description must match the encoded pixels.

| Source field | Preservation rule |
| --- | --- |
| Primaries | Retain the source color primaries |
| Transfer characteristics | Retain the source transfer curve |
| Matrix | Decode with the source matrix; describe the resulting image representation correctly |
| Range | Interpret the source range and translate it as required by the image representation |

YCbCr-to-RGB conversion changes the applicable matrix/range description. Copying YCbCr tags onto RGB pixels, or source transfer tags onto pixels already converted to sRGB, would misdescribe them. Selecting `format=rgba` alone does not establish color management.[^image-color]

Apply no brightness, contrast, saturation, compensating gamma, channel boosts, GIF palette filters or tone mapping. Quality and scale remain independent encoding/size choices; no color-look control is introduced.

## Color Preservation Approach

Carry the defined source color interpretation through the raw-pixel boundary into encoding. Embed a matching RGB ICC profile that explicitly describes the output primaries and transfer behavior.

| Format | Saved color description |
| --- | --- |
| PNG | `iCCP` profile, with other color chunks consistent with the profile |
| JPG | Embedded ICC metadata describing the decoded RGB interpretation |
| WebP | `ICCP` profile in the extended WebP container |

These formats support ICC embedding.[^image-profiles] The profile-generation route and encoder support must be established by saved-image evidence. Filter flags, probe labels or format-level capability alone do not establish a supported preservation path.

Define accepted/rejected source, profile and encoder combinations in a support matrix. Missing fields use only verified, documented defaults with disclosure. Conflicting metadata or unsupported preservation fails clearly without format substitution. A later export failure retains completed images.

Accept each preservation path only after the [evidence and completion criteria](#evidence-and-completion-criteria) pass.

## Evidence and Completion Criteria

Public evidence uses synthetic sources. Private inspection remains local under the [privacy policy](research-2026-09-30-video-frames.md#local-visual-review-and-privacy). Lossless `full` compares against the specified post-transform reference. Lossy encoding and scaling can change pixels.

Before implementation, establish independent pixel/profile references and record accepted/rejected source pixel formats, matrix/range/primaries/transfer combinations, inferred defaults and per-format encoder/profile paths. Include tested builds and missing/conflicting metadata or unsupported-path handling.

Closure requires real saved-image evidence for the accepted paths, independent decoded-pixel and color-description checks, and bounded local visual comparison. Cover affected formats, quality modes, scales, black/shadow/midtone/color patches and alpha; link results and required support decisions from the execution record. Equation-based conversion checks, copied tags or a viewer match alone cannot close this question.

The plan owns implementation and integrated acceptance. Reuse original evidence only where its exercised boundary is unchanged. Drafting and documentation review do not establish color feasibility or support.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](research-2026-09-30-video-frames.md)

## Related Plans

- [Video Frames Implementation Plan](../plans/plan-2026-09-30-video-frames-implementation.md)

[^image-color]: [FFmpeg filters: pixel format](https://ffmpeg.org/ffmpeg-filters.html#format) and [color conversion](https://ffmpeg.org/ffmpeg-filters.html#colorspace).

[^image-profiles]: [PNG specification: color space information](https://www.w3.org/TR/png-3/#11colorinfo), [ICC profile embedding, including JPEG](https://www.color.org/profile_embedding/) and [WebP container specification: color profile](https://developers.google.com/speed/webp/docs/riff_container#color-profile).
