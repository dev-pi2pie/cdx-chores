---
title: "Markdown PDF Phase 13 contract normalization"
created-date: 2026-08-14
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Implement the advisory Markdown PDF Profile feature revision, normalize the
repository's independent version and identity axes, and separate only confirmed
mixed-responsibility modules. Preserve actual-feature validation, renderer
capability checks, public exports, CLI behavior, evidence meaning, guarded
cleanup, and Node.js runtime compatibility.

## Starting Boundary

- Phase review base: `11767a14`, the reviewed Phase 12 documentation closeout.
- Clean implementation starting point: `999bb640`, after the Phase 13 planning
  and Profile revision research commits.
- The worktree was clean before this activation record began.
- The final implementation tip will be the last behavior, test, refactor, or
  accepted-review correction commit. The documentation-only closeout follows
  the reviewed range and records it.

## Frozen Contract

### Profile revision authority

- The stable `v0.1.6` Profile contract is the unversioned revision-2 historical
  baseline. Revision `3` is the additive `v0.1.7` canary contract and the first
  declaration written by generated Profiles.
- Optional top-level `schemaVersion` is advisory. Supported serialized keys,
  values, combinations, and structures decide reader compatibility; normalized
  effective behavior decides renderer capability.
- Missing declarations remain quiet. Malformed, stale, and forward declarations
  each produce at most one successful diagnostic and do not block an otherwise
  supported render.
- Unknown content, invalid content or combinations, structural failures, and
  unavailable effective renderer capabilities retain their concrete failures.
- Revision inference has a revision-2 floor and uses only explicitly serialized
  features before defaults or one-render overrides. The declaration itself does
  not affect inference.
- New generated or derived Profiles write revision `3`; source and base Profiles
  are never rewritten by rendering or derivation.

### Registry and module ownership

- `src/cli/markdown-pdf/profile/feature-registry.ts` owns recognized serialized
  features and their introduction metadata, including later-added values and
  supported combinations.
- `src/cli/markdown-pdf/profile/revision.ts` parses, infers, and classifies the
  advisory declaration.
- Profile schema and normalization consume the registry, and
  `MarkdownPdfProfileLoadResult` carries the source-derived assessment without
  adding rendering meaning to `NormalizedMarkdownPdfProfile`.
- Existing Markdown PDF diagnostics carry the bounded advisory conditions even
  when page numbers are disabled.

### Artifact taxonomy

- Profile `schemaVersion` is advisory feature metadata.
- Persisted report schema numbers remain strict only where a real reader/writer
  compatibility boundary requires them.
- Fixture catalogs and harness inputs use deterministic content identities when
  compatibility depends on content.
- Ownership markers remain stable safety identities rather than schema numbers.
- Package versions and renderer candidate versions do not version internal
  Profile or evidence formats.

### Permanent boundary

Production, tests, and existing evidence fixtures may change only where the
contract inventory or an accepted keep-or-split disposition requires it. Reuse
the existing renderer evidence catalog, harness, laboratory lifecycle, and
guarded cleanup. Add no second smoke framework or cleanup path.

Pure module movement must preserve public imports, catalog scenario values,
deterministic identities, evidence acceptance, and sanitized reporting. It does
not require a repeat of the live renderer matrix. A change to renderer behavior,
scenario inputs, or evidence acceptance semantics requires affected live
evidence before closeout.

## Inventory And Dispositions

The activation checkpoint freezes the questions below. The next checkpoint
records the evidence-backed answers before production changes:

- exhaustive revision-2 and revision-3 Profile feature map
- versioned Profile, Project, Template, renderer, font, and smoke artifacts,
  their consumers, and strict/advisory/digest/marker dispositions
- fixture catalog, harness contract, and evidence report identity dispositions
- renderer candidate and dependency identifier ownership
- line-count and responsibility inventory for affected production, fixture,
  harness, helper, and test files, with a keep-or-split decision for each

## Checklist

- [x] Activate this job from the Phase 12 closeout boundary before implementation.
- [ ] Record the Profile revision-2/revision-3 feature inventory and bump rules.
- [ ] Record artifact-version, candidate-identity, and keep-or-split dispositions.
- [ ] Implement registry-owned validation routing, inference, assessment, and
      advisory diagnostics with focused tests.
- [ ] Emit revision `3` from all Profile generation and derivation surfaces while
      preserving bases and render inputs.
- [ ] Normalize evidence identities and compatible future renderer candidates.
- [ ] Apply only accepted module and test splits behind stable boundaries.
- [ ] Complete focused, broad, static, formatting, build, and diff validation.
- [ ] Review the exact Phase 13 range for maintainability and test quality,
      resolve accepted findings, and re-review any widened range.
- [ ] Record a reviewed documentation closeout and Continue, Constrain, or Stop
      verdict before Phase 14.

## Validation

Focused validation will cover Profile parsing, inference, diagnostics,
generation, derivation, non-rewriting renders, Codex and Project surfaces,
Interactive behavior, artifact readers, fixture identity, evidence acceptance,
and compatible future renderer identifiers. Final validation includes:

```bash
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
git diff --check 11767a14..<final-implementation-tip>
```

Record test and assertion counts where available. The job will record any
affected live renderer command only if the permanent-boundary rule requires it.

## Commit, Review, And Closeout

- [ ] Record each meaningful validated checkpoint and its evidence boundary.
- [ ] Review `11767a14..<final-implementation-tip>` independently for
      maintainability and test quality after all implementation gates pass.
- [ ] Classify findings, commit accepted corrections separately, rerun affected
      and broad gates, and repeat both reviews on the widened range.
- [ ] Review the completed job, research status, and parent checklist before the
      documentation-only closeout commit.

No security scan is part of this phase because the planned work does not change
an authentication, authorization, secret, network-trust, or external-input
execution boundary.

## Evidence

- Activation documentation: pending commit.
- Inventory checkpoint: pending.
- Implementation checkpoints: pending.
- Exact reviewed range: pending.
- Final verdict: pending.

## Related Research

- [Markdown PDF Profile Revision And Feature Compatibility](../../researches/research-2026-08-14-markdown-pdf-profile-revision-and-feature-compatibility.md)
