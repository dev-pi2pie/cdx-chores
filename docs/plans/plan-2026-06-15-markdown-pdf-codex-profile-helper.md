---
title: "Markdown PDF Codex profile helper implementation"
created-date: 2026-06-15
status: draft
agent: codex
---

## Goal

Implement the direct `md pdf-profile codex` helper for generating and refining replayable Markdown PDF profiles from bounded document facts, font facts, user intent, and Codex structured recommendations.

This plan intentionally does not implement Interactive mode. Interactive Markdown PDF planning starts only after the direct helper contract is implemented and verified.

## Why This Plan

The related research settles the product boundary:

- `md to-pdf` remains deterministic.
- `pdf-profile` is the durable rendering decision.
- Codex is an opt-in helper for selecting and adapting profile candidates.
- `pdf-template` remains the advanced low-level HTML/CSS recipe surface.
- Interactive mode reuses the direct helper contract later instead of defining a second assistant model.

The first implementation must therefore create a reviewed profile artifact, not render a PDF automatically and not generate raw template or CSS code.

## Starting State

Current Markdown PDF support includes:

- `md to-pdf` through Pandoc-generated HTML and WeasyPrint PDF rendering.
- `md pdf-profile init` for deterministic YAML or JSON profile files.
- `md pdf-template init` for editable `template.html` and `style.css` recipe files.
- profile validation that rejects unknown root keys.
- profile-controlled page, ToC, cover, page chrome, font, metadata, and code-highlight settings.
- font discovery, matching, and coverage modules under `src/fonts/`.
- `font check` command behavior that can validate coverage and report inconclusive checks.
- existing Codex adapter patterns under `src/adapters/codex/`.
- data-stack Codex report precedent for advisory JSON artifacts linked to deterministic payloads.

Missing pieces:

- `md pdf-profile codex` command registration and action.
- schema-supported `profile` identity metadata for generated profiles.
- schema-supported preset identity that `md to-pdf --profile` consumes for replay.
- Markdown document signal collection for profile adaptation.
- bounded font summary collection for Codex input.
- Codex prompt, structured output parser, and validator for Markdown PDF profile recommendations.
- optional Codex diagnostic report artifact for profile decisions.
- non-writing review behavior through `--dry-run`.

## Scope

### Command Surface

Add:

```bash
cdx-chores md pdf-profile codex \
  --input report.md \
  --intent "wide table report with ToC and readable code" \
  --output report-profile.yml
```

Options:

- `--input <path>`: required Markdown input.
- `--intent <text>`: required general rendering direction.
- `--font-hint <text>`: optional, repeatable font preference hint.
- `--base-profile <path>`: optional existing Markdown PDF profile to refine.
- `--output <path>`: optional profile output path; generated `.yml` path when omitted.
- `--dry-run`: run signal collection, Codex recommendation, profile validation, and summary output without writing the profile.
- `--keep-codex-report`: also write the diagnostic report sidecar.
- `--codex-report-output <path>`: explicit diagnostic report path; implies `--keep-codex-report`.
- `--overwrite`: allow overwriting selected output artifacts.

Do not add extra user-facing hint flags just to expose prompt-internal categories. General direction stays in `--intent`; font preference stays in `--font-hint`.

### Profile Identity And Preset Replay

Add a schema-supported top-level `profile` section:

```yaml
profile:
  id: md-pdf-profile-20260615T081500Z-a1b2c3d4
  source: codex
  basedOn: wide-table
  preset: wide-table
  createdAt: 2026-06-15T08:15:00Z
```

Rules:

- `profile.id` is required for Codex-generated profiles.
- `profile.source` is `codex` for this helper.
- `profile.basedOn` records the selected candidate or base identity.
- `profile.preset` records replayable preset behavior when the selected candidate is preset-backed.
- `profile.createdAt` uses the existing UTC timestamp style used by generated artifacts.
- `md to-pdf --profile <path>` consumes `profile.preset` before renderer preset defaults.
- unknown keys inside `profile` fail validation.
- older valid profiles without `profile` remain loadable as base profiles and normal render profiles.

### Candidate Selection

Use this v1 catalog:

- built-in default profile
- preset-derived profile candidates for `article`, `report`, `wide-table`, `compact`, and `reader`
- one user-supplied base profile from `--base-profile <path>`, when provided

`--base-profile` rules:

- validate before calling Codex.
- fail before Codex when invalid.
- treat a valid base profile as the strongest candidate.
- preserve existing fields unless document facts or user intent justify a bounded change.
- write the adapted profile to `--output` or a generated output path; never mutate the base profile in place.
- if the base profile has `profile.id`, link that ID in the optional Codex report.
- if the base profile has no `profile.id`, report it as an untracked base profile.

Local profile-template catalogs remain out of scope for this first pass.

### Document And Font Signals

Collect bounded deterministic signals before calling Codex:

- Markdown frontmatter `lang`.
- frontmatter `pdf.content-langs`.
- heading count and maximum heading depth.
- Markdown table pressure, including maximum table column count and long table-line width when cheaply available.
- code fence count and bounded language list.
- script buckets from sampled document text: Latin, CJK, RTL, symbols, and emoji.
- local and remote asset counts.
- available font family summary.
- coverage warnings or inconclusive coverage states from existing font logic.
- user `--font-hint` values.

If a signal cannot be collected cheaply or safely, mark it inconclusive. Do not guess.

Privacy rules:

- do not send raw local font file paths to Codex.
- do not record raw absolute input paths in report JSON.
- use displayed paths, fingerprints, bounded summaries, and family names.
- do not send private source snippets unless a bounded redaction rule is implemented in the same phase.

### Codex Contract

Add a Markdown PDF profile Codex adapter under the existing Codex adapter boundary.

The adapter should receive:

- profile candidate summaries
- selected base profile content summary
- document signal summary
- font summary
- user intent
- user font hints
- supported profile schema summary

The adapter should return structured data, not arbitrary YAML text:

- decision mode: `adapted`, `conservative-fallback`, or `no-usable-profile`
- selected base candidate
- accepted profile fields
- preset identity when preset-backed
- concise reasoning
- warnings
- fallback reason when relevant
- unmatched intent directions when profile/template settings cannot represent them

Validate the structured response before serializing a profile. Reject unknown profile fields and invalid enum values.

### Decision Modes

Implement these outcomes:

| Mode | CLI behavior | Writes |
| --- | --- | --- |
| `adapted` | success | profile, plus optional Codex report |
| `conservative-fallback` | success with visible stdout note | profile, plus optional Codex report |
| `no-usable-profile` | failure | no profile; Codex report only when explicitly requested |

`conservative-fallback` is a Codex decision mode, not a separate CLI option.

### Output And Report Artifacts

Profile output:

- respect custom `--output`
- otherwise derive a generated `.yml` path from the input stem and profile UID
- reject unsupported profile output extensions
- require `--overwrite` when writing over an existing profile

Codex report output:

- default off
- `--keep-codex-report` writes a derived sidecar path
- `--codex-report-output <path>` writes the exact path and implies `--keep-codex-report`
- derived report names use the same profile UID
- generated path collisions may pick a new UID before writing
- explicit same-file collisions between profile and report outputs fail
- report JSON is advisory and is never accepted by `md to-pdf --profile`

Report JSON should include:

- artifact type and report artifact ID
- matching profile ID
- profile output path as displayed
- input fingerprint or bounded summary
- intent and font hints
- deterministic signal summary
- font summary and warnings
- selected base candidate
- base profile identity or untracked-base note
- decision mode
- changes from base
- accepted profile fields
- unmatched directions
- fallback reason when relevant
- validation warnings

### Review And Dry Run

Normal execution should:

- collect signals
- call Codex
- validate the proposed profile
- print a concise proposed-profile summary
- write selected artifacts

`--dry-run` should:

- collect signals
- call Codex
- validate the proposed profile
- print the same proposed-profile summary and warnings
- display the output paths that would be used
- skip profile writing
- write the Codex report only when `--keep-codex-report` or `--codex-report-output` is present

No interactive confirmation prompt should be required in the direct CLI path.

## Implementation Phases

### Phase 1: Profile Schema And Replay

- [ ] Add `profile` identity validation and normalization.
- [ ] Add `profile.preset` validation against the existing Markdown PDF preset set.
- [ ] Serialize `profile` in YAML and JSON profiles.
- [ ] Teach `md to-pdf --profile` to use `profile.preset` for preset-backed recipe behavior.
- [ ] Keep older profiles without `profile` valid.
- [ ] Add focused parser, serializer, and `md to-pdf --profile` replay tests.

