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
| 2 | Real-tool timing, stream agreement, encoder/filter feasibility, bounded writer topology, decoder guard, synthetic workload measurements | In progress |
| 3 | Streaming records, exact identities, bounded cache, source invalidation, cancellation/child closure | Not started |
| 4 | Verified pixels, alpha/transforms, safe publication, failure accounting, private processing smoke | Not started |
| 5 | Sampling, retained repeats, destinations and concrete naming | Not started |
| 6 | Direct command, validation, dependencies and doctor | Not started |
| 7 | Guided Interactive flow and recovery | Not started |
| 8 | Full regression, explicit smoke, documentation and research closure evidence | Not started |

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

- Constant FFV1 starts `[0, 40, 80, 120]` ms and shifted variable starts `[5000, 5040, 5120, 5500]` ms matched the declared identities in both tools. The latter has video-relative end 540 ms from the final 40-ms frame duration. A 70-ms target selects frame 2; the 270-ms midpoint selects frame 3. Decimal 2.5-FPS and 100-ms target expectations retain repeated identities. Real encoded repeated-output verification remains pending.
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

Synthetic artifacts remain ignored/untracked for local review. The disposable workspace check verified cleanup independently. Phase 2 task evidence is complete; acceptance awaits its full commit-range review.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](../../researches/research-2026-09-30-video-frames.md)
