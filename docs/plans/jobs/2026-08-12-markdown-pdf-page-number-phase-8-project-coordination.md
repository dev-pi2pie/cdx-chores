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

Phase 8 owns validation computation and preserves the existing generic Project
`validationResults` serialization of each result's name, status, and message.
It adds no structured diagnostic fields, capability-requirement fields, or
stable condition ID to reports or summaries. Phase 9 owns those new fields and
any schema extension, plus Project artifact references and render-command
handoff.

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
  structure validation, stylesheet ownership, diagnostic, in-memory
  no-temporary-artifact, and no-output coverage.
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

- [x] Audit the direct Project flow from shared signals through Profile,
      Template, validation, and existing write/report/handoff boundaries.
- [x] Shape-validate and normalize `--base-profile` before either Codex phase;
      reject malformed content, unknown keys, invalid arithmetic, and invalid
      scope/origin combinations.
- [x] Use the normalized base Profile as the authoritative bounded-patch base
      and the normalized final Profile as the sole page-number contract passed
      onward.
- [x] Prove omitted keys preserve values; valid present values, including
      `false` and `0`, replace them exactly; and `null`, unknown, or invalid
      keys fail.
- [x] Cover preservation, explicit revision, and every invalid boundary with
      focused base/final Profile fixtures and direct patch tests.
- [x] Record the 8A checkpoint commit and evidence below.

### 8B: Template Coordination

- [x] Pass the normalized final Profile into Template coordination without
      copying Profile-owned page-number or page-chrome policy into Template
      signals or generated Template CSS.
- [x] Preserve Template ownership of layout, cover, title, ToC, code, and asset
      decisions without adding a Project-specific page-number schema.
- [x] Reuse Phase 6 capability requirements and diagnostic payload types
      without probing the installed renderer or inventing another matrix.
- [x] Record the 8B checkpoint commit and evidence below.

### 8C: Generated Structure And CSS Validation

- [x] Inspect actual generated `template.html` and require one usable
      `.document-body` containing the live `$body$` insertion point plus the
      existing required Pandoc, title, ToC, code, and cover hooks.
- [x] Reuse the Phase 3 body-boundary validator and Phase 6 shared diagnostic
      envelope and missing-boundary condition.
- [x] Validate only the freshly generated Template stylesheet contribution;
      exclude Profile-generated renderer CSS and deliberate later user edits
      or generic partial bundles from this ownership validator.
- [x] Cover the named allowed fixtures
      `template-layout-and-unnamed-page-geometry`,
      `template-named-cover-presentation`, and
      `template-named-toc-presentation-and-clearing`.
- [x] Cover the named rejected fixtures
      `template-ordinary-margin-box-page-counter`,
      `template-page-counter-reset-or-increment`,
      `template-competing-page-chrome-typography`, and
      `template-competing-page-chrome-separator`.
- [x] Record the 8C checkpoint commit and evidence below.

### 8D: No-Output Validation Integration

- [x] Run base/final Profile, generated-structure, CSS-ownership, shared
      diagnostic, and capability-requirement validation before Project bundle,
      report, summary, or follow-up-command writes.
- [x] Return typed public-safe validation results to the prepared Project flow;
      preserve existing generic name/status/message serialization, and leave
      new report/summary fields and handoff work to Phase 9.
- [x] Prove validation failure exposes no usable Project bundle, replayable
      input claim, follow-up command, persistent output directory, or partial
      Project role.
- [x] Prove the existing explicitly requested report-only failure path leaves
      only its existing public-safe report and claims no replayable role. Its
      generic validation result may contain the new result's name, status, and
      message, but no structured diagnostics, capability requirements, or
      stable condition ID.
- [x] Prove success and handled failure leave no temporary inspection artifact.
      Validation remained in memory, so the conditional marked-temporary-area
      cleanup and unsafe-path refusal branch was not applicable, implemented,
      or exercised in Phase 8.
- [x] Record the 8D checkpoint commit and evidence below before aggregate
      validation and review.

## Public-Safe And No-Artifact Rules

- In-memory diagnostics and typed results may identify stable conditions,
  affected public fields, capability IDs, and reproducible fixture outcomes.
  The existing generic report entry remains limited to public-safe result name,
  status, and message until Phase 9 adds structured fields. Neither surface may
  disclose local paths, usernames, environment names, activation commands, raw
  errors, temporary retention choices, or host-only renderer details.
- Validation failure must occur before persistent Project-role writes. The one
  existing report-only failure exception may preserve generic validation-result
  serialization and must not create or claim replayable roles. Phase 9 owns any
  new structured report fields or schema.
- Do not force-add ignored files. Generated inspection inputs, outputs, reports,
  renderer artifacts, and temporary directories remain untracked and are
  removed after evidence is safely recorded.

