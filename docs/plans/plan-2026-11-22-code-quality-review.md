---
title: "Code Quality Review Implementation Plan"
created-date: 2026-11-22
modified-date: 2026-11-22
status: completed
agent: codex
---

## Scope

Address the ten findings in the Code Quality Review across `src/`, `test/`, and `scripts/`. Preserve public entry points, output contracts, and Node.js compatibility when extracting modules or replacing helpers. [Code Quality Review](../researches/research-2026-11-22-code-quality-review.md#findings)

## Related Research

- [Code Quality Review](../researches/research-2026-11-22-code-quality-review.md)

## Phase Records

Create one unified job record under `docs/plans/jobs/` when implementation starts. Add a phase entry and link its checklist to that entry when the phase begins. Verify and review each implementation phase within that phase, then record its scope, verification results, and review outcome. For committed checkpoints, record the exact reviewed range and update it if corrections widen the review. Close checklist items after their evidence is recorded.

## Phase 1. Markdown fenced-code signals

Scope the change to top-level fences in the renderer’s Pandoc Markdown mode. Share fence recognition across document signals and direct PDF title detection. Preserve signal schemas, limits, privacy, and existing heading and table heuristics outside fenced blocks. [Settled fence decision](../researches/research-2026-11-22-code-quality-review.md#fenced-code-and-document-structure)

[Phase 1 implementation record](jobs/2026-11-22-code-quality-review.md#phase-1-markdown-fenced-code-signals)

- [x] Use one scanner to route lines outside matched fences to title, heading, and table signals and matched openers to code signals.
- [x] Verify both marker types, opener placement, indentation, closing length, trailing text, and unclosed openers against the settled rules and Pandoc. Run the focused Bun signal regressions.
- [x] Verify direct rendering retains the metadata title after a shorter marker inside a valid fence and template layout stays `weak` for a real narrow table alongside a fenced wide lookalike. Run both suites with their ordinary-content cases. [Verification plan](../researches/research-2026-11-22-code-quality-review.md#verification-plan)

## Phase 2. CSV path containment

Replay assumes the canonical working directory and endpoint parents stay stable throughout validation and execution.

[Phase 2 implementation record](jobs/2026-11-22-code-quality-review.md#phase-2-csv-path-containment)

- [x] Validate both endpoint parents and file types for all planned moves before staging any file.
- [x] Share segment-aware lexical containment across replay and file I/O. Preserve each caller’s root-equality rules and reject cross-volume paths.
- [x] Verify nested `..draft` replay, invalid-parent and file rejections before mutation, and Windows drive and UNC rules. Review the exact implementation range under the stable-parent contract.

## Phase 3. Application test cost and coverage

Improve the managed Application suite’s runtime and the value of its assertions. Start with the measured Codex benchmark costs and the video tests near the cutoff. Keep the existing 360-second limit. [Application timing and coverage evidence](../researches/research-2026-11-22-code-quality-review.md#application-test-cost-and-coverage)

[Phase 3 implementation record](jobs/2026-11-22-code-quality-review.md#phase-3-application-test-cost-and-coverage)

- [x] Capture baseline suite and per-file timings. Use streamed case output when a timeout prevents report generation, and run any affected fixture independently to distinguish suite budget pressure from a fixture failure.
- [x] Reduce measured fixture costs by reusing setup or replacing incidental waits with observed events where they preserve the same behavior. Keep representative checks for real deadlines, signals, and process cleanup.
- [x] Audit the affected tests for tautological assertions and duplicate coverage. Use independent expected outcomes and consolidate duplicate cases only when a retained test covers the same behavior at the same boundary.
- [x] Compare focused timings and coverage before and after. Run `bun run test:integration:app` three times sequentially under the existing policy. Require zero failures, errors, or skips, valid reports, and verified cleanup. Record the slowest run and its headroom.

## Phase 4. Markdown PDF remote assets

[Phase 4 implementation record](jobs/2026-11-22-code-quality-review.md#phase-4-markdown-pdf-remote-assets)

- [x] Establish whether supported WeasyPrint versions can enforce the existing remote-asset opt-in at asset load time. Record the evidence and any compatibility decision before implementation.
- [x] Integrate the supported enforcement path and verify default blocking, explicit opt-in, and ordinary local assets with controlled renderer fixtures. If support is insufficient, record the blocker and leave the phase open.

### Follow-Up. WeasyPrint compatibility and guidance

- [x] Show `limited` in `doctor --details` when explicit opt-in is available and default export is unavailable. Preserve the existing JSON readiness fields.
- [x] Show an informational line on stderr when rendering with `--allow-remote-assets`. Use the CLI’s info color when enabled and plain text otherwise.
- [x] Add a compact version table to the Markdown PDF usage guide and link to it from the Interactive guide. Cover the 65.1 minimum for advanced Profile features, explicit opt-in on older renderers, and the 70.0+ protocol allowlist requirement for default and Interactive export.
- [x] Verify default and Interactive export, explicit opt-in, and Doctor with WeasyPrint 65.1, 69.0, and 70.0 in temporary `uv` environments. Check the info line with color enabled and disabled.
- [x] Review the exact follow-up range and record the results in the existing Phase 4 job entry. Cite WeasyPrint’s URL fetcher API and the 70.0 change that applies the configured fetcher to supplied stylesheets. Omit local setup details.

## Phase 5. Codex cancellation coverage

[Phase 5 implementation record](jobs/2026-11-22-code-quality-review.md#phase-5-codex-cancellation-coverage)

- [x] Wait for `config/read` before cancelling and track every fixture PID across invocations.
- [x] Run the discovery transport tests and verify termination of each launched fixture process.

## Phase 6. Inline prompt lifecycle

[Phase 6 implementation record](jobs/2026-11-22-code-quality-review.md#phase-6-inline-prompt-lifecycle)

- [x] Share terminal setup, cancellation, and teardown across path and text prompts. Keep completion behavior local and use `Set` for path suggestions in their existing order.
- [x] Run the prompt tests for completion, cancellation, and terminal restoration.

## Phase 7. Image framing modules

[Phase 7 implementation record](jobs/2026-11-22-code-quality-review.md#phase-7-image-framing-modules)

- [x] Separate the PNG, WebP, and JPEG streaming parsers behind the existing factory.
- [x] Run framing and publication tests for chunk boundaries, output bytes, and sink backpressure.

## Phase 8. Markdown PDF mock registrations

[Phase 8 implementation record](jobs/2026-11-22-code-quality-review.md#phase-8-markdown-pdf-mock-registrations)

- [x] Split the session, authoring, and rendering mock registrations and counters by service behind the existing harness entry point.
- [x] Run the interactive Markdown PDF tests that consume those registrations and verify the same observed calls and state transitions.

## Phase 9. Test-runner launch preflight

[Phase 9 implementation record](jobs/2026-11-22-code-quality-review.md#phase-9-test-runner-launch-preflight)

- [x] Extract launch validation behind the existing process runner entry point and preserve the distinction between launch rejection and spawn failure.
- [x] Run the process-runner tests for launch errors, output draining, and group shutdown.

## Phase 10. CRC-32 built-in

[Phase 10 implementation record](jobs/2026-11-22-code-quality-review.md#phase-10-crc-32-built-in)

- [x] Replace the PNG and three fixture-generator checksum implementations with `node:zlib.crc32`.
- [x] Compare PNG checksum results and generated fixture bytes, and run the affected image-framing and fixture tests.

## Phase 11. Docs Validation

[Phase 11 validation record](jobs/2026-11-22-code-quality-review.md#phase-11-docs-validation)

- [x] Validate the affected research, plan, and unified job record for working links, headings, Mermaid rendering, repository-relative references, and public-safe wording.
- [x] Reconcile phase checklists and document statuses with the recorded implementation and review evidence.
- [x] Resolve documentation discrepancies and record the documentation validation outcome in the unified job record.
