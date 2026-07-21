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

Interactive mode should support both of these user goals:

1. prepare durable profiles, template bundles, or project bundles for later reuse
   through one `pdf-recipes` authoring branch
2. run one `to-pdf` flow that can choose or create a recipe, review it, render
   the PDF, and remove only CLI-owned temporary artifacts after success

The direct command contracts remain the source of truth:

```text
md pdf-profile init|codex
md pdf-template init|codex
md pdf-project codex
md to-pdf [--profile | --template | --css | --bundle]
```

Interactive mode should orchestrate these capabilities without creating a
second artifact model, assistant model, or renderer.

This research is `in-progress` because the interaction and lifecycle direction
is chosen, while implementation work and release placement remain uncommitted.

## Current State

The earlier deferred prerequisites are complete:

- `md pdf-profile codex` writes reusable profile artifacts.
- `md pdf-template codex` writes reviewable template/CSS/assets bundles.
- `md pdf-project codex` writes coordinated project bundles containing
  `profile.yml`, `template.html`, `style.css`, and optional managed assets.
- there is no direct `md pdf-project init` or manual project-generation command.
- `md to-pdf --bundle <directory>` discovers accepted top-level profile,
  template, and stylesheet inputs from partial or complete bundles.
- explicit `--profile`, `--template`, and `--css` paths remain authoritative for
  their corresponding render roles.
- `md to-pdf` remains the deterministic renderer after inputs are accepted.

The current Interactive Markdown submenu still exposes `to-docx` and
`frontmatter-to-json`, but no Markdown PDF branches. The remaining problem is
therefore interaction orchestration rather than artifact or renderer design.

## Relationship To Roadmap

The parent roadmap is [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md).

That roadmap established the capability order:

```text
profile-Codex
  -> template-Codex
  -> pdf-project-Codex
  -> Interactive mode
```

This research now owns the active Interactive mode contract. The roadmap should
stay a lightweight history and capability overview rather than duplicate the prompt,
dry-run, output, and cleanup decisions recorded here.

## Scope

This research covers:

- the Interactive Markdown submenu branches for rendering and artifact creation
- the one-shot `to-pdf` orchestration flow
- existing, starter, formal-guide, and Codex-assisted input paths
- mandatory prepared-result dry-runs before writes or rendering
- output-question ordering and conditional output prompts
- durable versus CLI-owned temporary artifact lifecycles
- safe cleanup after successful rendering
- reuse of existing profile, template, project, bundle, and render services

This research does not implement:

- prompt wiring or menu routing
- a raw YAML, HTML, or CSS terminal editor
- a new profile, template, project, or report schema
- automatic cleanup of user-owned or explicitly saved artifacts
- changes to Pandoc, WeasyPrint, or the deterministic renderer
- a project starter or project formal-guide mode without a corresponding direct
  command contract
- a committed release target

## Product Boundary

Interactive mode is an orchestration UI over accepted direct contracts.

It should not:

- hide Codex inside an unreviewed render step
- make Codex mandatory for Markdown PDF rendering
- rerun Codex after the user has accepted a prepared candidate
- generate unreviewed HTML or CSS during rendering
- treat `--bundle` as a new artifact owner
- delete existing, external, or explicitly saved artifacts
- invent an Interactive-only profile or template schema

It should:

- expose `to-pdf` rendering and `pdf-recipes` durable authoring as related but
  distinct branches
- keep `to-pdf` as the only branch that owns rendering
- let `pdf-recipes` hand an accepted saved artifact to `to-pdf` without creating
  another render implementation
- offer deterministic profile and template starter and formal-guide paths
  without Codex
- make Codex Assistant an explicit preparation mode
- prepare and validate candidates before writing them
- show concrete artifact and render reviews
- let the user revise, regenerate, change mode, save, render, or cancel
- reuse `--bundle` as the common application path for partial and complete
  generated bundles
- remove CLI-owned temporary bundles only after a successful render

## Interactive Command Model

The Markdown submenu should expose two PDF-oriented user goals. `to-pdf`
uses a recipe to produce a PDF. `pdf-recipes` prepares durable profile,
template, or project artifacts and can hand a saved result to `to-pdf`.

