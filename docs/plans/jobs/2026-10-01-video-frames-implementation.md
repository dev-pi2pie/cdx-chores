---
title: "Video Frames Implementation Record"
created-date: 2026-10-01
status: in-progress
agent: codex
---

## Scope and Checkpoints

Execute the [implementation plan](../plan-2026-09-30-video-frames-implementation.md) from baseline `cfd2d7ca15195fc19b69ce6d2bd940f838d2b560`. This record stays open across all phases. Check off tasks after recording their evidence; close a phase only after reviewing its complete commit range.

| Phase | Research obligations | State |
| --- | --- | --- |
| 1 | Independent fixture expectations, smoke preparation, real terminal keys/resize, selection retention, fallbacks, prompt ownership/restoration | Completed |
| 2 | Real-tool timing, stream agreement, encoder/filter feasibility, bounded writer topology, decoder guard, synthetic workload measurements | Completed |
| 3 | Streaming records, exact identities, bounded cache, source invalidation, cancellation/child closure | Completed |
| 4 | Verified pixels, alpha/transforms, safe publication, failure accounting, private processing smoke | Completed |
| 5 | Sampling, retained repeats, destinations and concrete naming | Completed |
| 6 | Direct command, validation, dependencies and doctor | Completed |
| 7 | Guided Interactive flow, TUI review/polish, and recovery | Completed |
| 8 | Output path presentation, selection menus and streaming progress UX refinement | Original checkpoint completed; output information follow-up pending |
| 9 | Full regression, explicit smoke, documentation and research closure evidence | Not started |

## Phase 1

The earlier attempt is preserved on a separate local branch; its verification results are not acceptance evidence for this implementation. Reimplementation uses TypeScript/JavaScript, Bun development checks, and Node.js runtime checks.

Initial terminal facility check: Node received a key through a real terminal, reported TTY input/output, and restored the original terminal mode. No media or private input has been accessed.

Preparation evidence:

- Literal small timing expectations and 30/120/300-second scan recipes live in `scripts/spikes/video-frames/fixtures.ts`. They generate nothing on import.
- `bun scripts/spikes/video-frames/verify-workspace.ts` and its Node bundle both passed: budget rejection, ignored uniquely owned scratch, result readback, refusal to remove a replaced run directory, and cleanup. Only a tiny synthetic JSON result was written. Cadence was preserved when rejecting excessive image counts.
- Four focused budget unit tests passed (12 assertions); TypeScript and focused lint passed.
- The budget functions provide preflight and observed-limit checks. Real generation/process deadlines, shutdown acknowledgement, and ongoing disk observation remain Phase 2 verification work. The scratch threshold remains a monitored stop trigger.

Prototype implementation reuses raw sessions, key parsing, display-width measurement, existing menus, and template completion. The feature-local prompt adapter defers abort forwarding until the installed library's initial effects can run; isolated real-library regression cases verify that listeners do not appear after cleanup. No new runtime dependency or general terminal-test framework was added.

### Terminal Evidence

The developer entry is `scripts/spikes/video-frames-terminal.ts`. Bundle it with `bun build scripts/spikes/video-frames-terminal.ts --target=node --outfile <owned-run>/terminal.mjs`, then run `node <owned-run>/terminal.mjs` in a real terminal. It accepts synthetic fixtures only. Optional traces must stay in the owned ignored run; inspect them before cleanup. Use `--mode set|single|set-naming|sequence`, `--simple`, and the explicit fallback/failure switches to repeat the cases below.

Twenty-one prototype cases and two follow-up interruption cases passed in real Node terminals on macOS with Node 26.5.0:

| Check | Observed result |
| --- | --- |
| Endpoint/interior arrows | First/last roles stayed anchored, outward arrows did not wrap, and navigation made no resolution call |
| Measured layouts and resize | Full at 100 × 32, compact at 100 × 19, direct at 28 × 8, then full again; rapid resize also restored the wave |
| Precise retention | Requested 1,234 ms and resolved frame 3 at 1,200 ms survived layout/glyph/editor round trips unchanged |
| Editors | `aTf` stayed editor text; invalid Enter did not resolve; cursor editing and resize retained the draft; Escape restored the previous selection; valid time Enter resolved once |
| Fallbacks | Unknown dimensions, unknown duration, simple mode, unsupported raw input, and frame identity without time each allowed direct frame input |
| Direct time and noninteractive input | Timestamp input resolved the declared identity; redirected input gave CLI guidance without opening a prompt or resolving |
| Presets | First/last returned roles `[1, 4]`, first/middle/last `[1, 3, 4]`, and the one-frame fixture retained all three repeated roles |
| Naming | Single/set defaults omitted serial prompts; sequence defaults used start 1/width 6; embedded start 3/width 4 survived accepted defaults and produced `0003` |
| Glyphs and color | Unicode/ASCII toggled in both directions, hints changed, and disabled color retained geometry and controls |
| Cancellation and failure | Escape cancelled synthetic resolution before a follow-up prompt; Ctrl+C and resolver failure restored raw mode, cursor visibility, and listeners; interrupting active wave/direct resolution exited 130 after acknowledgement |

Real resize used terminal size changes, not injected layout objects. Terminal output and synthetic observations were inspected together. The resize/follow-up case also compared the terminal mode before and after Node. Every owned Node process closed; both prototype bundles and all 23 local traces were removed afterward.

### Regression Evidence and Limits

- Focused picker checks: 33 unit tests / 282 assertions and 9 application tests / 41 assertions passed.
- Managed unit suite: 1,442 cases / 5,556 assertions / 173 files passed.
- Managed application suite: 2,156 cases / 13,674 assertions / 292 files passed after the interruption fix; process and fixture cleanup passed. Neither suite retained results.
- TypeScript, lint, formatting, build, built Node video help, and ESM/CommonJS imports passed. The build retains the existing non-blocking TypeScript 7 API warning.

The prototype uses integer-millisecond fixtures; exact real-tool timing is Phase 3 work. Production registration/integration, image names/publication, media extraction, heavy workloads, minimum Node version, and other platforms remain unverified. Private processing smoke: **not tested**. Generated/private video smoke remains outside regular suites and CI.

### Review

Review of `cfd2d7ca..a1b28cb6` found one P2 issue: interrupting an active resolver could surface its ordinary error and exit 1. The wave and direct paths now wait for acknowledgement and preserve interruption status 130, including a resolver that returns a result after abort. Focused regressions and the managed application rerun passed.

The complete implementation range `cfd2d7ca15195fc19b69ce6d2bd940f838d2b560..52cd73e69b5674f8738da92e217b8440a8599e37` passed code, test, and documentation review with no remaining findings. Phase 1 is accepted and its plan tasks are checked. The plan remains active, the research remains in-progress, and this unified record remains open for Phases 2–8.

## Phase 2

Started from `49d37ee39ce1dcd278b412d1b2a35fac310aefb7`. Synthetic real-tool experiments remain explicit development tasks outside regular suites. Their ignored outputs are retained for local review; cleanup capability is checked separately with disposable owned fixtures.

Only synthetic inputs are used in this phase.

Doctor contract refinement adds advertised image-format/mode inspection separately from executable availability. Phase 2 verifies probe interpretation alongside real encoding evidence; Phase 6 owns report integration. No media generation occurs during doctor inspection.

