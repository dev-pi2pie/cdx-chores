---
title: "Markdown PDF Interactive Mode"
created-date: 2026-07-03
modified-date: 2026-07-22
status: in-progress
agent: codex
---

## Goal

Define a dedicated Interactive Markdown PDF mode over the shipped profile,
template, project, bundle-discovery, and deterministic rendering contracts.

Interactive mode should support two user goals:

1. run one `to-pdf` flow that chooses or creates a recipe, reviews it, and
   renders a PDF
2. prepare durable profiles, template bundles, or project bundles for later
   reuse through one `pdf-recipes` authoring branch

The direct command contracts remain the source of truth:

```text
md pdf-profile init|codex
md pdf-template init|codex
md pdf-project codex
md to-pdf [--profile | --template | --css | --bundle]
```

Interactive mode should orchestrate these capabilities without creating a
second artifact model, assistant model, or renderer.

The implementation records for completed Phases 1 through 6.6 evidence only
the flow each phase originally scoped. This research remains `in-progress`
because Phase 6.7 field-use refinements and Phase 7 validation, guide
alignment, complete-range review, and final closure reassessment remain
pending.

## Current Contracts And Boundaries

The required direct capabilities are shipped:

- `md pdf-profile init|codex` writes reusable profile artifacts.
- `md pdf-template init|codex` writes template, CSS, and managed-asset bundles.
- `md pdf-project codex` writes coordinated project bundles containing
  `profile.yml`, `template.html`, `style.css`, and optional managed assets.
- there is no direct `md pdf-project init` or manual project-generation command.
- `md to-pdf --bundle <directory>` discovers accepted top-level profile,
  template, and stylesheet inputs from partial or complete bundles.
- explicit `--profile`, `--template`, and `--css` paths remain authoritative for
  their corresponding render roles.
- `md to-pdf` remains the deterministic renderer after inputs are accepted.

The research started from an Interactive Markdown submenu that exposed
`to-docx` and `frontmatter-to-json` but no Markdown PDF branches. The linked
implementation now adds the two designed branches; final validation and guide
alignment remain under Phase 7 rather than requiring a new artifact or renderer
design.

This research covers:

- Interactive Markdown entry points for rendering and durable authoring
- built-in, existing, custom, starter, formal-guide, and Codex-assisted paths
- prepare-once review before writes or rendering
- conditional output prompts and checkpoint backtracking
- durable and CLI-owned temporary artifact lifecycles
- safe cleanup after successful rendering
- reuse of existing preparation, bundle, and render services

It does not introduce:

- a raw YAML, HTML, or CSS terminal editor
- a new profile, template, project, recipe, or report schema
- automatic cleanup of user-owned or explicitly saved artifacts
- changes to Pandoc or WeasyPrint rendering semantics, or to deterministic
  recipe generation
- Project `starter` or `formal-guide` modes without a corresponding direct
  command contract
- a committed release target

## Interaction Principles

The flow should reuse the strongest parts of the shipped Interactive patterns:

- **rename:** prepare and review a concrete plan before application
- **data query:** collect input, choose a mode, review a candidate, then choose
  output and execute; allow contextual backtracking without recomputing the
  candidate
- **data stack:** keep a `prepare* -> Prepared* -> writePrepared*` boundary and
  render grouped review information before a committing action

Markdown PDF should not copy data stack's output-before-review order. Recipe
selection and preparation determine which outputs are applicable, so default
output resolution and commit confirmation belong after recipe review.

Across both Markdown PDF branches:

- one screen should answer one decision
- action menus should stay short and contextual
- exact artifact names should replace generic `Apply` language
- `starter`, `formal-guide`, and `Codex Assistant` are the canonical preparation
  labels
- Codex use must never be implicit; Project selection enters its only supported
  Codex preparation path visibly
- the accepted prepared result must not be regenerated during save or render
- an active Codex request should show one concise Interactive waiting status,
  cleared before review, recovery, or error prompts
- `Back`, revision, and mode changes should return to the smallest relevant
  checkpoint

Prompt simulations show the highlighted choice's description below the whole
list, matching `@inquirer/select`. They do not imply that every description is
visible at once.

## Interactive Command Model

The Markdown submenu should expose two PDF-oriented goals:

```text
? Choose a markdown command
❯ to-pdf
  pdf-recipes
  to-docx
  frontmatter-to-json
  Back
  Cancel

Create a PDF
```

`to-pdf` owns rendering. `pdf-recipes` owns durable authoring and may hand a
saved artifact to `to-pdf`.

Here, **recipe** is the user-facing name for the effective rendering
composition. It is not a fourth serialized artifact type:

| Recipe component | Existing contract |
| --- | --- |
| Built-in recipe | renderer defaults and normalized render options |
| Profile | declarative policy consumed by the built-in recipe |
| Template bundle | explicit HTML, CSS, and managed asset overrides |
| Project bundle | coordinated profile, template, stylesheet, and assets |

`pdf-recipes` is an Interactive grouping, not a new direct
`md pdf-recipes` command.

### Entry Routing

```text
Interactive -> md
|
+-- to-pdf
|   +-- Choose Markdown input
|   `-- Choose recipe source
|       +-- Built-in
|       +-- Existing profile or bundle
|       +-- Custom inputs
|       `-- Create a recipe
|
`-- pdf-recipes
    `-- Choose reusable artifact
        +-- Profile
        +-- Template bundle
        `-- Project bundle
```

### Preparation And Review

```text
Existing or built-in source
        |
        `-- Resolve and validate --------+
                                         |
Create or author a recipe                |
        |                                |
        +-- Choose artifact              |
        +-- Choose preparation mode      |
        |   +-- starter / formal-guide   |
        |   `-- Codex Assistant          |
        |       setup -> consent -> wait |
        |       (Project enters directly)|
        `-- Prepare once ----------------+
                                         |
                                         v
                               +-------------------+
                               | Recipe review     |
                               | No files written  |
                               +-------------------+
                                 |      ^       |
                          revise +------+       +-- cancel
```

### Lifecycle And Execution

```text
Recipe review
|
+-- to-pdf
|   +-- Existing recipe -> Render ----------+
|   |                                       |
|   `-- Generated recipe                    |
|       +-- Temporary render ---------------+
|       `-- Save and render ----------------+
|                                           |
|                                           v
|                                 Applicable outputs
|                                           |
|                                 Final transaction review
|                                           |
|                                       Commit once
|                                           |
|                              +------------+------------+
|                              |                         |
|                           success                   failure
|                           keep outputs              retain session temp
|                           clean session temp        retry / revise / exit
|
`-- pdf-recipes
    +-- Choose durable output
    +-- Final save review
    +-- Save artifact
    `-- Optional handoff to to-pdf
```

## Recipe Sources

`to-pdf` should use one recipe-source selection rather than a sequence of
yes/no questions:

```text
? Choose a recipe for this PDF
❯ Built-in recipe
  Existing profile
  Existing bundle
  Custom inputs
  Create a recipe
  Back
  Cancel

Use renderer defaults
```

The choices map to existing renderer inputs:

| Interactive choice | Renderer mapping |
| --- | --- |
| Built-in recipe | no profile, template, CSS, or bundle path |
| Existing profile | `--profile <file>` |
| Existing bundle | `--bundle <directory>` |
| Custom inputs | explicit profile/template/CSS plus optional bundle |
| Create a recipe | prepared artifact materialized only after acceptance |

Built-in, existing, and custom paths never invoke Codex. Existing artifacts are
accepted renderer inputs regardless of how they were originally created.

### Built-In And Existing Sources

The recipe review should show the effective resolved inputs before output
selection. A built-in review can show normalized defaults:

```text
Markdown PDF recipe review

Input: report.md
Recipe source: built-in
Preset: article
Page: A4 portrait
Margins: 18mm
ToC: disabled
Code highlighting: disabled
Default CSS: enabled

Dry run: no files have been written.
```

An existing or custom review should label the source of each resolved role:

```text
Markdown PDF recipe review

Input: report.md
Bundle source: report-pdf-project

Resolved recipe inputs:
- Profile: profile.yml (bundle)
- Template: custom.html (explicit)
- Stylesheet: style.css (bundle)

Dry run: no files have been written.
```

These paths proceed directly from recipe review to PDF output selection. They
should not add a redundant `Continue to PDF output` checkpoint before the final
render confirmation.

### Custom Inputs

