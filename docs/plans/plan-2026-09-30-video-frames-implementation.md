---
title: "Video Frames Implementation Plan"
created-date: 2026-09-30
modified-date: 2026-10-01
status: active
agent: codex
---

## Goal and Planning Boundary

Implement `cdx-chores video frames` for one exact source frame, a fixed frame set, or a whole-video sequence of PNG, JPG, or still WebP images. Deliver the direct CLI and guided Interactive flow while preserving convert, resize and GIF processing behavior. The Phase 8 follow-up also aligns GIF output presentation.

Phases 1–7 and the original Phase 8 checkpoint are complete. The accepted checkpoints cover terminal prototypes, real-tool feasibility, exact resolution, verified backend image export, exact sequence sampling, destinations/naming, private processing smoke, direct CLI/doctor integration, the guided Interactive flow, and output/menu/progress UX refinement. Phase 8's output information follow-up and Phase 9's integrated verification, documentation and research closure remain pending. See the [unified execution record](jobs/2026-10-01-video-frames-implementation.md) for evidence and complete-range checkpoint reviews.

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

- [x] Implement the forward sampler with exact index-derived targets, first-frame origin, frame-at-time boundaries, incremental timing validation, reliable tail/end handling, repeated selections, and chronological publication.
- [x] Carry global source ordinals, cadence indices, and serials across bounded batches; do not start a process per image or retain a full frame table.
- [x] Implement mode-aware default/custom destinations and explicit-file extension validation. One-image sequences remain folders with sequence naming.
- [x] Implement normalized shared stem, mode-specific placeholders, required selection/serial tokens, verified unpadded frame numbers, serial parameter precedence/start/width, safe names, collisions, and numeric/length exhaustion.
- [x] Verify constant/variable/sparse timing, exact boundaries, unknown/conflicting ends, duplicate/decreasing/missing starts, decimal rates, oversized intervals, repeated source identities, and late failures. Preserve requested cadence and report actual writes/repeats only on verified completion.
- [x] Exercise bounded synthetic sequence/resource runs and private sequence smoke; verify output content/order, backpressure, cancellation, reporting, source preservation, safe cleanup behavior, and permitted local review-artifact handling.

