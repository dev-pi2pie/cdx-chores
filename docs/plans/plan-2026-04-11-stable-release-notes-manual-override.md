---
title: "Stable release notes manual override"
created-date: 2026-04-11
modified-date: 2026-04-11
status: draft
agent: codex
---

## Goal

Add a stable-release-only manual override path for GitHub release notes so `CHANGELOGS/vX.Y.Z.md` can provide the final published release body when present, while the current generated stable notes path remains the fallback.

## Why This Plan

The current stable release workflow always generates release notes from git history through `scripts/generate-stable-release-notes.sh`.

That works well for routine releases, but it leaves no first-class repository path for:

- hand-curated stable release messaging
- release notes that need tighter editorial control than commit-or-PR aggregation
- agent-authored stable notes that should be reviewed as committed source before a release runs

The requested change is narrow and already concrete:

- only stable releases should use the new override path
- the override should live in a root-level `CHANGELOGS/` directory
- the override filename should exactly match the stable tag, such as `CHANGELOGS/v0.1.1.md`
- when no matching override file exists, the repository should keep the current generated fallback behavior

This is implementation planning work rather than open-ended research because the intended behavior, file contract, and fallback path are already settled enough to execute.

## Current State

- stable releases currently resolve notes in `.github/workflows/release.yml`
- the stable path always calls `scripts/generate-stable-release-notes.sh`
- the generated output is passed directly to `gh release create` or `gh release edit`
- tests already cover the current stable generator behavior in `test/release-scripts.test.ts`
- no repository policy currently defines how hand-authored release-note source files should be named, structured, or consumed

## Design Contract

### Stable override location

- use `CHANGELOGS/` at the repository root for hand-authored stable release notes
- resolve the override file by exact tag match: `CHANGELOGS/${CURRENT_TAG}.md`
- the first supported file shape is stable full semver only: `v<major>.<minor>.<patch>.md`

### Selection behavior

- if `CHANGELOGS/${CURRENT_TAG}.md` exists and contains non-whitespace content, use it as the full stable release notes body
- if the matching file does not exist, fall back to `scripts/generate-stable-release-notes.sh`
- keep prerelease note generation unchanged
- implement the override lookup inside `scripts/generate-stable-release-notes.sh` so stable note selection stays testable and the workflow remains thin

### Failure behavior

- if a matching override file exists but is empty or whitespace-only, fail the stable release-notes step
- keep fallback behavior only for the missing-file case, not the empty-file case
- keep markdown content-shape rules in `RELEASE_NOTES_POLICY.md` rather than enforcing full release-note structure in CI

### Authoring contract

- treat the override file as final release-body markdown, not as a document with front matter
- keep the body human-authored and publishable as-is
- require the override file to remain a complete publishable release body on its own rather than a partial fragment
- keep the same top-level stable-release shape as the generated notes as the policy target:
  - `## What's Changed`
  - zero or more grouped `### <section>` subsections under that heading
  - `### Changelog`
- allow additional curated content when useful, but keep `## What's Changed` and a trailing `### Changelog` section as the expected stable-note structure
- require the trailing `### Changelog` section to include a canonical final line in stable compare-range form:
  - `Full Changelog: <previous-stable-version>...<current-stable-version>`

### Stable curation contract

- use conventional-commit `feat` and `fix` entries as the primary candidate pool for stable release-note curation
- skip `docs`, `test`, `style`, and `chore` commits as release-note items by default
- re-include a non-`feat` or non-`fix` change only when it materially changes shipped user-facing behavior
- write stable release bullets around final shipped behavior across the release range, not around each individual commit title
- collapse iterative commit sequences for the same change into one curated bullet when later commits refine, narrow, fix, or partially revert the earlier wording
- when an early commit message no longer matches the shipped contract, prefer the later effective behavior rather than the original feature claim
- use repository evidence beyond commit subjects when needed to confirm the final shipped contract, including:
  - current `README.md`
  - public guides under `docs/guides/`
  - implementation job records under `docs/plans/jobs/`
  - research or plan docs only when they clarify the final behavior that shipped
- add a `Contributors` section as an editorial addition when useful
- use commit authors in the stable release range as the contributor source of truth
- exclude obvious bot identities and AI-agent identities from contributor callouts
- treat authors with no earlier repo-history presence before the current stable range as new contributors and include a welcome-style note for them
- list returning contributors in the same `Contributors` section without the welcome-style note

## Scope

### In scope

- stable release-note override resolution through `CHANGELOGS/${CURRENT_TAG}.md`
- exact stable semver filename expectations such as `v0.1.1.md`
- fallback to the current stable generator when no matching override file exists
- explicit failure for empty matching override files
- tests covering override, fallback, and invalid-file behavior
- a dedicated root-level `RELEASE_NOTES_POLICY.md`
- an `AGENTS.md` link to the release-notes policy
- initial `CHANGELOGS/` directory bootstrap

### Out of scope