Custom input collection should use two layers. The first layer chooses the
composition model with a single selection:

```text
? Choose custom input mode
❯ Explicit inputs
  Bundle + explicit inputs
  Back
  Cancel

Select profile, template, or stylesheet paths directly
```

`Existing bundle` already owns bundle-only rendering. `Custom inputs` therefore
does not offer another bundle-only path.

The second layer selects only the explicit roles involved. For `Explicit
inputs`:

```text
? Choose explicit inputs
◉ Profile
◉ Template
◯ Stylesheet
```

At least one role is required. The flow then requests only the selected paths.

For `Bundle + explicit inputs`, the flow first asks for the bundle directory,
shows the roles discovered there, and then selects which roles to provide
explicitly. No role is selected by default:

```text
✔ Bundle directory report-pdf-project

Bundle provides: Profile, Template, Stylesheet

? Choose explicit roles
◯ Profile
◉ Template
◯ Stylesheet
```

At least one explicit role is required; otherwise the user should choose
`Existing bundle`. Only selected explicit paths are requested. An explicit role
may replace the same role from the bundle or supply a role the bundle does not
contain.

Precedence remains role-by-role and deterministic:

- an explicit profile, template, or stylesheet wins for that role
- a bundle source fills only roles that were not selected explicitly
- paths are not content-merged within a role
- multiple bundle candidates are an error only for an unresolved role
- invalid-profile errors, warnings, and resolving flags reuse the direct
  renderer behavior

Selecting a bundle source with explicit roles is therefore intentional, not a
conflict. Recipe review must show `(explicit)` or `(bundle)` provenance for each
resolved role.

## Recipe Authoring

`pdf-recipes` and `to-pdf -> Create a recipe` reuse the same preparation
services and helper matrix. Their difference is lifecycle ownership:
`pdf-recipes` saves a reusable artifact, while `to-pdf` prepares an artifact in
order to render the already-selected Markdown input.

### `pdf-recipes`: Direct Helper Map

```text
Profile         -> starter | formal-guide | Codex Assistant
Template bundle -> starter | formal-guide | Codex Assistant
Project bundle  -> Codex Assistant
```

The choices map to the direct CLI capability and output contract:

| Interactive choice | Direct contract reused |
| --- | --- |
| Profile `starter` | `md pdf-profile init` |
| Profile `formal-guide` | deterministic services used by `md pdf-profile init` |
| Profile `Codex Assistant` | `md pdf-profile codex` |
| Template `starter` | `md pdf-template init` |
| Template `formal-guide` | deterministic services used by `md pdf-template init` |
| Template `Codex Assistant` | `md pdf-template codex` |
| Project `Codex Assistant` | `md pdf-project codex` |

`formal-guide` is an Interactive deterministic layer over the normalized
profile or template services used by `init`; it is not a separate direct CLI
command.

Profile and Template bundle use this preparation prompt:

```text
? Choose preparation mode
❯ starter
  formal-guide
  Codex Assistant
  Back
  Cancel

Use the deterministic starter configuration
```

Project bundle should not show a one-option mode menu. After project selection,
the flow states:

```text
Project bundles are prepared with Codex Assistant.
```

The user can still return to artifact selection or cancel before Codex is
invoked.

`pdf-recipes` always prepares a durable artifact. Output collection follows the
corresponding direct helper:

- deterministic `init` routes request the required profile path or template
  directory instead of inventing a fallback absent from the direct command
- Codex routes accept an explicit output or use the direct helper's generated
  fallback when omitted
- generated fallback paths are shown before the final save confirmation

### `to-pdf`: Focused One-Shot Authoring

```text
Profile         -> starter | formal-guide | Codex Assistant
Template bundle -> starter | formal-guide | Codex Assistant
Project bundle  -> Codex Assistant
```

Profile and Template retain all three direct-helper-aligned preparation modes.
Their Codex Assistant paths reuse the already-selected Markdown document and
produce a renderable generated artifact without asking for the sample twice.
Project bundle moves directly into Codex Assistant without a one-option mode
prompt. Interactive mode must not synthesize Project `starter` or
`formal-guide` by running profile and template initialization separately. A
future deterministic Project mode requires a direct command contract first.

### `starter`

`starter` exposes the existing deterministic initialization behavior with a
small prompt surface and never invokes Codex.

