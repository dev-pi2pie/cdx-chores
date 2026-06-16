---
title: "Markdown PDF Codex Profile Helper and Interactive Flow"
created-date: 2026-06-10
modified-date: 2026-06-16
status: in-progress
agent: codex
---

## Goal

Define the next Markdown PDF development direction after the deterministic `md to-pdf`, `md pdf-profile init`, `md pdf-template init`, font-checking, and Shiki code-highlighting work.

This research covers two related layers:

1. a direct Codex-assisted profile helper that selects and adapts reusable Markdown PDF profiles
2. a later Interactive mode flow that reuses the same profile contract instead of inventing a separate assistant surface

The main product boundary is:

```text
md to-pdf remains deterministic.
pdf-profile is the durable rendering decision.
Codex is an opt-in helper that selects and adapts a profile template.
pdf-template remains the advanced low-level HTML/CSS recipe snapshot.
```

## Why This Research

The existing Markdown PDF lane has the deterministic foundation in place:

- `md to-pdf` renders Markdown through Pandoc-generated HTML and WeasyPrint.
- `md pdf-profile init` writes reusable PDF rendering settings.
- `md pdf-template init` writes editable `template.html` and `style.css` recipe files.
- `font list`, `font inspect`, and `font check` provide the font discovery and coverage checkpoint needed before any assistant suggests font settings.
- Shiki code highlighting can be controlled through CLI flags and profile fields.

The remaining deferred surfaces are not renderer problems. They are workflow and contract problems:

- how Codex should choose and adapt a profile template without writing raw executable HTML/CSS
- how font choices should be suggested from deterministic facts instead of prompt guesses
- how profile and diagnostic artifacts should remain replayable across projects
- how the helper should explain fallback or low-signal decisions
- how Interactive mode should offer the helper while keeping user review and deterministic replay clear
- how to avoid ambiguity between `pdf-profile` and `pdf-template`

This research records those decisions before drafting implementation plans.

## Starting State

The direct Markdown PDF command surface currently includes:

```bash
cdx-chores md to-pdf --input report.md --profile ./pdf-profile.yml
cdx-chores md pdf-profile init --output ./pdf-profile.yml
cdx-chores md pdf-template init --output ./pdf-template
cdx-chores font check --text "..." --family "Noto Serif CJK TC"
```

At the start of this research, the public Markdown PDF guide stated that Interactive Markdown PDF and Codex-assisted PDF helper flows were deferred. Earlier Markdown PDF research also deferred Codex SDK helper behavior until the deterministic renderer, profile, template, font, and code-highlighting layers were proven.

The interactive Markdown submenu currently has Markdown actions for `to-docx` and `frontmatter-to-json`, but not `to-pdf`, `pdf-profile init`, or `pdf-template init`.

## Scope

This research covers:

- the command naming and product boundary for a Codex-assisted Markdown PDF profile helper
- the distinction between `pdf-profile` and `pdf-template`
- profile and Codex diagnostic artifact identity rules
- base profile/template candidate selection and adaptation rules
- direct CLI output and diagnostic sidecar behavior
- deterministic font signal collection for Codex profile adaptation
- low-signal fallback behavior and diagnostic reporting
- the intended later Interactive mode flow
- sequencing for the first Codex helper plan and the later Interactive plan

This research does not implement:

- command wiring
- Codex SDK calls
- profile schema changes
- interactive prompts
- PDF rendering changes
- guide or README release-boundary updates

## Key Findings

### 1. `md to-pdf` should offer a profile-centered path, not a Codex-centered path

Profiles are optional today, and direct flags/presets remain valid. The improved durable workflow should make profile use the clearest replay path:

```bash
cdx-chores md to-pdf --input report.md --profile ./report-profile.yml
```

Codex should help create or refine the profile, but rendering with an accepted profile should not require Codex, network access, or an auth/session state.

Recommended workflow:

```bash
cdx-chores md pdf-profile codex \
  report.md \
  --intent "landscape internal report with wide tables, ToC, and readable code blocks" \
  --output ./report-profile.yml

cdx-chores md to-pdf \
  --input report.md \
  --profile ./report-profile.yml \
  --output ./report.pdf
```

This follows the existing reviewed-assist pattern used by data workflows, especially source-shape/profile-like artifacts and optional Codex reports. Rename remains useful as a broader opt-in Codex precedent, but it is not the main artifact/report analogy.