Phase 5 is accepted. Implementation, verification, and complete-range review evidence are recorded in the [Phase 5 checkpoint](jobs/2026-10-01-video-frames-implementation.md#phase-5).

Checkpoint: small independent fixtures and actual tool outputs agree on target count, source identity, and filename order. No incomplete timing/export result is promoted to success, and the manual workload stays within its declared budget.

## Phase 6: Direct CLI and Doctor Integration

Tasks:

- [x] Register the peer command and action exports; validate exactly one selection method, selector grammar, FPS/interval values, format/quality/scale, naming scope, explicit extensions, and conflicts before extraction/final writes.
- [x] Require both executables before source inspection for every frames method; diagnose source and encoder capability separately from tool availability.
- [x] Inspect FFmpeg/FFprobe availability and versions using the executables invoked by frames execution; assess advertised PNG/JPG/still-WebP support through exact encoder entries (`png`, `mjpeg`, `libwebp`). Check `libwebp`'s BGRA input support for the verified recipe and assess its lossless mode separately for WebP `full`; version numbers and package labels do not establish capability. Reuse one bounded inspection across Summary, Details, and JSON without reading media or encoding images. Add `video.frames` for executable availability and separate additive format/mode assessments; refine compact Video readiness/remediation for tool absence, unsupported formats/modes, unknown assessments, and operational probe failures while preserving existing capabilities, field meanings, and doctor exit behavior.
- [x] Integrate estimated/repeated-selection notices, phase progress, plain stderr output, final actual-result reporting, interruption, and partial failures.
- [x] Verify command/action validation and doctor consumers with controlled tools, including present/missing encoder entries, supported/unsupported WebP input and lossless mode, unknown successful probe output, and operational probe failures. Exercise representative direct exports through the built Node.js CLI with small synthetic sources; actual encoding/pixel evidence remains separate from advertised doctor assessments. Record source-test and built-package evidence separately.

Checkpoint: direct invocation implements the settled contract with actionable errors, additive doctor fields, and preserved convert/resize/GIF behavior.

Phase 6 is accepted. Implementation, verification, and complete-range review evidence are recorded in the [Phase 6 checkpoint](jobs/2026-10-01-video-frames-implementation.md#phase-6).

## Phase 7: Guided Interactive Integration

Build on the accepted Phase 1 prototypes and give the integrated flow its own TUI review and polish checkpoint. Follow the research's [wave and adaptive-layout contract](../researches/research-2026-09-30-video-frames.md#wave-picker-and-adaptive-terminal-layout) and existing [CLI output/color guidance](../guides/cli-output-and-color.md). Styling work preserves selection semantics, input ownership, and the shared export contract.

Tasks:

### Integration

- [x] Connect one-frame, fixed frame-set, and whole-video sequence branches to the shared resolver/sampler and prototype picker without image previews.
- [x] Integrate FPS presets/custom input, bounded interval suggestions/estimates, format/conditional quality, scale, destinations, and applicable templates and serial prompts.
- [x] Resolve single/frame-set identities before text review; show concrete names, dimensions, effective settings, chosen stream where relevant, repeat notices, and estimated sequence counts. Review acceptance owns final writes.
- [x] Preserve source/selection across option changes and editor/layout round trips; validate retained explicit filenames after format changes and invalidate reuse after observable source/stream changes.

### TUI Review and Polish

- [x] Review visual hierarchy, spacing, labels, control hints, and notice/error placement across selection menus, frame/time editors, settings, final review, progress, cancellation, and recovery. Keep presentation consistent with existing Interactive flows and essential information readable.
- [x] Polish full/compact picker presentation within the settled contract: thin mirrored bars, selected-bar accent, aligned triangles, endpoint labels, and coarse-position/precision notices. Make candidate positions and resolved frame identities clear; retain the synthetic distance cue, exact selection, and glyph preference.
- [x] Prepare a built-CLI terminal walkthrough with small synthetic sources for local presentation review; optional captures/transcripts stay in the ignored synthetic smoke workspace. Address actionable findings and recheck affected states before acceptance. Public TUI findings/evidence use synthetic content; private captures and inspection notes stay local under the privacy policy.

### Verification and Acceptance

- [x] Verify the integrated TUI in real Node.js terminals across wide/narrow and tall/short layouts, long source/output labels, wrapped controls/notices, Unicode/ASCII, and color enabled/disabled. Exercise resize and full/compact/direct-input transitions, including editor drafts and richer-layout restoration; essential controls, selection details, and precision notices must fit the measured display area.
- [x] Verify progress/input ownership, scan/export cancellation, failure recovery, direct-input fallbacks, resize, and terminal restoration. Unconfirmed child closure ends the flow and prevents replacement work.
- [x] Exercise real terminal interactions with synthetic sources and private real-video smoke through the built CLI. Inspect images locally; keep captures/private diagnostics local and publish processing outcomes only.

Keep layout/state assertions in inexpensive regular tests; assess visual presentation through the explicit built-CLI terminal walkthroughs above. Use the existing smoke budgets and small synthetic sources for presentation work; repeat only affected cases after polishing. Human review time remains outside the active processing budget.

Checkpoint: functional verification and the dedicated TUI review/polish pass are recorded, with actionable presentation findings addressed and affected cases rechecked. Review and exports identify the same selected frames, essential controls survive layout changes, no tool runs on navigation, and the next ordinary prompt works after completion/cancellation/failure.

Phase 7 is accepted. Integration, TUI review/polish, native terminal verification, private processing outcomes, and complete-range review evidence are recorded in the [Phase 7 checkpoint](jobs/2026-10-01-video-frames-implementation.md#phase-7).

## Phase 8: UX Review and Polish

Review direct CLI and guided frames UX in the three directions below. Reuse existing prompt, terminal and color helpers. Preserve exact frame/cadence semantics, confirmed publication accounting, and operation/input ownership. Follow the research's [progress contract](../researches/research-2026-09-30-video-frames.md#streaming-frame-resolution) and [CLI output/color guidance](../guides/cli-output-and-color.md).

Tasks:

### Output Path Presentation

- [x] Refine completion and partial-output messages: place each destination/retained-output path on its own indented line in standard cyan without bold; use natural image plurals and remove added sentence periods. Preserve path characters, relative/absolute display policy and stream routing. Respect target-stream TTY eligibility, `NO_COLOR` and `--no-color`; styled and plain output retain identical wording and layout.

### Selection Menus

- [x] Review frames selection/settings menus for ordering, labels, estimates, controls and disabled choices. Remove circular pagination/wraparound in these menus; use concise preset labels with selected-option descriptions for estimates. Keep long/wrapped content and essential controls readable within the measured terminal area.
- [x] Correct Back/Escape parent targets so navigation returns one logical prompt level, including cadence, presets and custom input. Keep explicitly named source/cancel actions distinct; preserve applicable choices and editor drafts when revisiting prompts. Recheck remaining frames menus for consistent labels/routes and verify navigation alone does not start decoding.

### Streaming Progress Reporting

- [x] Coordinate one frames progress presenter per active operation across direct and Interactive execution. Replace accumulating TTY updates with a compact live status adapted to terminal width; use throttled plain stderr lines for non-TTY progress and stdout for final results. Start near two updates per second, avoid duplicate headings/interleaved renderers, and clear live status before results, errors or the next prompt.
- [x] Report actual inspection, scanning, validation, export and finishing activity with honest units: inspected source frames, frames extracted for export and confirmed images written are distinct. Provide elapsed time/activity for unknown totals and label estimates explicitly; reaching an estimate does not establish completion. Show Stopping once while cancellation settles; distinguish cancelled/failed/completed outcomes and retain fatal child-closure precedence.

### Verification and Acceptance

- [x] Record finding/fix/recheck evidence for each direction. Run affected controlled output/menu/progress tests, type/lint/format/build checks and a built Node.js terminal walkthrough with small synthetic content. Cover single-file/folder and long paths, color/plain/redirected output, narrow layouts/resize, Back/Escape retention, slow stages, cancellation/failure, and next-prompt restoration. Review the complete Phase 8 commit range and resolve actionable findings before acceptance.

Use the existing smoke workspace, privacy/retention policy and development budgets. Regular tests use controlled tools; repeat native image processing only when a changed boundary needs it, without routine heavy-video reruns. Record public findings with synthetic examples and keep private screenshots, resource details and diagnostics local.

Checkpoint: the three UX directions have recorded fixes and affected rechecks; paths, menu navigation and live progress remain readable and accurate through completion, cancellation and failure. All Phase 8 tasks and the complete-range review must pass before Phase 9 begins.

The original Phase 8 checkpoint is accepted. Finding/fix/recheck evidence, controlled regression results, built Node.js terminal checks and complete-range review are recorded in the [Phase 8 checkpoint](jobs/2026-10-01-video-frames-implementation.md#phase-8). The follow-up below remains pending.

### Follow-Up: Prompt and Output Information

Implement the research's [output information consistency findings and presentation rules](../researches/research-2026-09-30-video-frames.md#output-information-consistency) across frames and the relevant GIF output surfaces. This checklist owns implementation and acceptance. Preserve the six accepted tasks above and their evidence. Accept this follow-up before Phase 9 begins. GIF changes concern presentation. Preserve its processing modes, option semantics and destination rules.

- [ ] Use the exact `Use default output` choice label in frames and GIF. Show the highlighted choice's mode-specific location hint below the choices: `Image beside the source`, `Frames folder beside the source` or `GIF file beside the source`. Keep this generic hint free of filenames/paths. Verify active and accepted prompt states with the installed prompt library, including narrow layouts; cover other callers if the shared output-choice helper changes.
- [ ] Show compact image estimates beside interval presets, with natural plurals and consistent detail placement. Cover ordinary, matching/exceeding-duration and unavailable estimates, plus valid/invalid custom input. Keep estimate qualifications and controls visible through narrow layouts/resize; padding and wrapping must preserve the count.
- [ ] Reveal the effective default/current naming combination: template, source stem, selected extension, applicable sequence start/minimum width and resulting filename examples. Refresh examples after relevant settings change using the shared naming rules. Keep unresolved source-frame values explicit and preserve explicit-file naming bypass and draft retention.
- [ ] Revalidate retained explicit output filenames when format changes. An incompatible extension must return to the destination editor with its draft retained before export review. Keep user-entered filenames literal and require a valid extension for the selected format.
- [ ] Make frames export review and GIF completion reporting follow the accepted path/color layout. Put actual destination paths on separate indented lines and keep filenames readable apart from frame details. Show quality and estimated counts once in frames review; retain the direct CLI's pre-export estimate notice. Use precise collision wording (`Stop on filename conflict` / `Replace matching images`) and preserve existing/nonempty-folder disclosures, partial/retained-output accounting, stream routing and color/plain equivalence. Cover both GIF conversion modes.
- [ ] Surface the existing destination-volume inspection in frames review and direct pre-export diagnostics: readable available space when known, or `Available space unknown`. Keep it advisory and reuse the research's resource policy; an unavailable inspection continues normally.
- [ ] Verify the follow-up with affected controlled Node prompt/naming/output/GIF checks, required type/lint/format/build checks and focused built Node.js terminal walkthroughs using small synthetic content. Cover retained-file format changes, count/boundary wording, changing naming inputs, known/unknown space, GIF default/custom choices and both completion paths, color/plain/redirected output, resize and Back/Escape retention without decoding on navigation. Recheck shared-helper consumers where affected. Record finding/fix/recheck evidence and review the complete follow-up change range before acceptance, using the existing smoke/privacy/retention policy and budgets.

Follow-up checkpoint: frames and GIF output information follows consistent labels, hint placement and path layout; frames estimates, naming, collision/space information and retained filenames are accurate before export. Implementation and verification remain pending; documentation review does not check these tasks.

## Phase 9: Integrated Verification and Documentation

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