### `formal-guide`

`formal-guide` follows Interactive data query: collect structured answers,
compile them deterministically, show the prepared result, and let the user
revise answers before application.

The first profile and template guide stays inside the current normalized recipe
surface:

- preset
- page size
- orientation
- preset or custom margins
- ToC enabled
- ToC depth and page-break behavior when enabled

Template questions organize the existing `md pdf-template init` surface around
documented presets, layout flags, margins, and ToC usage. The guide is not a raw
artifact editor and should not claim arbitrary HTML, CSS, cover composition,
font discovery, or design interpretation.

### `Codex Assistant`

`Codex Assistant` is the canonical Interactive mode label. It is powered by the
existing Markdown PDF Codex Helper contracts; `Codex Helper` does not identify
a second Interactive actor.

The available helper and Markdown sample behavior depend on the entry path:

| Entry path | Helper availability | Markdown sample behavior |
| --- | --- | --- |
| `to-pdf -> Codex Assistant` | Profile, Template, or Project | reuse the selected Markdown input; do not ask twice |
| `pdf-recipes -> Codex Assistant` | Profile, Template, or Project | ask for an optional Markdown sample |
| `starter` or `formal-guide` | none | do not request a sample |
| Built-in, existing, or Custom inputs | none | do not request a sample |

Additional signals remain artifact-specific:

| Artifact | Additional signals |
| --- | --- |
| Profile | optional base profile and repeatable font hints |
| Template bundle | optional base profile, repeatable font hints, and optional cover image |
| Project bundle | optional base profile, repeatable font hints, and optional cover image |

Every Interactive Codex preparation asks for a PDF intent, but accepts an empty
answer to preserve the direct helpers' optional intent contract. Intent entry
follows the data-query pattern: ask whether to use the multiline editor, then
open either the editor or the single-line input. Both paths use the compact
`PDF intent (optional)` label; single-line entry starts on the following
indented line. An empty intent simply omits that signal; the helper may still
use the Markdown sample, base profile, font hints, cover image, or its accepted
fallback behavior.

Codex setup uses progressive disclosure rather than another checkbox list. The
summary and edit actions follow the same artifact-specific order: intent, base
Profile, cover image when supported, then font hints. `Continue` comes after
the signal-editing actions so the flow does not visually suggest that optional
setup has already been skipped:

```text
Template bundle setup

Intent: Annual report with restrained editorial styling
Base profile: none
Cover image: none
Font hints:
- Source Serif 4
- JetBrains Mono

? Template bundle setup next step
❯ Revise PDF intent
  Set base profile
  Set cover image
  Edit font hints
  Continue
  Back
  Cancel
```

Profile omits `Set cover image`; Project uses the same Template ordering. The
setup menu is single-select because each choice edits one value. Phase 6.5 keeps
font hints repeatable through a small baseline add/remove loop:

```text
? Edit font hints
❯ Add font hint
  Remove font hint
  Done
```

`Remove font hint` appears only when at least one hint exists. Returning from
the loop shows the updated artifact setup summary. This baseline continues to
accept arbitrary text and must use `Font preference` rather than the narrower
`Font family hint` label.

The richer builder, fontconfig-only installed-family suggestions, supported
intended uses, edit action, shared discovery cancellation, and custom-input
fallback belong to Phase 6.6. The
focused [Interactive Font Hint Suggestions](research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md)
research owns that contract; Phase 6.5 must not absorb its discovery and
typeahead scope.

Artifact output does not belong in Codex setup. It is collected only after the
candidate is prepared, reviewed, and given a durable lifecycle. When omitted,
the direct helper fallback remains quiet until final save or render review.
Changing an output never regenerates the Codex candidate and no output path is
sent to Codex.

After consent, Interactive mode should show one waiting status for the active
Codex request and clear it before the next prompt. The copy should use the
Interactive artifact names:

```text
Preparing profile with Codex... /
Preparing template bundle with Codex... |
```

Project preparation may change the same status across its real profile and
template stages:

```text
Preparing project profile with Codex... /
Preparing project template with Codex... |
```

The existing direct-helper progress must not be rendered underneath a second
Interactive spinner. Direct commands keep their current progress contract;
Interactive orchestration should suppress or adapt that lower-level presenter.
Non-TTY execution must not emit animation control sequences.

