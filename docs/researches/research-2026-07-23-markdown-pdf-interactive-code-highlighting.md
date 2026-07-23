---
title: "Markdown PDF Interactive Code Highlighting"
created-date: 2026-07-23
modified-date: 2026-07-23
status: completed
agent: codex
---

## Goal

Define the follow-up Interactive contract for reusable Markdown PDF code
highlighting settings and one-render highlighting overrides without changing
the shipped direct CLI behavior.

The completed Interactive Markdown PDF work preserved the renderer's code
options but did not expose them as Interactive decisions. The follow-up should
make two distinct capabilities visible:

1. reusable `code` settings owned by a Profile
2. `--code-highlight` and `--no-code-highlight` equivalents owned by one
   `to-pdf` render

The direct commands, Profile schema, Shiki implementation, theme allowlist, and
renderer precedence remain the source of truth.

## Why This Follow-Up

The original Shiki implementation intentionally shipped highlighting as an
opt-in direct feature. It established:

- `code.highlight: false` as the direct Profile default
- `github-light` as the default theme when highlighting is enabled
- Profile-owned line numbers and transformer notation
- `--code-highlight` and `--no-code-highlight` as render-time overrides
- Template-owned CSS hooks that style highlighted output without enabling
  Shiki

Interactive mode currently resolves and displays effective highlighting for
existing render sources, but it does not let the user choose either direct
render override. Interactive Profile `formal-guide` also has no code
highlighting section, so its generated Profile silently inherits the direct
starter default of `code.highlight: false`.

This follow-up addresses those Interactive gaps. It does not reopen or rewrite
the completed Shiki or Interactive implementation plans.

Profile `formal-guide` is an opinionated guided-authoring surface rather than a
direct-equivalent starter. Enabling highlighting gives fenced code a useful
default presentation, has no rendered effect when no eligible code blocks are
present, and uses a validated built-in light theme. The user can review,
revise, or disable it before saving. Direct Profile initialization and
Interactive `starter` remain off for compatibility.

## Current Ownership

| Artifact or surface | Code-highlighting responsibility |
| --- | --- |
| Profile | Owns reusable `highlight`, `theme`, `lineNumbers`, and `transformerNotation` settings. |
| Project bundle | Carries reusable code-highlighting settings through its contained Profile; Interactive Project preparation remains Codex Assistant-only. |
| Template bundle | Does not own code-highlighting settings or enable Shiki; it may provide compatible CSS hooks. |
| `md to-pdf` | Resolves the effective Profile settings and owns one-render enable or disable overrides. |
| Interactive `pdf-recipes` | Saves durable artifacts but does not render; Project preparation remains Codex Assistant-only. |
| Interactive `to-pdf` | Owns the one-render highlighting decision and deterministic render. |

Use “does not own code-highlighting settings” for Template bundles rather than
“does not support code highlighting.” A Template can style highlighted markup
produced by the renderer, but it cannot enable Shiki or select the theme.

The Interactive authoring matrix is unchanged:

```text
Profile         -> starter | formal-guide | Codex Assistant
Template bundle -> starter | formal-guide | Codex Assistant
Project bundle  -> Codex Assistant only
```

This follow-up must not add Project `starter`, Project `formal-guide`, a Project
preparation-mode prompt, or any other Project authoring branch.

## Default Contract

The follow-up must distinguish the historical direct defaults from the new
guided default:

| Surface | Default behavior |
| --- | --- |
| Direct `md to-pdf` without a Profile or flag | Highlighting remains off. |
| Direct `md pdf-profile init` | The generated starter Profile remains off. |
| Existing Profile or Project bundle | Use its stored Profile settings. |
| Interactive Profile `starter` | Preserve direct starter behavior and remain off. |
| Interactive Profile `formal-guide` | The new Code highlighting section defaults to enabled. |
| Interactive Profile Codex Assistant or Project Codex Assistant | Use the validated generated Profile settings; do not impose a new global default. |
| Interactive Template authoring | Do not show reusable code-highlighting settings. |
| Interactive `to-pdf` render override | Default to `Use recipe setting`. |

