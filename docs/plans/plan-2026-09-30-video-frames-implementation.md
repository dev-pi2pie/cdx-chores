---
title: "Video Frames Implementation Plan"
created-date: 2026-09-30
modified-date: 2026-10-01
status: active
agent: codex
---

## Goal and Planning Boundary

Implement `cdx-chores video frames` for one exact source frame, a fixed frame set, or a whole-video sequence of PNG, JPG, or still WebP images. Deliver the direct CLI and guided Interactive flow without changing convert, resize, or GIF behavior.

Phases 1–4 are complete. The accepted checkpoints cover terminal prototypes, real-tool feasibility, exact resolution, and verified backend image export/private image-processing smoke. Sequence sampling, command/Interactive integration, and integrated stress remain pending. See the [unified execution record](jobs/2026-10-01-video-frames-implementation.md) for evidence and checkpoint reviews.

The research owns selection, sampling, terminal, image, and output semantics. This plan owns implementation order, acceptance checkpoints, development-test cost, and evidence handling. Runtime support claims require recorded results. Implement prototypes and verification support in TypeScript/JavaScript, using Bun for development and Node.js for runtime checks.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](../researches/research-2026-09-30-video-frames.md)

## Scope and Contract Sources

Use the research's contracts directly rather than maintaining a second option specification here:

| Area | Contract and implementation obligation |
| --- | --- |
| Command and flow | [Command surface](../researches/research-2026-09-30-video-frames.md#command-surface-and-interactive-flow): exactly one selector/preset/cadence, strict explicit-value validation, and shared export actions |
| Frame identity | [Single selection](../researches/research-2026-09-30-video-frames.md#single-frame-selection) and [frame sets](../researches/research-2026-09-30-video-frames.md#fixed-frame-sets): presentation-order ordinals, first-frame origin, exact endpoint identities, and duration-based midpoint |
| Picker | [Adaptive wave](../researches/research-2026-09-30-video-frames.md#wave-picker-and-adaptive-terminal-layout): synthetic distance cue, full/compact/direct-input layouts, precise selection retention, and no decoding on navigation |
| Sequence | [Whole-video sampling](../researches/research-2026-09-30-video-frames.md#whole-video-sequence-export): checked exact targets, frame-at-time mapping, retained repeats, and reliable end verification |
| Images | [Formats and scaling](../researches/research-2026-09-30-video-frames.md#image-formats-and-output-scaling): quality presets, faithful conversion, alpha, display transforms, square pixels, and scale within `0.1–1` |
| Files | [Destinations and naming](../researches/research-2026-09-30-video-frames.md#output-destinations-and-filename-templates): mode-aware paths, filename/format agreement, source ordinals versus export serials, safe publication, and partial-output accounting |
| Execution | [Streaming resolution](../researches/research-2026-09-30-video-frames.md#streaming-frame-resolution) and [dependencies](../researches/research-2026-09-30-video-frames.md#technical-feasibility-and-dependencies): one FFprobe/FFmpeg path, bounded state, progress, cancellation, and doctor projections |
| Evidence | [Verification criteria](../researches/research-2026-09-30-video-frames.md#verification-and-research-completion-criteria): independent synthetic expectations, real tool experiments, terminal behavior, and private visual smoke |

Keep the research's exclusions: no custom sequence ranges, arbitrary image counts, separate every-source-frame mode, persistent index sidecars, seek/tail optimizations, scene detection, cropping, viewer launches, image thumbnails, or terminal image protocols. The frame picker remains a position control with text review.

Preserve requested cadence and frame identities. A feasibility failure must not silently introduce deduplication, approximate timestamps, reduced presets, format substitution, or a blanket source-size limit.

## Implementation Boundaries

These are responsibility boundaries to refine during the prototypes, not a requirement to create every suggested file eagerly:

| Surface | Responsibility |
| --- | --- |
| `src/cli/video-frames/` | Options/types, selected-stream metadata, record parsing, exact timing, identity resolution/cache, sampling, image configuration, naming, and publication ownership |
| `src/cli/actions/` | Thin frames action and exports that connect validation, resolution, export, progress, and result reporting |
| `src/cli/process.ts` and adjacent process support | Incremental output, bounded diagnostics/queues, registered child ownership, and cancellation; preserve existing callers |
| `src/cli/commands/video.ts` | Direct command registration and option plumbing |
| `src/cli/interactive/video.ts` and frames-specific Interactive modules | Mode choices, picker/editors, output/naming prompts, review, export, and recovery |
| `src/cli/deps.ts`, `src/cli/doctor/` | FFprobe inspection, frames capability, compact Video state, remediation, and additive JSON fields |
| `test/video/` and affected foundation/doctor owners | Inexpensive unit and application regression tests with injected tools/processes |

Reuse existing terminal, path, slug, and template interaction foundations. Keep frames-specific semantics outside the rename planner and avoid growing the existing video action into the entire frames implementation. Runtime code must remain Node.js compatible; Bun is development/test tooling.

## Verification Strategy

### Regular Regression Tests

Unit tests cover pure selector grammar, exact arithmetic, timing boundaries, template rendering, layout calculations, and state transitions. Application tests cover actual filesystem/CLI/Interactive boundaries with controlled tool executables or injected processes, including missing dependencies and failure handling. Use existing feature ownership, suite suffixes, and fixture helpers from the [Testing Guide](../guides/testing.md).

Private videos and the cost-limited generated-video workload below are not regular suite inputs. Do not register those development smoke runs in unit tests, `test:all`, or automatic CI, and do not add an installed-FFmpeg dependency to an existing regular suite solely for this smoke work. Passing fake-tool tests does not establish decoding, image fidelity, or encoder support.

### Explicit Development Smoke Runs

Real FFprobe/FFmpeg experiments, generated-video stress checks, and private real-video smoke are explicit plan tasks. Their outcomes are required at the specified checkpoints even though they are outside the regular suites. Missing tools, unrun cases, failed checks, or exhausted budgets cannot be reported as passes.

Start with an on-demand FFmpeg synthetic pattern, continuous 1-based frame labels, and distinct endpoint markers. Fix expectations before extraction. Generate the longer source continuously from the same recipe; stitching clips is not required. Use a small streamed Node.js frame generator only when a machine-readable identity or independent pixel reference needs it. Keep any reusable support generic and separate from operator-selected private inputs.

Initial constant-rate scan workloads:

| Duration | Dimensions | Source rate | Expected displayed frames |
| --- | --- | --- | --- |
| 30 seconds | 320 × 180 | 15 FPS | 450 |
| 2 minutes | 320 × 180 | 15 FPS | 1,800 |
| 5 minutes | 320 × 180 | 15 FPS | 4,500 |

For each recipe, cap generation at its expected frame count and verify the generated artifact's count, timing, clean EOF, and endpoint labels before testing the product. Expected frame `n` starts at `(n − 1) / 15` for these cases. Use separate small recipes for variable/shifted timing, sparse starts, buffered output, alpha, color patches, orientation, and high-resolution cases. Do not use the implementation under test to manufacture expected identities or pixel references.

### Initial Smoke Cost Budget

These are provisional development-run limits to verify and calibrate. They are separate from the research's production resource settings and do not cap users' source duration, file size, scan time, or requested cadence.

Active work is elapsed wall-clock time spent generating, decoding, encoding, and checking results. Machine checks use no real-time playback pacing or media-player playback. Human review time is outside this processing budget.

| Resource | Initial development limit |
| --- | --- |
| Active work per case | 5 minutes, including generation and processing |
| Active work per smoke run | 15 minutes across its cases |
| Concurrent cases | 1 |
| Initial scan workload | At most 5 minutes at 320 × 180 and 15 FPS |
| Exported images | At most 1,000 per case and 1,500 across the run |
| Combined owned scratch usage | 512 MiB monitored stop threshold |

Preflight expected output counts and artifact cost before starting a case. Configure the test cadence to fit its declared workload. For example, a five-minute source sampled at 1 FPS has 300 targets while resolution still inspects up to 4,500 source frames. Use short sources for dense-output checks. Account for generated inputs, staged/final images, copy overhead, and diagnostics in the scratch allowance; existing read-only private inputs are outside it. Inspect current owned scratch usage, including retained review artifacts, before planning further work. Reaching the budget does not authorize deleting retained artifacts.

Observe scratch usage during work. The disk threshold is a stop trigger, not a filesystem quota or a guarantee against transient overshoot. Time, image, or storage exhaustion stops the case and reports `budget exceeded` with incomplete verification. Preserve requested product semantics: do not truncate a sequence or lower its cadence and call the case successful.

Active-work deadlines do not replace shutdown confirmation. Stop owned processes using the verified termination policy and confirm closure and file ownership before removing artifacts or accepting a completed run with retained files. Unresolved process/file ownership prevents checkpoint acceptance. When removal is selected, verify cleanup; a failed removal is a lifecycle failure even if content assertions passed. Intentional retention for review follows the policy below and does not prevent acceptance.

Measure CLI and child-process memory separately; observation alone does not establish a portable hard process-memory cap. Exercise deterministic resource failures with small injected limits, then verify real writer/tool enforcement under the research's configured limits. A larger resolution, file-size, codec, or production-boundary experiment needs a separately declared workload and budget before execution. Record changes with their measured justification. Heavy real-content behavior remains unverified without suitable evidence.

### Smoke Workspace and Privacy

Use `examples/playground/.tmp-smoke/video-frames/synthetic/<run-id>/` for owned generated-source runs. Keep generated sources, exports, and diagnostics in that run. Regular suite fixtures continue to use their existing `.tmp-tests` ownership; these manual runs do not share that runner's scratch lifecycle.

Manual smoke artifacts may be removed after inspection or retained locally for review. Retention may cover selected evidence or the complete owned run. Honor requested retention and keep retained artifacts ignored and untracked. The user may later remove them independently without a cleanup receipt, retention registry, or documentation update; no artifact manifest is required.

Verify safe cleanup behavior with small disposable owned fixtures when review artifacts are retained. Product staging cleanup and source protection remain required correctness checks. Retention of developer review artifacts does not excuse a product cleanup failure.

Private smoke uses a separate ignored local run area. Resolve private inputs locally and keep original sources outside the owned output tree, read-only. Neither private input nor result locations belong in the public plan or job record. Confirm sources and derived artifacts are ignored and untracked before retaining them. Never register private images, logs, or captures as regular test-result exports.

```text
Create uniquely owned run
  -> generate synthetic input or select private read-only input locally
  -> verify recipe/budget and run checks
  -> confirm child shutdown
  -> inspect outputs and write a public-safe processing summary
  -> remove owned run artifacts or retain them for local review
```

Public synthetic evidence may record recipes, tool builds, tested arguments, expected/actual values, and resource measurements. This plan describes general artifact-handling rules; actual private-run details stay local: source names/paths, identifiers, metadata, commands containing private paths, raw diagnostics, images, contact sheets, captures, and inspection notes. Publish only the operation checked and `passed`, `failed`, or `not tested` for private smoke. Omit source-specific counts, dimensions, timing, and performance measurements, as well as private artifact inventories and run-specific retention/cleanup history. Construct the public processing summary separately from local evidence; later manual deletion needs no public record.

If private content exposes a defect, retain the original investigation locally and create a synthetic reproduction before publishing detailed findings. The private failure remains an unresolved acceptance issue until fixed or its support boundary is explicitly decided; it is not an automatic skip.

Inspect failed runs before deciding whether to remove or retain artifacts. Keep affected scratch when shutdown or ownership is uncertain, and report the incomplete verification within the privacy rules above. Cleanup may remove inspected smoke outputs owned by that run; the product itself retains completed exports on failure/cancellation. Never remove the private source library, another run, user-owned folders, or unrelated outputs.

## Phase 1: Synthetic Fixtures and Terminal Prototype

Tasks:

- [x] Begin the unified execution record and map the research's verification obligations to these phase checkpoints.
- [x] Define independent small fixture expectations and the bounded synthetic workload recipes; verify scratch ownership, ignore status, budget checks, and result/cleanup handling before creating media.
- [x] Prototype the wave, frame-set preset chooser, and mode-specific naming prompts using synthetic state before integrating video decoding.
- [x] Verify full/compact/direct-input fit with actual wrapped display widths, unknown dimensions/duration, simple prompts, and non-interactive paths.
- [x] Exercise real keys and resize: endpoint/interior movement, precise request retention, glyph toggle, editor drafts, Enter/Escape ownership, and terminal restoration. Navigation and resize must not launch tools.

Checkpoint: the terminal prototype preserves the settled selection/control contract and every fallback remains usable. Record actual interaction results; static screenshots or layout assertions alone do not establish acceptance.

Accepted on 2026-10-01. The [Phase 1 record](jobs/2026-10-01-video-frames-implementation.md#phase-1) contains preparation, real Node terminal, regression, cleanup, and complete implementation-range review evidence.

## Phase 2: FFprobe/FFmpeg Feasibility and Evidence

Tasks:

- [x] Generate and verify the small labeled sources before increasing the scan workload. Record independent counts, starts, endpoint identities, tool builds, encoders, and required frame-field serialization.
- [x] Prove selected-stream agreement and presentation-order numbering across both tools, including stream defaults/cover exclusion, shifted timestamps, reordered/buffered frames, decoder failure, and clean EOF.
- [x] Verify exact frame-at-time and midpoint mappings, decimal FPS/interval targets, retained repeats, final-frame duration, and reliable-end rules.
- [x] Establish tested encoder/pixel/filter configurations for PNG/JPG/WebP, native quality mappings, lossless modes, alpha, color metadata, orientation, square pixels, and dimension rounding using independent references.
- [x] Prove a stream/writer topology that enforces per-image completion, two staging files and 256 MiB total encoded staging, including writes in progress and backpressure. Uncontrolled directory spooling is insufficient.
- [x] Select and verify a numeric decoder pixel guard in both tools; distinguish it from output dimensions, CLI limits, and child peak memory.
- [x] Run the initial increasing-duration synthetic checks within the smoke budget. Measure first/cached resolution, near-end/last selection, export, and CLI/child memory separately; record untested workloads/platforms.

Checkpoint: tested arguments, serialization, stream synchronization, image configuration, and writer ownership implement the research contract. Continue production integration only with that evidence. Constrain workload/support claims to tested boundaries; stop dependent work if correctness or resource enforcement fails. Record the gap rather than silently changing semantics.

Accepted on 2026-10-01. The [Phase 2 record](jobs/2026-10-01-video-frames-implementation.md#phase-2) contains real-tool/image/writer evidence, bounded synthetic workload measurements, limitations, and full implementation-range review.

## Phase 3: Streaming Process Foundation and Frame Resolution

Tasks:

- [x] Extend the process boundary for incremental records, bounded queues and stderr, structured progress, direct child spawning, and operation ownership while preserving existing process-helper callers.
- [x] Implement metadata-first inspection and checked exact arithmetic; reject unsupported numeric representations and keep estimates distinct from verified identities/counts.
- [x] Implement first/frame-N prefix stops, last-frame EOF/buffer handling, and initial full-stream timestamp ordering validation followed by cached early-stop requests. Unreliable timing rejects time selection while valid frame-number selection can retain its verified ordinal.
- [x] Resolve both fixed frame sets before review; revalidate midpoint duration, perform a second pass when needed, retain repeated roles, and fail the complete preset when its required timing/end evidence is unavailable.
- [x] Implement bounded session reuse, eviction, source/stream fingerprint checks, and invalidation before reuse, after scans, and before export.
- [x] Verify parser/metadata limits, slow consumers, decoder failures, source changes, and cancellation of multiple registered/resistant children. Apply two-second cooperative grace and five-second forced-close confirmation where supported; unconfirmed closure prevents replacement operations.

Checkpoint: exact identities and stop conditions pass deterministic and small real-tool checks, state remains bounded, and cancellation restores ownership. Existing video and other process callers retain their behavior.

Accepted on 2026-10-01. The [Phase 3 record](jobs/2026-10-01-video-frames-implementation.md#phase-3) contains streaming/resolution evidence, review fixes, regression results, and full implementation-range review.

## Phase 4: Image Encoding and Safe Publication

Tasks:

- [x] Implement verified format/quality configuration, availability checks, and source-faithful conversion without GIF palette/look behavior or fallback.
- [x] Preserve PNG/WebP alpha; reject non-opaque JPG frames. Apply aspect, supported display transforms, scale, dimension/pixel guards, and metadata reset in the tested order; review and saved pixels must agree.
- [x] Implement destination-volume owned staging, completed-file detection, enforced staging slots/bytes, backpressure, and selection-order publication.
- [x] Cover exclusive hard-link publication and supported exclusive-copy fallback, explicit/generated single-file overwrite and multi-image overwrite, target kinds, source aliases, competing writers, interrupted copies, and safe replacement failure. Never clear existing folders or stale/unrelated files.
- [x] Report published/incomplete outputs accurately across disk-full, encoder, limit, cancellation, and cleanup failures; count only confirmed publication.
- [x] Compare lossless pixels and alpha with independent post-transform references and lossy output with recorded tolerances. Verify actual formats/extensions, unavailable modes, color inference/rejection, asymmetric transforms, and PNG compression cost with small synthetic tool runs.
- [x] Perform private local image-export smoke and publish only processing outcomes. Verify source preservation, safe cleanup behavior, and permitted local review-artifact handling.

Checkpoint: resolved frames produce the requested images, filesystem operations enforce the output contract, and failures preserve/report completed exports. Pixel/filter assertions and fake encoders alone cannot close this phase.

## Phase 5: Sequence Sampling, Destinations, and Naming

Tasks:

- [ ] Implement the forward sampler with exact index-derived targets, first-frame origin, frame-at-time boundaries, incremental timing validation, reliable tail/end handling, repeated selections, and chronological publication.
- [ ] Carry global source ordinals, cadence indices, and serials across bounded batches; do not start a process per image or retain a full frame table.
- [ ] Implement mode-aware default/custom destinations and explicit-file extension validation. One-image sequences remain folders with sequence naming.
- [ ] Implement normalized shared stem, mode-specific placeholders, required selection/serial tokens, verified unpadded frame numbers, serial parameter precedence/start/width, safe names, collisions, and numeric/length exhaustion.
- [ ] Verify constant/variable/sparse timing, exact boundaries, unknown/conflicting ends, duplicate/decreasing/missing starts, decimal rates, oversized intervals, repeated source identities, and late failures. Preserve requested cadence and report actual writes/repeats only on verified completion.
- [ ] Exercise bounded synthetic sequence/resource runs and private sequence smoke; verify output content/order, backpressure, cancellation, reporting, source preservation, safe cleanup behavior, and permitted local review-artifact handling.

Checkpoint: small independent fixtures and actual tool outputs agree on target count, source identity, and filename order. No incomplete timing/export result is promoted to success, and the manual workload stays within its declared budget.

## Phase 6: Direct CLI and Doctor Integration

Tasks:

- [ ] Register the peer command and action exports; validate exactly one selection method, selector grammar, FPS/interval values, format/quality/scale, naming scope, explicit extensions, and conflicts before extraction/final writes.
- [ ] Require both executables before source inspection for every frames method; diagnose source and encoder capability separately from tool availability.
- [ ] Inspect FFprobe availability/version and FFmpeg's advertised PNG/JPG/still-WebP encoders and lossless WebP mode once; reuse bounded probe results across Summary, Details, and JSON without reading media or encoding images. Add `video.frames` for executable availability and separate additive format/mode assessments; refine compact Video readiness/remediation for tool absence, unsupported formats/modes, unknown assessments, and operational probe failures while preserving existing capabilities, field meanings, and doctor exit behavior.
- [ ] Integrate estimated/repeated-selection notices, phase progress, plain stderr output, final actual-result reporting, interruption, and partial failures.
- [ ] Verify command/action validation and doctor consumers with controlled tools; exercise representative direct exports through the built Node.js CLI with small synthetic sources. Record source-test and built-package evidence separately.

Checkpoint: direct invocation implements the settled contract with actionable errors, additive doctor fields, and preserved convert/resize/GIF behavior.

## Phase 7: Guided Interactive Integration

Tasks:

- [ ] Connect one-frame, fixed frame-set, and whole-video sequence branches to the shared resolver/sampler and prototype picker without image previews.
- [ ] Integrate FPS presets/custom input, bounded interval suggestions/estimates, format/conditional quality, scale, destinations, and applicable templates and serial prompts.
- [ ] Resolve single/frame-set identities before text review; show concrete names, dimensions, effective settings, chosen stream where relevant, repeat notices, and estimated sequence counts. Review acceptance owns final writes.
- [ ] Preserve source/selection across option changes and editor/layout round trips; validate retained explicit filenames after format changes and invalidate reuse after observable source/stream changes.
- [ ] Verify progress/input ownership, scan/export cancellation, failure recovery, direct-input fallbacks, resize, and terminal restoration. Unconfirmed child closure ends the flow and prevents replacement work.
- [ ] Exercise real terminal interactions with synthetic sources and private real-video smoke through the built CLI. Inspect images locally; keep captures/private diagnostics local and publish processing outcomes only.

Checkpoint: review and exports identify the same selected frames, essential controls survive layout changes, no tool runs on navigation, and the next ordinary prompt works after completion/cancellation/failure.

## Phase 8: Integrated Verification and Documentation

Tasks:

- [ ] Reconcile every research verification obligation with recorded results or an explicit unresolved support decision. Revisit stress cases when later changes affect their exercised boundary, without routine expensive reruns.
- [ ] Run affected regular suites, type/lint/format/build checks, existing-video regression coverage, and representative built Node.js invocation. Audit shared process/dependency/doctor changes for unaffected callers.
- [ ] Complete the applicable direct/Interactive private smoke checklist and the declared synthetic stress checks; verify accurate failures, cancellation, partial outputs, budget handling, shutdown, safe scratch cleanup, and permitted retention of review artifacts.
- [ ] Record tested builds/platforms and resource measurements with their scope. Declare larger file I/O, demanding codec, or heavy real-content gaps rather than claiming universal large-video compatibility.
- [ ] Write a current video-frames usage guide and update command discovery, dependency/doctor guidance, and testing documentation where affected. Keep smoke scratch policy and private operator details out of product UX.
- [ ] Review public evidence for private source/result identifiers, metadata, captures, images, commands, paths, local setup, and reviewer attribution.
- [ ] Close the plan/job only after required checkpoints pass; assess research completion against its own recorded evidence. Keep unresolved work visible and retain current documents at their normal locations.

Checkpoint: the feature, documented support boundary, regression coverage, real tool evidence, terminal behavior, private processing outcomes, and smoke artifact handling are consistent. Budget exhaustion, unrun required cases, or unresolved process/file ownership prevents completion. Intentional local retention of review artifacts does not prevent completion.

## Execution Records and Completion Rules

Create one `docs/plans/jobs/YYYY-MM-DD-video-frames-implementation.md` when Phase 1 begins. Link it from this plan and record each phase's implementation boundary, checks, synthetic results, generic private processing outcomes, support gaps, and checkpoint conclusion without copying the research or private report. Record the reviewed change range when implementation checkpoints use commits.

The plan becomes `active` when execution starts. Check a task only after its required outcome is recorded, and review coherent phase changes before accepting dependent work. An unresolved feasibility prerequisite or support decision keeps the affected checkpoint open; use `blocked` if execution cannot proceed. A successful narrow experiment is not completion of the whole feature.

Drafting and documentation review alone do not meet implementation or research completion criteria. There is no automatic archive action on completion.