Here, **recipe** is the user-facing name for the effective rendering
composition. It does not introduce a fourth artifact type or serialized recipe
schema. The existing artifacts retain their established ownership:

| Recipe component | Existing contract |
| --- | --- |
| Built-in recipe | renderer defaults and normalized render options |
| Profile | declarative policy consumed by the built-in recipe |
| Template bundle | explicit HTML, CSS, and managed asset overrides |
| Project bundle | coordinated profile, template, stylesheet, and assets |

`pdf-recipes` is therefore an Interactive umbrella for preparing reusable
components of a recipe, not a replacement for `md pdf-profile`,
`md pdf-template`, or `md pdf-project`. The menu name does not imply a new
direct `md pdf-recipes` command.

```text
✔ Choose a command md
? Choose a markdown command
❯ to-pdf               Create a PDF
  pdf-recipes           Prepare reusable profiles and bundles
  to-docx
  frontmatter-to-json
  Back
  Cancel

↑↓ navigate • ⏎ select
```

The artifact type remains explicit after entering `pdf-recipes`:

```text
? What would you like to create?
❯ Profile
  Template bundle
  Project bundle
  Back
  Cancel
```

This keeps the three direct ownership contracts without crowding the Markdown
submenu or creating four render entry points. It also mirrors the relationship
between rename plan generation and `rename apply` without adding an `apply`
alias to Markdown PDF. The meaningful application operation is already named
`to-pdf`.

`pdf-recipes` does not render independently. After saving, it may offer a
context-specific handoff such as `Continue to to-pdf with this profile`, which
transfers control and the saved artifact path to the `to-pdf` flow.

## Artifact Lifecycles

Interactive mode needs two explicit artifact lifecycles.

| Entry path | Primary goal | Default artifact lifecycle |
| --- | --- | --- |
| `pdf-recipes` -> Profile | Author a reusable render policy | durable |
| `pdf-recipes` -> Template bundle | Author reusable HTML/CSS/assets | durable |
| `pdf-recipes` -> Project bundle | Author a coordinated render project | durable |
| `to-pdf` with an existing recipe | Replay accepted artifacts | external artifacts are untouched |
| `to-pdf` with a generated recipe | Produce one PDF in one flow | CLI-owned session bundle, removed after successful render |

The same profile, template, and project generation services can support both
lifecycles. The entry path and the user's final action determine whether the
prepared candidate is written to a durable destination or a temporary session
bundle.

## `to-pdf` One-Shot Flow

`to-pdf` should support direct replay and in-session recipe creation.

```text
to-pdf
  -> choose Markdown input
  -> choose a recipe for this PDF
     - built-in recipe
     - existing profile
     - existing bundle
     - custom composition
     - create a recipe
  -> when creating, choose artifact type and preparation mode
  -> when using Codex, resolve the Markdown sample and confirm prepared signals
  -> resolve or prepare the recipe
  -> show mandatory recipe dry-run review
  -> choose render/save lifecycle
  -> ask only for applicable outputs
  -> show final transaction review
  -> execute the chosen action
```

PDF output belongs near execution, after the recipe is known and reviewed.
This follows the existing Interactive data-query rhythm:

```text
input
  -> mode
  -> candidate
  -> candidate review
  -> output selection
  -> execution
```

It also prevents irrelevant questions. A user who chooses a save-only
lifecycle should never be asked for a PDF output path.

## Recipe Source Modes

The `to-pdf` recipe prompt should use one selection rather than a sequence of
yes/no questions.

```text
? Choose a recipe for this PDF
❯ Built-in recipe
    Use the renderer defaults
  Existing profile
    Apply a reusable PDF profile
  Existing bundle
    Discover profile, template, and CSS from a bundle
  Custom composition
    Combine a bundle with explicit profile, template, or CSS overrides
  Create a recipe
    Create a profile, template bundle, or project bundle
  Back
  Cancel
```

The recipe choices map to existing renderer inputs:

| Interactive recipe choice | Renderer mapping |
| --- | --- |
| Built-in recipe | no profile, template, CSS, or bundle path |
| Existing profile | `--profile <file>` |
| Existing bundle | `--bundle <directory>` |
| Custom composition | explicit profile/template/CSS plus optional bundle |
| Create a recipe | prepared artifact materialized into a CLI-owned session bundle |

The source choice also establishes whether this flow can invoke Codex:

| Recipe choice | Codex behavior |
| --- | --- |
| Built-in recipe | never invokes Codex |
| Existing profile | never invokes Codex; replays the selected artifact |
| Existing bundle | never invokes Codex; replays discovered artifacts |
| Custom composition | never invokes Codex; resolves explicitly selected artifacts |
| Create a recipe | invokes Codex only if the later preparation mode is `Codex Assistant` |

Interactive mode should not infer that an existing artifact was originally
created by Codex. Existing artifacts are accepted renderer inputs and are
replayed deterministically.

`Existing bundle` intentionally covers profile-only, template-only, stylesheet-
only, template/CSS, and complete project bundles. Interactive mode should reuse
the existing bundle admission, conflict, warning, and explicit-override rules.

### Built-In Recipe Review

The built-in path still needs a meaningful recipe review even though it has no
external artifact paths. The first review should show the effective recipe
without asking for the later PDF output yet:

```text
Markdown PDF recipe dry-run

Input: report.md
Recipe source: built-in
Preset: article
Page: A4 portrait
Margins: 18mm
ToC: disabled
Code highlighting: disabled
Default CSS: enabled

No files have been written.
```

The final transaction review adds the selected PDF output and overwrite policy.

### Custom Composition

Custom composition should reuse the direct renderer's precedence instead of
introducing Interactive-only conflict behavior. The flow may collect an
optional bundle first, then optional explicit role overrides:

```text
Optional bundle directory
Optional explicit profile
Optional explicit template
Optional explicit stylesheet
```

At least one bundle or explicit role must be selected. Otherwise, the flow
should return to recipe selection or use `Built-in recipe` rather than creating
a second defaults path.

Precedence is role-by-role and deterministic: an explicit `--profile`,
`--template`, or `--css` selection wins for that role, while the optional bundle
fills only roles that remain unresolved. Paths are not content-merged within a
role; profile, template, and stylesheet remain independently optional as long
as the custom composition selects at least one accepted external artifact.

The dry-run should label the resolved source for each role:

```text
Markdown PDF recipe dry-run

Input: report.md
Bundle: report-pdf-project
Profile: profiles/report.yml (explicit)
Template: template.html (bundle)
Stylesheet: print.css (explicit)

No files have been written.
```

Bundle ambiguity and invalid-profile errors should retain the current direct
messages and resolving flags. Explicit inputs continue to resolve their roles
before bundle discovery.

## Recipe Preparation Modes

When the user creates a recipe from either `to-pdf` or `pdf-recipes`, the flow
should first choose the artifact type and then an explicit preparation mode.

```text
? What would you like to create?
❯ Profile
    Starter, Formal guide, or Codex Assistant
  Template bundle
    Starter, Formal guide, or Codex Assistant
  Project bundle
    Codex Assistant only
  Back
  Cancel
```

For Profile and Template bundle, continue to the full preparation-mode prompt:

```text
? How should this recipe be prepared?
❯ Starter
    Use the deterministic starter configuration
  Formal guide
    Answer structured questions without Codex
  Codex Assistant
    Draft and adapt the recipe with Codex Helper
  Change what to create
  Cancel
```

For Project bundle, do not show unsupported deterministic choices:

```text
? How should this project bundle be prepared?
❯ Codex Assistant
    Coordinate profile, template, CSS, and managed assets with Codex Helper
  Change what to create
  Cancel
```

The available mode choices are filtered by artifact capability. Project
bundle offers only Codex Assistant because `md pdf-project codex` is the only
accepted direct project-authoring contract.

The intended capability matrix is:

| Artifact | Starter | Formal guide | Codex Assistant |
| --- | --- | --- | --- |
| Profile | current deterministic profile-init behavior | structured recipe questions | document signals, intent, font hints, optional base profile |
| Template bundle | current deterministic template-init behavior | structured safe recipe questions | document signals, intent, font hints, optional base profile and cover image |
| Project bundle | unavailable; no `md pdf-project init` contract | unavailable; no deterministic or manual direct contract | current `md pdf-project codex` orchestration |

Interactive preparation choices map back to the direct command contracts:

| Interactive choice | Direct contract reused |
| --- | --- |
| Profile starter | `md pdf-profile init` |
| Profile Formal guide | deterministic services used by `md pdf-profile init` |
| Profile Codex Assistant | `md pdf-profile codex` |
| Template starter | `md pdf-template init` |
| Template Formal guide | deterministic services used by `md pdf-template init` |
| Template Codex Assistant | `md pdf-template codex` |
| Project Codex Assistant | `md pdf-project codex` |

Interactive mode must not synthesize Project Starter or Project Formal guide by
running profile and template initialization separately. Doing so would create a
new project-generation contract that the direct CLI does not currently expose.

Formal-guide profile and template modes compile structured answers into the
same deterministic profile and recipe services used by the corresponding
starter commands. They do not define new artifact schemas.

### Starter

Starter mode exposes the existing deterministic initialization behavior with a
small prompt surface. It should not call Codex.

### Formal Guide

Formal guide should work like Interactive `data query formal-guide`: collect
structured answers, compile them deterministically into accepted inputs, show
the result, and let the user revise the answers before application.

Formal guide is available only for Profile and Template bundle. It is a guided
interface over their existing deterministic initialization services, not a new
artifact-generation surface.

The first formal-guide surface should stay within the current normalized recipe
contract:

- preset
- page size
- orientation
- preset or custom margins
- ToC enabled
- ToC depth and page-break behavior when enabled

For Template bundle, these questions should organize the existing
`md pdf-template init` surface around the presets, layout flags, and ToC command
examples in [Markdown PDF Usage](../guides/markdown-pdf-usage.md). The first
version should not add newly invented layout variants beyond that documented
surface.

Formal guide is not a raw artifact editor and should not claim arbitrary HTML,
CSS, cover composition, font discovery, or design interpretation.

Project bundle is excluded from Formal guide. Internal deterministic fallbacks
inside the Codex project helper do not establish a public deterministic project
mode, and Custom composition selects existing artifacts rather than authoring a
new project bundle. A future deterministic project mode must first establish a
direct command contract before Interactive mode can expose it.

### Codex Assistant

Codex Assistant should reuse the interaction pattern established by data query:

`Codex Assistant` is the canonical Interactive preparation-mode label. It is
powered by the existing Markdown PDF Codex Helper contracts, such as
`md pdf-profile codex`, `md pdf-template codex`, and `md pdf-project codex`;
`Codex Helper` does not identify a second Interactive actor or mode.

Codex preparation may use a Markdown sample for document-informed signals:

| Entry path | Markdown sample behavior |
| --- | --- |
| `to-pdf` -> Codex Assistant | reuse the already-selected Markdown input; do not ask for it twice |
| `pdf-recipes` -> Codex Assistant | ask for an optional Markdown sample before intent collection |
| Starter or Formal guide | do not request a Markdown sample |
| Built-in, existing, or Custom composition | do not request a Markdown sample |

The consent review should identify the sample and other selected signals without
claiming that the entire source file is sent when the helper uses bounded,
document-informed signals.

```text
? Use multiline editor? Yes
? Describe the PDF direction:

Formal client report with a restrained cover, table of contents,
readable TypeScript examples, and dense financial tables.

Codex Assistant preparation

Markdown sample: report.md
Creating: Project bundle
Base profile: none
Cover image: cover.jpg

? Send this intent and prepared document signals to Codex Assistant? Yes
```

Codex use must remain visible at three checkpoints:

1. before invocation, the preparation-mode description says that Codex Helper
   will draft and adapt the recipe
2. at consent, the user explicitly reviews the selected sample and signals, then
   confirms sending the intent and prepared signals to Codex Assistant
3. during review, the dry-run identifies `Preparation mode: Codex Assistant`
   plus the reused helper contract and whether the request completed

