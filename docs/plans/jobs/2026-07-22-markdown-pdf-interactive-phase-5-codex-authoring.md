---
title: "Markdown PDF Interactive Mode Phase 5 Codex authoring"
created-date: 2026-07-22
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 5 of the Markdown PDF Interactive Mode plan by adding
entry-specific Codex-assisted Profile, Template, and Project preparation over
destination-neutral prepared candidates, bounded signal consent, explicit
regeneration, durable `pdf-recipes` saves, and lifecycle-filtered report state
without taking ownership of Phase 6 materialization or cleanup.

Phase base: `48669f8738e4c690273554b4cabb028e6cfd11a1`.

## Implementation Checklist

- [x] Expose destination-neutral prepared Profile, Template, and Project Codex
      candidates with late output, overwrite, and report binding.
- [x] Keep direct Profile, Template, and Project Codex actions compatible.
- [ ] Enforce the entry-specific artifact and preparation matrix.
- [ ] Reuse the selected `to-pdf` Markdown input and collect an optional
      preparation sample only under `pdf-recipes`.
- [ ] Collect optional intent, editable font hints, and applicable base Profile
      and cover-image signals.
- [ ] Review bounded signals and obtain consent before every Codex request.
- [ ] Hold accepted candidate and report data in memory through review and
      destination changes.
- [ ] Invoke Codex again only after explicit regeneration or revised setup and
      renewed consent.
- [ ] Save durable `pdf-recipes` artifacts and reports only after final review.
- [ ] Retain accepted `to-pdf` lifecycle and report state for Phase 6 without
      materializing an artifact.
- [ ] Add focused request-count, matrix, consent, report, rebind, and no-write
      coverage.
- [ ] Pass focused and repository validation.
- [ ] Review the exact Phase 5 commit range and resolve actionable findings.

## Verification

Current checkpoint:

```bash
bun test test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts test/cli-actions-md-to-pdf-template-codex/prepared.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts
bunx tsc --noEmit
git diff --check
```

The prepared-service slice passed with four tests and zero failures. Broader
direct Profile, Template, and Project Codex coverage passed with 261 tests and
zero failures before the Interactive authoring slice began.

Implementation checkpoint:

- `27b0f81` — destination-neutral Codex preparation and destination-time
  overwrite and report binding

## Review

Pending a validated Phase 5 commit range.

## Artifact Safety

Codex preparation must not write primary artifacts or reports. Output paths
remain local destination state and must not enter consent summaries or Codex
request payloads. Prepared assets and report data remain snapshotted in memory
until an explicit durable commit. Phase 6 owns temporary session directories,
rendering, recovery, and cleanup.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
