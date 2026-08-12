---
title: "Markdown PDF page-number Phase 8 Project coordination"
created-date: 2026-08-12
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Coordinate the authoritative normalized base and final Profiles with generated
Template structure and stylesheet validation in direct
`md pdf-project codex`. Reuse the Phase 3 body-boundary validator and Phase 6
diagnostic and capability contracts, return typed validation results, and
complete all validation before any Project bundle handoff.

Phase 8 owns validation computation only. Phase 9 remains responsible for
serializing validation results into summaries or reports and for Project
artifact references and render-command handoff.

## Starting Boundary

- Starting commit: `7b7ae9b5`.
- Phase 7 is completed; the parent plan remains `active`.
- The related research remains `in-progress` while later phases continue.
- The worktree was clean when Phase 8 was activated.
- No Phase 8 implementation or validation evidence is claimed by this
  activation record.

## Permanent File Boundary

- Production changes, if required by the 8A through 8D audits, remain in the
  existing Project Profile/Template coordination, generated-structure and
  generated-stylesheet validation, shared diagnostic, capability-requirement,
  and prepared Project-flow seams.
- Tests extend existing Project helper, Profile patch, Template generation,
  structure validation, stylesheet ownership, diagnostic, temporary cleanup,
  and no-output coverage.
- Fixture additions remain compact, reviewed, and limited to deterministic
  source inputs needed for the named allowed and rejected cases.
- This job and its parent plan are the Phase 8 execution and evidence records.
- No generated Project bundle, Profile, Template, Stylesheet, HTML, CSS, PDF,
  PNG, renderer environment, raw report, or validation output is committed.

## Temporary Inspection Boundary

- Prefer process-owned in-memory values throughout validation.
- If parser or file-shape inspection requires filesystem inputs, use one
  uniquely named, ownership-marked OS-temporary inspection area.
- Guard cleanup by the exact resolved inspection path and ownership marker;
  refuse unmarked, missing-marker, or broader parent paths.
- Clean the inspection area on success and handled failure. Retain it only for
  a failed or inconclusive investigation that requires explicit follow-up.
- Local activation commands, environment names, resolved temporary paths, raw
  errors, and host-specific details remain private and are not copied into
  public records.

## Subphase Checkpoints

- [x] Activate Phase 8 and record starting commit `7b7ae9b5`.

### 8A: Authoritative Base Profile And Final Profile

- [ ] Audit the direct Project flow from shared signals through Profile,
      Template, validation, and existing write/report/handoff boundaries.
- [ ] Shape-validate and normalize `--base-profile` before either Codex phase;
      reject malformed content, unknown keys, invalid arithmetic, and invalid
      scope/origin combinations.
- [ ] Use the normalized base Profile as the authoritative bounded-patch base
      and the normalized final Profile as the sole page-number contract passed
      onward.
- [ ] Prove omitted keys preserve values; valid present values, including
      `false` and `0`, replace them exactly; and `null`, unknown, or invalid
      keys fail.
- [ ] Cover preservation, explicit revision, and every invalid boundary with
      focused base/final Profile fixtures and direct patch tests.
- [ ] Record the 8A checkpoint commit and evidence below before 8B begins.

### 8B: Template Coordination

- [ ] Pass the normalized final Profile into Template coordination without
      copying Profile-owned page-number or page-chrome policy into Template
      signals or generated Template CSS.
- [ ] Preserve Template ownership of layout, cover, title, ToC, code, and asset
      decisions without adding a Project-specific page-number schema.
- [ ] Reuse Phase 6 capability requirements and diagnostic payload types
      without probing the installed renderer or inventing another matrix.
- [ ] Record the 8B checkpoint commit and evidence below before 8C begins.

### 8C: Generated Structure And CSS Validation

- [ ] Inspect actual generated `template.html` and require one usable
      `.document-body` containing the live `$body$` insertion point plus the
      existing required Pandoc, title, ToC, code, and cover hooks.
- [ ] Reuse the Phase 3 body-boundary validator and Phase 6 shared diagnostic
      envelope and missing-boundary condition.
- [ ] Validate only the freshly generated Template stylesheet contribution;
      exclude Profile-generated renderer CSS and deliberate later user edits
      or generic partial bundles from this ownership validator.
- [ ] Cover the named allowed fixtures
      `template-layout-and-unnamed-page-geometry`,
      `template-named-cover-presentation`, and
      `template-named-toc-presentation-and-clearing`.
