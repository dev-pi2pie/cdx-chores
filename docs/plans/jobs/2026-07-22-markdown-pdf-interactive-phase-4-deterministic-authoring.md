---
title: "Markdown PDF Interactive Mode Phase 4 deterministic authoring"
created-date: 2026-07-22
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 4 of the Markdown PDF Interactive Mode plan by adding shared,
deterministic Profile and Template preparation for `starter` and
`formal-guide`, durable `pdf-recipes` saves, and the Phase 4 lifecycle choices
needed by `to-pdf` without taking ownership of Phase 6 temporary directories or
recovery behavior.

Phase base: `c456e2c`.

## Implementation Checklist

- [ ] Add destination-neutral prepared Profile and Template services.
- [ ] Keep direct Profile and Template initialization behavior compatible.
- [ ] Add shared `starter` preparation for Profile and Template artifacts.
- [ ] Add grouped `formal-guide` collection and revision.
- [ ] Enforce the deterministic artifact matrix and keep Project unavailable.
- [ ] Save durable `pdf-recipes` artifacts only after final review.
- [ ] Require explicit durable output paths from the direct initialization contract.
- [ ] Expose temporary-render and save-and-render choices without materializing a
      Phase 6-owned temporary directory.
- [ ] Add focused parity, matrix, revision, lifecycle, and no-write coverage.
- [ ] Pass focused and repository validation.
- [ ] Review the exact Phase 4 commit range and resolve actionable findings.

## Review

Pending a validated Phase 4 commit range.

## Artifact Safety

Deterministic preparation must remain side-effect free. Durable writes may
target only the reviewed explicit output. Temporary session directory creation,
cleanup, failure retention, and recovery remain deferred to Phase 6.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
