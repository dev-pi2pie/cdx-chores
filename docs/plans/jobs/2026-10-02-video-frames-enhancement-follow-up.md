---
title: "Video Frames Enhancement Follow-Up"
created-date: 2026-10-02
status: in-progress
agent: codex
---

## Scope and Checkpoints

Reopened the [implementation plan](../plan-2026-09-30-video-frames-implementation.md) and [frame research](../../researches/research-2026-09-30-video-frames.md) for color/output enhancements. The separate [color research](../../researches/research-2026-10-02-video-frames-color-space-preservation.md) is the primary design reference for current color-preservation rules and feasibility. The frame research owns the wider feature contract and historical color context. Phase 10 owns implementation and focused acceptance; Phase 11 owns integrated verification, documentation and final closure.

The [original implementation record](2026-10-01-video-frames-implementation.md) remains completed for Phases 1–9. Its checked tasks, results and acceptance history are preserved. Initial preparation reopened the plan and both researches without accepting new implementation tasks.

| Phase | Responsibility | State |
| --- | --- | --- |
| 10 | Source/display color interpretation, capacity-disclosure removal, destination/collision/review wording across all modes and focused review | Color acceptance reopened; destination/capacity tasks accepted |
| 11 | Independent color/integrated verification, regressions, current docs, privacy audit and final review | Pending |

## Planning Evidence

Code review found an explicit BT.709-to-sRGB transfer conversion in the color planner and fixed RGB tags in the encoder configuration. A small synthetic neutral limited-range BT.709 YUV420P grayscale check used constant chroma values of 128 and known luma patches. At luma 32, the production image-plan path produced RGB 34 while matrix/range conversion alone produced RGB 19; black and white endpoints remained 0 and 255. These observations establish the transfer choice's effect, not a validated correction or viewer equivalence.

At planning, the [color research](../../researches/research-2026-10-02-video-frames-color-space-preservation.md) defined the preservation direction. Encoder/profile support needed evidence before implementation. The execution results below establish the focused support boundary.

Code review also confirmed capacity information, singular destination wording shared by frame sets/sequences, a one-frame custom-folder choice and `Keep current` path labels. Existing-file choices say `Keep existing images` while review says `Stop on filename conflict`; review also exposes internal mode values and a generic destination label. The frame research records consistent destination, path-hint, collision and review wording across all three modes. This finding is code-based; revised prompts remain unimplemented and untested.

Publication setup already uses recursive folder creation. The destination contract now explicitly separates complete single-image file paths from multi-image folders and filename patterns, with missing-folder creation during confirmed export. This clarification adds no implementation or native verification claim.

Private processing outcomes: local existing-export pipeline comparison **passed**; source preservation **passed**; source-color-preserving correction **not tested**; viewer appearance equivalence **not tested**. Private inputs, derived images and inspection details stay local and are not verification fixtures or public correctness evidence.

## Documentation Checkpoint

Reopened the research/plan, preserved the original acceptance and added unchecked Phases 10–11. Feature rules and color feasibility have separate research owners. The destination work has separate single-file and folder/pattern tasks, with missing-folder creation and validation timing defined in research. New plan tasks use short sentences without semicolons. Collision/review scope remains across all modes. The usage guide describes shipped behavior. Runtime code is unchanged.

Ownership wording now identifies the color research as the primary design reference for color preservation. The frame research retains a short historical note explaining the original intent and conversion checks' limits. Both documents link that boundary, and neither claims a verified replacement path. Documentation review found no material ownership conflicts.

A wording refinement makes the earlier approach's implemented and checked status explicit and identifies the new research as investigation of a different preservation path. Historical color verification was not repeated for this edit.

At this documentation checkpoint, the color research defined a preservation approach with matching ICC profiles for PNG/JPG/WebP and a source/profile/encoder support matrix. Broad questions and the QuickTime paragraph were removed, with verification and privacy requirements consolidated under the evidence gate. Profile generation and encoder support were still unverified. Documentation review found no material issues. Link/anchor, lifecycle, privacy, checklist and diff checks passed.

At the documentation checkpoint, all nine Phase 10 tasks and seven Phase 11 tasks were unchecked. Local links, anchors, lifecycle wording, privacy boundaries and preserved acceptance checklists passed integrity checks. Execution results follow below.

## Phase 10

### Destinations and Capacity

Interactive One frame now accepts custom image file paths and preserves default generated naming. Frame set and Sequence use folder destinations and filename patterns, including one-image sequences. Relative-path hints, retained destinations, collision choices and review's mode/file/folder labels follow the research. Review and navigation create no output folders. Export uses the existing recursive folder creation after validation.