- deterministic execution remains available without Codex
- Codex proposes bounded recommendations
- accepted recommendations become explicit replayable inputs
- advisory evidence is optional and separate from the execution artifact

### 2. The direct helper should be `md pdf-profile codex`

The first Codex helper should live under the profile noun group:

```bash
cdx-chores md pdf-profile codex report.md --intent "..." --output report-profile.yml
```

This is preferred over `md pdf-profile suggest` because `suggest` hides the Codex dependency and makes the command sound like a deterministic heuristic. It is also preferred over `md to-pdf --codex` for the first slice because adapting a profile and rendering a PDF are different decisions.

The command should be a subcommand, not only a flag, because it creates a durable profile artifact. Flags should be reserved for optional Codex checkpoints inside an existing workflow, such as a later Interactive `md to-pdf` flow or a future render-time helper.

Recommended command roles:

| Surface | Role |
| --- | --- |
| `md pdf-profile init` | deterministic starter profile |
| `md pdf-profile codex [path]` | Codex-assisted profile template selection and adaptation from available signals |
| `md to-pdf --profile <path>` | deterministic render from an accepted profile |
| `md pdf-template init` | low-level editable HTML/CSS recipe snapshot |

### 3. The helper should choose and adapt profile candidates

`md pdf-profile codex` should not be framed as blank profile generation. It should start from known profile candidates, inspect the current Markdown document, apply user hints, then write a better-fitting replayable profile.

Recommended helper pipeline:

```text
profile candidates
  -> built-in default profile
  -> built-in preset-derived profiles
  -> user supplied base profile from --base-profile <path>
  -> optional local profile templates later

document signals
  -> frontmatter/lang
  -> heading structure
  -> table pressure
  -> code block density and languages
  -> script/language samples
  -> asset signals

user hints
  -> intent
  -> font hints

font facts
  -> available font families
  -> coverage checks

Codex decision
  -> select base candidate
  -> explain why
  -> apply bounded changes
  -> output structured profile fields
```

The helper should split target signals from source signals. The Markdown path, intent, and font hints tell Codex what to optimize toward. The base profile tells the helper where to start. Codex-assisted mode needs at least one target signal; a base profile alone should stay deterministic because it does not define a useful adaptation direction.

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

`md pdf-profile codex report.md` and `md pdf-profile codex --input report.md` should be equivalent. If both are supplied, conflicting normalized paths should fail before collecting signals. If no path is supplied but `--intent` or `--font-hint` is present, the helper can still ask Codex to adapt from the candidate catalog and available target signals. If only `--base-profile` is supplied, the helper should validate and write a deterministic derivative or normalized copy with a new profile identity, without calling Codex. If no path, intent, font hint, or base profile is supplied, the helper should return the same kind of deterministic basic profile that `md pdf-profile init` can create, without calling Codex.

The direct CLI should stay small. General rendering direction belongs in `--intent`; font preference belongs in `--font-hint`. The helper can derive internal decision categories from those inputs, document signals, and font facts, then report how the categories mapped to supported profile fields.

Recommended prompt-design boundary:

```text
User-facing CLI
  [report.md] or --input report.md
  --intent "internal review packet with dense tables and readable code"
  --font-hint "prefer Noto Serif CJK TC"
          |
          v
Deterministic collectors
  available document signals
  available font summaries
  candidate profile catalog
          |
          v
Codex prompt contract
  interpret intent as:
    purpose: review | reading | print | archive | presentation
    density: compact | balanced | spacious
    table priority: low | medium | high
    code priority: low | medium | high
    locale/script needs: derived from document + font facts
  select base profile candidate
  produce only supported profile fields
          |
          v
Validated artifacts
  profile.yml
  optional codex-report.json
```

This prevents CLI flag bloat while preserving the useful reasoning layer. New user-facing hint flags should not be added just to mirror prompt categories. If a direction cannot be represented by the current profile schema or template behavior, the helper should not invent an unsupported field. It should leave the profile valid and, when the report is requested, list the unmatched direction in the report.

This model makes fallback behavior part of the normal decision tree. If signals are weak, Codex can choose a conservative base candidate and explain that choice instead of needing a separate `--fallback-profile` option.

Recommended decision modes:

| Mode | Meaning |
| --- | --- |
| `adapted` | Codex selected a base profile and made document-specific changes |
| `conservative-fallback` | signals were weak or conflicting, so Codex selected a safe base with minimal changes |
| `no-usable-profile` | Codex was unavailable or returned output that could not be validated |

The first two modes can still write a valid profile. `no-usable-profile` should not silently write a profile that looks Codex-authored.

Recommended direct CLI behavior by decision mode:

| Mode | Exit behavior | File writes |
| --- | --- | --- |
| `adapted` | success | write profile; optionally write Codex report |
| `conservative-fallback` | success with visible stdout note | write profile; optionally write Codex report |
| `no-usable-profile` | failure | do not write profile; optionally write Codex report only if explicitly requested |

`conservative-fallback` should not require a separate direct CLI option. It is a Codex helper decision when signals are weak or conflicting. `no-usable-profile` covers unavailable Codex, invalid structured output, or profile validation failure.

The optional Codex report should explain:

- selected base profile or preset
- decision mode
- signals used
- changes from the base candidate
- confidence or risk notes
- fallback reason, when a conservative fallback was chosen

The profile itself can keep only concise provenance, such as `source: codex` and `basedOn: wide-table`, while the report carries the detailed reasoning.

The Codex response contract should follow the strict patch pattern already used by `data stack`, not an open object fragment. A free-form `accepted_fields` object is too loose for strict structured-output validation because nested objects must be explicitly closed. The direct helper should instead ask Codex for bounded profile patches:

```text
decision_mode
selected_candidate_id
accepted_patches[]
  op: replace
  path: enum of supported Markdown PDF profile paths
  value: bounded primitive or string array
reasoning
warnings
fallback_reason
unmatched_directions
```

The implementation can still apply those patches by converting them into a profile application step, but the external Codex contract should be enum-backed, closed, and API-valid before Interactive mode depends on it.

Recommended v1 candidate catalog:

| Candidate | `basedOn` value | Source |
| --- | --- | --- |
| built-in default profile | `default` | current default Markdown PDF profile values |
| article preset profile | `article` | profile values plus preset behavior for `article` |
| report preset profile | `report` | profile values plus preset behavior for `report` |
| wide-table preset profile | `wide-table` | profile values plus preset behavior for `wide-table` |
| compact preset profile | `compact` | profile values plus preset behavior for `compact` |
| reader preset profile | `reader` | profile values plus preset behavior for `reader` |
| user supplied base profile | existing profile identity when present; generated profile UID when absent | profile loaded from `--base-profile <path>` |

The first helper should support `--base-profile <path>` so Codex can refine an existing profile instead of forcing every assisted run to start from a built-in candidate. Local profile-template catalogs remain outside the first pass. The v1 catalog should be generated from the same defaults, preset validation, and recipe behavior used by current `md to-pdf` and `md pdf-profile init` paths, plus the single loaded base profile when the user provides one.

Recommended `--base-profile` behavior:

- load and validate the base profile before collecting Codex recommendations
- treat the base profile as the strongest candidate when it is valid
- preserve existing fields unless Codex has document facts or user intent that justify a bounded change
- record the base profile path as a displayed path in the optional Codex report, not as a raw private absolute path
- reject invalid base profiles before calling Codex
- keep `--output` separate from `--base-profile` so the helper writes a reviewed derivative instead of mutating the source profile in place

### 4. `pdf-profile` and `pdf-template` must stay distinct

The simplest distinction is:

```text
pdf-profile = what the PDF should be like
pdf-template = how HTML/CSS physically renders it
```

`pdf-profile` should hold structured, validated fields:

```yaml
page:
  size: A4
  orientation: landscape

toc:
  enabled: true
  depth: 3

fonts:
  body:
    default: "Source Serif 4"
    zh-Hant: "Noto Serif CJK TC"
  code:
    default: "JetBrains Mono"

code:
  highlight: true
```

`pdf-template` should keep writing low-level files:

```text
pdf-template/
  template.html
  style.css
```

The Codex helper should target `pdf-profile` in the first implementation. Raw `template.html` and `style.css` generation should remain deferred because it expands the review surface and risks turning assistant output into executable rendering code.

### 5. Profile completeness depends on preset persistence