Codex use remains visible at four checkpoints:

1. the mode description says Codex will draft and adapt the recipe
2. the consent review identifies the sample, intent, and prepared signal
   categories before sending them
3. the waiting status confirms that the accepted request is active
4. the recipe review records `Preparation mode: Codex Assistant`, the reused
   helper contract, and whether the request completed

The consent review should not imply that an entire source file is sent when the
helper uses bounded document-informed signals:

```text
Codex Assistant preparation

Markdown sample: report.md
Creating: Project bundle
Intent: Annual report with restrained editorial styling
Base profile: none
Cover image: cover.jpg
Font hints:
- Source Serif 4
- JetBrains Mono
Signals: document structure, content hints, and user intent

? Send this intent and prepared document signals to Codex Assistant? Yes
```

Revision changes the intent or selected signals. Regeneration repeats the Codex
request with the same inputs. Accepting a prepared candidate never repeats the
request.

## Shared Recipe Review

Every branch must prepare and validate before a committing action:

```text
collect choices
  -> normalize inputs
  -> resolve paths and bundle roles
  -> generate when requested
  -> validate the prepared result
  -> display recipe review
  -> await a contextual action
```

The review is the Interactive presentation of dry-run state:

- no profile, template, project, PDF, HTML, or report file is written
- generated content remains available in memory
- revision returns to the smallest relevant checkpoint
- changing outputs does not regenerate the candidate
- cancellation before commit leaves no filesystem artifact
- a requested diagnostic report remains in memory until commit

This requires a reusable prepared-result boundary:

```text
prepare once
  -> review
  -> commit the same prepared result
```

Review must not run a direct helper once with `dryRun: true` and again with
`dryRun: false`, because the second invocation could produce a different Codex
result.

### Generated Recipe Actions

For `to-pdf`, generated candidates use a short contextual menu. A Project
candidate uses:

```text
? Recipe review next step
❯ Render with temporary project bundle
  Save project bundle and render
  Revise recipe
  Change recipe setup
  Cancel

Remove it after success; retain it if rendering fails
```

Profile and Template bundle substitute their exact artifact names.
`to-pdf` does not offer a save-only outcome; durable authoring without rendering
belongs to `pdf-recipes`.

`Revise recipe` returns to the smallest relevant input set. `Change recipe
setup` can return to preparation mode or artifact type without writing the
current in-memory candidate.

For `pdf-recipes`, the accepting action is simply `Save profile`, `Save template
bundle`, or `Save project bundle`, followed by applicable output selection and
a final save review.

After a durable save, the handoff uses plain user-facing language:

```text
? What next?
❯ Render a PDF with this profile
  Create another recipe
  Exit
```

The saved artifact enters `to-pdf` as an existing renderer input. `to-pdf`
continues to own the Markdown input, PDF output, final review, and render. An
optional Markdown sample collected during `pdf-recipes` preparation is not an
implicit render input: the handoff asks whether to use it or select another
Markdown file. When a sample exists, the handoff offers `Use <sample>` and
`Choose another Markdown file`; without a sample, `to-pdf` collects its normal
required Markdown input. Only that explicit choice becomes the render input.

## Outputs And Commit

An explicit output selected after lifecycle choice remains local session state
and does not reserve or write a path. When no output was supplied, the default
remains quiet until it becomes applicable. The effective output is resolved
and confirmed only after recipe review and lifecycle selection:

```text
recipe review
  -> choose lifecycle
  -> choose compatible report retention, when applicable
  -> resolve or revise applicable artifact output
  -> choose applicable PDF output
  -> final transaction review
  -> commit
```

| Continuation | Artifact output | PDF output |
| --- | --- | --- |
| Render built-in or existing recipe | none | required or defaulted |
| Temporary render | internal session bundle | required or defaulted |
| Save generated artifact and render | explicit output or shown generated fallback | required or defaulted |
| Durable `pdf-recipes` save | explicit output or shown generated fallback | not requested |

For a saved Project bundle, an omitted output directory falls back to the
direct helper convention:

```text
md-pdf-project-YYYYMMDDTHHMMSSZ-xxxxxxxx/
```

The directory is generated in the current working directory with bounded
collision retries. The final transaction review must show the concrete resolved
path, never only `automatic` or the pattern placeholder.