The primary hint remains one natural-language `intent`. Additional prompts are
conditional on the chosen artifact:

| Artifact | Additional signals |
| --- | --- |
| Profile | optional base profile and repeatable font hints |
| Template bundle | optional base profile, repeatable font hints, and optional cover image |
| Project bundle | optional base profile, repeatable font hints, and optional cover image |

After Codex preparation, candidate review should go directly to a contextual
lifecycle and recovery menu. It should not add a generic `Apply this candidate`
checkpoint before the lifecycle decision.

The accepting actions must name the concrete artifact instead of using a
generic category name. The temporary action is common to every generated
artifact; its description states both the successful cleanup and failed-render
retention rules. The durable actions vary by artifact:

| Artifact | Save and render | Save only |
| --- | --- | --- |
| Profile | `Save profile and render` | `Save profile only` |
| Template bundle | `Save template bundle and render` | `Save template bundle only` |
| Project bundle | `Save project bundle and render` | `Save project bundle only` |

For example, a Project bundle candidate created inside `to-pdf` uses:

```text
? Recipe candidate next step
❯ Render PDF and clean up
    Use temporary project files; remove them after success and retain them if rendering fails
  Save project bundle and render
    Write the project bundle to a durable directory, then render the PDF
  Save project bundle only
    Write the project bundle without rendering
  Revise intent
  Regenerate with the same intent
  Change preparation mode
  Change what to create
  Cancel
```

The Profile and Template bundle paths substitute their exact artifact names and
describe their temporary files in the same way.

For a durable Project bundle candidate created inside `pdf-recipes`:

```text
? Recipe candidate next step
❯ Save project bundle
  Revise intent
  Regenerate with the same intent
  Change preparation mode
  Change what to create
  Cancel
```

The equivalent accepting actions are `Save profile` and `Save template bundle`.

Selecting a render or save lifecycle accepts the candidate but remains
non-committing. The flow still asks for applicable outputs and shows the final
transaction review before writing or rendering. `Regenerate` explicitly
performs another Codex request; every accepting lifecycle must use the exact
prepared result already shown to the user.

Changing preparation mode or what to create explicitly discards the current
in-memory candidate. No cleanup is needed because it has not been written.

## Mandatory Dry-Run Contract

Every render and recipe-creation branch should prepare and review before
committing.

```text
collect choices
  -> normalize inputs
  -> resolve paths and bundle roles
  -> generate candidate when requested
  -> validate candidate and planned outputs
  -> display dry-run review
  -> await user decision
```

The Interactive dry-run contract is stricter than merely invoking a direct
helper with `--dry-run`:

- no profile, template, project, PDF, HTML, or report file is written before the
  user chooses a committing action
- generated content remains available in memory for the subsequent save or
  render action
- accepting a candidate does not repeat Codex generation
- revision returns to the smallest relevant checkpoint
- changing output does not regenerate an accepted candidate
- cancelling before application leaves no filesystem artifact

Diagnostic-report retention is selected after the candidate lifecycle and is
included in the final transaction review. The report remains in memory until
the user chooses a committing action. Interactive preview must not preserve the
direct helper behavior where a requested report can be written during
`--dry-run`.

The implementation therefore needs a reusable prepared-result boundary:

```text
prepare once
  -> review
  -> commit the same prepared result
```

It should not implement review by running a helper once with `dryRun: true` and
again with `dryRun: false`.

## Output Ordering

Outputs should be requested only after the recipe candidate is accepted.

```text
to-pdf
  -> Markdown input
  -> choose or create a recipe
  -> dry-run and review the recipe
  -> choose render/save lifecycle
  -> choose compatible Codex report retention, when applicable
  -> choose applicable artifact output
  -> choose applicable PDF output
  -> final review
  -> execute the chosen action
```

The required outputs depend on the selected continuation:

| Continuation | Artifact output | PDF output |
| --- | --- | --- |
| Render a built-in or existing recipe | none | required or defaulted |
| Render PDF and clean up | internal temporary bundle | required or defaulted |
| Save generated artifact and render | user-selected durable output | required or defaulted |
| Save generated artifact only | user-selected durable output | not requested |