Removed the frames capacity formatter, volume inspection and direct/Interactive capacity output. Resource guards, staging accounting and real write-failure handling remain intact.

Focused managed Node application checks passed **29 cases / 133 assertions** across action, destination and publication owners, including disk-full/quota failures, source protection and retained outputs. Interactive menu/workflow checks passed **14 cases / 57 assertions**, covering inline/simple prompts, all modes, nested paths, format correction, cancellation, path-kind conflicts and one-image sequences. TypeScript and affected lint/format/diff checks passed. The new menu fixture was split into separate editor cases to fit its existing timeout rather than increasing the budget.

This checkpoint accepted the five destination/output tasks. Later color and verification results follow below. Phase 11 is unstarted.

### Color Feasibility

The opt-in [color preservation experiment](../../../scripts/spikes/video-frames-color-preservation.ts) passed **39 cases / 224 images** on FFmpeg/FFprobe **9.0.2** under Node.js **26.5.0**. The bounded run used **21.262 seconds** active processing and **2,575,625 bytes** owned scratch.

Candidate cases cover 8-bit YUV420/422/444, ordinary/full-range variants, three matrices, both ranges and BT.709/sRGB transfer, plus full-range BGRA and partial-alpha odd dimensions. Raw source samples were verified independently of production extraction. Matrix/range conversion differed from declared equations by at most one code value. Limited neutral luma 32 produced RGB 19. PNG/WebP `full` preserved reference RGBA exactly, and JPG `full` center error was at most one code value. ICC attachment preserved compressed payload and decoded samples in all three formats.

The build lacks `iccgen`, and bare encoder outputs contain no ICC. Independent matrix/shaper profiles describe inverse source transfer and BT.709 primaries. LittleCMS independently verified profile IDs and RGB-to-XYZ interpretation with maximum error **0.00001341**. The macOS `sips` inspector reported an MD5 warning despite the independent ICC-standard ID match. That inspector result is a warning, not a claimed pass or a visual-fidelity result. LittleCMS is used only by explicit development evidence and is not a runtime dependency.