The Interactive `formal-guide` default-on choice is deliberately
surface-specific. It must not change the direct Profile default, existing
Profiles, scripted renders, or `starter` equivalence.

## Reusable Profile Settings

### Formal Guide

Only Profile `formal-guide` should add this artifact-scoped section. Template
`formal-guide` must not show reusable code-highlighting settings, and Project
bundle has no `formal-guide` preparation mode.

The Profile section appears after Table of contents. This is a structural
prompt sketch; the prompt table below defines the actual messages:

```text
Profile formal-guide
|
+-- Layout
+-- Margins
+-- Table of contents
`-- Code highlighting
    `-- Enable code highlighting in this Profile?
        |
        +-- Yes (default)
        |   +-- Theme
        |   |   default: github-light
        |   +-- Line numbers
        |   |   default: No
        |   `-- Transformer notation
        |       default: No
        |
        `-- No
            `-- Skip Theme, Line numbers, and Transformer notation
```

Actual prompt messages:

| Prompt | Description |
| --- | --- |
| `Enable code highlighting in this Profile?` | Reusable default for renders using this Profile |
| `Theme` | Colors used for highlighted code |
| `Show line numbers in highlighted code blocks?` | Add line numbers when highlighting is active |
| `Enable transformer notation in highlighted code blocks?` | Recognize supported Shiki code annotation markers |

`Theme` is acceptable as the short prompt because it appears inside the Code
highlighting section. Outside that context, documentation and review summaries
should say `Code highlighting theme`.

When highlighting is disabled, skip the dependent prompts and compile
`highlight`, `lineNumbers`, and `transformerNotation` as `false`. An initially
disabled section uses `github-light` as its inert validated theme. Revising an
enabled section to disabled retains its selected theme but forces the two
dependent booleans off. If the section is enabled again, reuse the retained
theme and default line numbers and transformer notation to No.

The Profile candidate review should add:

```text
Code highlighting:
- Enabled: yes
- Theme: github-light
- Line numbers: no
- Transformer notation: no
```

When disabled, the review should still show the stored theme and label it as
used when highlighting is enabled.

`Revise code highlighting` should be a peer of `Revise layout`, `Revise
margins`, and `Revise table of contents` for a Profile `formal-guide`
candidate. Template candidates must not show that revision action.

### Starter And Codex Assistant

Profile `starter` remains the deterministic direct-equivalent starter and does
not gain questions or a new default.

The existing Codex Profile patch boundary already supports all four `code`
fields. Profile Codex Assistant and Project Codex Assistant candidate reviews
should expose the resolved Profile values. Project remains a direct transition
to Codex Assistant; this review requirement does not add a Project preparation
mode. The follow-up should not invent a parallel Interactive-only Profile
schema or let a Template candidate claim ownership of those fields.

## One-Render Override

Interactive `to-pdf` should expose:

```text
? Code highlighting for this PDF
❯ Use recipe setting
  Enable for this render
  Disable for this render
  Back
  Cancel
