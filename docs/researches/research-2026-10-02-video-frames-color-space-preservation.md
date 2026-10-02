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

The implemented path has focused pixel/profile evidence, but local appearance review failed. Color acceptance is [reopened](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#color-acceptance-reopened) to resolve the source-to-display interpretation. Earlier mechanical checks remain valid within their tested assumptions.

## Earlier Conversion and Observation

The earlier color planner converted BT.709 transfer to sRGB, and the encoder configuration supplied fixed RGB tags. The [planning observation](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#planning-evidence) showed lighter dark patches than matrix/range conversion alone. It established the effect of that choice. Original equation-based checks validated that conversion, rather than preservation of source transfer or viewer equivalence.

## Source Definitions and Image Representation

Source color information governs interpretation; the saved description must match the encoded pixels.

| Source field | Preservation rule |
| --- | --- |
| Primaries | Retain the source color primaries |
| Transfer characteristics | Interpret signal encoding and intended display behavior together; describe the saved image accordingly |
| Additional color descriptions | Inspect available profiles/gamma descriptions and resolve conflicts before choosing an interpretation |
| Matrix | Decode with the source matrix; describe the resulting image representation correctly |
| Range | Interpret the source range and translate it as required by the image representation |

YCbCr-to-RGB conversion changes the applicable matrix/range description. Copying YCbCr tags onto RGB pixels, or source transfer tags onto pixels already converted to sRGB, would misdescribe them. Selecting `format=rgba` alone does not establish color management.[^image-color]

Apply no brightness, contrast, saturation, compensating gamma, channel boosts, GIF palette filters or tone mapping. Quality and scale remain independent encoding/size choices; no color-look control is introduced.

## Color Preservation Approach

Carry the verified source color interpretation through the raw-pixel boundary into encoding. Embed an RGB ICC profile that describes the output primaries and intended display behavior. Retaining a transfer label does not by itself establish that interpretation.

| Format | Saved color description |
| --- | --- |
| PNG | `iCCP` profile, with other color chunks consistent with the profile |
| JPG | Embedded ICC metadata describing the decoded RGB interpretation |
| WebP | `ICCP` profile in the extended WebP container |

These formats support ICC embedding.[^image-profiles] Saved-image evidence establishes the profile-generation route and encoder support. Filter flags, probe labels or format-level capability alone do not establish a supported preservation path.

Define accepted/rejected source, profile and encoder combinations in a support matrix. Missing fields use only verified, documented defaults with disclosure. Conflicting metadata or unsupported preservation fails clearly without format substitution. A later export failure retains completed images.

The current implementation uses these fallbacks for absent, `unknown` and `unspecified` fields, with a notice for each inferred field. Their notices and numeric behavior were tested. Their display interpretation remains part of the reopened investigation:

| Field | Packed RGB | YUV |
| --- | --- | --- |
| Primaries | BT.709 | BT.709 |
| Transfer | sRGB | BT.709 |
| Matrix | GBR | SMPTE170M |
| Range | Full | Limited, or full for `yuvj` formats |

Accept each preservation path only after the [evidence and completion criteria](#evidence-and-completion-criteria) pass.

## Encoder and Profile Path

The implementation generates a self-contained ICC matrix/shaper profile and attaches it to the encoded stream before publication. Attachment preserves compressed image/alpha payloads and counts metadata against staging limits. These mechanisms remain verified. The tested FFmpeg build lacks `iccgen`, and its bare PNG/JPG/WebP outputs do not embed ICC profiles.

The current BT.709 profile uses inverse signal transfer with ICC parametric curve type 3: `g = 1/0.45`, `a = 1/1.099296826809442`, `b = 1-a`, `c = 1/4.5`, and `d = 0.0812428582986315`. The sRGB profile uses its inverse piecewise transfer. Both describe BT.709 primaries with D65-to-D50 chromatic adaptation. Mathematical and LittleCMS checks verified those chosen curves; they did not establish that the BT.709 curve gives the intended displayed appearance.

ICC's output-referred BT.709 reference specifies a BT.1886 display curve, represented by `L = V^2.4`, rather than inverse signal transfer.[^profile-definition] This distinction requires revisiting the profile-selection rule. It does not establish a universal gamma-2.4 replacement for every source carrying a BT.709 transfer label.

The [candidate evidence](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#color-feasibility) verifies the following combinations before production integration:

| Boundary | Tested candidate |
| --- | --- |
| YUV | 8-bit 420/422/444, including full-range variants |
| Primaries and transfer | BT.709 primaries with BT.709 or sRGB transfer |
| Matrix and range | BT.709, SMPTE170M or BT470BG, each at limited/full range |
| RGB | Full-range BGRA with GBR matrix and either transfer |
| Outputs | PNG and WebP `full` exact RGBA, JPG `full` with recorded lossy tolerance |
| Alpha and dimensions | Partial alpha and odd dimensions in PNG/WebP |

The [production evidence](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#production-color-preservation) verifies the candidate matrix's decoding, encoding and profile mechanics through actual exports, plus all quality presets and representative scales. Additional native PNG/WebP exports cover ten packed RGB aliases, NV12/NV21 and YUVA420/422/444 using disclosed defaults. Their rawvideo NUT sources do not retain color metadata. Explicit definitions for those aliases are tested separately through the native filter path, without claiming tagged-container export coverage.

The [spatial color checks](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#spatial-color-and-scaling) also verify point-sampled color and partial alpha through resizing. Broad uniform patches alone did not expose the scaler's sample changes. The verified route retains complete chroma during nearest-neighbor scaling.

Higher bit depths, HDR, wider primaries and conflicting fields remain rejected. Profile structure and chosen-curve arithmetic are verified independently. Correct source/display interpretation and appearance remain unresolved; broader native platforms remain outside the focused evidence.

## Display Interpretation and Resolution

Resolve the mismatch before accepting the color path again:

1. Inspect the available source matrix, range, primaries and transfer declarations, plus container color/profile/gamma descriptions where present. Record how supported interpretations are identified and how incomplete or conflicting descriptions are handled. This does not expand HDR, gamut or archival-profile scope.
2. Establish a display reference from published standards and an external reference profile. Compare signal and display curves through black, near-black, shadows, midtones and colors. Expected display results must not be derived solely from the current profile generator or its equations.
3. Generate a local reference frame with AVFoundation, preserving the returned image's color description.[^native-reference] Verify the actual frame time and geometry, then use an independent color-management transform to put the reference and export into one explicit comparison space. Start at full size and apply the same geometry/sampling policy for scaled checks. Native extraction is an additional macOS reference, not proof of QuickTime equivalence or a portable runtime dependency.
4. Choose and verify the output profile from the established source/display interpretation. Retain source-coded samples where that representation is correct; any necessary representation conversion must have an explicit reference. Validate synthetic results and bounded local appearance without grading or viewer-specific compensating adjustments.

Public evidence remains synthetic. Local source metadata, images, comparisons and inspection details remain private. The execution record publishes only generic local outcomes.

## Evidence and Completion Criteria

Public evidence uses synthetic sources. Private inspection remains local under the [privacy policy](research-2026-09-30-video-frames.md#local-visual-review-and-privacy). Lossless `full` compares against the specified post-transform reference. Lossy encoding and scaling can change pixels.

The [feasibility checkpoint](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#color-feasibility) established pixel/profile references for the chosen inverse-signal model. The support matrix and production evidence record those definitions, inferred defaults and encoder/profile paths. New acceptance requires independent source/display interpretation references as well as checks for affected combinations and failure handling.

Closure requires verified source/display semantics, real saved-image evidence, independent decoded-pixel and color-description checks, and bounded local visual comparison. Cover affected formats, quality modes, scales, black/shadow/midtone/color patches and alpha; link results and required support decisions from the execution record. Agreement with the chosen curve's equations, copied tags or a viewer match alone cannot close this question. An unresolved local appearance failure keeps color acceptance open.

The plan owns implementation and integrated acceptance. Reuse original evidence only where its exercised boundary is unchanged. Drafting and documentation review do not establish color feasibility or support.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](research-2026-09-30-video-frames.md)

## Related Plans

- [Video Frames Implementation Plan](../plans/plan-2026-09-30-video-frames-implementation.md)

[^image-color]: [FFmpeg filters: pixel format](https://ffmpeg.org/ffmpeg-filters.html#format) and [color conversion](https://ffmpeg.org/ffmpeg-filters.html#colorspace).

[^image-profiles]: [PNG specification: color space information](https://www.w3.org/TR/png-3/#11colorinfo), [ICC profile embedding, including JPEG](https://www.color.org/profile_embedding/) and [WebP container specification: color profile](https://developers.google.com/speed/webp/docs/riff_container#color-profile).

[^profile-definition]: [ICC v4 profile specification](https://www.color.org/specification/ICC.1-2022-05.pdf), [FFmpeg profile-generation coefficients](https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/fflcms2.c) and [ICC BT.709 reference-display registry](https://registry.color.org/rgb-registry/bt709).

[^native-reference]: [Apple AVAssetImageGenerator](https://developer.apple.com/documentation/avfoundation/avassetimagegenerator) and [QuickTime container color descriptions](https://developer.apple.com/documentation/quicktime-file-format/color_parameter_atom).