## Checkpoint Commits

- Activation documentation: `60157dfa`.
- 8A authoritative Profile checkpoint: `60b07b17`.
- 8B Template coordination checkpoint: `cbf9fd59`.
- 8C generated structure and CSS checkpoint: `cd79b7be`.
- 8D no-output integration checkpoint: `ccae59e4`.
- Evidence documentation: `<phase-8-evidence-commit>`.
- Review-finding corrections: `0bbd6408`.

Replace each placeholder only after the corresponding commit exists. A
documentation-only closeout commit that records the final aggregate verdict is
outside the implementation/evidence review range.

The independently prepared 8B checkpoint landed before 8A; the labels above
record responsibility rather than commit chronology. The aggregate review
range covers both checkpoints in their committed order.

Correction `0bbd6408` restores the Phase 9 report boundary while preserving the
existing generic `validationResults` entry, so the new result's name, status,
and message may appear. Phase 8 adds no structured diagnostic or
capability-requirement fields to reports or summaries, and the stable
body-boundary validation condition ID remains available only through the
in-memory typed diagnostic returned by Project validation.

## Validation Plan And Evidence Placeholders

- 8A Project/Profile regression at the pre-final Project tip:
  `bun test test/cli-actions-md-to-pdf-project-codex --timeout 30000` passed
  105 tests and 1,425 assertions. This covered the authoritative-base patch,
  preservation, exact replacement, invalid-key, and invalid-value boundaries
  committed in `60b07b17`.
- 8B focused Template-coordination validation at `cbf9fd59`:
  `bun test test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts --timeout 30000 --test-name-pattern 'keeps final-profile page numbers and page chrome private to Template coordination'`
  passed 1 test and 23 assertions, proving page-number and page-chrome values
  remain absent from Template signals and generated output.
- 8C focused generated HTML/CSS validation:
  `bun test test/cli-actions-md-to-pdf-project-codex/page-number-compatibility.test.ts test/cli-actions-md-to-pdf-project-codex/validation.test.ts --timeout 30000`
  passed 28 tests and 190 assertions. All three named allowed fixtures were
  accepted and all four named rejected fixtures returned the expected typed
  ownership failure.
- 8D focused no-output, report-only failure, diagnostics, and
  no-temporary-artifact validation:
  `bun test test/cli-actions-md-to-pdf-project-codex/action-write.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts test/cli-actions-md-to-pdf-project-codex/validation.test.ts --timeout 30000`
  passed 47 tests and 903 assertions.
- Final Project regression:
  `bun test test/cli-actions-md-to-pdf-project-codex --timeout 30000` passed
  108 tests and 1,477 assertions.
- Broad Markdown PDF regression:
  `rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000`
  passed 1,069 tests and 7,853 assertions.
- Full repository suite: `bun test --timeout 30000` passed 2,089 tests and
  12,080 assertions with 0 failures.
- Static and build validation passed at `0bbd6408`: `bunx tsc --noEmit`,
  `bun run lint`, `bun run format:check`, `bun run build`, and
  `git diff --check`. The build used Bun `1.3.14` and tsdown `0.22.14`; the
  existing TypeScript 7 preview warning remained non-blocking. `0bbd6408` is
  the final implementation and validation tip for this evidence snapshot.
- Cleanup state: Phase 8 used process-owned in-memory validation only, created
  no temporary inspection laboratory, and retained no generated Project,
  Profile, Template, Stylesheet, HTML, CSS, PDF, PNG, renderer, raw report, or
  validation artifact. Because no temporary area existed, marked-area cleanup
  and unsafe-path refusal were neither required nor exercised.
- Evidence-document gate: targeted formatting for this job and its parent plan
  and `git diff --check` pass in the evidence worktree. The evidence commit
  requires those documentation gates only; it does not become a claimed final
  implementation or aggregate-review tip until its full hash is recorded.

## Exact Aggregate Review

- Required aggregate base: `7b7ae9b5`.
- Final implementation and validation tip for this evidence snapshot:
  `0bbd6408`.
- Phase 8 evidence tip: `<phase-8-evidence-tip>`.
- Proposed exact review range: `7b7ae9b5..<phase-8-evidence-tip>`.
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

**Provisional verdict: Continue after review.** Phase 8A through 8D
implementation and validation are complete through correction `0bbd6408`. The
job remains `in-progress` because the evidence commit does not yet exist and
the exact aggregate range has not been reviewed. No aggregate-review verdict is
claimed by this provisional evidence record.
Phase 9 must not begin until the evidence tip replaces the remaining
placeholder, the exact range is reviewed, every actionable finding is resolved,
and the final verdict is recorded here.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