The decoder-boundary experiment declares two one-frame FFV1 sources: 4,096 × 4,096 and 4,097 × 4,096. The proposed guard is 16,777,216 pixels, with acceptance at that boundary and rejection above it. Inputs stream from Node; no raw source file is staged. Its declared additional scratch allowance is 16 MiB and its processing allowance follows the five-minute case/fifteen-minute run limits. This is a pixel-boundary check, not heavy real-content evidence.

### Timing, Streams, and Decoder Guard

The on-demand entry is `scripts/spikes/video-frames-tools.ts`; bundle with Bun's Node target and run the bundle using `node <bundle> timing|streams|guard`. Expectations and raw labeled pixels are prepared independently of production resolution. The tools execute directly with bounded diagnostics/output and a monitored combined synthetic scratch allowance. The checks passed with Node 26.5.0 and FFmpeg/FFprobe 8.0.1 on macOS. Other builds/platforms remain unverified.

- Constant FFV1 starts `[0, 40, 80, 120]` ms and shifted variable starts `[5000, 5040, 5120, 5500]` ms matched the declared identities in both tools. The latter has video-relative end 540 ms from the final 40-ms frame duration. A 70-ms target selects frame 2; the 270-ms midpoint selects frame 3. Decimal 2.5-FPS targets map to `[1, 3]`; 100-ms interval targets retain `[1, 2, 3, 3, 3, 4]`. Those interval repeats were encoded and verified in the subsequent writer checkpoint below.
- Twelve H.264 frames actually included B frames, decoded in presentation order, and reached the final marker after draining. One-frame decoding preserved its endpoint identity.
- Eligible-video inspection uses `-select_streams V`, then an explicit stream index for both tools. A default second stream, tied defaults, no defaults, and an MP4 attached picture passed identity/pixel checks. The no-default fixture uses Matroska because the tested MP4 muxer marks the first video default.
- Frame records use `-show_frames -show_entries frame=stream_index,best_effort_timestamp,pts,duration,pict_type:frame_side_data= -of compact=p=1:nk=0`. Numeric values remain strings in stream time-base ticks; empty selected side data can produce a trailing separator and blank line. Variable-timing generation requires `-enc_time_base filter` to avoid encoder-time-base rounding.
- Damaged H.264 made FFprobe return zero while emitting error-level decode diagnostics. Successful exit alone does not establish clean EOF: the error-level channel must also be empty. Strict FFmpeg validation uses `-xerror -err_detect explode` and failed on that input. A truncated MP4 also failed inspection.
- `-max_pixels 16777216` was accepted at 4,096 × 4,096 and rejected at 4,097 × 4,096 in both tools. The guard is separate from output dimensions, source size, and process memory. RSS observations are sampled and can miss short-lived peaks; they are not portable hard memory limits.

TypeScript, focused lint, formatting, `git diff --check`, four budget unit tests (12 assertions), and the disposable workspace/cleanup check passed.

### Images, Probe Interpretation, and Writer Topology

The Node entry also accepts `encoders|images|transforms|display|writer|workloads`. All correctness groups, including timing/streams/guard, passed against FFmpeg/FFprobe 9.0.2. Inventory parsing requires exact video encoder names; still-WebP help requires the exact encoder header, BGRA representation, and a lossless option accepting 1. Controlled negative outputs and actual unknown-encoder help (exit 0) did not establish support. These are advertised capabilities, separate from the encoding results below.

- PNG compression 0 and 9 changed file bytes but preserved independent RGBA pixels. Filter-frame `setparams` was necessary to retain BT.709 primaries/sRGB transfer in the encoded PNG; encoder flags alone did not establish that metadata.
- JPG quantizers for `low|medium|high|full` are `12|6|3|1`, with full-range 4:4:4 BT.601 conversion. Fixed-reference mean RGB error stayed within 9 for low and 5 for the other presets. Opaque alpha-capable input remained opaque.
- Still-WebP qualities are `40|70|90|100`; only full uses lossless mode. BGRA input preserved alpha exactly in every preset; lossless output matched all reference bytes. Lossy mean RGB error stayed within 12. Explicit RGB-to-YUVA scaling had changed alpha by one level, so it is not the accepted configuration.
- Limited-range BT.601/709 patches matched independently declared RGB colors within three levels. BT.709-to-sRGB transfer conversion matched an independent transfer calculation within three levels. Tested scope is 8-bit SDR; HDR/wide-gamut conversion and arbitrary source profiles are unverified and require explicit validation in Phase 4.
- Actual MOV display matrices, 2:1 sample aspect, quarter/half turns, reflection, and odd-dimension scale rounding passed. Normalize aspect before display transformation; reset input display metadata before manual transformation to avoid orientation surviving in PNG EXIF. Independently transformed alpha required scaling a separate alpha plane; direct packed-alpha scaling changed alpha by one level. Saved pixels decoded correctly with ordinary autorotation enabled, and saved dimensions/aspect agreed with the reference.
- The PNG-pipe prototype frames data incrementally through IEND, awaits successful file close, and publishes in order through a slow sink. At most two files, including writes in progress, were owned. The configured encoded-byte limit is 256 MiB; a small injected boundary rejected in-progress writes before overshoot. Truncated images were never published. Six actual interval exports decoded as `[1, 2, 3, 3, 3, 4]`, preserving every target before the 540-ms end. This proves a topology; production format framing and safe publication remain Phase 4 work.

### Increasing-Duration Workloads

Continuous 320 × 180, 15-FPS sources passed declared count/timing/EOF/endpoint checks: 450, 1,800, and 4,500 displayed frames. Their time base was 1/15360 with 1,024 ticks per frame. One-FPS exports produced 30, 120, and 300 verified identities, without real-time pacing. All three cases together used approximately 5.5 seconds of active work and 450 output images, within the declared budgets.

| Duration | Initial full scan | First prefix | Near-end prefix | Last prefix | Export | Sampled child RSS | Sampled parent RSS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 30 seconds | 50 ms | 34 ms | 48 ms | 50 ms | 127 ms | 35,072 KiB | 138,248,192 bytes |
| 2 minutes | 102 ms | 35 ms | 104 ms | 104 ms | 321 ms | 38,640 KiB | 170,934,272 bytes |
| 5 minutes | 213 ms | 39 ms | 213 ms | 213 ms | 756 ms | 39,792 KiB | 171,704,320 bytes |

Cached minimal-identity lookups took under 0.01 ms in this feasibility harness. Prefix stops awaited child close; only the full scan established exact EOF/count. Measurements include process/observation overhead, sampled RSS can miss peaks, and these are not production resolver measurements or hard memory guarantees. Larger file I/O, demanding codecs, heavy real content, minimum Node, and other platforms remain unverified. Private processing smoke: **not tested**.

Synthetic artifacts remain ignored/untracked for local review. The disposable workspace check verified cleanup independently.

### Review and Acceptance

The complete implementation range `49d37ee3..229a7e39` received maintainability, test/evidence, and documentation review with no actionable findings. The acceptance receipt was reviewed separately. Phase 2 is accepted on 2026-10-01; its experiments remain scoped to feasibility rather than production behavior.

## Phase 3

Started from accepted Phase 2 tip `2cc3c66794a2e613cc2051de57188bb945d2ded5`. Added adjacent streaming process support without changing the existing buffered process helper. Exact resolution, bounded reuse, source changes, and cancellation are verified within the recorded scope.

### Streaming and Resolution Checkpoint