- prerelease release-note overrides
- alternate naming schemes such as `0.1.1.md` or `release-v0.1.1.md`
- front-matter-based release-note metadata
- a broader changelog system for every commit or unreleased work
- changing the generated stable notes format when fallback generation is used
- changing GitHub release creation behavior outside note-content selection

## Risks and Mitigations

- Risk: override lookup logic is split between workflow YAML and shell logic, which makes the contract harder to reason about and test.
  Mitigation: keep stable note selection in one place, preferably the existing stable release-notes script boundary, and keep the workflow thin.

- Risk: agents create placeholder files that accidentally suppress the generated fallback.
  Mitigation: fail on empty or whitespace-only matching files so an intentional override must contain real content.

- Risk: release-note files drift into general documentation conventions and become cluttered with front matter or lifecycle metadata.
  Mitigation: define `RELEASE_NOTES_POLICY.md` as a separate root-level release-notes policy instead of folding these files into `DOCUMENTATION_POLICY.md` or mixing policy guidance into `CHANGELOGS/`.

- Risk: future contributors guess at filename patterns and create files that are never consumed.
  Mitigation: document the exact contract as `CHANGELOGS/<tag>.md`, with stable semver examples and explicit non-examples.

- Risk: curated notes diverge visually from generated notes enough to make releases feel inconsistent.
  Mitigation: recommend the generated heading structure in the release-notes policy, while keeping the manual override body publishable as-is.

- Risk: commit history reflects intermediate development steps rather than the final shipped contract, so stable notes can become misleading if they mirror commit titles too closely.
  Mitigation: define stable-note curation around final shipped behavior and allow docs and implementation records to act as evidence when later commits supersede the original feature wording.

- Risk: contributor acknowledgments become inconsistent across releases if the source of truth is not fixed.
  Mitigation: define commit authors in the stable release range as the baseline contributor source, then exclude bots and AI agents explicitly in the release-notes policy.

## Implementation Touchpoints

- `.github/workflows/release.yml`
- `scripts/generate-stable-release-notes.sh`
- `test/release-scripts.test.ts`
- `CHANGELOGS/`
- `RELEASE_NOTES_POLICY.md`
- `AGENTS.md`

## Phase Checklist

### Phase 1: Freeze the release-note override contract

- [ ] freeze the exact stable override path as `CHANGELOGS/${CURRENT_TAG}.md`
- [ ] freeze stable-only filename expectations as `v<major>.<minor>.<patch>.md`
- [ ] freeze missing-file fallback behavior
- [ ] freeze empty-file failure behavior
- [ ] freeze `scripts/generate-stable-release-notes.sh` as the single stable override-resolution boundary
- [ ] freeze the implementation-versus-policy boundary:
  - [ ] CI enforces only file lookup and non-empty override content
  - [ ] `RELEASE_NOTES_POLICY.md` owns release-note structure and editorial rules
- [ ] freeze the manual override body policy target as:
  - [ ] expected `## What's Changed`
  - [ ] optional grouped `### <section>` subsections
  - [ ] expected trailing `### Changelog`
  - [ ] required final line `Full Changelog: <previous-stable-version>...<current-stable-version>`

### Phase 2: Implement override resolution

- [ ] add stable override detection before generated stable notes are emitted
- [ ] use the matching override file as the full stable release-notes body when present and valid
- [ ] preserve the current generated fallback path when no matching override file exists
- [ ] keep prerelease behavior unchanged

### Phase 3: Verification coverage

- [ ] add a test for using `CHANGELOGS/vX.Y.Z.md` when a matching file exists
- [ ] add a test for falling back to generated notes when the matching file is absent
- [ ] add a test for failing when the matching file is empty or whitespace-only
- [ ] confirm the selected content still reaches the GitHub release creation path unchanged

### Phase 4: Repository authoring guidance

- [ ] create `RELEASE_NOTES_POLICY.md` at the repository root
- [ ] link `AGENTS.md` to `RELEASE_NOTES_POLICY.md` as the release-note policy reference
- [ ] document the exact filename contract with examples such as `CHANGELOGS/v0.1.1.md`
- [ ] document that override files are final markdown bodies and must not use front matter
- [ ] document the required top-level section shape for manual overrides
- [ ] document the canonical trailing line:
  - [ ] `Full Changelog: <previous-stable-version>...<current-stable-version>`
- [ ] document the stable curation rule:
  - [ ] start from `feat` and `fix` as the primary candidate pool
  - [ ] skip `docs` by default as release-note items
  - [ ] collapse iterative commits into final shipped outcomes
  - [ ] prefer current shipped behavior over superseded early commit wording
  - [ ] use docs and job records as evidence when commit titles are misleading
- [ ] document contributor guidance:
  - [ ] use commit authors in the stable range as the baseline source
  - [ ] exclude bots and AI agents
  - [ ] welcome new contributors
  - [ ] list returning contributors under `Contributors`
- [ ] document the fallback rule so contributors know when a file is optional versus required
- [ ] add an initial `CHANGELOGS/` bootstrap artifact if needed so the convention is visible in the repository

## Related Job Records

- `docs/plans/jobs/2026-02-27-release-workflow-review-fixes.md`