Output selection should allow returning to recipe review without discarding or
regenerating the prepared candidate.

Built-in and existing paths proceed directly from recipe review to PDF output.
They receive one committing confirmation in the final render review rather than
an additional continuation prompt.

Example final review:

```text
Final render review

Input: report.md
Bundle: report-pdf-project
PDF output: report.pdf
Bundle cleanup: never
Overwrite: disabled

? Render this PDF? Yes
```

## Reports, Cleanup, And Recovery

### Codex Report Retention

Report choices appear only after Codex preparation and are filtered by the
selected lifecycle:

| Lifecycle | Available report choices |
| --- | --- |
| Temporary render | No; write to a separate path |
| Save and render | No; keep with saved recipe; write to a separate path |
| Durable `pdf-recipes` save | No; keep with saved recipe; write to a separate path |
| Non-Codex paths | no report prompt |

`Keep with saved recipe` reuses the direct helper placement contract: a profile
report is an adjacent sidecar, while template and project reports are bundle
artifacts.

A temporary lifecycle must not offer bundle-owned report retention because the
session bundle is scheduled for removal. A separately persisted report may
survive temporary-bundle cleanup.

Reports are written only after the user commits the prepared result, never
during recipe review.

### Temporary Render Transaction

Temporary recipe sessions remain under the operating system's temporary
directory rather than the current working directory. Immediately after
creating a unique directory, the CLI resolves it to its canonical path. That
exact canonical directory becomes the opaque ownership, retention, display,
and cleanup boundary.

This stays portable across the platform-selected temporary roots on macOS,
Linux, and Windows while preventing a normal system path alias from being
misclassified as a user-controlled symlink parent. It also avoids requiring a
writable working directory or leaving generated recipe files in a repository.
User-selected durable outputs keep the existing symlink-aware validation.

The temporary path behaves as a small transaction:

```text
accepted prepared result
  -> create a unique CLI-owned OS-temporary session
  -> resolve and retain its exact canonical path
  -> write the exact accepted artifacts
  -> render through the shared to-pdf service
  -> confirm successful PDF output
  -> remove the session bundle
```

Cleanup is ownership- and outcome-based:

| Artifact origin or outcome | Cleanup behavior |
| --- | --- |
| Existing profile, template, CSS, or bundle | never remove |
| Explicitly saved generated artifact | never remove |
| CLI-owned session bundle after successful render | remove |
| CLI-owned session after materialization or renderer-preparation failure | retain and print its path |
| CLI-owned session bundle after failed render | retain and print its path |
| Successful render followed by cleanup failure | keep PDF, warn, and print bundle path |
| Durable materialization or renderer-preparation failure | retain the durable recipe and print its path |
| Cancellation before commit | nothing was written |

Cleanup targets only the exact canonical unique directory retained in current
session state. It must never derive a deletion target from a broad root, glob,
unresolved environment variable, existing bundle path, current working
directory, or user-selected durable output. Failure output prints the same
canonical session path directly so the retained diagnostic location is
actionable without a long working-directory-relative traversal.

### Materialization And Render Failure Recovery

Temporary materialization, renderer-preparation, and render failures retain the
generated bundle for diagnosis and reuse. Render retry reuses the same written
artifact and prepared render plan:

```text
Rendering failed before a PDF was completed.

Temporary project bundle retained:
<temporary-session-bundle>

? Render recovery
❯ Retry render
  Keep bundle and revise recipe
  Keep bundle and exit
  Delete bundle and exit
```

- `Retry render` reuses the materialized bundle and never repeats preparation.
- `Keep bundle and revise recipe` returns to recipe review while preserving the
  failed bundle for diagnosis.
- `Delete bundle and exit` requires explicit confirmation and may remove only
  the exact CLI-owned session bundle.
- there is no ambiguous `Cancel` after temporary files exist.

Durable failures never make the saved recipe a cleanup target. A failed write
may retry the same bound candidate. A renderer-preparation failure after a
successful write may retry preparation without rewriting or regenerating the
recipe. Both stages may return to the same accepted recipe review or exit while
retaining and printing the durable destination.

The renderer writes the PDF into CLI-owned temporary storage, then commits the
completed file through the shared safe-write boundary. Final PDF symlinks and
symlinked parent directories are rejected rather than followed.