At the feasibility checkpoint, the candidate matrix was recorded in [color research](../../researches/research-2026-10-02-video-frames-color-space-preservation.md#encoder-and-profile-path). Production integration, additional source representations, quality/scale combinations, missing/conflicting metadata handling and viewer appearance needed separate results. This checkpoint accepted the feasibility prerequisite, not production preservation or research closure.

### Production Color Preservation

The decoder now performs matrix/range conversion without changing source transfer. PNG, JPG and WebP exports receive matching BT.709-primary ICC profiles through the bounded image staging path. Encoded payloads are preserved, profile bytes count against staging limits, and unsupported/conflicting definitions retain explicit failures.

Built Node.js results on the recorded tool builds:

- The [production matrix](../../../scripts/spikes/video-frames-color-preservation.ts) passed **39 cases / 336 images**, including **112 production exports**, in **60.117 seconds** active processing. Lossless pixels matched independent references exactly. JPG center error remained at most one code value. Extracted profiles passed independent curve, primaries, profile-ID and LittleCMS checks.
- The [quality/scale proof](../../../scripts/spikes/video-frames/color-quality-proof.ts) passed both transfers across all PNG/JPG/WebP presets at scales **1, 0.5 and 0.1**, including odd output dimensions. Its broad color patches checked **54 production exports** against **54 independent bare references**. PNG/WebP `full` pixels were exact, lossy decoded comparisons stayed within the declared three-code-value tolerance, and compressed payloads were unchanged by profile attachment.
- The [format proof](../../../scripts/spikes/video-frames/color-format-proof.ts) passed **15 cases / 30 production PNG/WebP exports** in **22.945 seconds**, with **401,994 bytes** scratch. All ten packed RGB aliases, NV12/NV21 and YUVA420/422/444 remained native, with exact RGBA and partial/opaque alpha. Rawvideo NUT drops color fields, so these exports verify disclosed defaults. **60 additional native filter checks** exercise explicit definitions separately from tagged-container exports.

Full managed unit verification passed **1,613 cases / 37,468 assertions**. The affected video application lane passed **139 cases / 661 assertions**, including existing GIF behavior, cancellation, publication and terminal ownership. TypeScript, full lint/format and the Node-target build passed. The existing TypeScript 7 build warning remains non-blocking.

At the production checkpoint, preservation was accepted for these focused paths. Local private checks, the focused terminal receipt and complete-range review were still open. Viewer appearance and integrated acceptance remain Phase 11 obligations.

### Spatial Color and Scaling

A spatially varying synthetic grid exposed a gap in the broad-patch evidence. Plain nearest-neighbor scaling changed selected RGB samples by up to **107 code values** for the RGB source and **136** for the YUV source, while unscaled exports were exact. Adding both `full_chroma_int` and `full_chroma_inp` preserves the declared point samples without transfer conversion or grading.

The [spatial acceptance proof](../../../scripts/spikes/video-frames/color-scaling-proof.ts) passed **18 PNG/WebP full exports** across RGB, YUV and partial-alpha RGB at scales **1, 0.5 and 0.1**. RGBA matched independent references exactly, and saved profiles passed independent inspection and LittleCMS checks. Active processing was **7.590 seconds**, with **153,585 bytes** scratch.

The quality/scale proof was repeated after the fix: **54 production exports / 54 bare references**, **23.394 seconds** and **544,669 bytes** scratch. Decoded comparisons were exact against the matching native presets, and profile attachment preserved every compressed payload. This does not make lossy presets lossless relative to source pixels.

An earlier expanded spatial run stopped at a smoke-monitor `ENOENT` race during staging cleanup and is not accepted. The monitor now tolerates disappearance of enumerated child entries while retaining root-read, alias and other failures. The complete rerun passed with child closure confirmed.

Regular policy regressions now cover explicit BT.709 RGB alpha, sRGB YUVA, disclosed NV12/NV21 defaults and padded-RGB alpha rejection. These pin interpretation and alpha eligibility, while native format evidence owns channel/plane fidelity. The updated full unit suite passed **1,617 cases / 37,490 assertions**; type/lint/format and the Node-target build passed.

### Focused CLI and Local Checks

Real terminal walkthroughs used the bundled Node.js Interactive workflow and installed tools with a four-frame synthetic source. One frame exported a nested custom file, Frame set exported three named roles, and Sequence exported 25 serial filenames with 21 repeated selections. File/folder hints, readable mode names, naming previews, collision choices and wrapped text were inspected. Destination folders were absent at review and created only after confirmed export. All three flows returned with terminal ownership restored and no capacity message.

After the scaling fix, the built CLI exported **eight images** across One frame PNG at half size, a three-image JPG frame set and a four-image WebP sequence. Nested destinations, final counts, saved profiles and absence of capacity disclosure passed. Expected stderr progress/notices were captured separately from exit-code validation.

At the focused checkpoint, private checks reported: export **passed**; independent decoded-pixel comparison **passed**; saved-profile validation **passed**; source preservation **passed**; viewer appearance **not tested**. Private inputs and derived evidence remain ignored, untracked and outside public records.

At the focused checkpoint, the tool/terminal gate was accepted and complete-range review was still open. Visual comparison, minimum-Node/integrated verification and usage-guide reconciliation remain Phase 11 tasks.

### Review and Acceptance

Reviewed the complete implementation range **`6e3d765c7c53418acdd5a37cd1a6a93aad06ee62..71b899ef3a36bb9e4f446df3f62f57cda9acb97c`**, covering all four implementation/evidence checkpoints. The source-policy coverage finding was resolved by the focused regressions. Extended code review found no remaining material issues. Documentation review accepted the explicit defaults, evidence scope, historical checkpoint wording and ownership boundaries.

At that checkpoint, local links/anchors, lifecycle, checklist preservation, formatting/diff and public-evidence privacy checks passed, and all nine Phase 10 tasks were accepted. The color acceptance is reopened below. Phases 1–9 retain their original acceptance. Phase 11's seven tasks remain unchecked; the plan stays active and both researches and this follow-up record stay in-progress.

### Color Acceptance Reopened

Local appearance review: **failed (operator reported)**. The remaining dark-color mismatch withdraws color acceptance. Earlier pixel, source-preservation, profile-structure, curve-arithmetic and scaling results remain valid within their tested assumptions; they do not prove the chosen profile reproduces the source's intended displayed appearance.

The current BT.709 ICC path uses inverse signal transfer. The [ICC BT.709 display reference](https://registry.color.org/rgb-registry/bt709) instead specifies a BT.1886 display curve. This establishes a gap in the interpretation used by the implementation and its references. It does not establish the exact local player interpretation or an accepted replacement profile.

The [color research](../../researches/research-2026-10-02-video-frames-color-space-preservation.md#display-interpretation-and-resolution) owns the renewed source/display investigation. Phase 10 reopens its reference, implementation, color verification and final review tasks. Its five destination/capacity tasks remain accepted, and Phase 11 remains pending. Runtime code is unchanged by this reopening.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](../../researches/research-2026-09-30-video-frames.md)
- [Video Frames Color Space Preservation](../../researches/research-2026-10-02-video-frames-color-space-preservation.md)