`Save generated artifact` is descriptive contract wording in this table, not a
literal prompt label. The prompt uses `profile`, `template bundle`, or `project
bundle`, according to the candidate being reviewed.

Output selection should allow returning to artifact review without discarding
or regenerating the prepared candidate.

`pdf-recipes` requests only its durable artifact destination before committing.
If the user then chooses a context-specific `Continue to to-pdf` action, the
saved artifact becomes an existing renderer input to `to-pdf`, which owns the
later Markdown input, PDF output, final review, and rendering prompts.

## Execution And Cleanup Semantics

The one-shot temporary path should behave as a small transaction:

```text
accepted in-memory candidate
  -> create a unique CLI-owned session bundle
  -> write the exact accepted candidate
  -> render through md to-pdf --bundle
  -> confirm successful PDF output
  -> remove the CLI-owned session bundle
```

All generated artifact scopes can use this path:

```text
profile session bundle
  profile.yml

template session bundle
  template.html
  style.css
  assets/

project session bundle
  profile.yml
  template.html
  style.css
  assets/
```

The cleanup policy is ownership- and outcome-based:

| Artifact origin or outcome | Cleanup behavior |
| --- | --- |
| Existing profile, template, CSS, or bundle | never remove |
| Explicitly saved generated artifact | never remove |
| CLI-owned session bundle after successful render | remove |
| CLI-owned session bundle after failed render | retain and print its path |
| Successful render followed by cleanup failure | keep PDF, warn, and print the remaining bundle path |
| Cancellation before commit | nothing was written |

Cleanup must target only the exact unique directory created and retained in the
current session state. It must never derive a deletion target from a broad root,
glob, unresolved environment variable, existing bundle path, or user-selected
durable output.

Diagnostic-report retention is available only after Codex Assistant preparation
and is filtered by the selected lifecycle:

| Lifecycle | Available report choices |
| --- | --- |
| Render PDF and clean up | No; write to a separate path |
| Save generated artifact and render | No; keep with saved recipe; write to a separate path |
| Save generated artifact only | No; keep with saved recipe; write to a separate path |
| Durable `pdf-recipes` save | No; keep with saved recipe; write to a separate path |
| Built-in, existing, Custom composition, Starter, or Formal guide | no new Codex report prompt |

The temporary cleanup lifecycle must not offer `Keep with saved recipe` because
the session bundle is scheduled for removal:

```text
✔ Recipe lifecycle Render PDF and clean up

? Keep a Codex diagnostic report?
❯ No
  Write it to a separate path
```

Durable lifecycles may retain the report with the accepted artifact:

```text
✔ Recipe lifecycle Save project bundle and render

? Keep a Codex diagnostic report?
❯ No
  Keep it with the saved recipe
  Write it to a separate path
```

`Keep it with the saved recipe` reuses the direct helper's placement contract:
a profile report is an adjacent sidecar, while template and project reports are
bundle artifacts. The selection must never silently change a temporary cleanup
lifecycle into durable retention. A separately persisted report can survive
while the temporary render bundle is removed.

A selected report is written only after the user commits the prepared result,
never during the pre-commit dry-run review.

## Simulated Existing-Bundle Render

```text
✔ Choose a command md
✔ Choose a markdown command to-pdf
✔ Input Markdown file report.md
✔ Choose a recipe for this PDF Existing bundle
✔ Bundle directory report-pdf-project

Markdown PDF recipe dry-run

Input: report.md
Recipe source: existing bundle
Profile: profile.yml
Template: template.html
Stylesheet: style.css
Recipe bundle: report-pdf-project

No files have been written.

? Recipe next step
❯ Continue to PDF output
  Change recipe
  Cancel

✔ PDF output report.pdf
✔ Overwrite if it exists? No

Final render review

Input: report.md
Bundle: report-pdf-project
PDF output: report.pdf
Existing bundle cleanup: never

? Render this PDF? Yes
```

## Simulated One-Shot Codex Project Render

