---
title: "Markdown PDF Codex Helper Roadmap"
created-date: 2026-06-10
modified-date: 2026-06-19
status: in-progress
agent: codex
---

## Goal

Define the Markdown PDF Codex helper direction after the deterministic `md to-pdf`, `md pdf-profile init`, `md pdf-template init`, font-checking, and Shiki code-highlighting work.

This research now covers four related layers:

1. a direct Codex-assisted profile helper that selects and adapts reusable Markdown PDF profiles
2. a direct Codex-assisted template helper that drafts reviewable HTML/CSS recipe artifacts
3. a later hybrid one-shot helper that chooses profile-only or template-backed output
4. a later Interactive mode flow that reuses the same direct contracts instead of inventing a separate assistant surface

The main product boundary is:

```text
md to-pdf remains deterministic.
pdf-profile is the quick durable rendering decision.
pdf-template is the advanced low-level HTML/CSS recipe snapshot.
Codex is an opt-in helper that drafts reviewable artifacts.
Interactive mode should orchestrate stable direct contracts, not define a separate assistant model.
```

## Why This Research

The existing Markdown PDF lane has the deterministic foundation in place:

- `md to-pdf` renders Markdown through Pandoc-generated HTML and WeasyPrint.
- `md pdf-profile init` writes reusable PDF rendering settings.
- `md pdf-template init` writes editable `template.html` and `style.css` recipe files.
- `font list`, `font inspect`, and `font check` provide the font discovery and coverage checkpoint needed before any assistant suggests font settings.
- Shiki code highlighting can be controlled through CLI flags and profile fields.

The remaining assistant surfaces are not renderer problems. They are workflow and contract problems:

- how Codex should choose and adapt a profile without writing raw executable HTML/CSS
- how Codex should draft template HTML/CSS without hiding unreviewed rendering code inside `md to-pdf`
- how font choices should be suggested from deterministic facts instead of prompt guesses
- how profile, template, and diagnostic artifacts should remain replayable across projects
- how the helper should explain fallback or low-signal decisions
- how a later hybrid helper should choose between profile-only and template-backed outputs
- how Interactive mode should offer the helpers while keeping user review and deterministic replay clear
- how to avoid ambiguity between `pdf-profile` and `pdf-template`

This research records those decisions before drafting or updating the focused implementation plans.

## Starting State

The direct Markdown PDF command surface currently includes:

```bash
cdx-chores md to-pdf --input report.md --profile ./pdf-profile.yml
cdx-chores md pdf-profile init --output ./pdf-profile.yml
cdx-chores md pdf-template init --output ./pdf-template
cdx-chores font check --text "..." --family "Noto Serif CJK TC"
```

At the start of this research, the public Markdown PDF guide stated that Interactive Markdown PDF and Codex-assisted PDF helper flows were deferred. Earlier Markdown PDF research also deferred Codex SDK helper behavior until the deterministic renderer, profile, template, font, and code-highlighting layers were proven.

The first direct helper, `md pdf-profile codex`, was completed for the previous canary line, `v0.1.5-canary.2`. The current canary target is `v0.1.5-canary.3`, and the intended remaining work before tagging that canary is the direct `md pdf-template codex` route.

The interactive Markdown submenu currently has Markdown actions for `to-docx` and `frontmatter-to-json`, but not `to-pdf`, `pdf-profile init`, or `pdf-template init`.

## Scope

This research covers:

- the command naming and product boundary for a Codex-assisted Markdown PDF profile helper
- the product boundary for a Codex-assisted Markdown PDF template helper
- the distinction between `pdf-profile` and `pdf-template`
- profile and Codex diagnostic artifact identity rules
- base profile/template candidate selection and adaptation rules
- direct CLI output and diagnostic sidecar behavior
- deterministic font signal collection for Codex profile adaptation
- low-signal fallback behavior and diagnostic reporting
- canary sequencing for profile, template, hybrid one-shot, and Interactive work
- the intended later Interactive mode flow

This research does not implement:

- command wiring
- Codex SDK calls
- profile schema changes
- template artifact generation
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

The command should be a subcommand, not only a flag, because it creates a durable profile artifact. Flags should be reserved for optional Codex checkpoints inside a later hybrid or Interactive workflow.

Recommended command roles:

| Surface | Role |
| --- | --- |
| `md pdf-profile init` | deterministic starter profile |
| `md pdf-profile codex [path]` | Codex-assisted profile candidate selection and adaptation from available signals |
| `md to-pdf --profile <path>` | deterministic render from an accepted profile |
| `md pdf-template init` | low-level editable HTML/CSS recipe snapshot |
| `md pdf-template codex [path]` | Codex-assisted advanced template recipe drafting, targeted for `v0.1.5-canary.3` |
| later hybrid one-shot helper | chooses profile-only or template-backed artifacts before deterministic render |

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

The first helper supports `--base-profile <path>` so Codex can refine an existing profile instead of forcing every assisted run to start from a built-in candidate. Local profile catalog support remains outside the first pass. The v1 catalog is generated from the same defaults, preset validation, and recipe behavior used by current `md to-pdf` and `md pdf-profile init` paths, plus the single loaded base profile when the user provides one.

Recommended `--base-profile` behavior:

- load and validate the base profile before collecting Codex recommendations
- treat the base profile as the strongest candidate when it is valid
- preserve existing fields unless Codex has document facts or user intent that justify a bounded change
- record the base profile path as a displayed path in the optional Codex report, not as a raw private absolute path
- reject invalid base profiles before calling Codex
- keep `--output` separate from `--base-profile` so the helper writes a reviewed derivative instead of mutating the source profile in place

### 4. `pdf-profile`, `pdf-template`, and hybrid one-shot must stay distinct

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

The first Codex helper targeted `pdf-profile` and intentionally rejected raw `template.html` or `style.css` generation. That safety decision still stands for the profile helper: profile-Codex should report local cover images, arbitrary CSS, custom HTML, and template-only layout as unsupported profile directions instead of inventing profile fields.

That does not mean template-Codex is rejected as a product direction. It means template-Codex needs its own artifact contract. The current canary target is a direct `md pdf-template codex` route that writes a reviewable recipe directory rather than hiding generated HTML/CSS inside `md to-pdf`.

The intended helper model is:

```text
profile-only path
  -> quick durable config
  -> no CSS/HTML exposure
  -> deterministic render with --profile

template path
  -> request crosses into design/layout/custom media
  -> write template.html, style.css, and any managed local assets
  -> deterministic render with --template and --css

later hybrid one-shot path
  -> decide whether the request can stay profile-only
  -> escalate to template artifacts only when the requested output needs them
  -> still render from accepted deterministic artifacts
```

A template-backed render may still accept `--profile` as structured input for page, ToC, metadata, font, and profile-controlled hooks. But once a custom template and stylesheet are supplied, the template/CSS layer is the stronger visual layer. A profile field only affects the final PDF when the selected template and CSS honor the corresponding hook.

### 5. Profile completeness depends on preset persistence

Profiles are the right durable artifact, but current profile behavior has one known gap: `md pdf-profile init --preset <name>` stores values derived from a preset, not the preset identity itself. A later `md to-pdf --profile <path>` run can preserve page shape while still using the default `article` preset CSS unless the same `--preset` is passed again.

That matters for the Codex helper because many user intents map directly to presets:

- "wide table report" maps naturally to `wide-table`
- "long report with ToC" maps naturally to `report`
- "screen reading copy" maps naturally to `reader`
- "dense internal notes" maps naturally to `compact`

If `md pdf-profile codex` writes only derived fields, the generated profile may not be a complete replayable rendering decision. The completed profile helper therefore added a schema-supported preset identity field and taught `md to-pdf --profile <path>` to consume it before treating Codex profiles as fully replayable.

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

Richer cover media, local cover images, and exact title-block rendering belong to template/custom HTML work. The current canary target is to move that work into a direct template-Codex contract rather than expanding profile-Codex.

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

### 11. Template-Codex is the current canary target

The completed profile helper is the previous direct Codex layer. The current canary target, before tagging `v0.1.5-canary.3`, is a direct template helper:

```bash
cdx-chores md pdf-template codex \
  report.md \
  --intent "client report with a local cover image, clean tables, and readable code" \
  --base-profile ./report-profile.yml \
  --cover-image ./cover.png \
  --output ./pdf-template
```

The exact command surface belongs in the focused [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md) research and its later implementation plan, but this parent roadmap should record the settled product direction:

- `md pdf-template codex` is the right home for cover media, custom cover composition, exact table styling, section layout, and other HTML/CSS-backed directions.
- `-o, --output <directory>` should be required for the first template-Codex slice and should keep the same directory semantics as `md pdf-template init --output <directory>`.
- the direct helper should accept the same deterministic recipe flags as `md pdf-template init` and `md to-pdf` for preset, page shape, margins, and ToC behavior.
- It should write reviewable artifacts such as `template.html`, `style.css`, managed local assets, and an optional Codex diagnostic report.
- It should not render the PDF automatically as its primary behavior.
- `md to-pdf` should remain deterministic and should consume accepted template artifacts through `--template` and `--css`.
- The default render posture should be layered: profile-derived default CSS stays enabled and the template stylesheet applies after it. `--no-default-css` should be treated as an advanced self-contained-bundle posture.
- `--base-profile <path>` should be allowed as an input signal and compatibility target, but template/CSS remains the stronger visual layer when supplied at render time.
- The template helper can generate HTML/CSS, but the output must be explicit files that the user can inspect, commit, diff, and replay.
- The first slice should not generate a default output directory when `--output` is omitted; a template bundle is larger than a single generated profile file and should have an explicit destination.

Recommended artifact shape:

```text
pdf-template/
  template.html
  style.css
  assets/
    cover.png
  template.codex-report.json  # optional
```

Recommended layered render after review:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-profile.yml \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css \
  --output ./report.pdf
```

The focused template-Codex research owns the bounded contract for signal ladder, decision modes, render posture, asset copying, relative references, remote-asset policy, template identity, diagnostic report fields, required Pandoc and Shiki hooks, and how much raw CSS/HTML Codex may propose versus how much deterministic code should synthesize.

### 12. Hybrid one-shot comes after template artifacts prove out

A one-shot Codex helper remains useful for users who want to ask for a finished PDF direction without understanding the profile/template split. It should not be the next implementation layer. The one-shot route depends on both direct artifact contracts:

```text
user request
  -> collect document, intent, profile, template, font, and asset signals
  -> decide:
       profile-only is enough
       or template artifacts are required
  -> write accepted artifacts
  -> optionally render through deterministic md to-pdf
```

The hybrid helper should not replace `md pdf-profile codex` or `md pdf-template codex`. It should orchestrate them once both are stable. That keeps the easy path easy without forcing every advanced request into profile fields or every simple request into generated CSS.

### 13. Interactive mode should reuse stable direct contracts later

Interactive mode should be a later orchestration layer after the direct profile helper, direct template helper, and hybrid one-shot helper have stable contracts. It should not invent a second assistant model.

The later Interactive flow should orchestrate the same direct capabilities:

```text
md -> to-pdf
  -> choose Markdown input
  -> choose PDF output
  -> choose profile behavior
     - no profile
     - use existing profile
     - create from preset
     - adapt profile with Codex
  -> choose template behavior
     - use built-in template/CSS
     - use custom template/CSS
     - write deterministic template snapshot
     - draft template with Codex
  -> choose one-shot assist only after direct helper contracts are stable
  -> deterministic preview
     - page settings
     - ToC
     - code highlighting
     - cover/header/footer/page numbers
     - template assets and CSS/default-CSS behavior
     - font warnings
     - output paths
  -> choose action
     - render now
     - save profile only
     - save template only
     - save diagnostic report
     - revise choices
     - cancel