Profiles are the right durable artifact, but current profile behavior has one known gap: `md pdf-profile init --preset <name>` stores values derived from a preset, not the preset identity itself. A later `md to-pdf --profile <path>` run can preserve page shape while still using the default `article` preset CSS unless the same `--preset` is passed again.

That matters for the Codex helper because many user intents map directly to presets:

- "wide table report" maps naturally to `wide-table`
- "long report with ToC" maps naturally to `report`
- "screen reading copy" maps naturally to `reader`
- "dense internal notes" maps naturally to `compact`

If `md pdf-profile codex` writes only derived fields, the generated profile may not be a complete replayable rendering decision. The first implementation plan should add a schema-supported preset identity field and teach `md to-pdf --profile <path>` to consume it before treating Codex profiles as fully replayable.

This direction makes a Codex-generated profile self-contained and aligns with the preset-persistence follow-up already recorded for Markdown PDF profiles.

This is not just about storing a label. Presets affect renderer behavior through generated CSS and recipe choices, including typography, table sizing, spacing, and other layout rules that cannot be fully captured by copying only a few page fields. A Codex-selected base candidate therefore needs replayable preset identity.

### 6. Codex font choices need deterministic signals, not prompt-only guessing

The helper should not ask Codex to infer fonts from prompt text alone. Font recommendations should be based on deterministic inputs:

- Markdown frontmatter `lang`, when present
- `pdf.content-langs`, when present
- sampled script coverage from document text, such as Latin, Traditional Chinese, Japanese, Korean, RTL, symbols, and emoji
- code fence languages and code-block density
- table width and heading structure signals
- user intent
- optional user font hints
- bounded local font family inventory from existing font discovery
- coverage results or warnings from existing font-check logic

The helper should not reimplement font discovery or glyph coverage. It should orchestrate the existing font module and `font check` behavior, then pass summarized facts to Codex.

Minimum v1 document signals should be small and deterministic:

| Signal | Suggested v1 shape |
| --- | --- |
| frontmatter language | document `lang` plus `pdf.content-langs`, when present |
| heading shape | heading count and max heading depth |
| table pressure | max detected Markdown table columns, long table-line width, or inconclusive |
| code shape | code fence count plus bounded language list |
| script samples | detected script buckets such as Latin, CJK, RTL, symbols, emoji |
| asset signals | local/remote image or asset reference counts |
| font facts | family-name inventory summary plus coverage warnings |

If a signal cannot be collected cheaply or safely, it should be marked inconclusive rather than guessed. The implementation plan should define exact sampling limits and redaction rules before sending signal summaries to Codex.

Recommended direct CLI shape:

```bash
cdx-chores md pdf-profile codex report.md \
  --intent "Traditional Chinese and English client report with code examples" \
  --font-hint "prefer Noto CJK if available" \
  --output report-profile.yml
```

`--input <path>` should remain as an explicit alias for script-friendly usage. `--font-hint` should be optional and repeatable. The default helper path should work from whichever signals are available. When no Markdown path is available, document facts are absent rather than guessed.

Common hint signals should be structured before they reach Codex. Interactive mode can ask friendly questions, but the helper should reduce the answers into stable fields such as:

| Signal | Example |
| --- | --- |
| document purpose | internal report, client report, reference sheet |
| audience/read mode | print review, screen reading, archival PDF |
| language mix | English plus Traditional Chinese, Japanese-only, multilingual |
| layout pressure | wide tables, dense notes, long-form prose |
| code needs | highlighted code, line numbers, plain code blocks |
| font preference | prefer local corporate font, prefer Noto CJK if available |

Privacy boundary:

- Codex context should use family names, language/script summaries, and coverage status.
- It should not need raw local font file paths.
- Review artifacts should avoid recording private source snippets unless the implementation adds explicit redaction and bounded sample rules.
- Review artifacts should avoid raw absolute source paths by default; use displayed relative paths, file fingerprints, and bounded document summaries where traceability is needed.

### 7. Codex should return bounded profile fields

The Codex output should be structured and narrow. It should not return arbitrary YAML text as the primary contract.

Recommended output categories:

- selected base profile or preset
- decision mode
- preset identity for replayable preset-backed profiles
- page settings
- ToC settings
- code highlighting settings
- cover/page-chrome/page-number settings
- font role settings
- expected content languages
- metadata defaults only when clearly inferred or requested
- short reasoning summaries and warnings

The implementation should parse Codex output, validate it through the profile schema, then serialize the profile through deterministic code.