```

Choice mapping:

| Interactive choice | Shared renderer input | Direct equivalent |
| --- | --- | --- |
| `Use recipe setting` | `codeHighlight: undefined` | omit both flags |
| `Enable for this render` | `codeHighlight: true` | `--code-highlight` |
| `Disable for this render` | `codeHighlight: false` | `--no-code-highlight` |

Descriptions:

| Choice | Description |
| --- | --- |
| `Use recipe setting` | Use the selected Profile value; when no Profile is present, use the renderer default of off |
| `Enable for this render` | Use the Profile theme, or `github-light` when no Profile supplies one |
| `Disable for this render` | Also disable line numbers and transformer notation for this render |

Here, `recipe setting` means the reusable setting resolved from the selected
render source. A built-in, Template-only, or Custom source without a Profile
has no reusable enablement, so its inherited renderer default is off.

Do not add Theme, line-number, or transformer-notation overrides to this
render-time block. Those remain reusable Profile settings. The Interactive
choice should compile immediately to the existing optional boolean rather than
introducing a persisted preference or another recipe type.

## Implementation Evidence

The follow-up contract is now implemented and documented in the shipped
interactive and direct usage guides. Profile `formal-guide` owns reusable code
settings, `to-pdf` owns the one-render override, and direct CLI compatibility
remains unchanged.

Phase 4 automated and real-render evidence is recorded in the linked
implementation plan and validation job. The final whole-plan range passed
correctness, test-coverage, maintainability, and documentation review after
the durable-recovery finding was fixed.

## Decision Flow

```text
Interactive
`-- md
    +-- to-pdf
    |   +-- Choose Markdown input
    |   `-- Choose recipe source
    |       |
    |       +-- Built-in / Existing Profile / Existing bundle / Custom inputs
    |       |   +-- Code highlighting for this PDF
    |       |   +-- Prepare effective renderer inputs
    |       |   +-- Recipe review
    |       |   +-- Choose PDF output
    |       |   +-- Final render review
    |       |   `-- Render
    |       |
    |       `-- Create a recipe
    |           +-- Choose artifact
    |           |   +-- Profile
    |           |   |   `-- starter / formal-guide / Codex Assistant
    |           |   |       Profile formal-guide only:
    |           |   |       `-- Code highlighting
    |           |   +-- Template bundle
    |           |   |   `-- starter / formal-guide / Codex Assistant
    |           |   |       no reusable code-highlighting prompts
    |           |   `-- Project bundle
    |           |       `-- Codex Assistant directly
    |           |           no preparation-mode prompt
    |           +-- Prepare candidate once
    |           +-- Candidate review
    |           +-- Choose temporary render or save-and-render
    |           +-- Code highlighting for this PDF
    |           +-- Choose applicable outputs
    |           +-- Final render review
    |           +-- Materialize the accepted candidate
    |           +-- Prepare renderer with the override
    |           `-- Render
    |
    `-- pdf-recipes
        +-- Choose artifact through the same authoring matrix
        +-- Prepare and review a durable recipe
        +-- Save it
        `-- Optional render handoff
            +-- Choose or reuse Markdown input
            +-- Code highlighting for this PDF
            `-- Continue through shared to-pdf preparation
```

For built-in, existing, and custom sources, collect the render override after
the source is known and before renderer preparation. For a generated candidate,
choose temporary render or save-and-render first, then collect the render
override before any output confirmation, materialization, or renderer
preparation. The lifecycle choice establishes that the accepted candidate will
be rendered; the later override changes only that render.

Back behavior:

- existing, built-in, and custom sources return to recipe-source selection
- generated candidates return to the same candidate review
- saved-recipe handoff returns to Markdown input selection
- cancellation performs no implicit write or render

After recipe or final review, `Change code highlighting` should return to the
same render-time choice while preserving the Markdown input, source paths,
accepted generated candidate, lifecycle, and resolved output choices. A Codex
generated branch also preserves its already selected report retention choice;
plain built-in, existing, and custom render paths have no report state. A
changed override may repeat deterministic renderer preparation, but it must not
regenerate a deterministic or Codex artifact, issue another Codex request, or
rewrite a successfully saved recipe.

## Effective Precedence

| Profile setting | Render override | Effective result |
| --- | --- | --- |
| Any valid code block | Use recipe setting | Use all stored Profile values. |
| Highlighting disabled | Enable for this render | Enable highlighting with the stored theme; preserve stored line-number and transformer settings. |
| Highlighting enabled | Enable for this render | Keep highlighting enabled with the stored settings. |
| Highlighting enabled or disabled | Disable for this render | Disable highlighting, line numbers, and transformer notation for this render. |
| No Profile | Use recipe setting | Use the renderer default: highlighting off, `github-light` inert, and line numbers and transformer notation off. |
| No Profile | Enable for this render | Enable highlighting with `github-light`; keep line numbers and transformer notation off. |
| No Profile | Disable for this render | Keep highlighting, line numbers, and transformer notation off. |