## Representative Generated-Recipe Flow

```text
✔ Choose a markdown command to-pdf
✔ Input Markdown file report.md
✔ Choose a recipe for this PDF Create a recipe
✔ What would you like to create? Project bundle

Project bundles are prepared with Codex Assistant.

Project bundle setup

Intent: none
Base profile: none
Cover image: none
Font hints: none

✔ Project setup next step Set PDF intent
✔ Use multiline editor? No
? PDF intent (optional)
  Annual report with restrained editorial styling
✔ Project setup next step Set cover image
✔ Cover image cover.jpg
✔ Project setup next step Edit font hints
✔ Edit font hints Add font hint
✔ Font hint Inter
✔ Edit font hints Done

Project bundle setup

Intent: Annual report with restrained editorial styling
Base profile: none
Cover image: cover.jpg
Font hints: Inter

✔ Project setup next step Continue

Codex Assistant preparation

Markdown sample: report.md
Creating: Project bundle
Intent: Annual report with restrained editorial styling
Base profile: none
Cover image: cover.jpg
Font hints: Inter
Signals: document structure, content hints, and user intent

✔ Send this intent and prepared document signals to Codex Assistant? Yes

Preparing project profile with Codex... done
Preparing project template with Codex... done

Markdown PDF recipe review

Artifact: project bundle
Preparation mode: Codex Assistant
Helper contract: md pdf-project codex
Codex request: completed
Profile decision: adapted
Template decision: adapted
Managed assets: 1
Validation: passed

Planned bundle files:
- profile.yml
- template.html
- style.css
- assets/cover.jpg

Dry run: no files have been written.

✔ Recipe review next step Save project bundle and render
✔ Keep a Codex diagnostic report? No
✔ Project bundle output md-pdf-project-20260721T010203Z-a1b2c3d4/
✔ PDF output report.pdf
✔ Overwrite if it exists? No

Final render review

Input: report.md
Project bundle: md-pdf-project-20260721T010203Z-a1b2c3d4/
PDF output: report.pdf
Bundle retention: durable
Codex report: not retained

? Render this PDF? Yes

Wrote project bundle: md-pdf-project-20260721T010203Z-a1b2c3d4/
Wrote PDF: report.pdf
```

## Implementation Implications

Interactive mode should reuse shared services rather than invoke direct CLI
actions as subprocess-like steps.

The required boundary is:

```text
prompt collection
  -> shared preparation service
  -> prepared profile/template/project/render result
  -> Interactive review loop
  -> shared commit or render service
```

`Recipe` remains UX vocabulary for an effective composition. Implementation
must not broaden the existing `MarkdownPdfRecipe` type into an umbrella for
profiles, templates, projects, and lifecycle state. Narrow Interactive state
types may reference the existing prepared contracts.

Required service changes include:

- `md to-pdf` needs a preparation boundary that resolves bundle roles,
  normalizes recipe options, validates output collisions, and returns a render
  plan before invoking external renderers.
- profile, template, and project generation need prepared results that can be
  reviewed and later written without recomputing Codex decisions.
- temporary and durable materialization must accept the same prepared results.
- the final renderer must consume the resolved options used by the direct CLI.

Interactive tests should cover:

- entry-specific source and mode routing
- `pdf-recipes` parity with the direct Profile, Template, and Project helpers
- `to-pdf` Codex preparation for Profile, Template, and Project
- Project's direct transition to Codex Assistant without a one-option mode menu
- custom-input mode routing, role validation, and precedence
- contextual backtracking without candidate regeneration
- single-line and multiline PDF-intent entry with both provided and empty answers
- artifact-specific setup ordering before consent
- Markdown-sample reuse, repeatable font-hint editing, optional signals, and
  consent
- Phase 6.6 font-hint builder compilation, custom entry, custom-first
  fontconfig suggestions, intended-use review, post-Codex assignment review,
  shared cancellation, and no-native-fallback custom input
- Phase 6.7 direct guided/custom collection actions, visible repeatable
  accumulation, and no manual discovery-retry branch
- one non-overlapping waiting status per Codex request, including cleanup before
  review, recovery, or error prompts
