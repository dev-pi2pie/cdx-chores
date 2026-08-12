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

- [ ] Add the typed renderer-contract catalog and shared launch pair.
- [ ] Add deterministic harness and lifecycle coverage.
- [ ] Run the `65.1`, `68.0`, and `69.0` renderer-contract matrix.
- [ ] Run the candidate-selected `doctor --json` and current `md to-pdf`
      actual-launch lane.
- [ ] Extract page evidence and inspect representative rendered pages.
- [ ] Record capability-specific baselines and a Continue/Constrain/Stop
      verdict.
- [ ] Clean successful laboratories and close retained diagnostic laboratories
      when resolved or abandoned.
- [ ] Run focused and repository validation.
- [ ] Review the exact Phase 1 commit range and resolve actionable findings.

## Evidence Status

Implementation and renderer execution have not started. No capability baseline
is accepted yet.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