```

The Codex helper inside Interactive mode should appear only as an opt-in choice under profile, template, or later one-shot behavior. It should not be a hidden dependency of `md:to-pdf`.

### 14. Implementation should follow canary milestones

This research should now sequence work by canary milestones instead of a two-plan profile-then-Interactive path:

| Milestone | Target | Status |
| --- | --- | --- |
| Profile helper | `v0.1.5-canary.2` | completed |
| Template helper | `v0.1.5-canary.3` | current target before tagging |
| Hybrid one-shot helper | next canary | deferred until template artifacts prove out |
| Interactive Markdown PDF mode | later canary | deferred until direct helpers stabilize |

Completed profile plan:

```text
docs/plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md
```

Completed profile-helper scope:

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

Current canary plan to draft:

```text
docs/plans/plan-YYYY-MM-DD-markdown-pdf-template-codex-helper.md
```

Related current research:

```text
docs/researches/research-2026-06-18-markdown-pdf-template-codex-helper.md
```

Current canary scope to settle before implementation:

- `md pdf-template codex` command surface
- required `-o, --output <directory>` behavior aligned with `md pdf-template init`
- recipe-flag parity with `md pdf-template init` and `md to-pdf`
- input document, user intent, base-profile, and cover/media signal collection
- signal ladder for deterministic, Codex-assisted, and too-low-signal cases
- decision modes and exit/write behavior
- template artifact identity and optional diagnostic report identity
- output directory and overwrite/collision behavior
- managed asset copy/reference behavior
- generated `template.html` and `style.css` reviewability
- required Pandoc, profile-renderer, and Shiki hook preservation
- local and remote asset policy
- compatibility with `md to-pdf --template`, `--css`, `--profile`, and `--no-default-css`
- dry-run or preview behavior
- failure behavior when Codex is unavailable or generated artifacts fail validation

The research remains `in-progress` because template-Codex still needs an implementation plan and evidence, and the hybrid one-shot and Interactive layers remain deferred.

## Alternatives Considered

### `md pdf-profile init --codex-assist`

This would align with `data stack --codex-assist`, but it blurs deterministic profile initialization with assistant adaptation. The command would need `--intent`, document introspection, structured Codex output, and optional Codex report behavior, which is enough behavior to justify a separate subcommand.

### `md to-pdf --codex`

This is attractive for users who want one command to produce a PDF, but it mixes profile adaptation, template drafting, and rendering. The first implementation kept profile adaptation separate so the accepted profile can be inspected, committed, and replayed without Codex. The same principle should hold for template-Codex: the direct template helper should write accepted artifacts first. A later hybrid one-shot helper can orchestrate profile/template choices after both direct contracts are stable.

### `md pdf-profile suggest --provider codex`

This keeps the command provider-neutral, but the repo currently has Codex-specific command and flag surfaces such as `data query codex`, `--codex-assist`, and `--codex-*` analyzer flags. The first helper is explicitly Codex-backed, so naming it `codex` is clearer.

### `md pdf-template codex`

This was deferred from the profile-helper slice because it creates a larger review surface and turns assistant output into low-level rendering code. That deferral was correct for `v0.1.5-canary.2`.

For the current canary target, `md pdf-template codex` is no longer an alternative to reject. It is the accepted next direct helper surface, provided it has its own artifact contract, writes reviewable `template.html`/`style.css` files, manages local assets explicitly, and keeps `md to-pdf` deterministic.

### Creation-only profile helper

A helper that only creates profiles from built-in candidates would be simpler, but it would force users to abandon existing profile work whenever they want Codex assistance. The first helper should support both built-in candidate selection and refinement from `--base-profile <path>` so the reviewed artifact can evolve from a known profile.

### `--print-profile`

A stdout-only profile mode could help scripts inspect generated YAML without writing files. The first helper can rely on `--dry-run` for preview and normal `--output` for durable artifacts; stdout profile emission can be reconsidered if scripting feedback shows a real need.

### Deterministic preset recommender

A non-Codex heuristic recommender could choose a built-in preset from simple document signals. That may be useful later, but it should not be confused with the Codex helper. The first helper needs Codex mainly for mapping user intent, hints, and mixed document signals into an explainable adapted profile.

## Recommendations

1. Treat `md pdf-profile codex` as the completed first direct helper from `v0.1.5-canary.2`.
2. Preserve the profile-helper boundary: no raw CSS, no raw HTML, no local cover images, and no template-only layout in profile fields.
3. Use the focused template-Codex research as the input for an implementation plan for the current `v0.1.5-canary.3` target.
4. Frame `md pdf-template codex` as reviewable recipe artifact generation, not automatic PDF rendering.
5. Let template-Codex accept profile, document, intent, font, and asset signals, while keeping template/CSS as the stronger visual layer when rendered.
6. Require explicit `-o, --output <directory>` behavior, overwrite behavior, managed asset behavior, and optional diagnostic report behavior for template-Codex.
7. Keep `md to-pdf` deterministic: render accepted profile/template/CSS artifacts without requiring Codex.
8. Defer the hybrid one-shot helper until both direct profile and template helper contracts are stable.
9. Defer Interactive Markdown PDF mode until direct profile, direct template, and hybrid one-shot surfaces have stable contracts.
10. Keep public docs and release notes clear about canary boundaries: `v0.1.5-canary.3` should not be described as released until its target work is complete and tagged.

## Related Research

- [Markdown to PDF with WeasyPrint](research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Font Inspect and Check Commands](research-2026-05-07-font-inspect-and-check-commands.md)
- [Markdown PDF Shiki Code Highlighting](research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Data stack replay records, duplicate handling, and Codex schema assist](research-2026-04-24-data-stack-replay-and-codex-schema-assist.md)
- [Data stack artifact and Codex contract cleanup](research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md)

## Related Jobs

- [Markdown PDF profile preset persistence follow-up](../plans/jobs/2026-05-08-markdown-pdf-profile-preset-persistence-follow-up.md)
- [Markdown PDF Codex profile Phase 7 docs closeout](../plans/jobs/2026-06-16-markdown-pdf-codex-profile-phase-7-docs-closeout.md)
