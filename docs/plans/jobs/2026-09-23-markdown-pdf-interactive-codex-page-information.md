---
title: "Markdown PDF Interactive Codex page information implementation"
created-date: 2026-09-23
status: in-progress
agent: codex
plan: ../plan-2026-09-23-markdown-pdf-interactive-codex-page-information.md
---

## Scope

Track the implementation, validation, visual review, and documentation
closeout of Interactive Markdown PDF Codex page information in one record.
Update this job as each phase reaches its gate; the linked plan owns the full
checklist and product contract.

## Prerequisite Contract Gate

- [x] Decide which page-information values may be stored in optional Profile
      and Project reports, separately from exact saved Profile content and
      user-visible consent/review.
- [x] Define report compatibility and privacy cases before changing code or
      the shared redactor.
- [x] Decide local consent/review text display against the existing terminal
      color rules and define the escaping checks for implementation.
- [x] Define Phase 3, 4, and 5 rendered-page snapshots and cleanup timing.
- [x] Review the research and plan direction, then record the decision here.

The source trace found that the Profile report stores model patch values and
prose, and the Project report can retain model phase prose. Both can echo page
text even if a new report field contains metadata only. For Interactive runs
with explicit page information, the report contract now uses metadata-only
requested/effective/provenance fields and typed model-result summaries. It
omits raw model patch values and prose. Existing free-form input fields and
runs without explicit page information keep their current retention. The
shared path redactor is unchanged.

The existing Profile version-4 reader accepted a synthetic additive metadata
field. Project bundle recognition checks its report discriminator; it has no
full report reader. Phase 4 will run the synthetic marker, model-echo,
failure, and existing-intent cases against the implemented projection.

Local consent and candidate review show exact page text with terminal control
and formatting characters escaped, including bidirectional controls. The
existing Project escape helper does not cover all formatting controls, so
Phase 4 must verify the expanded display rule. The existing color contract
remains per stream and styles only fixed labels. The plan fixes the Phase 3–5
page snapshot set; each gate will report labeled PNGs
before cleaning its own generated files.

Contract review added C1 and Unicode separator display cases and an enabled
number baseline for the Phase 4 saved-recipe comparison. The prerequisite gate
is complete at the contract level. Phase 1 implementation has not started.

## Phase Progress

| Section | Status | Evidence to record |
| ------- | ------ | ------------------ |
| Phase 1 | Pending | Collection and revision checks; reviewed commit range |
| Phase 2 | Pending | Signal, consent, and request checks; reviewed commit range |
| Phase 3 | Pending | Final Profile and Project handoff checks; first PDF extraction and labeled page snapshots; reviewed commit range |
| Phase 4 | Pending | Review, report projection, and lifecycle checks; saved-recipe and override snapshots; reviewed commit range |
| Phase 5 | Pending | Integrated matrix, built-CLI smoke, final snapshot report, limitations, cleanup, final verdict |
| Phase 6 | Pending | Guide alignment, documentation review, lifecycle closeout |

For each phase, record its exact base and tip commits, checks, accepted review
fixes, visual conclusions where applicable, cleanup, and verdict. Keep
machine-specific setup and raw artifacts out of this record.

## Related Research

- [Interactive Markdown PDF Codex Page Information Signals](../../researches/research-2026-09-22-markdown-pdf-interactive-codex-page-information.md)