```text
✔ Choose a command md
✔ Choose a markdown command to-pdf
✔ Input Markdown file report.md
✔ Choose a recipe for this PDF Create a recipe
✔ What would you like to create? Project bundle
✔ How should this recipe be prepared? Codex Assistant
✔ Cover image file cover.jpg
✔ Use multiline editor? Yes

Codex Assistant preparation

Markdown sample: report.md
Creating: Project bundle
Base profile: none
Cover image: cover.jpg

✔ Send this intent and prepared document signals to Codex Assistant? Yes

Codex Thinking... Drafting Markdown PDF project recipe

Markdown PDF recipe dry-run

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

No files have been written.

? Recipe candidate next step
❯ Render PDF and clean up
    Use temporary project files; remove them after success and retain them if rendering fails
  Save project bundle and render
    Write the project bundle to a durable directory, then render the PDF
  Save project bundle only
    Write the project bundle without rendering
  Revise intent
  Regenerate with the same intent
  Change preparation mode
  Change what to create
  Cancel

✔ Recipe candidate next step Render PDF and clean up
✔ Keep a Codex diagnostic report? No
✔ PDF output report.pdf
✔ Overwrite if it exists? No

Final render review

Input: report.md
Generated bundle: temporary CLI-owned session bundle
PDF output: report.pdf
Bundle retention: remove after successful render
Codex report: not retained

? Render this PDF? Yes

Wrote PDF: report.pdf
Removed temporary Markdown PDF session bundle.
```

## Simulated Formal-Guide Profile Authoring And Handoff

```text
✔ Choose a command md
✔ Choose a markdown command pdf-recipes
✔ What would you like to create? Profile
✔ How should this recipe be prepared? Formal guide
✔ Preset report
✔ Page size A4
✔ Orientation portrait
✔ Use preset margins? Yes
✔ Generate a table of contents? Yes
✔ Table of contents depth 3
✔ Table of contents page break after

Markdown PDF profile dry-run

Preparation mode: formal-guide
Preset: report
Page: A4 portrait
Margins: preset
ToC: enabled, depth 3, break after
Validation: passed

No files have been written.

? Recipe candidate next step
❯ Save profile
  Revise formal-guide answers
  Change preparation mode
  Change what to create
  Cancel

✔ Profile output report-profile.yml

Final profile save review

Profile output: report-profile.yml
Profile retention: keep

? Save this profile? Yes

Wrote Markdown PDF profile: report-profile.yml

? What next?
❯ Continue to to-pdf with this profile
  Create another recipe
  Exit

✔ Input Markdown file report.md

Markdown PDF recipe dry-run

Input: report.md
Profile: report-profile.yml (explicit)

No PDF or additional artifacts have been written by to-pdf.

✔ PDF output report.pdf
✔ Overwrite if it exists? No

Final render review

Input: report.md
Profile: report-profile.yml
PDF output: report.pdf
Profile cleanup: never
Overwrite: disabled

? Render this PDF? Yes

Wrote PDF: report.pdf
```

## Simulated Render Failure

```text
Rendering failed before a PDF was completed.

The generated session bundle was retained for diagnosis:
<temporary-session-bundle>

You can revise the recipe or retry rendering from this bundle.

? Next step
❯ Retry render
  Keep bundle and exit
  Remove bundle and exit
  Cancel
```

The explicit remove choice after failure is separate from automatic cleanup.
Automatic cleanup occurs only after successful rendering. `Retry render` reuses
the already-materialized session bundle and never repeats starter,
formal-guide, or Codex generation.

## Implementation Implications

The Interactive flow should reuse shared services instead of invoking direct
CLI actions as subprocess-like steps.

The implementation should copy different aspects from two existing Interactive
precedents:

- use data query for input, mode, candidate review, output selection, execution,
  and checkpoint-backtracking order
- use data stack's `prepare* -> Prepared* -> writePrepared*` shape for the
  filesystem and generated-candidate boundary, without copying any
  output-before-prepare ordering

The required architectural boundary is:

```text
prompt collection
  -> shared preparation service
  -> prepared profile/template/project/render result
  -> Interactive review loop
  -> shared commit or render service
```

