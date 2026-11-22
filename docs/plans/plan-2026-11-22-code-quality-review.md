---
title: "Code Quality Review Implementation Plan"
created-date: 2026-11-22
modified-date: 2026-11-22
status: active
agent: codex
---

## Scope

Address the nine findings in the Code Quality Review across `src/`, `test/`, and `scripts/`. Start with Markdown PDF fence signals. Preserve public entry points, output contracts, and Node.js compatibility when extracting modules or replacing helpers. [Code Quality Review](../researches/research-2026-11-22-code-quality-review.md#findings)

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

- [ ] Define whether replay must tolerate concurrent parent replacement. Validate both endpoint parents for stable-parent preflight. If concurrent replacement is in scope, enforce containment during the move.
- [ ] Share segment-aware lexical containment where callers have matching contracts. Preserve each caller’s root-equality rules and reject cross-volume paths.
- [ ] Verify allowed paths such as `..draft`, rejections for out-of-root parents and cross-volume paths, and the accepted concurrency contract using isolated fixtures.

## Phase 3. Markdown PDF remote assets

- [ ] Establish whether supported WeasyPrint versions can enforce the existing remote-asset opt-in at asset load time. Record the evidence and any compatibility decision before implementation.
- [ ] Integrate the supported enforcement path and verify default blocking, explicit opt-in, and ordinary local assets with controlled renderer fixtures. If support is insufficient, record the blocker and leave the phase open.

## Phase 4. Codex cancellation coverage

- [ ] Wait for `config/read` before cancelling and track every fixture PID across invocations.
- [ ] Run the discovery transport tests and verify termination of each launched fixture process.

## Phase 5. Inline prompt lifecycle

- [ ] Share terminal setup, cancellation, and teardown across path and text prompts. Keep completion behavior local and use `Set` for path suggestions in their existing order.
- [ ] Run the prompt tests for completion, cancellation, and terminal restoration.

## Phase 6. Image framing modules

- [ ] Separate the PNG, WebP, and JPEG streaming parsers behind the existing factory.
- [ ] Run framing and publication tests for chunk boundaries, output bytes, and sink backpressure.

## Phase 7. Markdown PDF mock registrations

- [ ] Split the session, authoring, and rendering mock registrations and counters by service behind the existing harness entry point.
- [ ] Run the interactive Markdown PDF tests that consume those registrations and verify the same observed calls and state transitions.

## Phase 8. Test-runner launch preflight

- [ ] Extract launch validation behind the existing process runner entry point and preserve the distinction between launch rejection and spawn failure.
- [ ] Run the process-runner tests for launch errors, output draining, and group shutdown.

## Phase 9. CRC-32 built-in

- [ ] Replace the PNG and three fixture-generator checksum implementations with `node:zlib.crc32`.
- [ ] Compare PNG checksum results and generated fixture bytes, and run the affected image-framing and fixture tests.

## Phase 10. Docs Validation

- [ ] Validate the affected research, plan, and unified job record for working links, headings, Mermaid rendering, repository-relative references, and public-safe wording.
- [ ] Reconcile phase checklists and document statuses with the recorded implementation and review evidence.
- [ ] Resolve documentation discrepancies and record the documentation validation outcome in the unified job record.