- Adjacent `src/cli/process/` support keeps selected metadata within 1 MiB, individual records/progress blocks within 64 KiB, retained stderr within the last 64 KiB with a notice, and each consumed native output queue within 256 KiB. Cumulative record output is streamed without a total-size cap. Consumers apply backpressure; cancellation requires child close and consumer settlement, including a resistant-child force transition after two seconds. Unconfirmed closure blocks reuse. Windows immediate-force behavior is modeled; native Windows execution remains unverified.
- `src/cli/video-frames/` inspects eligible/default streams and applies the 16,777,216-pixel guard to metadata and frame probes. Frame ticks are checked signed 64-bit values; time-base components are positive signed-32-bit values. Exact rational components are bounded to 256 bits, and unsafe numeric JSON estimates fail rather than being rounded. User-facing frame ordinals stay safe integers. Metadata count/duration remain estimates.
- First/frame-N stop at a verified prefix; Last drains clean EOF. Initial timestamp selection validates strictly increasing starts through EOF; unchanged-source ordering supports later prefix stops. Exact boundaries, shifted origin, duplicate/decreasing/missing timing, and unknown tail behavior pass independent cases. A positive final decoded duration supplies the reliable end; unsupported or uncorroborated tail evidence fails without padding. Earlier targets with a proven later start can still resolve when the final end is unavailable.
- Fixed presets resolve all roles before returning, retain repeated roles, revalidate estimated midpoint duration, and use a second forward pass when needed. Session reuse holds at most 128 minimal identities, with no decoded buffers/full frame table. Canonical file identity/size/mtime/ctime and selected-stream metadata are checked before reuse, after scans, and before export. Observable changes require fresh selection; undetectable mutation is not an immutability guarantee.
- Controlled Node fixtures pass large cumulative frame streams, incomplete/oversized records, metadata limits, decoder-error stderr with exit zero, source changes, cancellation, and exact selected-stream mapping. An explicit Node real-tool smoke also passed shifted 70-ms mapping, cached hits without a scan, cached time prefix stop, midpoint, twelve buffered H.264 frames, one-frame repeated roles, a default second video stream, and source-change rejection before export. Its initial timestamp resolution was approximately 95 ms and cached identity reuse approximately 31 ms; metadata/source checks still run on cache hits. These are small-source observations, not heavy-video performance claims.

Validation passed: managed unit suite 1,468 cases / 5,664 assertions across 177 files; managed application suite 2,174 cases / 13,746 assertions across 294 files; TypeScript, repository lint/format, build, and diff checks. Owned Node fixtures and explicit small real-tool resolver smoke passed. The resolver ran as both ESM and CommonJS Node bundles; built CLI video help and package ESM/CJS loading passed separately. Node 26.5.0 on macOS is tested; minimum Node and other platforms remain unverified. The existing buffered helper and command registration are unchanged.

### Review Follow-up

Review of `2cc3c667..4437171d` found a P2 cancellation race: a child could close while an asynchronous consumer remained pending, leaving a later abort without a registered shutdown timer. Shutdown registration now lasts until both child close and consumer settlement. A close-before-abort regression verifies bounded confirmation and refusal to reuse unconfirmed ownership. Added ordinal coverage also proves that a low metadata count cannot reject an existing frame, and a high estimate cannot extend actual EOF or produce a cached identity. Focused regressions, both managed suites, and Node ESM/CommonJS real-tool smoke reruns passed after the fix.

### Review and Acceptance

The complete implementation range `2cc3c66794a2e613cc2051de57188bb945d2ded5..9dae70de348dd5b82e95a8550bff4de057ffb5c8` passed code, test, and documentation review with no remaining actionable findings after the follow-up. Phase 3 is accepted on 2026-10-01; its plan tasks are checked. The plan remains active, the research remains in-progress, and this record remains open for Phases 4–8.

Private processing smoke: **not tested**. Ignored synthetic artifacts are retained for local review; product encoding/publication and doctor projections remain later phases.

## Phase 4

Started from accepted Phase 3 tip `1165dd2b9755ae714b16c24de8142c5a6a9eb46d`. Implement the verified image configuration and a shared bounded exporter/publication boundary before sequence sampling. Phase 2 recipes remain independent smoke references. At phase start, production pixel, filesystem, failure, and private processing evidence was pending. The checkpoints below record verification and acceptance.

### Image Configuration Checkpoint

The shared configuration retains immutable aspect/color/display metadata, validates PNG/JPG/WebP quality and scale, and plans aspect correction before one orthogonal display transform and scaling. It preserves alpha on a separate plane and applies the 16,777,216-pixel guard to intermediate/displayed dimensions. Advertised encoder checks require exact inventory/help fields and explicit lossless WebP support; report integration remains Phase 6.

Ten independent image-plan unit cases (65 assertions) and the existing metadata/resolver checks passed: 26 cases / 144 assertions together. TypeScript, repository lint/format, and diff checks passed. The explicit `scripts/spikes/video-frames-image-config.ts` Node smoke passed with FFmpeg/FFprobe 9.0.2: all JPG/WebP presets, exact PNG/lossless WebP bytes, exact alpha, and reflected 2:1-aspect MOV output at half scale. The combined nearest RGB resize has up to one level of arithmetic rounding against independently composed coordinates; PNG preserves the resulting pixels exactly. Saved PNG dimensions, square aspect, orientation reset, and BT.709/sRGB tags passed.

The initial source conversion boundary is verified 8-bit RGB/YUV with BT.709 primaries and sRGB/BT.709 transfer; missing fields use disclosed explicit interpretations. Conflicting metadata, unsupported primaries/transfer/bit depth, or unsupported display transforms fail specifically. At this checkpoint, expanded conversion/failure evidence and production export/private smoke were pending. Synthetic review artifacts stay ignored/untracked.

### Encoder Input Checkpoint

Adjacent process support now streams encoder input through awaited native writes with the same 256-KiB queue boundary. Input producers remain part of shutdown acknowledgement after child close; cancellation aborts their signal and closes the pipe. The buffered helper is unchanged. Twelve process unit cases (34 assertions) and eleven controlled Node application cases (44 assertions) passed, including 3,276,800 input bytes through a slow reader, input failure, resistant-child cancellation, oversized input rejection, and a producer that remains pending after child close. TypeScript and focused ownership checks passed; full phase regression and exporter integration were pending at this checkpoint.

### Staging and Publication Checkpoint

The common writer frames PNG/JPG/still-WebP incrementally, awaits staged-file close, and publishes in order. It enforces two staged files and 256 MiB including writes in progress, waiting for publication to release capacity. Publication pins the canonical destination, rejects non-regular/symlink/source-alias targets, uses exclusive hard links with exclusive streamed-copy fallback only for unsupported-link errors, and replaces overwritten targets by rename without delete-first. Completed outputs and reported incomplete copies survive failures; cleanup removes only verified owned staging after closure confirmation.

Seven pure framing cases (502 assertions) and 25 controlled Node filesystem cases (100 assertions) passed. Cases cover fragmented/container-aware completion, animation rejection, slow sinks, byte/file backpressure, injected limit/disk-full/close failures, direct and hard-link/symlink source protection with both overwrite states, unrelated hardlinks, competing writers in link/copy paths, late collisions, incomplete images/copies, failed replacement, foreign staging, changed parents, cleanup failure, and refusal to clean without closure confirmation. These structural fixtures are not pixel-fidelity evidence.

The explicit `scripts/spikes/video-frames-writer.ts` Node smoke passed all three real image formats with four outputs each. Slow publication reached two owned files without exceeding encoded capacity. PNG and lossless WebP preserved independent RGBA bytes exactly; JPG mean RGB error stayed within five levels and alpha stayed opaque. Structured encoder progress, ordered output, close acknowledgement, and staging removal passed. TypeScript, repository lint/format, and diff checks passed. Real filesystem evidence is macOS-local; unsupported-link/copy and failure paths use controlled injections rather than claims about every filesystem.