The override never mutates the Profile. A Template-only or built-in recipe has
no Profile-owned enablement, so `Use recipe setting` remains off while `Enable
for this render` activates Shiki through the renderer.

## Review Contract

Reviews should separate durable settings from one-render state:

```text
Reusable Profile settings:
- Highlighting: enabled
- Theme: light-plus
- Line numbers: enabled
- Transformer notation: disabled

Render override:
- Use recipe setting

Effective render:
- Highlighting: enabled
- Theme: light-plus
- Line numbers: enabled
- Transformer notation: disabled
```

Template-only review must not show a reusable Profile-settings block. It may
show the render override and effective renderer result.

## Compatibility Boundary

This follow-up should not:

- change the direct Profile default from `false`
- change `md pdf-profile init` output
- change existing Profile, Template, Project, or report schemas
- add Project `starter`, Project `formal-guide`, or a Project preparation-mode
  prompt
- add code settings to `md pdf-template init|codex`
- add new direct `md to-pdf` flags
- change the fixed Shiki theme allowlist
- make output paths or render overrides Codex signals
- regenerate an accepted artifact when only the render override changes

Direct CLI regression coverage for omitted, positive, and negative highlight
flags should remain unchanged and pass alongside the new Interactive tests.

## Documentation Impact

After implementation is verified:

- update [Markdown PDF Interactive Usage](../guides/markdown-pdf-interactive-usage.md)
  with the two-layer Profile and render model
- add a short Interactive mapping note to the Code Highlighting section in
  [Markdown PDF Usage](../guides/markdown-pdf-usage.md)
- keep the Profile, Project, and Template ownership wording aligned
- leave historical plans and research unchanged
- add release-note wording only when this enhancement enters a release scope

Local renderer setup is development-environment information and should not be
recorded in public guides, research, plans, or job evidence.

## Validation Direction

The follow-up plan should cover:

- Profile `formal-guide` enabled and disabled collection, conditional prompts,
  revision, serialization, retained theme, and default-on behavior
- absence of reusable code settings from Template authoring
- absence of new Project preparation modes or prompts
- Profile Codex Assistant and Project Codex Assistant candidate review of all
  four Profile fields
- inherit, enable, and disable render choices
- built-in, existing Profile, existing bundle, custom, generated, and handoff
  paths
- Template-only rendering with `Enable for this render`
- backtracking without artifact or Codex regeneration
- direct CLI compatibility
- focused, full-suite, and real renderer smoke validation

## Settled Direction

- Profile owns reusable code-highlighting settings; a Project bundle carries
  them through its contained Profile.
- Template bundles own compatible CSS presentation only.
- Project preparation remains Codex Assistant-only; this follow-up adds no
  Project authoring branch.
- Interactive Profile `formal-guide` adds a Code highlighting section whose
  enablement defaults to on.
- Disabling that section skips its dependent prompts, retains a valid inert
  theme, and forces line numbers and transformer notation off.
- Direct and starter defaults remain unchanged and off.
- Interactive render override defaults to `Use recipe setting`.
- Theme, line numbers, and transformer notation remain Profile-owned.
- Existing renderer precedence and optional boolean input are reused.
- Historical Shiki and Interactive lifecycle documents remain closed.

The product direction, implementation, renderer validation, and exact-range
review evidence are complete and linked.

## Related Research

- [Markdown PDF Shiki Code Highlighting](research-2026-05-16-markdown-pdf-shiki-code-highlighting.md) — historical direct and Profile contract
- [Markdown PDF Interactive Mode](research-2026-07-03-markdown-pdf-interactive-mode.md) — historical Interactive lifecycle contract
- [Markdown PDF Project Codex Helper](research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)

## Related Plans

- [Markdown PDF Interactive code highlighting implementation](../plans/plan-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
- [Markdown PDF Shiki code highlighting implementation](../plans/plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md) — historical completed plan
- [Markdown PDF Interactive Mode implementation](../plans/plan-2026-07-21-markdown-pdf-interactive-mode.md) — historical completed plan
