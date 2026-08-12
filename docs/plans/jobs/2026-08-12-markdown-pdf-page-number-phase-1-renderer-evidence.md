---
title: "Markdown PDF page-number Phase 1 renderer evidence"
created-date: 2026-08-12
status: active
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Establish the renderer-capability evidence required before the page-number
Profile contract is extended. This job covers reusable contract inputs,
isolated WeasyPrint candidate runs, the current `md to-pdf` launch control,
page-by-page extraction, representative visual inspection, and guarded
temporary-laboratory cleanup.

The job records only public-safe versions, outcomes, limitations, and
conclusions. It does not record local environment names, activation commands,
resolved paths, or raw machine reports.

## Starting Boundary

- Starting commit: `de646be9`.
- The worktree was clean before Phase 1 began.
- The implementation plan is `active`.
- The related research is `in-progress` until renderer evidence is recorded.

## Permanent File Boundary

Phase 1 may add exactly these permanent implementation/evidence files before a
separate expansion review:

- `test/fixtures/markdown-pdf/page-number-renderer-contract.ts`
- `test/fixtures/markdown-pdf/page-number-launch.md`
- `test/fixtures/markdown-pdf/page-number-launch-profile.yml`
- `scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts`
- `test/markdown-pdf-page-number-renderer-evidence.test.ts`

This job record and evidence-supported updates to the parent plan and research
are also expected. Generated HTML/CSS, copied inputs, PDFs, PNGs, reports, and
candidate environments remain in the ownership-marked OS temporary laboratory
and are not committed.

## Tasks

- [x] Add the typed renderer-contract catalog and shared launch pair.
- [x] Add deterministic harness and lifecycle coverage.
- [x] Run the `65.1`, `68.0`, and `69.0` renderer-contract matrix.
- [x] Run the candidate-selected `doctor --json` and current `md to-pdf`
      actual-launch lane.
- [x] Extract page evidence and inspect representative rendered pages.
- [x] Record capability-specific baselines and a Continue/Constrain/Stop
      verdict.
- [x] Clean successful laboratories and close retained diagnostic laboratories
      when resolved or abandoned.
- [x] Run focused and repository validation.
- [ ] Review the exact Phase 1 commit range and resolve actionable findings.

## Evidence Status

The renderer matrix, current-launch control, extraction checks, representative
visual inspection, laboratory closeout, and repository validation are
complete. Phase 1 remains active until exact-range review closes.

## Renderer Matrix

Every candidate used the same Python minor and the same pinned supporting
packages. The shared environment contract was Python `3.11.14`, Pydyf
`0.12.1`, FontTools `4.63.0`, and Pango `1.57.0`.

| Evidence lane                        | WeasyPrint 65.1 | WeasyPrint 68.0 | WeasyPrint 69.0 |
| ------------------------------------ | --------------- | --------------- | --------------- |
| Required renderer-contract scenarios | Pass            | Pass            | Pass            |
| Repagination sentinel                | Pass            | Pass            | Pass            |
| Generated and legacy body-hook cases | Pass            | Pass            | Pass            |
| Candidate-selected `doctor --json`   | Pass            | Pass            | Pass            |
| Current `md to-pdf` actual launch    | Pass            | Pass            | Pass            |

The initial run was inconclusive because the configured page-image executable
was unavailable. It did not affect baseline selection. The harness was changed
to the available Poppler executable, the same matrix was rerun, and the retained
diagnostic laboratory was removed after the issue was resolved.

## Provisional Capability Baselines

The recorded evidence result identifies WeasyPrint `65.1` as the lowest passing
candidate for every retained capability. Phase 1 acceptance remains pending
the exact-range review.

- document and body sequence origins
- `start: 0`, default arithmetic, and `increment: 2`
- document and body visibility boundaries
- all six margin-box positions
- portrait and landscape pages, narrow margins, and inserted blank pages
- bounded typography, color, separators, and spacing
- physical page totals and the informative long-content repagination sentinel

The actual-launch lane proves candidate selection and compatibility with the
currently shipped command. It does not claim that the later advanced Profile
fields are already implemented.

## Phase 2 Value Domains

The boundary fixture passed on every candidate with the following proposed
public domains. Phase 2 must encode these exact constraints rather than accept
arbitrary CSS:

| Field             | Accepted domain                                                                                        | Zero rule                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `fontSize`        | `pt` length from `6pt` through `12pt`, with at most one fractional digit                               | zero invalid                                 |
| `fontWeight`      | `400`, `500`, `600`, or `700`                                                                          | not applicable                               |
| `lineHeight`      | unitless number from `1` through `2`                                                                   | zero invalid                                 |
| `color`           | six-digit hexadecimal color, case-insensitive                                                          | not applicable                               |
| `separator.width` | `pt` length from `0.25pt` through `2pt`, with at most two fractional digits                            | zero invalid; omit `separator` to disable it |
| `separator.style` | `solid`                                                                                                | not applicable                               |
| `separator.color` | six-digit hexadecimal color, case-insensitive                                                          | not applicable                               |
| `separator.gap`   | `mm` length from `0mm` through `4mm`, with at most one fractional digit; numeric zero is also accepted | unitless zero valid                          |

Representative rendered pages covered every position and the documented
domain endpoints. Visual inspection found no clipping, overlap, illegible
text, misplaced separator, incorrect visibility transition, or orientation
defect.

## Pre-Live Checkpoint Commits

- `299cedc5` — compact fixture catalog, evidence harness, deterministic tests,
  lifecycle records, and pre-live review fixes.
- `9184a9fa` — explicit shared-Python executable selection for candidate
  consistency.

## Verdict

**Recorded result: Continue.** The retained sequence, visibility, positioning,
and bounded style capabilities have a reproducible WeasyPrint `65.1` evidence
result. Phase 2 may encode the value domains above only after the exact-range
review accepts Phase 1. The final evidence commit and reviewed range will be
recorded during that closeout.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