### Source Image Export Checkpoint

Resolved selections carry an internal context binding; copied or stale identities require fresh resolution. Export rechecks source/stream fingerprints and actual selected-frame geometry/color/aspect before extraction. Bounded source-ordered groups use one decoder and one encoder, one reusable RGBA frame, 64 KiB awaited encoder writes, and the owned image writer. Repeated roles produce separate files. No full frame table or per-image process is introduced. Structured failure results distinguish confirmed writes, incomplete destination copies, retained staging, and unconfirmed ownership/closure. Encoder preflight creates no destination on failure.

Controlled Node pipeline cases passed **9 cases / 45 assertions**, including repeated roles, unavailable mode, late alpha, partial raw output, short/failed encoding, source mutation, and cancellation. Focused frame units passed **39 cases / 670 assertions**; the full managed unit suite passed **1,493 cases / 6,260 assertions** across 181 files. Managed application regression passed **2,211 cases / 13,903 assertions** across 296 files. Phase-range review was pending at this checkpoint.

The opt-in `scripts/spikes/video-frames-export.ts` production-path smoke passed under Node ESM and CommonJS bundles, with 41 images per run: all nine format/quality choices, independently labeled first/middle/last pixels, repeated one-frame roles, reflected 2:1 aspect plus half-scale geometry, and eight tagged YUV matrix/range/transfer combinations. Fixtures verify persisted tags and unchanged source YUV values before applying independent color equations. Maximum color-reference error was one RGB level; transformed RGB tolerance remained one level and alpha exact. PNG/lossless WebP supplied pixels were exact; JPG mean error stayed within nine levels for low and five otherwise, lossy WebP within twelve. Saved codec/extension, dimensions, square aspect, absent display transform, source preservation, and staging removal passed.

For a labeled 96 × 64 PNG, compression 0 versus 9 took about 34 versus 35 ms including launch and produced 24,801 versus 369 bytes; both preserved pixels. This small synthetic observation is not a heavy-content performance claim. TypeScript, lint, format, package build, legacy built video help, and package ESM/CommonJS imports passed. New backend bundle smoke is distinct from future command integration.

Private processing outcomes: PNG image export **passed**; JPG image export **passed**; still-WebP image export **passed**; source preservation **passed**; owned staging cleanup **passed**. No private-resource details are recorded.

### Review Follow-up

Review of `1165dd2b..35f2ea9b` found a P2 overwrite-accounting issue: duplicate group names could replace an earlier image while counting both writes. A bounded normalized/case-insensitive name set now rejects duplicates before frame scanning or destination creation. Both overwrite policies and case aliases are covered; the refreshed controlled Node exporter suite passed **13 cases / 65 assertions**. TypeScript, lint, format, and diff checks passed. Documentation review also corrected stale pending-evidence summaries and labeled initial checkpoint gaps as historical. Expanded-range review was pending at this follow-up.

The follow-up review added canonical Unicode alias coverage under both overwrite policies; the refreshed exporter suite passed **15 cases / 75 assertions**. The smoke monitor now counts the shared owned scratch root, including retained synthetic and private outputs, against the same 512-MiB budget. Pure smoke-budget cases and TypeScript/lint/diff checks passed; this changes development verification support, not the product export policy.

### Review and Acceptance

The complete implementation range `1165dd2b9755ae714b16c24de8142c5a6a9eb46d..57e134bd521f666d28c301ba3a290ddf054e973b` passed code, test, security-boundary, and documentation review with no remaining actionable findings after the follow-ups. Phase 4 is accepted on 2026-10-01; all Phase 4 tasks are checked. The plan stays active, the research stays in-progress, and this job remains open for Phases 5–8. Backend bundle evidence does not claim command/Interactive integration, heavy real-content coverage, minimum-Node execution, or portable filesystem proof.

## Phase 5

Started from accepted Phase 4 tip `67827e8456521cb4bfe3d73e764ef1db36994831`. Keep exact forward sampling separate from naming/destination calculation and reuse the accepted bounded image exporter.

### Naming and Destination Checkpoint

Moved the prototype's pure naming grammar/defaults into the backend; prompts reuse it. Generated names use the existing source slug and unchanged shared rename separator normalization, verified unpadded ordinals, explicit selection roles, and per-value growing serial widths. Explicit serial settings override embedded parameters then defaults; unsafe counters, widths, mode scopes, tokens, lengths, and device names fail without adjustment.

Destination inspection preserves source-adjacent defaults and invocation-cwd custom paths, literal single-image extensions (including JPG/JPEG case variants), and mode-defined file/folder meaning. It rejects source aliases and wrong existing kinds, detects a nonempty folder with one bounded read, and creates nothing. Available space uses BigInt `bavail × bsize` from the destination or nearest existing parent; unavailable inspection remains advisory.

Managed units passed **1,499 cases / 6,296 assertions** across 182 files. Focused naming/prototype units passed **15 cases / 144 assertions**, destination filesystem cases **2 / 23**, and existing rename rendering cases **13 / 21**. TypeScript, lint, format, and diff checks passed. Sequence integration, real-tool/private sequence smoke, full application regression, and range review were pending at this checkpoint.

### Forward Sampling and Export Checkpoint

FPS parsing retains positive ordinary decimals exactly; integer `ms|s|m` intervals have checked amounts/milliseconds without the Codex timeout cap. Every target derives from its global index and the first displayed-frame origin. The sampler retains the previous identity and at most 128 targets, selects the later frame at an exact boundary, preserves repeated selections, and publishes chronologically. Only clean EOF and a positive final decoded duration establish the display end; container/count estimates cannot pad the sequence. Unknown tails, unreliable starts, and late failures retain confirmed images without reporting completion or a final repeat count.

Single/set entrypoints retain requested labels and generated or literal destinations. Sequence naming carries global cadence indices, verified source ordinals, and growing serial widths across groups; even one exported image uses a folder. The shared exporter uses one decoder/encoder per bounded group, one reusable RGBA buffer, and the accepted staging/publication boundary. Sampling uses a forward record stream with backpressure; each export group also performs prefix validation and decoding from the beginning. This is bounded state rather than a single continuous FFmpeg decoding pass, so many groups can add substantial work.

A native 120-target case exposed the FFmpeg expression parser's depth limit with linear additions. Balanced selection expressions now preserve every requested ordinal and keep depth bounded; the full 128-target expression is covered without reducing cadence or group capacity.

Controlled Node cases cover constant/variable/sparse boundaries, decimal rates, oversized intervals, false duration estimates, unknown tails, duplicate/decreasing/missing starts, late probe failure, serial exhaustion, collision, disk-full, overwrite/stale files, and cancellation. Assertions check independent identities in published structural image bytes, global filenames, bounded state/process counts, source preservation, and staging cleanup. The refreshed image/sequence entry suites passed **31 cases / 155 assertions**; these fixtures establish orchestration rather than actual image fidelity.

### Alpha Fidelity Boundaries

