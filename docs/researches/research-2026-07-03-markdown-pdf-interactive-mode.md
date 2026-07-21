---
title: "Markdown PDF Interactive Mode"
created-date: 2026-07-03
modified-date: 2026-07-21
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

This research remains `in-progress` because the interaction direction is
chosen, while implementation and verification evidence needed for closure is
not yet recorded in linked plan or job records.

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

The current Interactive Markdown submenu exposes `to-docx` and
`frontmatter-to-json`, but no Markdown PDF branches. The remaining problem is
interaction orchestration rather than artifact or renderer design.

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
- changes to Pandoc, WeasyPrint, or the deterministic renderer
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
        |   starter / formal-guide /     |
        |   Codex Assistant              |
        |   (Project uses Codex directly)|
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
services, but intentionally do not expose the same authoring matrix.
`pdf-recipes` maps the reusable helper families directly. `to-pdf` keeps its
one-shot path smaller and reserves Codex Assistant for a coordinated Project
bundle.

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

### `to-pdf`: Smaller One-Shot Authoring

```text
Profile         -> starter | formal-guide
Template bundle -> starter | formal-guide
Project bundle  -> Codex Assistant
```

`to-pdf` must not offer Profile or Template `Codex Assistant`. Selecting Codex
Assistant in this entry path means one thing: prepare a coordinated Project
bundle for the already-selected Markdown document through
`md pdf-project codex`.

Profile and Template remain available through `starter` and `formal-guide`.
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
| `to-pdf -> Codex Assistant` | Project only | reuse the selected Markdown input; do not ask twice |
| `pdf-recipes -> Codex Assistant` | Profile, Template, or Project | ask for an optional Markdown sample |
| `starter` or `formal-guide` | none | do not request a sample |
| Built-in, existing, or Custom inputs | none | do not request a sample |

Additional signals remain artifact-specific:

| Artifact | Additional signals |
| --- | --- |
| Profile | optional base profile and repeatable font hints |
| Template bundle | optional base profile, repeatable font hints, and optional cover image |
| Project bundle | optional base profile, repeatable font hints, and optional cover image |

Every Interactive Codex preparation asks for intent, but accepts an empty
answer to preserve the direct helpers' optional intent contract. An empty
intent simply omits that signal; the helper may still use the Markdown sample,
base profile, font hints, cover image, or its accepted fallback behavior.

In `to-pdf`, Project setup uses progressive disclosure rather than another
checkbox list:

```text
Project bundle setup

Intent: Annual report with restrained editorial styling
Base profile: none
Font hints: Inter, Noto Sans TC
Cover image: none

? Project setup next step
❯ Continue
  Revise intent
  Set base profile
  Edit font hints
  Set cover image
  Set output directory
  Back
  Cancel
```

The setup menu is single-select because each choice edits one value. Font hints
remain repeatable and `Edit font hints` opens one settled add/remove loop:

```text
? Edit font hints
❯ Add font hint
  Remove font hint
  Done
```

`Remove font hint` appears only when at least one hint exists. Returning from
the loop shows the updated Project setup summary.

`Set output directory` is optional local setup:

- an explicit directory is preserved exactly and may appear in the local setup
  summary
- when unset, the setup summary stays quiet and the direct Project helper
  fallback is resolved only if the user later chooses to save the bundle
- choosing temporary render ignores the durable preference and uses a separate
  unique CLI-owned session directory
- the output directory remains local orchestration state and is never sent to
  Codex
- changing an explicit output never regenerates the Codex candidate

Codex use remains visible at three checkpoints:

1. the mode description says Codex will draft and adapt the recipe
2. the consent review identifies the sample, intent, and prepared signal
   categories before sending them
3. the recipe review records `Preparation mode: Codex Assistant`, the reused
   helper contract, and whether the request completed

The consent review should not imply that an entire source file is sent when the
helper uses bounded document-informed signals:

```text
Codex Assistant preparation

Markdown sample: report.md
Creating: Project bundle
Intent: Annual report with restrained editorial styling
Base profile: none
Font hints: Inter, Noto Sans TC
Cover image: cover.jpg
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
continues to own the Markdown input, PDF output, final review, and render.

## Outputs And Commit

An explicit output collected during setup remains local session state and does
not reserve or write a path. When no output was supplied, the default remains
quiet until it becomes applicable. The effective output is resolved and
confirmed only after recipe review and lifecycle selection:

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

The temporary path behaves as a small transaction:

```text
accepted prepared result
  -> create a unique CLI-owned session bundle
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
| CLI-owned session bundle after failed render | retain and print its path |
| Successful render followed by cleanup failure | keep PDF, warn, and print bundle path |
| Cancellation before commit | nothing was written |

Cleanup targets only the exact unique directory retained in current session
state. It must never derive a deletion target from a broad root, glob,
unresolved environment variable, existing bundle path, or user-selected
durable output.

### Render Failure Recovery

A failed render retains the generated bundle for diagnosis and reuse:

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

## Representative Generated-Recipe Flow

```text
✔ Choose a markdown command to-pdf
✔ Input Markdown file report.md
✔ Choose a recipe for this PDF Create a recipe
✔ What would you like to create? Project bundle

Project bundles are prepared with Codex Assistant.

✔ Describe the PDF direction Annual report with restrained editorial styling
✔ Project setup next step Edit font hints
✔ Edit font hints Add font hint
✔ Font hint Inter
✔ Edit font hints Done
✔ Project setup next step Set cover image
✔ Cover image cover.jpg

Project bundle setup

Intent: Annual report with restrained editorial styling
Base profile: none
Font hints: Inter
Cover image: cover.jpg

✔ Project setup next step Continue

Codex Assistant preparation

Markdown sample: report.md
Creating: Project bundle
Intent: Annual report with restrained editorial styling
Base profile: none
Font hints: Inter
Cover image: cover.jpg
Signals: document structure, content hints, and user intent

✔ Send this intent and prepared document signals to Codex Assistant? Yes

Codex Thinking... Drafting Markdown PDF project recipe

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
- `to-pdf` exclusion of Profile and Template Codex modes
- Project's direct transition to Codex Assistant in `to-pdf`
- custom-input mode routing, role validation, and precedence
- contextual backtracking without candidate regeneration
- intent prompting with both provided and empty answers
- Markdown-sample reuse, repeatable font-hint editing, optional signals, and
  consent
- explicit and generated-fallback Project output directories
- temporary rendering ignoring an explicitly selected durable output
- lifecycle-filtered artifact, PDF, and report prompts
- successful cleanup and cleanup-failure warnings
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
- `to-pdf` offers Profile and Template bundle through `starter` and
  `formal-guide`, while its Codex Assistant path prepares only a Project bundle.
- Project bundle skips a one-option mode menu in both entry paths.
- Interactive Codex preparation always asks for intent but accepts an empty
  answer, matching the direct helper contract.
- Base profile, repeatable font hints, and cover image are Codex signals when
  supported by the selected artifact; output paths remain local configuration.
- An omitted saved Project output uses the direct helper's collision-safe
  `md-pdf-project-<timestamp>-<uid>/` fallback; temporary rendering uses a
  separate CLI-owned session directory.
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
- Existing and explicitly saved artifacts are never automatically removed.
- Codex reports are written only after commit and follow lifecycle-filtered
  retention rules.
- The research remains `in-progress` until implementation and verification
  evidence supports closure under the documentation policy.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Project Codex Helper](research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Render Bundle Directory](research-2026-07-10-markdown-pdf-render-bundle-directory.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
