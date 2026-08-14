---
title: "Markdown PDF Phase 13 contract normalization"
created-date: 2026-08-14
status: completed
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
- Final implementation tip: `46a8c1f6`, the last accepted-review correction
  commit. This documentation-only closeout follows the reviewed range.

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

### Profile feature map

Comparison of `v0.1.6` (`38e227bf`) with the clean implementation starting
point `999bb640` confirms the exhaustive accepted contract below. The inventory
used the Profile schema, types, normalization, defaults, and domain validators
in this range:

```bash
git diff v0.1.6..999bb640 -- src/cli/markdown-pdf/profile
```

| Revision | Serialized Profile features                                                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2`      | `profile` identity; `page`; `toc`; dynamic `metadata`; `pdf.content-langs`; `fonts` role maps; `cover`; header/footer `left`, `center`, and `right`; page-number `enabled`, `position`, `format`, and `scope: body`; `titleBlock`; and `code` |
| `3`      | `pageNumbers.scope: document`; `countFrom`, `start`, and `increment` plus the document-scope/document-origin combination; and header/footer `style` with its typography, color, and separator fields                                          |

Top-level `schemaVersion` is revision-3 declaration metadata, not an inferred
Profile feature. It is recognized by the revision-3 reader and first emitted by
revision-3 writers, but its presence never raises the inferred minimum.

Revision `2` remains the inference floor. Empty `header.style` or `footer.style`
and empty nested `separator` objects still imply revision `3` because a
revision-2 reader rejects those keys. Pre-existing page-number keys remain
revision `2` even though current defaults now serialize them beside revision-3
keys. `schemaVersion` is declaration metadata and never raises inference.

Dynamic metadata and font mappings are registered as bounded map features, not
as a revision per user-defined member. Revision bumps follow the frozen research
rules: add a revision for a newly recognized key, value, combination, or other
serialized construct that an older reader rejects; do not bump for refactors,
diagnostic wording, candidate additions, formatting, or conformance fixes.

### Artifact taxonomy

| Artifact or identity                      | Disposition      | Reason                                                                |
| ----------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| Profile `schemaVersion`                   | add revision `3` | Advisory producer signal; actual content remains authoritative.       |
| Profile Codex report artifact version `4` | keep strict      | Its persisted reader has an exact compatibility gate.                 |
| Template and Project report version `1`   | remove           | Their consumers use the artifact type; no reader enforces the number. |
| Renderer fixture contract `4`             | remove           | Catalog content already determines `catalogDigest`.                   |
| Renderer harness contract `4`             | remove           | Actual execution inputs should determine `harnessDigest`.             |
| Renderer evidence report schema `3`       | remove           | No reader consumes it; its two input digests identify the evidence.   |
| Font-discovery evidence schema `2`        | remove           | It is writer/test-only with no compatibility reader.                  |
| Profile-font smoke plan schema `1`        | remove           | The plan fields are consumed directly without a version gate.         |
| Renderer ownership marker containing `v4` | keep             | Stable cleanup authorization token, not a schema.                     |
| Profile-font smoke marker containing `v1` | keep             | Stable cleanup authorization token, not a schema.                     |

Add an unsupported-version regression around the retained Profile Codex report
reader. Historical evidence documents remain unchanged when a current writer-
only field is removed.

### Renderer candidate identity

Broaden candidate ID and dependency-version fields to strings. Keep the concrete
`65.1`, `68.0`, and `69.0` catalog as the tested evidence matrix and derive
scenario-reference types from that catalog. Add a compatible future-candidate
regression so a new renderer does not require widening a runtime allowlist.

### Module responsibility dispositions

| Boundary                              |        Size at inventory | Disposition                                                                                                                                                               |
| ------------------------------------- | -----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile schema and normalizer         |          213 / 571 lines | Add focused feature-registry and revision modules. Keep schema as structural validation and normalization as the orchestrator; do not split cohesive private normalizers. |
| Renderer fixture catalog/materializer |              1,231 lines | Split pure candidates and scenario groups from filesystem materialization and digest ownership, retaining the existing import path as a barrel.                           |
| Renderer evidence harness             |              1,524 lines | Split contract/types, subprocess, laboratory, PDF/PNG inspection and validation, scenarios, orchestration, public report, and CLI behind the existing script facade.      |
| Renderer evidence tests               |              1,482 lines | Split only with harness ownership while retaining an end-to-end mocked orchestration suite.                                                                               |
| Render asset preparation              |     703-line `render.ts` | Extract remote/custom-template asset policy and rewriting into a focused internal module; keep render-file creation and Pandoc orchestration in `render.ts`.              |
| Template Codex decisions              | 658-line decision module | Extract font decision validation and inference only; retain general decision domains and top-level validation.                                                            |
| Profile signals                       |                434 lines | Keep; it is a cohesive signal collector.                                                                                                                                  |
| Template CSS synthesis                |                445 lines | Keep; ordered CSS emission is one responsibility.                                                                                                                         |
| Template output planning              |                375 lines | Keep; collision and writable-plan validation form one transaction.                                                                                                        |
| Project validation                    |                483 lines | Keep; it is the cross-phase validation boundary.                                                                                                                          |

Project and Template tests are already mostly responsibility-scoped. Reorganize
only renderer-harness tests required by the accepted source split, and add new
focused Profile revision tests without unrelated fixture movement.

## Checklist

- [x] Activate this job from the Phase 12 closeout boundary before implementation.
- [x] Record the Profile revision-2/revision-3 feature inventory and bump rules.
- [x] Record artifact-version, candidate-identity, and keep-or-split dispositions.
- [x] Implement registry-owned validation routing, inference, assessment, and
      advisory diagnostics with focused tests.
- [x] Emit revision `3` from all Profile generation and derivation surfaces while
      preserving bases and render inputs.
- [x] Normalize evidence identities and compatible future renderer candidates.
- [x] Apply only accepted module and test splits behind stable boundaries.
- [x] Complete focused, broad, static, formatting, build, and diff validation.
- [x] Review the exact Phase 13 range for maintainability and test quality,
      resolve accepted findings, and re-review any widened range.
- [x] Record a reviewed documentation closeout and Continue, Constrain, or Stop
      verdict before Phase 14.

## Validation

Focused validation covered Profile parsing, inference, diagnostics, generation,
derivation, non-rewriting renders, Codex and Project surfaces, Interactive
behavior, artifact readers, fixture identity, evidence acceptance, and
compatible future renderer identifiers. Final validation used:

```bash
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
git diff --check 11767a14..46a8c1f6
```

Completed results:

- Markdown PDF regression: 1,198 tests and 8,821 assertions passed.
- Repository regression: 2,218 tests and 13,259 assertions passed.
- TypeScript, lint, format, build, built-CLI Profile generation, and both diff
  checks passed.
- The built Node.js CLI emitted `schemaVersion: 3` in a generated YAML Profile.
- The renderer catalog digest remained
  `6fad96e23af73339f422b6de0e832a440dd45aea90ba6aed745c82ee66a99a75`.
- The renderer harness digest remained
  `ca63f6a79dbb4ebafa88ef71f0d34d490da3f06c1f266a4b87312d195b1b01ab`.

The live renderer matrix was not repeated. Scenario inputs, renderer behavior,
evidence acceptance, ownership markers, and both deterministic identities were
unchanged; the accepted fixture and harness work was responsibility-preserving
module movement.

## Commit, Review, And Closeout

- [x] Record each meaningful validated checkpoint and its evidence boundary.
- [x] Review `11767a14..46a8c1f6` independently for
      maintainability and test quality after all implementation gates pass.
- [x] Classify findings, commit accepted corrections separately, rerun affected
      and broad gates, and repeat both reviews on the widened range.
- [x] Review the completed job, research status, and parent checklist before the
      documentation-only closeout commit.

No security scan is part of this phase because the planned work does not change
an authentication, authorization, secret, network-trust, or external-input
execution boundary.

## Evidence

- Activation documentation: `51e1f056`.
- Inventory and dispositions: `1cb0f69f`.
- Advisory Profile revision and registry implementation: `d986cb60`.
- Artifact and candidate identity normalization: `d7893128`.
- Render-asset and Template-font responsibility splits: `1156958a` and
  `f2c3077f`.
- Renderer fixture, harness, and evidence-test modularization: `b1c7ea4f`.
- Broad-suite Interactive compatibility correction: `434a280f`.
- Initial review range: `11767a14..434a280f`. Two maintainability findings and
  two regression-coverage findings were accepted.
- Typed capability and normalization-ownership correction: `d2b46980`.
- Project revision-diagnostic handoff and serialization correction: `46a8c1f6`.
- Final reviewed range: `11767a14..46a8c1f6`. Independent maintainability and
  test-quality re-reviews reported no findings.
- Final verdict: **Continue** to Phase 14. Phase 13 meets its compatibility,
  identity, modularization, validation, and review gates.

## Related Research

- [Markdown PDF Profile Revision And Feature Compatibility](../../researches/research-2026-08-14-markdown-pdf-profile-revision-and-feature-compatibility.md)