Independent synthetic probes exposed two unsupported paths. A generated WebM declared alpha and an alternate decoder exposed it, while the default decoder produced opaque pixels. The backend now rejects that declaration/decoded-format conflict before destination creation. The supported FFmpeg WebP lossless path also changed RGB under alpha zero; it exposes no exact-transparent-RGB control in the tested configuration. WebP documentation distinguishes preserving those invisible colors through an explicit exact option. The backend rejects WebP `full` with fully transparent pixels and suggests PNG; it does not change the format or weaken exact RGBA semantics. See the [WebP encoding documentation](https://developers.google.com/speed/webp/docs/cwebp).

The opt-in `scripts/spikes/video-frames-fidelity.ts` passed under Node ESM and CommonJS, with 137 images per run. PNG preserved alpha-zero RGBA exactly; lossy WebP preserved zero alpha; WebP `full` preserved exact RGBA for tested alpha values 1, 127, 128, 254, and 255. Declared-alpha/default-decoder failures created no destination. A 129-target sequence retained its 128 completed WebP images when the final fully transparent frame failed, confirmed closure, and removed owned staging. Source preservation passed. These are explicitly verified initial support boundaries, not arbitrary source-codec support claims.

### Synthetic Sequence and Resource Evidence

The opt-in `scripts/spikes/video-frames-sequence.ts` Node ESM run passed twelve cases with 694 published images in approximately 86 seconds of active work, including generation and machine verification. Constant sources use lossless qtrle/MOV or FFV1/NUT; independent preflight checks exact timestamps, per-frame duration, count, clean EOF, and endpoint identities before production export. NUT preserves exact 15-FPS ticks rather than rounding them to millisecond Matroska ticks. Expectations are fixed independently of the sampler.

The CommonJS Node bundle passed all nine small sequence/destination/cancellation cases with 244 images; longer cases were not repeated in that lane. The final ESM run owns the increasing-duration measurements below.

- One second at 24 FPS exported identities 1–24. A 12-FPS source sampled at 24 FPS exported 24 images from 12 distinct frames.
- Decimal 23.976 FPS, shifted/sparse starts `[5000, 5040, 5120, 5500]`, exact boundaries, twelve buffered H.264 frames, and an oversized `15m` interval passed. The shifted `100ms` export decoded as `[1, 2, 3, 3, 3, 4]`; the oversized interval remained a one-image sequence folder.
- A six-second 5-FPS source sampled at 24 FPS exported 144 images from 30 distinct frames, retaining 114 repeats across the production 128-target boundary. Two decoder/encoder groups passed with slow publication reaching two owned files. Every PNG filename, identity, and independent RGBA reference was checked; the buffered H.264 case checks identities rather than claiming lossless source pixels.
- Mode-aware default/literal/custom/set exports passed. Native cancellation with slow publication retained three confirmed images, returned cancellation without a completion/repeat count, confirmed closure, preserved the source, and removed staging.

The increasing-duration sources were 320 × 180 at 15 FPS with 450, 1,800, and 4,500 displayed frames; 1-FPS sampling exported 30, 120, and 300 verified PNG identities. Observations below time only the production export, including its scans/revalidation, rather than source generation or independent output verification.

| Source duration | Export | Sampled parent RSS | Sampled aggregate owned-child RSS | Peak owned children | Decoder/encoder groups | Peak targets |
| --- | --- | --- | --- | --- | --- | --- |
| 30 seconds | 1,677 ms | 209,321,984 bytes | 54,688 KiB | 2 | 1 | 30 |
| 2 minutes | 5,835 ms | 221,839,360 bytes | 55,040 KiB | 2 | 1 | 120 |
| 5 minutes | 23,254 ms | 240,517,120 bytes | 78,640 KiB | 3 | 3 | 128 |

Each long case retained one raw frame and at most one staged image; the shared limits remain two staged files and 256 MiB encoded capacity. RSS observations can miss peaks and include earlier parent allocations; they are not portable memory guarantees. These simple generated sources do not establish heavy real-file/codec performance. The runs stayed inside the declared development budgets, used machine checks without playback, and kept ignored synthetic review artifacts. Product staging/source checks remain distinct from optional developer artifact removal.

Final regression passed: managed units **1,510 cases / 6,393 assertions** across 183 files; managed applications **2,235 cases / 14,036 assertions** across 299 files; TypeScript, lint, format, diff checks, package build, legacy built video help, and ESM/CommonJS package loading. Source backend bundles are separate evidence from future built frames-command integration. Node 26.5.0 on macOS is tested; minimum Node, other platforms, and heavy real content remain unverified.

Private processing outcomes: PNG sequence export **passed**; JPG sequence export **passed**; still-WebP sequence export **passed**; source preservation **passed**; owned staging cleanup **passed**. Only operation outcomes are recorded. Full Phase 5 range review was pending at this checkpoint.

### Review Follow-up

The complete Phase 5 implementation range `67827e8456521cb4bfe3d73e764ef1db36994831..4094954c3904834bd63c8a19061ba1f0737f2681` received code, test/evidence, security-boundary, and documentation review. No actionable code/test/security findings remained. Documentation review found stale research statements saying verified backend and terminal-prototype behavior still lacked evidence. Those statements now link scoped checkpoint results and keep production command/Interactive integration, broader codecs/color paths, heavy real content, minimum Node, and other platforms open. Expanded-range documentation review was pending at this follow-up.

### Review and Acceptance

The complete implementation range `67827e8456521cb4bfe3d73e764ef1db36994831..371cc129e93b44def4467913868676710b992d5d` passed phase reviews with no remaining actionable findings after the documentation follow-up. Source/tests were unchanged by that follow-up; expanded-range documentation review confirmed the evidence/currentness correction. Phase 5 is accepted on 2026-10-01; all Phase 5 tasks are checked. The plan stays active, the research stays in-progress, and this record remains open for Phases 6–8. Ignored synthetic smoke artifacts are retained for local review; later removal needs no public cleanup record. Source-dependent alpha limitations and broader support gaps remain scoped as recorded above.

## Phase 6

Implementation begins from `1ce22917a106c18722334f98eb66d6fa80db98b9`. Direct command/action integration, advertised doctor assessments, and built-command verification are in progress. No Phase 6 task is accepted yet.

### Input-closure Follow-up

A controlled two-image encoder failure exposed a pending input-end callback after child closure. The shared process boundary now starts its existing cancellation/confirmation policy automatically when a child closes before input settlement. This prevents a pending action from disappearing with a successful Node exit. Seven process-ownership unit cases / 21 assertions passed; the new controlled Node command scenario confirms bounded partial-failure reporting. Existing export verification accepts the additional premature-input error while retaining closure, source, and staging checks.

### Direct Command and Doctor Checkpoint

The thin frames action separates read-only preparation from export and retains exact resolver-bound selections. Direct validation covers selector/cadence conflicts, image settings, naming scope and explicit extensions before tool/source work. Both tools and requested advertised encoder support are checked with bounded, cancellable metadata probes before source inspection. Progress/notices use stderr; success reports actual writes/repeats, while failures report only confirmed partial outputs. Controlled Node command checks cover all modes, read-only review, retained identity, missing FFprobe, early encoder failure, scan/export interruption, and signal restoration.

Doctor adds `tools.ffprobe`, availability-only `video.frames`, and separate `videoFrames.encoders` assessments. Exact entries, BGRA input, and WebP lossless mode remain supported/unsupported/unknown; operational probe failures keep exit 2 without a partial report. Controlled availability/projection and parser tests passed. Existing video capabilities retain their FFmpeg-only dependency.

Source evidence: final focused command/options/doctor checks passed **55 cases / 361 assertions**; action/export failures passed **17 cases / 86 assertions**, with scan/export interruption rechecked afterward. Managed units passed **1,568 cases / 6,768 assertions** across 185 files. TypeScript, lint, formatting, diff checks and package build passed. Managed application results follow in phase acceptance evidence.

Managed applications passed **2,237 cases / 14,049 assertions** across 300 files, including unaffected command, dependency, doctor and shared-process consumers. Explicit built-CLI smoke support reuses the existing budget/ownership lab for Phases 6–7 and retains ignored synthetic review artifacts. The final preflight verifies generated count/start timing and independent first/last endpoint pixels before product invocation.

Built evidence is separate: the actual Node CLI passed nine small synthetic export cases (**18 images**) covering first/last/number/time, fixed set, repeated FPS targets, oversized interval, PNG/JPG/still-WebP, conflict and extension rejection, and source preservation. PNG/WebP pixels matched independent opaque references; JPG decoded with expected dimensions. ESM/CommonJS package loading passed. This bounded processing proof does not establish heavy real-content or cross-platform support. At this checkpoint, phase acceptance and complete-range review remained pending.

### Review Follow-up

The full Phase 6 range `1ce22917a106c18722334f98eb66d6fa80db98b9..091edd73373a65b54fc959e03ebf467f5360f43b` received code, test, security and documentation review. Code review found that premature-input cancellation hid the encoder's captured diagnostic. The process boundary now retains its status and bounded stderr after stream settlement; both two-image command and existing exporter regressions require that diagnostic. All 40 affected process/action/export cases / 164 assertions passed; TypeScript, lint, format and diff checks passed. Other review lanes found no material findings. At this checkpoint, expanded-range review and phase acceptance remained pending.

### Review and Acceptance

Expanded full-range review `1ce22917a106c18722334f98eb66d6fa80db98b9..55c480c9aa5a6b7bf996383cdcd284e053963582` found no remaining actionable code, test or security findings. Documentation evidence was consistent; presentation cleanup is included in this receipt. Phase 6 is accepted on 2026-10-01 with all five tasks checked. Managed unit/application evidence is recorded above, and the diagnostic follow-up passed its affected 40-case regression set. The plan stays active, research stays in-progress, and this record remains open for Phases 7–8. The explicit synthetic CLI run retained review artifacts and completed within the existing budget; native lossless pixels, advertised doctor checks, and controlled failures remain distinct evidence.

## Phase 6 Planning Refinement

Clarified doctor inspection against the executables used by frames execution, exact encoder entries, the verified WebP BGRA input, and separate lossless-mode support. Version/package labels cannot establish capability. Controlled verification now names supported, absent/unsupported, unknown, and failed-probe cases; routine doctor inspection remains separate from actual encoding/pixel smoke evidence. At this planning checkpoint, Phase 6 implementation had not started.

Documentation review found no actionable findings. Phase/checklist preservation and diff checks passed.

## Phase 7

Implementation began from the Phase 6 acceptance receipt `26754458a11b4c679090066230c26bbdc5e54fcb`. The checkpoints below record integration, the dedicated TUI review/polish pass, real terminal verification and private processing outcomes.

### Exact Picker and Operation Checkpoint

Picker projection now retains exact rational decoded timing and its original resolved object; display truncation is identified without changing selection. Direct resolution and other asynchronous stages use one feature operation input owner until work settles, with Escape cancellation and terminal restoration. Fatal child closure takes priority over cancellation recovery. Focused picker/layout/operation verification passed **38 cases / 239 assertions**, including fatal Escape/Ctrl+C, exact timing, pending-input ownership, and next-prompt restoration. TypeScript, lint, formatting, diff checks and build passed. At that checkpoint, Phase 7 acceptance remained pending.

### Guided Flow Checkpoint

The Interactive video menu now reaches one-frame, fixed-set and whole-video sequence exports through the shared preparation/export boundary. Settings include advertised format/quality choices, scale, destinations, applicable naming/serial inputs, and cadence estimates. Text review keeps original resolved identities, concrete names and output dimensions; only Export publishes images. Option changes retain selections and validate retained explicit extensions. Observable source changes restart source inspection; unconfirmed closure ends the flow.

Shared path/text prompts now forward streams and abort signals through inline editors and simple fallbacks. Controlled workflow checks cover read-only review, custom identity retention across settings, stale extensions, repeated roles, sequence naming, source invalidation and fatal closure. Menu loading stays lazy so unrelated Interactive flows preserve their prompt boundaries.

Managed unit verification passed **1,579 cases / 6,833 assertions** across 186 files; managed application verification passed **2,246 cases / 14,093 assertions** across 302 files. TypeScript, repository lint/format, diff checks and package build passed. A subsequent presentation refinement passed its affected **22 cases / 147 assertions**: the direct picker and export menu retain essential frame/settings details in their titles, and wave styling groups spans without changing stripped geometry. At that checkpoint, native terminal and complete-range review evidence remained required before acceptance.

### TUI Review and Native Verification

The opt-in `scripts/spikes/video-frames-interactive.ts` prepares a 60-frame, 96 × 64 lossless synthetic source. Independent preflight checked every start, frame count and endpoint pixels. Built Node.js CLI walkthroughs exercised actual terminal keys and resizing; they did not play media. The presentation pass found and corrected four issues: short menus lost resolved details in scrollback; colored waves styled every character separately; review did not explicitly distinguish lossless/lossy quality; explicit-file errors belonged in the destination editor. The last correction also makes shared inline path validation show sanitized errors while keeping the draft editable. Direct, destination and Interactive checks reuse one filename-extension rule.

Final review also identifies explicit filenames separately from generated naming, and shows the normalized stem and effective template for generated names. This preserves the distinction already made by the destination/naming prompts.

| Walkthrough | Verified outcome |
| --- | --- |
| Full/compact/direct layouts | 100 × 32, 100 × 19, 28 × 8 and 80 × 19 terminals; wrapped long source/output labels and controls; essential menu details remained readable |
| Editors and resize | Draft `00:00:01.234` survived narrowing and restoration; request 1,234 ms resolved to frame 31 at 1,200 ms and remained unchanged through full/compact/direct/full transitions and option changes |
| Wave presentation | Thin mirrored bars, aligned markers, accent and endpoints; Unicode/ASCII preference survived redraws; color/plain output and grouped-span polish were rechecked |
| One frame and fixed set | PNG custom selection matched independent pixels; JPG first/middle/last identities were 1/31/60, with verified 48 × 32 half-scale output and successful decoding |
| Whole-video sequence | A `1s` interval produced WebP identities 1/26/51; saved lossless RGBA matched independent references; serial naming, estimates and actual-result reporting agreed |
| Destination correction | Inline and simple editors retained invalid filenames for correction; matching case-insensitive extensions exported exact PNG pixels; final review showed lossless quality |
| Cancellation and recovery | Active scan/export Escape cancellation, picker Ctrl+C interruption and existing-file failure recovery preserved sources/outputs, removed owned staging and restored the terminal; each next ordinary prompt worked |

Controlled checks additionally prove no resolution on navigation, pending-work input ownership, exact rational identities, source/stream invalidation and fatal closure preventing replacement work. Native checks use small generated sources and do not establish heavy real-content performance. Walkthrough artifacts stayed within the declared development budgets and remain available for local review.

Private guided processing outcomes: one-frame export **passed**; frame-set export **passed**; sequence export **passed**; source preservation **passed**; staging cleanup **passed**.

Final managed units passed **1,580 cases / 6,836 assertions** across 186 files. After the final destination/review changes, the affected prompt, guided workflow, direct command, destination and options checks passed **39 cases / 208 assertions** across seven files. TypeScript, repository lint/format, diff checks and package build passed. The earlier managed application run remains the broad regression baseline; the affected follow-up covers the final polish. Node 26.5.0 on macOS is verified; minimum Node, other platforms and heavy real content remain unverified. Complete Phase 7 range review and acceptance remain pending at this checkpoint.

### Review Follow-up

Full-range review `26754458a11b4c679090066230c26bbdc5e54fcb..4ef1b9c1297261501e011a81d2b2506e543284c8` found no actionable code or security findings. Test review requested a regression for the newly displayed inline validation diagnostics. The added case supplies terminal escape, bell, line-separator and format-control characters; none reaches the terminal as a control, and the original editable draft survives. All **14 affected cases / 46 assertions** passed. TypeScript, lint, format and diff checks passed. Expanded-range review and phase acceptance remain pending at this checkpoint.

An additional boundary check found that the picker treated metadata duration as an exact timestamp limit. Both timestamp editors now distinguish a coarse estimated span from a verified bound and defer authoritative validation to the shared resolver. Existing reliable-duration prototype behavior remains unchanged. Wave/direct regressions accept a 120-ms target beyond a 100-ms estimate and retain frame 3; a target at the independently declared 540-ms end still fails. The guided workflow verifies its metadata-only picker is marked estimated. All **41 affected cases / 245 assertions** passed. The built Node wave recheck labeled the estimate, rejected a request past decoded EOF, recovered and exported the exact requested frame pixels; terminal restoration and the next prompt passed. TypeScript, lint, format, diff checks and build passed.

### Phase 7 Acceptance

Expanded full-range review `26754458a11b4c679090066230c26bbdc5e54fcb..abed572ee86d2f126e969ffe67d65287c4d14024` found no remaining actionable code, test or security findings. Test review requested verified-duration coverage; both explicit and default verified bounds now have regressions proving out-of-range timestamps stay editable and never reach the resolver. All **43 affected cases / 259 assertions** passed. The naming review follow-up passed its controlled Node workflow case and native inline/simple correction/export rechecks; saved PNG pixels remained exact. TypeScript, lint, format, diff checks and build passed. The final documentation receipt was reviewed separately before commit.

Phase 7 is accepted on 2026-10-01 with all ten tasks checked. Direct CLI/doctor and guided Interactive integration are complete. The plan stays active, research stays in-progress, and this record stays open for Phase 8's integrated verification/documentation audit and research closure. Prior accepted checklists remain unchanged. Native/private development smoke remains separate from regular suites and CI; private evidence remains operation outcomes only.

## Phase 7 Planning Refinement

Expanded Phase 7's unchecked tasks into integration, TUI review/polish, and verification/acceptance groups. The integrated picker and surrounding flow now have an explicit presentation review, terminal-layout matrix, and finding/fix/recheck checkpoint before acceptance. Phase numbers, completed Phases 1–5 tasks, and the existing smoke/privacy boundaries are preserved; at this planning checkpoint, Phase 7 implementation had not started.

Documentation review found no actionable findings. Phase/checklist preservation, Phase 7 links, and diff checks passed; this records planning changes rather than implementation acceptance.

## Phase 8 Planning Refinement

Added [Phase 8: UX Review and Polish](../plan-2026-09-30-video-frames-implementation.md#phase-8-ux-review-and-polish) for three follow-ups: output path layout/color, selection menus, and streaming progress reporting. Review identified inline paths with added punctuation, circular menu pagination and Back skipping prompt levels, duplicate/accumulating progress output, a selected-frame extraction count labeled as total source decoding, and sampling/validation work without visible updates. Fixes and verification remain pending; no Phase 8 task is accepted by this planning update.

The previous final-validation Phase 8 moves intact to [Phase 9](../plan-2026-09-30-video-frames-implementation.md#phase-9-integrated-verification-and-documentation). Earlier acceptance entries use the numbering at their checkpoint; the current overview and plan use the revised numbering. Phases 1–7's accepted checklists and evidence are preserved. The plan stays active and this record/research stay in-progress. Public UX evidence uses synthetic content; private resource details and captures stay local under the existing smoke/privacy policy.

Documentation review found no actionable findings. Accepted-phase/final-audit preservation, unchecked task states, lifecycle statuses, links/anchors, private-source exclusion and diff checks passed. This records planning verification; Phase 8 implementation and acceptance remain pending.

## Phase 8

Implementation begins from `3a9c891ccbba9a10935fae250ee8f5e41747d95b`. Output presentation, menu navigation and streaming progress have separate finding/fix/recheck checkpoints; complete-range review and terminal verification remain required before acceptance. Phase 9 stays pending and prior accepted checklists remain unchanged.

### Output Path Checkpoint

Completion and partial-output reporting now separate indented destinations/retained paths from plain count labels, use standard cyan only on eligible streams, and omit added periods. Image counts use natural plurals. The controlled Node action fixture passed, covering all export modes, relative/absolute paths with spaces, color/plain parity, redirected stdout, `--no-color`, empty `NO_COLOR`, partial results and interruption. Scoped lint/format and diff checks passed; native terminal verification and complete Phase 8 acceptance remain pending.

### Selection Menu Checkpoint

Frames menus now use finite pagination, concise cadence labels and selected descriptions. Local cadence, settings and naming loops return Back/Escape to their parent prompt and retain applicable choices/drafts. Direct frame/time editors retain escaped drafts without resolving until acceptance. Optional shared path/text draft hooks preserve other callers. Narrow descriptions fit the measured display and expand after resize; disabled choices remain unselectable.

Controlled Node menu/picker checks passed **22 cases / 96 assertions**; settings/naming units passed **17 / 162**; affected shared prompt regressions passed **45 / 170**. Type, scoped lint/format and diff checks passed, and the menu changes had no actionable code-review findings. Workflow integration, native terminal rechecks and full Phase 8 acceptance remain pending.

### Backend Progress Checkpoint

Additive progress fields identify sampling, pass-local validation, extraction/export and finishing without changing existing written/decoded callback fields. Inspected records, selected pixel extractions and confirmed publications remain separate; scan targets reset between validation passes. Finishing is an activity state before disposal/settlement/cleanup, never proof of completion.

Controlled Node export/sequence verification passed **32 cases / 160 assertions**, with a validation-target follow-up of **14 / 70**. The independent variable sequence records four inspected source frames, five selected extractions across groups and six confirmed images; a repeated selection records one extraction and three writes. Late source/timing/tool failures retain failure outcomes. Review also found cancellation during final cleanup could report completion after the operation detached its external signal; both immediate finishing and post-disposal cleanup cancellation now retain all confirmed images while returning incomplete/cancelled results. Type, scoped lint/format and diff checks passed. Presenter/native verification and phase acceptance remain pending.

### Coordinated Presentation and Terminal Checkpoint

Direct and Interactive preparation/export now share one progress presenter per active operation. Live terminal status uses three compact rows, measured width, elapsed/activity cues and distinct inspection/extraction/publication counts; estimates remain labeled. Plain stderr is throttled, including quiet-stage activity. Status clears before notices, results, errors and subsequent prompts. Stopping freezes updates while shutdown settles, and Escape suppresses a late successful acknowledgement without hiding fatal closure failures. Revisited selection menus retain applicable mode, cadence and preset choices.

The managed unit suite passed **1,584 cases / 6,859 assertions / 187 files** and the managed application suite passed **2,261 / 14,162 / 303**. The final presenter/action/workflow/operation follow-up passed **10 / 54**, including Interactive progress on redirected stderr while prompts retain stdout. TypeScript, repository lint/format, build and diff checks passed. Controlled tools cover redirected output, slow/unknown stages, failure and confirmed cancellation; regular suites do not invoke native media tools or private resources.

Seven built Node.js terminal walkthroughs passed on macOS with Node 26.5.0: sequence Back/draft retention; colored single-file output and invalid-extension correction; interruption; active scan cancellation; active export cancellation; narrow direct timestamp entry; and real resize from 28 × 8 to 100 × 32 and back. Each verified terminal-mode restoration and a subsequent installed-library prompt. A 60-frame, 96 × 64 synthetic source produced independently checked PNG pixels: interval selections 1/17/33/49, first frame 1, and the retained timestamp selection 17. Paths with spaces, file/folder destinations, natural counts and indented output were checked. Cancellation reused an existing bounded synthetic duration source; source hashes and absence of staging/symlink leftovers passed. All owned processes closed within existing monitored smoke limits.

The `--ux` development entry reuses the existing smoke lab and budgets. Ignored synthetic inputs, outputs and terminal captures remain available for local review. No private resource was used for this checkpoint. Minimum-supported Node, other platforms and heavy real-content behavior were not newly tested; earlier declared support gaps remain. Complete-range review and Phase 8 acceptance are still pending.

### Review Follow-Up

Complete-range review `3a9c891ccbba9a10935fae250ee8f5e41747d95b..e29955773f11b0f4cb63c6e1b2c4f10d3cc6dd1e` found no actionable correctness, maintainability, security or documentation issues. Test review identified missing action-boundary evidence for live renderer cleanup after encoder failure. The existing controlled Node action fixture now checks clearing before the partial/error report, released resize listeners, no further timer/resize writes, and an intact subsequent prompt. That fixture passed **1 case / 6 assertions**; the other nine focused cases also passed. Type, lint, format and diff checks passed. No production change or native rerun is needed for this coverage follow-up; expanded-range review remains required.

### Acceptance

Expanded complete-range review `3a9c891ccbba9a10935fae250ee8f5e41747d95b..0881623b47cb8b82ba082c0bb89af39e34d9346a` has no remaining actionable code, test or security findings. The failure-restoration coverage gap is closed. The final documentation receipt is reviewed separately; earlier accepted phase sections remain unchanged.

Phase 8 is accepted on 2026-10-01 with all six tasks checked. Output paths, menu navigation and streaming progress have recorded fixes and controlled/native rechecks. The plan remains active and this record/research remain in-progress for Phase 9. Its seven tasks stay unchecked. Ignored review artifacts remain locally available; retention does not prevent this checkpoint's acceptance, and no private resource details or local setup enter the public record.

### Output Information Follow-Up Planning

Expanded the pending work to seven [Phase 8 follow-up tasks](../plan-2026-09-30-video-frames-implementation.md#follow-up-prompt-and-output-information), with a corresponding [research clarification](../../researches/research-2026-09-30-video-frames.md#output-information-consistency). The scope covers frames/GIF default-choice hints and path reporting, interval estimates, effective naming, retained-file format validation, precise review/collision wording, available-space disclosure and focused verification. GIF processing behavior is preserved.

Code/prompt review found inline GIF completion paths, repeated frames review information, ambiguous collision wording and destination space inspected without presentation. A controlled prompt check using synthetic text retained a PNG filename after choosing JPG; subsequent option validation rejected the mismatch. These observations define follow-up work, with implementation and rechecks pending. The original six accepted tasks and implementation evidence remain unchanged; Phase 9 remains unstarted and all parent statuses stay open. Documentation review found no actionable findings; preservation/status/link/anchor, privacy and diff checks passed.

Refined the research wording to lead with findings and presentation rationale. Its current next steps link to the pending Phase 8 follow-up and Phase 9. The plan retains ownership of implementation and acceptance, with task scope and checkpoint status unchanged. Documentation review found no actionable findings. Checklist/history, status, local link/anchor, privacy and diff checks passed.

### Output Information Follow-Up Execution

Interval preset rows now show compact count estimates. Below-list details distinguish preliminary metadata from a decoded end, retain export confirmation wording and identify matching/exceeding intervals. Compact descriptions keep counts, qualifications and controls visible at 28 × 8, with full wording restored after resize. Custom input uses the shared exact cadence calculation and retains validation/drafts. Existing FPS feedback remains intact.

Affected controlled settings, installed Node prompt and workflow checks passed **18 cases / 109 assertions**. They cover ordinary/boundary/unknown counts, valid/invalid custom input, measured narrow layouts, resize and verified-duration qualification. Type, scoped lint/format and diff checks passed. One follow-up task is checked. Remaining output/naming work, built-CLI terminal walkthroughs and complete-range review remain pending.

Default destinations now use the shared label with generic location hints below the choices. Naming information uses resolved selections and shared filename rules, refreshes valid serial/format examples, and identifies unresolved source-frame values. Incompatible retained filenames return to the destination editor before review, with literal drafts and Back correction preserved. Explicit files bypass templates.

Focused naming, installed Node prompt and workflow checks passed **24 cases / 172 assertions**, including compact layouts, resize followed by navigation, active/accepted prompts, inline/simple extension correction and mixed-case JPEG acceptance. Type, scoped lint/format and diff checks passed. GIF hint/routing and both output modes passed **13 controlled cases / 77 assertions**. Two built Node terminal walkthroughs confirmed the GIF default hint, both saved GIF modes, source preservation, terminal restoration and the next prompt. The shared output-choice helper is unchanged. Four follow-up tasks are checked. Reporting, final integrated verification and complete-range review remain pending.

Frames review and both GIF completion modes now use separate indented cyan destination lines through the existing display/color policy. Review separates filenames from frame details, presents quality/count information once and uses precise collision labels. Direct estimate notices and confirmed success/partial/retained-output accounting remain intact. Existing volume inspection appears as readable advisory capacity or an explicit unknown result in review/pre-export diagnostics.

Controlled output checks passed for both GIF modes, target-stream color eligibility, redirected/no-color paths, known/unknown space, count deduplication and failure/terminal restoration. The final Node action fixture passed **1 case / 6 assertions** after adding unknown-count review coverage. The managed unit suite passed **1,591 cases / 6,906 assertions / 188 files**, and type/lint/format/build/diff checks passed.

Five built Node synthetic checks passed: interval sequence with compact-to-wide navigation, retained PNG-to-JPG filename correction, both GIF modes and redirected direct CLI export. Two three-image sequences matched independently expected source frames 1/26/51. The JPEG and GIF files decoded in their selected formats, source bytes stayed unchanged, and interactive cases restored terminal state and accepted the next prompt. Selection descriptions refresh on navigation after resize. Ignored review artifacts remain available locally under the existing budgets. No private media was used, and earlier support gaps remain. Six implementation tasks are checked. Final application-suite reconciliation and complete-range review remain pending.

Complete-range review through `a0a4db8b6c140c0216ea4d314f6efd81c2ba768c` found no actionable maintainability or security issues. Test review identified a weak GIF color assertion that could pass with a styled label and plain destination. Both GIF modes now require the exact raw destination line, including path-only cyan when eligible. Affected GIF checks passed **13 cases / 77 assertions**, with type/lint/format/diff checks passed. Expanded-range acceptance remains pending.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](../../researches/research-2026-09-30-video-frames.md)