- explicit and generated-fallback Project output directories
- temporary rendering ignoring an explicitly selected durable output
- lifecycle-filtered artifact, PDF, and report prompts
- successful cleanup and cleanup-failure warnings
- canonical OS-temporary session creation across platform path conventions
- render-failure retention and explicit deletion confirmation
- protection of existing and durable artifacts

## Settled Decisions

- `to-pdf` and `pdf-recipes` are the two Interactive Markdown PDF branches.
- `to-pdf` is the only render owner.
- `pdf-recipes` is an Interactive grouping, not a serialized artifact or direct
  command.
- `pdf-recipes` maps directly to the reusable helper families: Profile and
  Template bundle support `starter`, `formal-guide`, and `Codex Assistant`;
  Project bundle supports `Codex Assistant` only.
- `to-pdf` offers Profile and Template bundle through `starter`, `formal-guide`,
  and `Codex Assistant`; Project bundle supports `Codex Assistant` only.
- Project bundle skips a one-option mode menu in both entry paths.
- Interactive Codex preparation uses optional single-line or multiline PDF
  intent entry, matching the direct helper's optional intent contract.
- Base profile, repeatable font hints, and cover image are Codex signals when
  supported by the selected artifact; output paths remain local configuration.
- Codex setup presents intent, base Profile, artifact-specific cover image, and
  font hints before `Continue`; artifact outputs are collected later.
- Phase 6.5 preserves a simple repeatable free-text font-hint editor; Phase 6.6
  separately adds the structured builder, optional fontconfig suggestions, a
  one-second discovery budget, and shared cancellation without changing the
  direct `fontHints: string[]` contract. Missing `fc-list` falls back to custom
  input without a native platform inventory.
- Phase 6.7 makes guided and complete-custom additions direct collection
  actions, re-renders the ordered collection after every accepted change, and
  removes the manual discovery-retry branch while preserving sequential
  repeatability and the direct `fontHints: string[]` payload.
- Interactive mode shows one concise, artifact-specific waiting status for an
  active Codex request and clears it before the next prompt.
- An omitted saved Project output uses the direct helper's collision-safe
  `md-pdf-project-<timestamp>-<uid>/` fallback; temporary rendering uses a
  separate CLI-owned OS-temporary session directory whose canonical path is
  the exact ownership and cleanup boundary.
- Built-in, existing, and custom sources never invoke Codex.
- Custom inputs use a single-select composition mode followed by multi-select
  explicit roles; bundle-only rendering remains under `Existing bundle`.
- Every path prepares once and displays recipe review before writing or
  rendering.
- Dry-run is the no-write state reported by recipe review, not a separate
  candidate-generation pass.
- Existing sources proceed from recipe review directly to output selection.
- Generated candidates use short contextual lifecycle menus.
- `to-pdf` offers temporary render or save-and-render for generated recipes;
  save-only authoring belongs to `pdf-recipes`.
- Effective output resolution is conditional on the chosen lifecycle. Unset
  defaults stay quiet until the final save review.
- Temporary generated bundles are removed only after successful rendering.
- Failed temporary renders retain the exact CLI-owned bundle and provide
  explicit retry, revision, retention, and deletion actions.
- Durable write and renderer-preparation failures retain the saved recipe and
  can retry without rebinding, rewriting a successful artifact, or regenerating
  the accepted candidate.
- Final PDF writes use a CLI-owned render file and a symlink-aware commit
  boundary.
- Existing and explicitly saved artifacts are never automatically removed.
- Codex reports are written only after commit and follow lifecycle-filtered
  retention rules.
- The research remains `in-progress` until implementation and verification
  evidence supports closure under the documentation policy.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Interactive Font Hint Suggestions](research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md)
- [Markdown PDF Project Codex Helper](research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Render Bundle Directory](research-2026-07-10-markdown-pdf-render-bundle-directory.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)

## Related Plans

- [Markdown PDF Interactive Mode implementation](../plans/plan-2026-07-21-markdown-pdf-interactive-mode.md)
- [Phase 6.7 temporary-session portability](../plans/jobs/2026-07-22-markdown-pdf-interactive-phase-6-7-temporary-session-portability.md)
- [Phase 6.7 repeatable font-hint flow](../plans/jobs/2026-07-22-markdown-pdf-interactive-phase-6-7-font-hint-flow.md)