`Recipe` remains UX vocabulary for the effective composition. Implementation
must not introduce a second general-purpose or serialized Interactive recipe
schema, or broaden the existing `MarkdownPdfRecipe` type into an umbrella for
profiles, templates, projects, and lifecycle state. Narrow Interactive state
types may use recipe-oriented names when they discriminate and reference the
existing prepared profile, template, project, bundle, and render contracts.

In particular:

- `md to-pdf` needs a preparation boundary that resolves bundle roles,
  normalizes profiles and recipe options, validates output collisions, and
  returns the render plan before invoking external renderers.
- profile, template, and project generation need prepared results that can be
  reviewed and later written without recomputing Codex decisions.
- temporary bundle materialization must accept the same prepared artifacts as
  durable writes.
- the final renderer should consume the same resolved options used by the
  direct CLI.
- Interactive tests should cover checkpoint backtracking, output ordering,
  candidate reuse, Markdown-sample consent, lifecycle-filtered report choices,
  successful cleanup, render-failure retention, cleanup failure warnings, and
  protection of external artifacts.

## Settled Preparation Boundaries

- Starter and Formal guide are available for Profile and Template bundle only.
- Template Formal guide is limited to the existing `md pdf-template init`
  recipe surface, presented through the documented preset, page-shape, margin,
  and ToC usage cases.
- Project bundle authoring is Codex Assistant only because
  `md pdf-project codex` is the only accepted direct project-generation command.
- Interactive mode must not invent Project Starter, Project Formal guide, or a
  manual project generator. Any future deterministic project mode requires a
  separately established direct command contract first.

## Settled Lifecycle Boundaries

- Candidate review goes directly to a contextual render/save lifecycle; there
  is no generic `Apply this candidate` checkpoint.
- The temporary action is labeled `Render PDF and clean up`; its description
  promises cleanup after success and retention of the temporary files after a
  render failure.
- Durable actions name the exact artifact, such as `Save profile and render`,
  `Save template bundle only`, or `Save project bundle`.
- Selecting a lifecycle accepts the prepared candidate but does not write or
  render until applicable outputs and the final transaction review are
  confirmed.
- Codex report retention is selected after lifecycle choice. A temporary bundle
  scheduled for removal may persist a report only to a separate path.
- `to-pdf` reuses its Markdown input for Codex document signals;
  `pdf-recipes` asks for an optional sample only on Codex Assistant paths.
- Interactive `Recipe` terminology must map to existing prepared contracts and
  must not create a second serialized artifact model.

## Recommendations

1. Add `to-pdf` and `pdf-recipes` as the two PDF-oriented Interactive Markdown
   branches.
2. Let `to-pdf` support built-in, existing, and one-shot generated recipes.
3. Let `pdf-recipes` author durable profiles, template bundles, or project
   bundles and hand saved results to `to-pdf` when the user wants to continue.
4. Keep `to-pdf` as the only render/application owner rather than introducing a
   new `apply` alias or separate artifact-branch render paths.
5. Make prepared-result dry-run review mandatory before writes or rendering.
6. Use `Render PDF and clean up` for the temporary lifecycle and exact artifact
   names for durable actions; do not add a separate generic `Apply this
   candidate` step.
7. Ask for artifact and PDF outputs only after the recipe candidate is
   accepted.
8. Add deterministic starter and formal-guide modes for profile and template
   creation.
9. Keep Codex Assistant explicit in the preparation-mode choice, sample and
   signal consent, progress state, and dry-run provenance, then reuse its
   accepted result without a second request during application.
10. Filter Codex report choices by lifecycle and never offer bundle-owned report
    retention when the temporary bundle is scheduled for removal.
11. Default one-shot generated recipes to a CLI-owned temporary bundle that is
   removed only after successful rendering.
12. Keep durable helper outputs and all existing external artifacts by default.
13. Keep Project Starter and Project Formal guide unavailable unless a direct
    deterministic project-generation contract is separately established.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Project Codex Helper](research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Render Bundle Directory](research-2026-07-10-markdown-pdf-render-bundle-directory.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
