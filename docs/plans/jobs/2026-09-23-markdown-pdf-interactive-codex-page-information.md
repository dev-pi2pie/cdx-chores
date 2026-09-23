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

Phases 1–2 verify the new collection and preparation paths internally. Phase 3
verifies exact saved and rendered artifacts without retaining an optional Codex
diagnostic report. The normal Interactive save/render path accepts the new
choices only after Phase 4 verifies local review and report omission.

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

The saved Profile keeps exact page text. Codex receives it after consent only
when a request is needed. The existing optional Profile and Project diagnostic
reports gain requested-choice and validated final stored metadata: number
settings, selected and stored header/footer positions, and reserved-slot
clear/retain outcome. The new fields do not copy labels, repeating text,
previews, or rendering claims, and they do not infer slot provenance. An attempt-based
omission marker and safe result summary replace raw Codex result values and
prose on these runs; independently entered intent and font hints retain
their existing behavior. The shared path redactor is unchanged.

The Profile version-4 reader accepts additive fields and an absent optional
decision; the Project bundle recognizes its existing report discriminator.
These are structural compatibility checks, not a promise to retain model
prose. Phase 4 will test the omission marker, synthetic model echoes,
failure, direct-command compatibility, and independently entered intent.

Local consent and candidate review show exact page text with terminal control
and formatting characters escaped, including bidirectional controls. The
existing Project escape helper does not cover all formatting controls, so
Phase 4 must verify the expanded display rule. The existing color contract
remains per stream and styles only fixed labels. The plan fixes the Phase 3–5
page snapshot set; each gate will report labeled PNGs before cleaning its own
generated files.

Contract review added C1 and Unicode separator display cases and an enabled
number baseline for the Phase 4 saved-recipe comparison. The prerequisite gate
also requires Project handoff and font review to use in-memory results so
reduced report fields do not remove visible feedback. The revised report
contract distinguishes stored positions from rendered output, omits slot
provenance, and ties the omission marker to actual model attempts. The gate is
complete at the contract level.

## Phase Progress

| Section | Status | Evidence to record |
| ------- | ------ | ------------------ |
| Phase 1 | Complete | Collection and revision checks; reviewed commit range |
| Phase 2 | Complete | Signal, consent, and request checks; reviewed commit range |
| Phase 3 | Pending | Final Profile and Project handoff checks; first PDF extraction and labeled page snapshots; reviewed commit range |
| Phase 4 | Pending | Review, report projection, and lifecycle checks; saved-recipe and override snapshots; reviewed commit range |
| Phase 5 | Pending | Integrated matrix, built-CLI smoke, final snapshot report, limitations, cleanup, final verdict |
| Phase 6 | Pending | Guide alignment, documentation review, lifecycle closeout |

For each phase, record its exact base and tip commits, checks, accepted review
fixes, visual conclusions where applicable, cleanup, and verdict. Keep
machine-specific setup and raw artifacts out of this record.

Phase 1 implementation range: `4ff30540..b684afe4`. Its collector and
revision gate passed. Focused collection and Formal Guide checks passed (65 tests), as did
focused setup and existing Interactive entry checks (23 tests), TypeScript,
scoped lint and format checks, and whitespace validation. Later base selection
and replacement preserve explicit ON selections without adding newly occupied
slots; OFF remains OFF. The managed application suite stopped before testing
because its process-observation prerequisite was unavailable here; the focused
application files passed through direct Bun execution. Commit-range review
found missing base-revision and navigation coverage, plus ambiguity about
retained text while repeating content is OFF. Follow-up tests cover replacement,
Back/Cancel, and ON-to-OFF-to-ON revision; the inactive draft rule is explicit
in the collector. Independent maintainability and test re-reviews of the widened
range found no remaining material issue. No PDF artifact is due at this gate.

Phase 2 implementation range: `d970f0b9..38d3675e`. Its signal, consent, and
request gate passed. The internal structured signal keeps exact active text and
placeholders, drops inactive OFF drafts and conflict data, and rejects invalid
guided number settings or page text over 512 characters. Page-information-only
Profile and Project paths make zero model requests; removing the last explicit
group restores Project's low-signal result. Mixed runs obtain consent before
Profile or Project requests and retain one model selection across phases and
retries. Local consent escapes controls and formatting characters while
preserving plain text and per-stream heading styling. Optional diagnostic
report retention is guarded until Phase 4 implements its safe projection.

The initial Profile/Project action regression slice passed (222 tests). Focused
collector/signal/consent unit checks passed (27 tests), as did adjacent
Interactive and helper application checks (29 tests), TypeScript, scoped lint
and format checks, and whitespace validation. An existing mocked service test
needed its export fixture updated for the new report guard; it now passes.
No PDF artifact is due at this gate.

The first Phase 2 commit-range review found a late report-binding path that
could retain a Codex echo of entered text. Prepared Profile and Project state
now blocks optional reports at bind and write boundaries, including direct
report writing. Follow-up checks cover synthetic echoed text, explicit OFF
with inactive drafts, and declined Project consent. The Profile/Project action
slice passed again (225 tests); focused follow-up unit and application slices
passed (14 and 21 tests). Independent code, test, and security re-reviews of
the widened range found no remaining material issue.

## Related Research

- [Interactive Markdown PDF Codex Page Information Signals](../../researches/research-2026-09-22-markdown-pdf-interactive-codex-page-information.md)