The first helper should avoid:

- raw CSS
- raw HTML template fragments
- remote asset suggestions
- automatic language-span rewriting
- auto-rendering the PDF without a user-visible profile decision

### 7.1. Title and cover decisions need a deduplication policy

The helper should treat Markdown titles as document structure, not just as cover-page material. A Markdown file can already contain a good visible title in its first H1, while frontmatter `title` can also feed metadata, renderer title chrome, or a cover title. If Codex enables cover or title treatment only because a title signal exists, the rendered PDF can duplicate the same title.

The direct helper should collect bounded title signals when a Markdown sample is available:

- frontmatter `title`, when present
- first Markdown H1, when present
- normalized title match between frontmatter `title` and the first H1
- explicit cover intent from `--intent`
- explicit no-cover or no-title-page intent from `--intent`

Recommended title decision ladder:

```text
explicit cover intent
  -> Codex may enable supported cover/profile title behavior
  -> warn when the body H1 duplicates the cover/title and profile settings cannot suppress it

explicit no-cover or no-title-page intent
  -> keep cover disabled
  -> avoid adding extra title chrome

frontmatter title matches first H1, no explicit cover intent
  -> treat the H1 as the visible document title
  -> avoid enabling cover or extra title treatment

metadata title exists, no first H1
  -> Codex may use supported title or cover behavior when the document purpose justifies it

first H1 exists, no metadata title
  -> treat the H1 as the visible document title
  -> avoid cover unless requested
```

This is a profile-helper policy, not a Markdown rewrite feature. The helper should not remove the first H1, mutate frontmatter, invent unsupported title-suppression fields, or generate custom HTML/CSS to solve title duplication. If the current profile schema cannot represent the requested title or cover behavior, Codex should record the unsupported direction through warnings or unmatched directions.

Richer cover media, local cover images, and exact title-block rendering belong to template/custom HTML work or later template-Codex research.

### 8. Codex-generated profiles need durable identity

Profiles generated by `md pdf-profile codex` should always include an artifact identity, even when the user provides a custom output path.

The existing profile schema rejects unknown root keys, so the implementation plan must add `profile` as the schema-supported identity section rather than putting helper metadata into document `metadata`.

Recommended identity shape:

```yaml
profile:
  id: md-pdf-profile-20260610T081500Z-a1b2c3d4
  source: codex
  basedOn: wide-table
  preset: wide-table
  createdAt: 2026-06-10T08:15:00Z
```

This top-level `profile` section is the confirmed identity home for Markdown PDF profile artifacts. It describes the profile artifact itself. It should not be merged into document metadata or rendered into the PDF.

Identity rules:

- `md pdf-profile codex` always creates a profile ID when it writes a profile.
- The ID stays stable if the profile file is moved, copied, or reused from another root directory.
- The short UID suffix may be used in generated filenames for readability.
- Custom output paths are respected; identity still lives inside the profile.
- Codex-assisted outputs use `profile.source: codex`.
- Outputs that skip Codex use `profile.source: deterministic`, including the no-signal basic profile and base-only deterministic derivative paths.
- If `--base-profile <path>` points to a valid profile with `profile.id`, the generated derivative should keep a link to that base identity in the Codex report and create a new `profile.id` for the derivative.
- If `--base-profile <path>` points to a valid older profile without `profile.id`, the helper should treat the base identity as missing, generate a new `profile.id` for the derivative, and record the base as an untracked base profile in the optional Codex report.
- If a built-in preset candidate is selected, `basedOn` should use the preset-backed candidate name, such as `wide-table`.
- If a built-in preset candidate is selected, `preset` should store the replayable renderer preset consumed by `md to-pdf --profile`.
- If no clear base candidate is available but a conservative fallback profile is still valid, `basedOn` should use `default`.
- Future identity for `md pdf-profile init` can reuse the deterministic source value, but wiring identity into `init` is not required for the first helper.

### 9. Codex diagnostic report should be optional and linked by the same UID

The profile is the replayable rendering artifact. The Codex report JSON is optional diagnostic history.

Direct CLI flag naming should stay close to existing data-stack wording unless implementation review finds a strong reason to diverge. The user-facing prompt can call this diagnostic history, but the direct CLI surface should prefer `codex-report` terminology for consistency with `data stack --codex-assist`.