### Phase 2: Profile Candidate And Signal Modules

- [ ] Add reusable candidate construction from current defaults and presets.
- [ ] Add base-profile loading and validation helpers.
- [ ] Add Markdown signal collection for headings, tables, code fences, scripts, assets, and frontmatter.
- [ ] Add bounded font summary collection using existing font modules.
- [ ] Add tests for signal caps, inconclusive states, and base-profile validation.

### Phase 3: Codex Adapter

- [ ] Add Markdown PDF profile prompt construction.
- [ ] Call Codex through the existing adapter style.
- [ ] Parse structured recommendations.
- [ ] Validate decision modes and accepted fields.
- [ ] Support unavailable Codex and invalid structured output paths.
- [ ] Add adapter unit tests with stubs.

### Phase 4: Action And Command Wiring

- [ ] Add `actionMdPdfProfileCodex`.
- [ ] Register `md pdf-profile codex`.
- [ ] Implement output path generation, UID handling, overwrite checks, and collision checks.
- [ ] Implement `--dry-run`, `--keep-codex-report`, and `--codex-report-output`.
- [ ] Print concise summary output and fallback notes.
- [ ] Export action types through the Markdown action index.

### Phase 5: Codex Report Artifact

- [ ] Define the report JSON schema and TypeScript types.
- [ ] Write derived and explicit report paths.
- [ ] Link report ID and profile ID.
- [ ] Record base-profile identity or untracked-base fallback.
- [ ] Keep reports advisory-only.
- [ ] Add report validation and collision tests.

### Phase 6: Documentation And Guide Updates

- [ ] Update Markdown PDF user guidance after behavior is implemented.
- [ ] Document direct helper examples.
- [ ] Document replay through `md to-pdf --profile`.
- [ ] Document diagnostic report retention.
- [ ] Keep Interactive mode documented as a later plan.

## Non-Goals

- no Interactive Markdown PDF flow
- no render-time `md to-pdf --codex`
- no raw HTML or CSS generation
- no `md pdf-template codex`
- no local profile-template catalog
- no provider-neutral `suggest` command
- no stdout-only profile emission
- no automatic PDF rendering from the helper
- no new broad hint flags beyond `--intent` and `--font-hint`

## Validation

Focused automated coverage:

- command registration and option validation
- profile schema validation for `profile` identity and preset replay
- old-profile compatibility without `profile`
- `md to-pdf --profile` consuming `profile.preset`
- candidate construction from defaults, presets, and `--base-profile`
- invalid base-profile rejection before Codex
- document signal collection with bounded samples
- font summary and coverage warning handling
- Codex unavailable path
- invalid Codex structured output path
- `adapted`, `conservative-fallback`, and `no-usable-profile` behavior
- generated output path and UID behavior
- explicit and generated collision behavior
- `--dry-run` non-writing profile behavior
- optional report writing and report/profile UID matching
- deterministic render replay from a generated profile

Expected commands during implementation:

```bash
bun test test/cli-actions-md-to-pdf-profile*.test.ts
bun test test/cli-actions-md-to-pdf-actions*.test.ts
bun test test/fonts-cli-check*.test.ts
bun test
```

Manual smoke coverage should use `examples/playground/` for temporary Markdown inputs and generated profile/report artifacts.

## Acceptance Criteria

- `cdx-chores md pdf-profile codex` can generate a validated profile from built-in candidates.
- `--base-profile <path>` can refine an existing valid profile without mutating it.
- generated profiles include `profile.id`, `source`, `basedOn`, `preset` when applicable, and `createdAt`.
- `md to-pdf --profile <generated-profile>` replays the selected preset behavior.
- `--dry-run` previews the profile decision without writing the profile.
- optional Codex reports are linked to the generated profile UID.
- low-signal conservative fallback is visible in stdout.
- unavailable Codex and invalid structured output never silently write a fake Codex profile.
- tests cover the failure and replay paths needed by the Interactive-mode readiness checkpoint.

## Related Research

- [Markdown PDF Codex Profile Helper and Interactive Flow](../researches/research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Font Inspect and Check Commands](../researches/research-2026-05-07-font-inspect-and-check-commands.md)
- [Markdown PDF Shiki Code Highlighting](../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)
- [Data stack artifact and Codex contract cleanup](../researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md)
