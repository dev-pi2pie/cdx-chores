---
title: "Markdown PDF Codex profile helper implementation"
created-date: 2026-06-15
modified-date: 2026-06-16
status: active
agent: codex
---

## Goal

Implement the direct `md pdf-profile codex` helper for generating and refining replayable Markdown PDF profiles from bounded document facts, font facts, user intent, base-profile input, and Codex structured recommendations.

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
cdx-chores md pdf-profile codex report.md \
  --intent "wide table report with ToC and readable code" \
  --output report-profile.yml
```

Options:

- `[input]`: optional positional Markdown sample used to collect bounded document signals.
- `--input <path>`: optional explicit Markdown sample path; equivalent to positional input.
- `--intent <text>`: optional general rendering direction.
- `--font-hint <text>`: optional, repeatable font preference hint.
- `--base-profile <path>`: optional existing Markdown PDF profile to refine.
- `--output <path>`: optional profile output path; generated `.yml` path when omitted.
- `--dry-run`: run signal collection, Codex recommendation, profile validation, and summary output without writing the profile.
- `--keep-codex-report`: also write the diagnostic report sidecar.
- `--codex-report-output <path>`: explicit diagnostic report path; implies `--keep-codex-report`.
- `--overwrite`: allow overwriting selected output artifacts.

Do not add extra user-facing hint flags just to expose prompt-internal categories. General direction stays in `--intent`; font preference stays in `--font-hint`.

Signal ladder:

```text
Inputs
  |
  +-- [path] ---------- target signal: document facts
  +-- --intent -------- target signal: direction
  +-- --font-hint ----- target signal: font preference
  +-- --base-profile -- source signal: starting profile
  |
  v
Decision
  |
  +-- any target signal? ----> Codex helper receives bounded payload
  |
  +-- base-profile only? ---> deterministic base derivative, Codex skipped
  |
  +-- no signals? ----------> deterministic basic profile, Codex skipped
```

Rules:

- positional input and `--input <path>` are aliases.
- conflicting normalized positional and `--input` paths fail before collecting signals.
- any target signal is enough to enter Codex-assisted mode.
- `--base-profile` alone is a source signal only; validate and write a deterministic derivative without calling Codex.
- no path, no intent, no font hint, and no base profile returns a deterministic basic profile without calling Codex.
- signal mode should be classified for diagnostics and tests.

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
- `profile.source` is `codex` for Codex-assisted outputs.
- `profile.source` is `deterministic` for outputs that skip Codex, including no-signal basic-default and base-only deterministic derivatives.
- `profile.basedOn` records the selected candidate or base identity.
- `profile.preset` records replayable preset behavior when the selected candidate is preset-backed.
- `profile.createdAt` uses the existing UTC timestamp style used by generated artifacts.
- `md to-pdf --profile <path>` consumes `profile.preset` before renderer preset defaults.
- unknown keys inside `profile` fail validation.
- older valid profiles without `profile` remain loadable as base profiles and normal render profiles.
- `profile.source` accepts `codex` and `deterministic` after the signal-ladder follow-up.
- `.json` profile output must support the same identity and preset replay behavior as `.yml` and `.yaml` profile output.

Replay precedence:

```text
explicit `md to-pdf` CLI recipe flags
  -> `profile.preset` and profile-derived recipe options
  -> renderer defaults
```

This preserves existing CLI override behavior while making generated profiles replayable when no render-time override is passed.

### Candidate Selection

Use this v1 catalog:

- built-in default profile
- preset-derived profile candidates for `article`, `report`, `wide-table`, `compact`, and `reader`
- one user-supplied base profile from `--base-profile <path>`, when provided

Candidate distinction:

- `default` means the current minimal profile fallback with no explicit `profile.preset`.
- `article` means the preset-backed candidate with `profile.preset: article`.
- `default` may still render with the renderer default preset when no preset override exists, but it should not serialize `profile.preset`.
- each candidate summary passed to Codex must state whether it is preset-backed and which profile fields it contributes.

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

Collect bounded deterministic signals before calling Codex when a Markdown sample is available:

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

No-path runs should record document facts as absent rather than inconclusive. They may still call Codex when a target signal exists, such as `--intent` or `--font-hint`. `--base-profile` alone should not call Codex.

Signal caps for v1:

| Signal | Bound |
| --- | --- |
| document text for script buckets | scan at most 20,000 non-frontmatter characters; do not send raw text to Codex |
| heading summary | count all parsed headings; include max depth and counts by depth only |
| Markdown table scan | inspect at most the first 50 table-like rows and report max column count and max line width |
| code fence languages | list at most 12 distinct language labels plus an overflow count |
| asset summary | count local and remote references; do not include raw remote URLs in Codex input |
| font family summary | include bounded family names and coverage statuses; do not include file paths |
| frontmatter | include only `lang`, `pdf.content-langs`, and metadata keys needed for PDF profile reasoning |

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
- available document signal summary
- available font summary
- optional user intent
- optional user font hints
- signal mode
- supported profile schema summary

The adapter should return structured data, not arbitrary YAML text:

- decision mode: `adapted`, `conservative-fallback`, or `no-usable-profile`
- selected base candidate
- accepted profile patches
- preset identity when preset-backed
- concise reasoning
- warnings
- fallback reason when relevant
- unmatched intent directions when profile/template settings cannot represent them

Accepted patches should use a strict schema-compatible contract:

```text
accepted_patches[]
  op: replace
  path: enum of supported Markdown PDF profile paths
  value: bounded primitive or string array