There is one intentional difference from `data stack`: data-stack Codex reports are tied to `--dry-run`, while `md pdf-profile codex` writes the primary profile artifact during normal execution. For Markdown PDF profiles, the report option should mean "also keep the diagnostic explanation for this profile decision."

Recommended direct CLI options:

```text
--output <path>
  Write the profile to this path. If omitted, derive a .yml profile path from the input stem and UID.

--keep-codex-report
  Write a Codex diagnostic report sidecar using a derived path.

--codex-report-output <path>
  Write the Codex diagnostic report sidecar to an explicit path. Implies --keep-codex-report.

--overwrite
  Allow overwriting selected output artifacts.
```

When `--output` is custom and `--keep-codex-report` is set:

```bash
cdx-chores md pdf-profile codex \
  report.md \
  --intent "wide table report with ToC" \
  --output ./profiles/client-report.yml \
  --keep-codex-report
```

Recommended outputs:

```text
profiles/client-report.yml
profiles/client-report.codex-report-a1b2c3d4.json
```

When both paths are explicit:

```bash
cdx-chores md pdf-profile codex \
  report.md \
  --intent "wide table report with ToC" \
  --output ./profiles/client-report.yml \
  --codex-report-output ./profiles/client-report.codex-report.json
```

The tool should write exactly those paths, while both artifacts still contain the same profile ID.

When `--output` is omitted, generated names should stay readable:

```text
report.pdf-profile-a1b2c3d4.yml
report.pdf-profile-codex-report-a1b2c3d4.json
```

Generated profile and report paths should fall back to another UID path if they collide. Explicit custom paths should fail early when they resolve to the same file as another selected artifact.

The Codex report JSON should include:

- artifact type
- report artifact ID
- matching profile ID
- profile output path as displayed by the CLI
- signal mode, such as document-informed, hint-only, mixed-with-base, base-only-deterministic, or basic-default
- input document fingerprint or bounded document summary when a Markdown path is supplied
- user intent
- optional font hints
- deterministic document facts
- font summary and warnings
- selected base profile or preset
- decision mode
- signals used
- changes from base
- fallback reason, when applicable
- Codex recommendations
- accepted final profile fields
- validation warnings

`md to-pdf --profile <path>` should not need the Codex report JSON.

### 10. Direct CLI should support non-writing review

Direct CLI invocation is already an explicit user request. The first helper should avoid mandatory interactive confirmation prompts so it remains usable in scripted and repeatable workflows.

However, it should still support preview-before-write behavior through a non-writing mode:

```bash
cdx-chores md pdf-profile codex \
  report.md \
  --intent "wide table report with ToC" \
  --dry-run
```

Recommended direct behavior:

- normal execution prints a concise proposed-profile summary, validates the profile, and writes selected artifacts
- `--dry-run` still runs the helper and validation path, but prints the proposed-profile summary and warnings without writing a profile
- `--dry-run --keep-codex-report` may write the diagnostic report while still skipping the profile write
- if no `--output` is provided, both normal execution and `--dry-run` should display the derived output path that would be used; path-backed runs can derive from the input stem, while no-path runs should derive from the profile UID
- `--keep-codex-report` writes diagnostic history only when the user requests it
- `--codex-report-output` implies `--keep-codex-report`
- `--overwrite` controls overwriting both profile and selected report outputs for v1
- low-signal fallback decisions should be visible in stdout even when the Codex report is not kept

Interactive mode can provide the richer user decision loop later.

### 11. Interactive mode should reuse the helper contract after it exists

Interactive mode should be the second implementation layer, after `md pdf-profile codex` proves the direct helper API, schema, artifact identity, and diagnostic sidecar behavior.

The later Interactive flow should not invent a second assistant model. It should orchestrate the same profile helper contract:

```text
md -> to-pdf
  -> choose Markdown input
  -> choose PDF output
  -> choose profile behavior
     - no profile
     - use existing profile
     - create from preset
     - adapt profile with Codex
  -> advanced rendering
     - use built-in template/CSS
     - use custom template/CSS
     - write template snapshot for editing
     - choose debug HTML output
     - choose remote-asset and default-CSS behavior
  -> deterministic preview
     - page settings
     - ToC
     - code highlighting
     - cover/header/footer/page numbers
     - font warnings
     - output paths
  -> choose action
     - render now
     - save profile only
     - save profile and Codex diagnostic report
     - revise profile choice
     - cancel
```