- [ ] Cover the named rejected fixtures
      `template-ordinary-margin-box-page-counter`,
      `template-page-counter-reset-or-increment`,
      `template-competing-page-chrome-typography`, and
      `template-competing-page-chrome-separator`.
- [ ] Record the 8C checkpoint commit and evidence below before 8D begins.

### 8D: No-Output Validation Integration

- [ ] Run base/final Profile, generated-structure, CSS-ownership, shared
      diagnostic, and capability-requirement validation before Project bundle,
      report, summary, or follow-up-command writes.
- [ ] Return typed public-safe validation results to the prepared Project flow;
      leave Phase 9 as the only serialization and handoff owner.
- [ ] Prove validation failure exposes no usable Project bundle, replayable
      input claim, follow-up command, persistent output directory, or partial
      Project role.
- [ ] Prove the existing explicitly requested report-only failure path leaves
      only its public-safe report through the Phase 9 boundary and claims no
      replayable role.
- [ ] Prove success and handled failure leave no temporary inspection artifact,
      including cleanup refusal for unmarked or broader paths.
- [ ] Record the 8D checkpoint commit and evidence below before aggregate
      validation and review.

## Public-Safe And No-Artifact Rules

- Diagnostics, typed results, and later report inputs may identify stable
  conditions, affected public fields, capability IDs, and reproducible fixture
  outcomes. They must not disclose local paths, usernames, environment names,
  activation commands, raw errors, temporary retention choices, or host-only
  renderer details.
- Validation failure must occur before persistent Project-role writes. The one
  existing report-only failure exception may be serialized only through the
  Phase 9 output boundary and must not create or claim replayable roles.
- Do not force-add ignored files. Generated inspection inputs, outputs, reports,
  renderer artifacts, and temporary directories remain untracked and are
  removed after evidence is safely recorded.

## Checkpoint Commits

- Activation documentation: `<phase-8-activation-commit>`.
- 8A authoritative Profile checkpoint: `<phase-8a-checkpoint>`.
- 8B Template coordination checkpoint: `<phase-8b-checkpoint>`.
- 8C generated structure and CSS checkpoint: `<phase-8c-checkpoint>`.
- 8D no-output integration checkpoint: `<phase-8d-checkpoint>`.
- Evidence documentation: `<phase-8-evidence-commit>`.
- Review-finding corrections, if any: `<phase-8-review-fix-commit>`.

Replace each placeholder only after the corresponding commit exists. A
documentation-only closeout commit that records the final aggregate verdict is
outside the implementation/evidence review range.

## Validation Plan And Evidence Placeholders

- 8A focused Project/Profile validation: pending; record the exact command,
  test and assertion counts, and reviewed commit.
- 8B focused Template-coordination validation: pending; record the exact
  command, counts, and reviewed commit.
- 8C focused generated HTML/CSS validation: pending; record the exact command,
  named fixture outcomes, counts, and reviewed commit.
- 8D focused no-output, report-only failure, diagnostics, and cleanup
  validation: pending; record the exact command, counts, and reviewed commit.
- Broad Markdown PDF regression: pending; record the exact command, test and
  assertion counts, and final evidence tip.
- Full repository suite: pending; record the exact command, test and assertion
  counts, and final evidence tip.
- Static and build validation: pending; record results for
  `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
  `bun run build`, and `git diff --check` at the final evidence tip.
- Cleanup state: activation created no inspection laboratory or generated
  Project, Profile, Template, Stylesheet, HTML, CSS, PDF, PNG, renderer, or raw
  report artifact. Replace this statement with final observed cleanup evidence
  after 8D and aggregate validation.

## Exact Aggregate Review

- Required aggregate base: `7b7ae9b5`.
- Final Phase 8 implementation/evidence tip: `<phase-8-final-tip>`.
- Exact review range: `7b7ae9b5..<phase-8-final-tip>`.
- Maintainability review: pending.
- Test review: pending.
- Security review: pending.
- Documentation review: pending.
- Actionable-finding resolution and widened-range verdict: pending.

Replace the final-tip placeholder with the exact full commit before review.
If corrections land, widen the tip, repeat affected validation, re-review the
exact widened range, and record every accepted finding and disposition before
Phase 9 begins.

## Final Verdict

**Phase 8 is active.** Only the activation boundary and execution contract are
recorded. No 8A, 8B, 8C, or 8D implementation, validation, or aggregate-review
evidence is claimed. Phase 9 must not begin until the exact Phase 8 aggregate
range is reviewed, all actionable findings are resolved, and the final verdict
is recorded here.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