```

This follows the `data stack` Codex-report precedent: Codex recommends bounded changes through enum-backed paths instead of returning an arbitrary nested object. Validate the structured response before serializing a profile. Reject unknown patch paths, unsupported value types, and invalid enum values.

Shared decision and report types should be defined with the adapter contract so parsing and report serialization do not diverge later.

Adaptation rules:

```text
base = selectedCandidate.fullProfile
patches = validateCodexAcceptedPatches(codex.acceptedPatches)
proposed = applyBoundedPatches(base, patches)
validate(proposed)
write(proposed + profile identity metadata)
```

Rules:

- start from the selected base candidate's full profile object
- apply only schema-valid replace patches from Codex
- keep unspecified fields from the base profile
- disallow deletion and reset semantics in v1
- for `--base-profile`, use the loaded profile as the base object
- validate the final merged profile before writing or reporting success

Recommended module layout:

- `src/cli/markdown-pdf/profile/identity.ts`
- `src/cli/markdown-pdf/profile/candidates.ts`
- `src/cli/markdown-pdf/profile/signals.ts`
- `src/adapters/codex/markdown-pdf-profile/`
- `src/cli/markdown-pdf/codex-report/`
- `src/cli/actions/markdown/pdf-profile-codex.ts`

### Decision Modes

Implement these outcomes:

| Mode | CLI behavior | Writes |
| --- | --- | --- |
| `adapted` | success | profile, plus optional Codex report |
| `conservative-fallback` | success with visible stdout note | profile, plus optional Codex report |
| `no-usable-profile` | failure | no profile; Codex report only when explicitly requested |

`conservative-fallback` is a Codex decision mode, not a separate CLI option.

Minimum stdout summary for successful runs:

- decision mode
- selected `basedOn`
- output profile path
- preset value when present
- fallback reason when mode is `conservative-fallback`

Error and exit behavior:

| Outcome | Exit | Writes |
| --- | --- | --- |
| `adapted` | `0` | profile, plus optional Codex report |
| `conservative-fallback` | `0` | profile, plus optional Codex report |
| `no-usable-profile` | non-zero | no profile; Codex report only when explicitly requested |
| Codex unavailable | non-zero | no profile; Codex report only when explicitly requested |
| invalid structured output | non-zero | no profile; Codex report only when explicitly requested |
| invalid base profile | `2` | no profile and no Codex call |

The implementation should use the existing read-only Codex adapter pattern and show progress/status output while the Codex call is running.

### Output And Report Artifacts

Profile output:

- respect custom `--output`
- otherwise derive a generated `.yml` path from the input stem and profile UID when input exists
- otherwise derive a generated `.yml` path from the profile UID
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
- signal mode
- input fingerprint or bounded summary when a Markdown path is supplied
- intent and font hints
- deterministic signal summary
- font summary and warnings
- selected base candidate
- base profile identity or untracked-base note
- decision mode
- changes from base
- accepted profile patches
- unmatched directions
- fallback reason when relevant
- validation warnings

### Review And Dry Run

Normal execution should:

- collect available signals
- call Codex when at least one target signal exists
- validate the proposed profile
- print a concise proposed-profile summary
- write selected artifacts

`--dry-run` should:

- collect available signals
- call Codex when at least one target signal exists
- validate the proposed profile
- print the same proposed-profile summary and warnings
- display the output paths that would be used
- skip profile writing
- write the Codex report only when `--keep-codex-report` or `--codex-report-output` is present

No interactive confirmation prompt should be required in the direct CLI path.

## Implementation Phases

### Phase 1: Profile Schema And Replay

- [x] Add `profile` identity validation and normalization.
- [x] Add `profile.preset` validation against the existing Markdown PDF preset set.
- [x] Serialize `profile` in YAML and JSON profiles.
- [x] Teach `md to-pdf --profile` to use `profile.preset` for preset-backed recipe behavior.
- [x] Preserve CLI-over-profile replay precedence for explicit render flags.
- [x] Keep older profiles without `profile` valid.
- [x] Add focused parser, serializer, and `md to-pdf --profile` replay tests, including a preset-backed CSS replay test.

### Phase 2: Profile Candidate And Signal Modules

- [x] Add reusable candidate construction from current defaults and presets.
- [x] Distinguish `default` from preset-backed `article` in candidate summaries.
- [x] Add base-profile loading and validation helpers.
- [x] Add Markdown signal collection for headings, tables, code fences, scripts, assets, and frontmatter.
- [x] Enforce v1 signal caps and no-snippet Codex input behavior.
- [x] Add bounded font summary collection using existing font modules.
- [x] Add tests for signal caps, inconclusive states, and base-profile validation.

### Phase 3: Codex Adapter

- [x] Define shared decision and report TypeScript types used by adapter parsing and report serialization.
- [x] Add Markdown PDF profile prompt construction.
- [x] Call Codex through the existing adapter style.
- [x] Parse structured recommendations.
- [x] Validate decision modes and accepted fields.
- [x] Implement bounded base-profile merge semantics with no deletion or reset behavior in v1.
- [x] Support unavailable Codex and invalid structured output paths.
- [x] Add adapter unit tests with stubs.

Phase 3 follow-up note:

- The first adapter implementation used an open `accepted_fields` object and validated it after Codex returned.
- Phase 6.1 replaces that object fragment with a strict patch contract because real structured-output schema validation rejects open nested objects before Codex can generate a response.

### Phase 4: Action And Command Wiring

- [x] Add `actionMdPdfProfileCodex`.
- [x] Register `md pdf-profile codex`.
- [x] Implement output path generation, UID handling, overwrite checks, and collision checks.
- [x] Implement `--dry-run`, `--keep-codex-report`, and `--codex-report-output`.
- [x] Print concise summary output and fallback notes.
- [x] Add progress/status output and explicit exit behavior for Codex unavailable, invalid structured output, and invalid base profile cases.
- [x] Export action types through the Markdown action index.

### Phase 5: Codex Report Artifact

- [x] Define the report JSON schema using the shared decision/report types from Phase 3.
- [x] Write derived and explicit report paths.
- [x] Link report ID and profile ID.
- [x] Record base-profile identity or untracked-base fallback.
- [x] Keep reports advisory-only.
- [x] Add report validation and collision tests.

### Phase 6: Optional Input And Signal-Ladder Contract

- [x] Add optional positional input support for `md pdf-profile codex [input]`.
- [x] Keep `--input <path>` as an explicit alias for script-friendly usage.
- [x] Reject conflicting positional and `--input` paths before collecting signals.
- [x] Make `--intent` optional now that no-signal requests can fall back deterministically.
- [x] Add signal-mode classification for document-informed, hint-only, mixed-with-base, base-only-deterministic, and basic-default runs.
- [x] Extend profile source validation so basic-default output can use `profile.source: deterministic`.
- [x] Skip Codex and produce a deterministic basic profile when no signal exists.
- [x] Validate and write a deterministic base derivative when only `--base-profile` is supplied.
- [x] Allow Codex-assisted mode when any target signal exists: input path, intent, or font hint.
- [x] Record signal mode in Codex reports when a report is written.
- [x] Bump the Codex report artifact version for the signal-mode contract and validate signal/input metadata consistency.
- [x] Reject direct, symlink, and hardlink source/sink collisions across Markdown input, base profile, profile output, and Codex report output.
- [x] Add tests for positional input parity, input conflict errors, intent-only mode, font-hint signal handling, base-only deterministic mode, no-signal deterministic fallback, generated no-input output paths, report metadata validation, and alias-path collisions.

Phase 6 focused validation:

```bash
bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts
```

Phase 6 follow-up note on 2026-06-15:

- Help text now presents `[input]` as the normal Markdown sample form and `--input <path>` as the script-friendly equivalent.
- The command description now mentions sample signals, hints, and fallback defaults so no-signal deterministic fallback is not misread as always invoking Codex.
- No behavior changed in this follow-up.

Phase 6 working-directory hotfix note on 2026-06-15:

- `md pdf-profile codex` now starts Codex from the caller's `runtime.cwd`, matching the existing `rename`, `data query`, and `data stack` Codex helper policy.
- The bug happened because the action passed `runtime.cwd`, but the adapter wrapped the Codex call in `runCodexPromptOnly`, which replaced that working directory with a temporary prompt directory.
- This could fail before the profile prompt reached Codex when the temporary directory was not a trusted Git repository.
- The focused job record is `docs/plans/jobs/2026-06-15-markdown-pdf-codex-profile-phase-6-hotfix.md`.

### Phase 6.1: Strict Structured Output Patch Contract

- [x] Replace open `accepted_fields` output with strict `accepted_patches`.
- [x] Define enum-backed Markdown PDF profile patch paths for the first supported adaptation surface.
- [x] Keep patch operations to `replace` only.
- [x] Support only bounded value schemas that structured-output validation accepts.
- [x] Convert accepted patches into the existing profile application path.
- [x] Preserve final `validateMarkdownPdfProfileShape` validation before writing or reporting success.
- [x] Add profile normalization validation so invalid patch values fail before reporting success.
- [x] Update the Codex prompt to ask for patches, not arbitrary profile fragments.
- [x] Update decision/report types so reports explain accepted patches and derived changes from the base profile.
- [x] Add regression coverage for the schema shape so open object fragments cannot return.
- [x] Record the live Codex verification limit: sandboxed smoke is blocked before a remote structured-output response, and unsandboxed verification was rejected by policy because it would disclose README-derived signals externally.
- [x] Add a Phase 6.1 job record after implementation and validation.
- [x] Add the strict structured-output required-property hotfix for `fallback_reason`.
- [x] Make every key under the output schema `properties` appear in `required`.
- [x] Represent absent `fallback_reason` with a schema-valid empty string.
- [x] Normalize empty `fallback_reason` back to an omitted decision/report value.
- [x] Update prompt wording so Codex always returns the required `fallback_reason` field.
- [x] Add regression coverage for the required-property schema rule.
- [x] Re-run the real command smoke and record whether it reaches the next validation boundary.

Phase 6.1 rationale:

- `data query` works because its Codex output schema is a closed object with fixed `sql` and `reasoning_summary` properties.
- `data stack` works because recommendations use closed nested objects and enum-backed patch paths.
- `md pdf-profile codex` reached the real structured-output request after the Phase 6 working-directory hotfix, then failed because `accepted_fields: { type: "object" }` was an open object fragment.
- The fix should align the Markdown PDF helper with the `data stack` patch-contract pattern instead of chasing nested `additionalProperties: false` errors across a wide profile schema.
- The next strict-schema failure is a required-property rule: Codex structured output requires every key declared in `properties`, including `fallback_reason`, to be present in `required`.

Phase 6.1 focused job record:

- `docs/plans/jobs/2026-06-16-markdown-pdf-codex-profile-phase-6-1-strict-patch-contract.md`

### Phase 6.2: Patch Value Domains And Progress Feedback

- [x] Add enum/value-domain metadata for Codex patch paths with constrained profile values.
- [x] Include allowed values in the bounded Codex prompt facts instead of adding new CLI hint flags.
- [x] Validate enum-sensitive patch values before profile application with path-specific error context.
- [x] Cover the observed invalid `/cover/style` patch value path.
- [x] Cover the observed invalid `/pageNumbers/position` patch value path.
- [x] Decide and implement the invalid-patch handling policy: fail closed.
- [x] Keep selected-candidate validation fail-closed when Codex selects an unknown candidate.
- [x] Add Codex waiting progress feedback for the direct `md pdf-profile codex` helper.
- [x] Reuse or extract the existing direct-command TTY spinner pattern from rename Codex progress.
- [x] Keep progress output TTY-only or safely single-line on non-TTY streams.
- [x] Ensure progress stops and clears on success, fallback, and all error paths.
- [x] Add focused tests for value-domain handling and progress cleanup.
- [x] Run artifact-safe smoke tests with `--dry-run` and no Codex report flags.
- [x] Verify no generated profile, report, or replay artifacts are staged or committed.
- [x] Add a Phase 6.2 job record after implementation and validation.

Phase 6.2 rationale:

- Phase 6.1 made the structured-output schema API-valid.
- Live runs then reached profile application and exposed semantic patch-value failures, such as invalid `profile.cover.style` and `profile.pageNumbers.position` values.
- Those failures are value-domain contract gaps, not structured-output schema-shape gaps.
- Direct CLI users also need visible progress while Codex is running; `rename` Codex progress is the closest existing direct-command precedent.

Phase 6.2 focused job record:

- `docs/plans/jobs/2026-06-16-markdown-pdf-codex-profile-phase-6-2-patch-value-domains.md`

### Phase 6.3: Renderer Compatibility And Style Decision Policy

- [ ] Replace cover-page CSS that emits WeasyPrint viewport-unit warnings with paged-media-safe layout CSS.
- [ ] Add regression coverage proving enabled cover profiles do not emit `min-height: 100vh`.
- [ ] Add candidate-summary traits so Codex sees the behavioral cost of each candidate, including cover, ToC, page numbers, code highlighting, density, and intended use.
- [ ] Add bounded style-policy prompt facts that keep profiles reusable and conservative.
- [ ] Add feature trigger rules for cover, ToC, page numbers, and code highlighting.
- [ ] Add renderer compatibility prompt facts that tell Codex not to select settings known to produce renderer warnings.
- [ ] Keep style and renderer guidance prompt-internal; do not add new public hint flags beyond `--intent` and `--font-hint`.
- [ ] Tune page-number guidance so Codex enables page numbers only for explicit intent or long-form document signals.
- [ ] Avoid total-page formats in Codex decisions until total-page semantics are deterministic and documented.
- [ ] Add focused tests for prompt facts, candidate traits, cover CSS compatibility, and conservative page-number selection.
- [ ] Run artifact-safe smoke tests with `--dry-run` and no Codex report flags.
- [ ] Verify no generated profile, report, PDF, or replay artifacts are staged or committed.
- [ ] Add a Phase 6.3 job record after implementation and validation.

Phase 6.3 rationale:

- Phase 6.2 made Codex patch values schema-valid and profile-valid, but valid profile values can still route into renderer warnings or over-eager document chrome.
- A live replay using a Codex-generated profile selected `cover.enabled: true` and `cover.style: report`; the deterministic cover CSS then emitted WeasyPrint warnings for `min-height: 100vh`.
- That warning is a renderer compatibility bug, not raw Codex CSS generation. Valid cover profiles should render without known warnings.
- The same replay showed that page numbers need a clearer decision policy. Codex should not infer full report chrome from soft wording such as clean, proper, polished, or professional unless document signals or explicit intent justify it.
- Candidate summaries currently expose only coarse identity and field presence. Codex needs compact candidate traits so it can understand that selecting a preset may also enable cover, ToC, page numbers, and code highlighting.
- The fix should remain internal to candidate facts, prompt facts, renderer CSS, and tests. It should not introduce broad style-hint flags or make the CLI surface larger.

### Phase 7: Documentation And Guide Updates

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
- optional positional input and `--input` parity
- conflicting positional and `--input` path rejection
- profile schema validation for `profile` identity and preset replay
- JSON profile identity and preset replay parity
- old-profile compatibility without `profile`
- `md to-pdf --profile` consuming `profile.preset`
- render CLI flags overriding `profile.preset` and profile-derived recipe options
- preset-backed profile replay producing different generated CSS than default/article-free profile replay when expected
- candidate construction from defaults, presets, and `--base-profile`
- `default` versus preset-backed `article` candidate distinction
- invalid base-profile rejection before Codex
- document signal collection with bounded samples
- no-path signal-mode behavior
- no raw document snippets, raw remote URLs, or local font paths in Codex input
- font summary and coverage warning handling
- Codex unavailable path
- invalid Codex structured output path
- strict structured-output schema compatibility for accepted patches
- bounded merge semantics preserving unspecified base fields
- `adapted`, `conservative-fallback`, and `no-usable-profile` behavior
- generated output path and UID behavior
- explicit and generated collision behavior
- `--dry-run` non-writing profile behavior
- optional report writing and report/profile UID matching
- deterministic no-signal basic-profile fallback without a Codex call
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
- `cdx-chores md pdf-profile codex <path>` and `--input <path>` share the same document-signal contract.
- `cdx-chores md pdf-profile codex` without signals produces a deterministic basic profile without calling Codex.
- one target signal, such as input path, `--intent`, or `--font-hint`, is enough to enter Codex-assisted mode.
- `--base-profile` alone produces a deterministic derivative without calling Codex.
- `--base-profile <path>` can refine an existing valid profile without mutating it.
- generated profiles include `profile.id`, `source`, `basedOn`, `preset` when applicable, and `createdAt`.
- `md to-pdf --profile <generated-profile>` replays the selected preset behavior.
- a generated `wide-table` profile produces preset-backed render output without also passing `--preset`.
- explicit render CLI flags still override generated profile settings.
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