This keeps `pdf-profile` in the normal path and `pdf-template` in the advanced path.

Minimum menu actions for the second plan:

- `md:to-pdf`
- `md:pdf-profile-init`

The Interactive-mode plan owns the placement decision for `md:pdf-template-init`. The direct Codex profile helper plan must not depend on that UX decision.

The Codex helper inside Interactive mode should appear only as an opt-in choice under profile behavior, not as a hidden dependency of `md:to-pdf`.

### 12. The implementation should be sequenced as two plan docs

This research should produce two implementation plans in order. The first plan implements the direct Codex profile helper. The second plan designs Interactive mode after the direct helper contract is implemented and verified.

First plan:

```text
docs/plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md
```

Scope:

- `md pdf-profile codex` command surface
- profile candidate selection and bounded adaptation
- `--base-profile <path>` refinement from an existing validated profile
- Markdown structure and profile-signal introspection
- font summary and font-check orchestration
- bounded, strict Codex structured output using enum-backed profile patches
- decision modes, including conservative fallback and no usable profile
- schema-supported preset identity and profile replay through `md to-pdf --profile`
- profile identity schema extension
- deterministic profile serialization
- adapter boundary under the existing Codex adapter layer
- artifact path collision checks for generated and custom profile/report paths
- `--dry-run`, `--output`, `--keep-codex-report`, `--codex-report-output`, and `--overwrite`
- optional Codex diagnostic report JSON
- focused tests for unavailable Codex, invalid structured output, overwrite behavior, and deterministic replay through `md to-pdf --profile`

Follow-up in the first plan:

- optional positional Markdown path support
- `--input <path>` parity and conflict validation
- signal-mode classification
- intent-only Codex adaptation
- base-only deterministic derivative without a Codex call
- deterministic basic-profile fallback without a Codex call when no signals exist
- strict structured-output patch contract that replaces open accepted-field fragments

Sequencing checklist:

- [x] Record the research decision for the direct Codex profile helper.
- [x] Draft the first implementation plan for `md pdf-profile codex`.
- [x] Replace the open Codex accepted-field fragment with a strict patch contract.
- [x] Implement and verify `md pdf-profile codex`.
- [x] Update this research if implementation changes the helper API, artifact identity, preset replay, or report sidecar contract.
- [ ] Draft the Interactive-mode implementation plan.

Direct helper implementation checkpoint:

- The first implementation plan is completed: [Markdown PDF Codex profile helper implementation](../plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md).
- The current user-facing guide is: [Markdown PDF Codex Profile Helper](../guides/markdown-pdf-codex-profile-helper.md).
- The landed helper uses `md pdf-profile codex [input]` with optional `--input <path>`, `--intent`, repeatable `--font-hint`, `--base-profile`, `--output`, `--dry-run`, `--keep-codex-report`, `--codex-report-output`, and `--overwrite`.
- The final implementation includes the strict `accepted_patches` contract, the dedicated `accepted_font_patches` role/key contract, profile identity and preset replay, deterministic no-signal and base-only fallback routes, optional diagnostic reports linked to the profile UID, table-signal layout policy, and renderer-owned `titleBlock.metadataTitle` duplicate-title handling.
- This research remains `in-progress` because Interactive mode is the second layer and still needs its own implementation plan.

Interactive plan readiness checkpoint:

The second plan must not be drafted against guesses. Before drafting it, verify the completed `md pdf-profile codex` implementation against these contracts:

- command surface and output path behavior are implemented
- built-in candidate selection and `--base-profile <path>` refinement both work
- generated profiles include `profile.id`
- preset identity replays through `md to-pdf --profile`
- optional Codex reports link to the same profile UID
- decision modes are implemented for `adapted`, `conservative-fallback`, and `no-usable-profile`
- real Codex-assisted runs use a strict structured-output schema, not an open object fragment
- `--dry-run`, `--output`, `--overwrite`, `--keep-codex-report`, and `--codex-report-output` behavior is settled
- focused tests cover unavailable Codex, invalid Codex output, invalid base profiles, overwrite collisions, and deterministic render replay

Second plan, drafted only after that readiness checkpoint passes:

```text
docs/plans/plan-YYYY-MM-DD-markdown-pdf-interactive-mode.md
```

Scope:

- interactive `md:to-pdf`
- interactive `md:pdf-profile-init`
- placement decision for `md:pdf-template-init`
- profile behavior choice flow
- optional Codex profile adaptation checkpoint
- deterministic preview screen
- render/save/revise/cancel decisions
- artifact retention prompts

The research must be updated before drafting the second plan if the direct helper implementation changes the helper API, artifact identity, or diagnostic sidecar contract.

## Alternatives Considered

### `md pdf-profile init --codex-assist`

This would align with `data stack --codex-assist`, but it blurs deterministic profile initialization with assistant adaptation. The command would need `--intent`, document introspection, structured Codex output, and optional Codex report behavior, which is enough behavior to justify a separate subcommand.

### `md to-pdf --codex`

This is attractive for users who want one command to produce a PDF, but it mixes profile adaptation and rendering. The first implementation should keep those steps separate so the accepted profile can be inspected, committed, and replayed without Codex.

### `md pdf-profile suggest --provider codex`

This keeps the command provider-neutral, but the repo currently has Codex-specific command and flag surfaces such as `data query codex`, `--codex-assist`, and `--codex-*` analyzer flags. The first helper is explicitly Codex-backed, so naming it `codex` is clearer.

### `md pdf-template codex`

This would generate or edit raw HTML/CSS recipe files. It remains deferred because it creates a larger review surface and turns assistant output into low-level rendering code. Profile fields are the safer first abstraction.

### Creation-only profile helper

A helper that only creates profiles from built-in candidates would be simpler, but it would force users to abandon existing profile work whenever they want Codex assistance. The first helper should support both built-in candidate selection and refinement from `--base-profile <path>` so the reviewed artifact can evolve from a known profile.

### `--print-profile`

A stdout-only profile mode could help scripts inspect generated YAML without writing files. The first helper can rely on `--dry-run` for preview and normal `--output` for durable artifacts; stdout profile emission can be reconsidered if scripting feedback shows a real need.

### Deterministic preset recommender

A non-Codex heuristic recommender could choose a built-in preset from simple document signals. That may be useful later, but it should not be confused with the Codex helper. The first helper needs Codex mainly for mapping user intent, hints, and mixed document signals into an explainable adapted profile.

## Recommendations

1. Draft and implement the Codex helper plan first.
2. Use `md pdf-profile codex` as the direct command name.
3. Frame the helper as profile candidate selection plus bounded adaptation, not blank profile generation.
4. Support `--base-profile <path>` in the first helper so Codex can refine an existing validated profile.
5. Keep Codex output bounded to structured profile fields and decision metadata.
6. Resolve preset persistence in the first helper plan by adding schema-supported preset identity.
7. Add `profile` as the schema-supported identity section for Codex-generated profiles.
8. Keep Codex report JSON optional and linked by the profile UID.
9. Derive Codex report sidecar paths from the actual profile output path when the user provides custom `--output`.
10. Reject explicit same-file collisions among profile and report outputs; fall back for generated path collisions.
11. Use document facts and font-check summaries as Codex inputs; do not rely on prompt text alone for font choices.
12. Keep the first helper hint surface limited to `--intent` for general direction and `--font-hint` for font preference; do not add extra hint flags just to expose prompt-internal categories.
13. Make conservative fallback a visible Codex decision mode, not a separate direct CLI option.
14. Draft the Interactive-mode plan only after the direct helper passes the readiness checkpoint.
15. Let the Interactive-mode plan decide `pdf-template init` placement after the direct helper contract is available.

## Related Research

- [Markdown to PDF with WeasyPrint](research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Font Inspect and Check Commands](research-2026-05-07-font-inspect-and-check-commands.md)
- [Markdown PDF Shiki Code Highlighting](research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)
- [Data stack replay records, duplicate handling, and Codex schema assist](research-2026-04-24-data-stack-replay-and-codex-schema-assist.md)
- [Data stack artifact and Codex contract cleanup](research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md)

## Related Jobs

- [Markdown PDF profile preset persistence follow-up](../plans/jobs/2026-05-08-markdown-pdf-profile-preset-persistence-follow-up.md)
- [Markdown PDF Codex profile Phase 7 docs closeout](../plans/jobs/2026-06-16-markdown-pdf-codex-profile-phase-7-docs-closeout.md)
