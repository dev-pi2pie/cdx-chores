---
title: "Interactive Markdown PDF Usage"
created-date: 2026-07-22
modified-date: 2026-07-23
status: completed
agent: codex
---

## Goal

Use Interactive mode to render Markdown with an existing recipe or prepare a
reviewable Profile, Template bundle, or Project bundle without translating the
workflow into direct CLI flags first.

Interactive mode orchestrates the same helpers and render inputs as the direct
commands. It does not introduce another recipe format or renderer:

- `to-pdf` owns PDF rendering.
- `pdf-recipes` owns durable recipe authoring and can hand a saved recipe to
  `to-pdf`.
- Profile files and Template or Project bundles remain usable by the direct
  CLI.

## Requirements

Start the guided CLI with:

```bash
cdx-chores interactive
```

Choose `md`, then choose `to-pdf` or `pdf-recipes`.

Rendering requires Pandoc and WeasyPrint. Codex-assisted preparation also
requires configured Codex support. Check available capabilities with:

```bash
cdx-chores doctor
```

## Choose An Entry Goal

Use `to-pdf` when the current goal is a PDF:

```text
md -> to-pdf
  -> choose or prepare a recipe
  -> settle the render source or generated lifecycle
  -> choose code highlighting for this PDF
  -> review reusable, override, and effective settings
  -> choose applicable outputs
  -> render
```

Use `pdf-recipes` when the current goal is a reusable artifact:

```text
md -> pdf-recipes
  -> prepare a recipe
  -> review the candidate
  -> save the durable artifact
  -> optionally hand it to to-pdf
```

Both entries prepare the same artifact families. Their lifecycle choices are
different because `pdf-recipes` does not own rendering.

## Render With `to-pdf`

After selecting the Markdown input, choose one recipe source:

| Recipe source | Behavior |
| --- | --- |
| Built-in recipe | Use renderer defaults. |
| Existing profile | Select one reusable Profile file. |
| Existing bundle | Discover top-level Profile, Template, and Stylesheet roles from one directory. |
| Custom inputs | Select explicit roles, optionally filling unselected roles from a bundle. |
| Create a recipe | Prepare a new Profile, Template bundle, or Project bundle before rendering. |

Custom inputs use two layers. First choose either `Explicit inputs` or
`Bundle + explicit inputs`. Then select one or more explicit roles: Profile,
Template, and Stylesheet. Explicit selections remain authoritative for their
roles; a selected bundle fills only unresolved roles.

The recipe review shows the selected source, resolved role provenance,
effective page settings, ToC behavior, separate reusable Profile settings,
the one-render highlighting override, the effective code result, and any
bundle warnings. No PDF is written before this review.

## Prepare A Recipe

The authoring matrix is the same under `to-pdf -> Create a recipe` and
`pdf-recipes`:

| Artifact | `starter` | `formal-guide` | `Codex Assistant` |
| --- | --- | --- | --- |
| Profile | yes | yes | yes |
| Template bundle | yes | yes | yes |
| Project bundle | no | no | yes |

Project bundle enters Codex Assistant directly because there is no direct
deterministic Project initializer.

Project bundle has no `starter` or `formal-guide` branch and no
preparation-mode menu. Its Codex-generated contained Profile may own reusable
code settings; the Project itself does not add another settings schema.

### Deterministic preparation

`starter` uses the deterministic starter configuration.

`formal-guide` asks for document preset, page size, orientation, margins, and
table-of-contents behavior. At recipe review, its layout, margin, and ToC
groups can be revised independently without changing artifact type.

For a Profile, `formal-guide` also adds a Code highlighting section:

1. `Enable code highlighting in this Profile?` defaults to yes.
2. When enabled, the code highlighting `Theme` chooses one of the supported light themes.
3. Line numbers and transformer notation are optional and default to off.

`Theme` is part of Code highlighting. When highlighting is disabled,
Interactive mode skips Theme, line-number, and transformer prompts, retains a
valid inert theme, and forces both dependent features off. Recipe review
offers `Revise code highlighting` for this Profile section.

This opinionated default applies only to Interactive Profile
`formal-guide`. Profile `starter` and direct Profile initialization remain off
by default. Template `formal-guide` continues to ask only about layout,
margins, and ToC; a Template owns compatible CSS presentation but no reusable
code settings.

### Codex Assistant

Codex Assistant collects only preparation signals before requesting a
candidate:

- optional PDF intent, entered in single-line or multiline form
- optional base Profile
- optional cover image for Template and Project bundles
- an ordered, repeatable font-hint collection
- for `pdf-recipes`, an optional Markdown preparation sample

The `to-pdf` entry reuses its selected Markdown input as the preparation
sample. Artifact and PDF output paths are chosen later; they are local lifecycle
configuration rather than Codex signals.

The setup review shows the signals before consent. During the request,
Interactive mode presents one artifact-specific waiting status and clears it
before the next prompt.

### Font hints

The font-hint editor supports two direct addition paths:

- `Add guided font hint` builds a font preference and intended use.
- `Add complete custom hint` accepts the full direct-equivalent hint text.

Guided intended uses include general or body text, language-specific body text,
headings and titles, code text, code symbols, and artifact-supported page
headers and footers. The editor previews the compiled direct equivalent before
adding it. Accepted hints can be edited, removed, or reordered.

When `fc-list` discovery is available within its bounded lookup time, the font
preference prompt offers installed family suggestions plus custom text. If
discovery is unavailable or times out, the same prompt falls back to ordinary
custom input without a native platform inventory fallback. The local inventory
is never sent to Codex; only accepted hint text is included after the user
reviews the setup and confirms the request.

The candidate review reports applied, blocked, and unresolved font directions
where the direct helper returns that information.

Codex Profile review shows reusable settings from the generated Profile.
Project review shows them from its generated contained Profile. Template
review has no reusable code-settings block.

## Prepare Once, Then Commit

Every generated path shares the same preparation boundary:

1. collect preparation answers
2. prepare one candidate
3. validate and review that candidate with no writes

A render-capable `to-pdf` continuation then:

4. choose the concrete save or render lifecycle
5. for rendering, choose code highlighting for this PDF
6. choose outputs and review the effective render
7. materialize and render without implicit regeneration

The `pdf-recipes` save-only path instead chooses a durable destination and
writes the reviewed candidate. Its optional render handoff starts the shared
`to-pdf` flow after that save.

Changing Codex setup invalidates the previous candidate. Changing only a local
destination or the one-render highlighting override does not request another
candidate, change artifact identity, or rewrite an already saved recipe.

## Code Highlighting For One Render

Every `to-pdf` render path asks `Code highlighting for this PDF` after its
render source is settled:

| Interactive choice | Renderer input | Result |
| --- | --- | --- |
| `Use recipe setting` | omitted | Use the resolved Profile setting; without a Profile, highlighting remains off. |
| `Enable for this render` | `true` | Enable highlighting without changing the Profile. Without Profile settings, use the default `github-light` theme. |
| `Disable for this render` | `false` | Disable highlighting, line numbers, and transformer notation for this PDF only. |

`Use recipe setting` is the default. Theme, line numbers, and transformer
notation remain reusable Profile settings; Interactive mode does not offer
render-time overrides for them.

The prompt appears at the boundary appropriate to the source:

```text
existing / built-in / Custom
  -> source selected
  -> code highlighting for this PDF
  -> authoritative renderer preparation

generated Profile / Template / Project
  -> candidate accepted
  -> temporary-render or save-and-render selected
  -> code highlighting for this PDF
  -> Codex report choice when applicable
  -> artifact and PDF outputs

saved-recipe handoff
  -> Markdown input chosen or reused
  -> code highlighting for this PDF
  -> authoritative renderer preparation
```

Recipe and final render reviews keep three concepts separate:

- `Reusable Profile settings` appears only when a Profile is actually
  resolved, including the contained Profile of a Project.
- `Render override` shows the selected one-render choice.
- `Effective render` shows what the renderer will use after precedence is
  applied.

A Template-only or built-in render omits the reusable block but still shows
the override and effective result. `Change code highlighting` revisits the
one-render prompt without changing the selected source, accepted generated
candidate, resolved outputs, or applicable Codex report choice. It does not
regenerate an artifact, repeat a Codex request, or rewrite an already saved
recipe.

`Back` from the initial prompt returns existing sources to recipe-source
selection, generated sources to the same accepted candidate review, and a
saved-recipe handoff to Markdown-input selection. Re-entering the same
generated candidate retains its override, including after a lifecycle change.
Changing the Markdown input, source, artifact, preparation mode, or generated
candidate resets the choice to `Use recipe setting`. `Cancel` performs no
implicit write or render.

## Lifecycle Choices

| Entry and source | Available lifecycle |
| --- | --- |
| `to-pdf`, existing or built-in recipe | Render the PDF; never remove the selected recipe. |
| `to-pdf`, generated recipe | Render with a CLI-owned temporary recipe, or save the recipe and render. |
| `pdf-recipes`, generated recipe | Save the Profile or bundle. |
| `pdf-recipes`, after save | Render through a `to-pdf` handoff, create another recipe, or exit. |

Durably saved and pre-existing artifacts are never automatically removed.

### Temporary render lifecycle

Temporary rendering keeps recipe ownership separate from the PDF:

```text
accepted candidate
  -> create CLI-owned OS temporary session
  -> materialize the recipe once
  -> render the PDF outside the session
       success -> attempt to remove the exact session
       failure -> retain and print the canonical session path
```

The PDF output and any separately retained report must be outside the temporary
session. A report cannot be kept with a temporary artifact because successful
cleanup would remove it.

After a successful render, cleanup targets only the exact CLI-owned session.
If cleanup itself fails, the completed PDF remains valid and the CLI prints the
retained session path.

After a render failure, the retained-session recovery menu can retry the
render, return to recipe review, keep the session and exit, or explicitly
delete the exact session after confirmation. A failure before materialization
and renderer preparation complete retains the session and offers revision,
retention, or confirmed deletion without claiming that a render can already be
retried.

The owned recipe session is different from the renderer's internal scratch
directory. Pandoc and WeasyPrint use separate renderer scratch space, which is
removed on a best-effort basis when the renderer finishes. That internal
cleanup has no Interactive recovery menu. Only the generated recipe session can
be retained and shown for Interactive recovery.

### Cross-platform temporary location

The session is created below the operating-system temporary directory returned
by Node.js `os.tmpdir()`, not below the current working directory.[^node-tmp]

| Platform | Temporary-directory selection |
| --- | --- |
| Windows | `TEMP`, then `TMP`, then the Windows system temporary directory. |
| macOS, Linux, and other non-Windows systems | `TMPDIR`, then `TMP`, then `TEMP`, then `/tmp`. |

The actual directory therefore varies by operating system, distribution,
login session, and environment configuration. A session child uses the prefix
`cdx-chores-markdown-pdf-` plus a unique suffix.

The CLI canonicalizes the newly created directory before using it. If the
platform exposes its temporary root through a symlink alias, materialization,
recovery display, and cleanup all use the same canonical session path. When a
session is retained, use the exact path printed by the CLI rather than assuming
one of the fallback locations in the table.

### Durable save and render

`Save ... and render` writes the accepted recipe to its durable destination,
then prepares `to-pdf` from that saved artifact. A successful durable write is
not repeated when renderer preparation or rendering is retried. Durable
materialization and renderer-preparation failures keep the selected output and
offer retry, recipe revision, or exit.

The generated-lifecycle recovery menus apply only to temporary and
save-and-render candidates. Built-in, existing Profile, existing bundle, and
Custom-input rendering continues through the direct prepared-render path.

The final review shows recipe output, PDF output, report retention, overwrite
behavior, cleanup ownership, reusable Profile settings when present, the
one-render override, and the effective code result before rendering starts.
Changing only code highlighting from this review preserves the applicable
outputs, report, cleanup ownership, and accepted artifact. Generated
materialization is not repeated.

## Codex Reports

Report choices appear only for Codex-assisted candidates:

- do not keep a report
- keep it with a durably saved recipe
- write it to a separate path

Temporary rendering supports no report or a separate report path only. The
separate report must not collide with the PDF or temporary session.
For a generated Codex candidate, report retention is chosen after the
one-render highlighting prompt. `Back` or `Cancel` at that highlighting
boundary therefore does not collect a report output path.

## `pdf-recipes` Handoff

After a successful save, `pdf-recipes` can open `to-pdf` with the accepted
artifact already selected:

- a Profile enters as `Existing profile`
- a Template or Project bundle enters as `Existing bundle`

If Codex preparation used a Markdown sample, the handoff asks whether to reuse
it or choose another Markdown input. Without a saved sample, the handoff asks
for the render input. Rendering still occurs only inside the shared `to-pdf`
flow. The same `Code highlighting for this PDF` prompt appears after the
Markdown input is chosen or reused. The saved Profile, or a Profile contained
by the saved bundle, remains reusable state; the handoff choice remains
one-render state.

## Navigation And Safety

- `Back` returns to the nearest meaningful recipe, artifact, mode, setup, or
  output checkpoint.
- `Cancel` exits without an implicit save or render.
- `Back` from the initial highlighting prompt returns to the current source,
  candidate, or handoff-input checkpoint without writing or rendering.
- Changing only the one-render highlighting override reuses the accepted
  source or candidate and applicable output state.
- Existing files are not overwritten unless overwrite is explicitly enabled.
- Final PDF writes use the shared safe renderer output boundary.
- Recipe and PDF output paths must not collide.

## Direct CLI Equivalents

Use the direct commands for scripting or when all inputs are already known:

```text
md pdf-profile init|codex
md pdf-template init|codex
md pdf-project codex
md to-pdf [--profile | --template | --css | --bundle]
  [--code-highlight | --no-code-highlight]
```

Interactive artifacts remain ordinary Profile files and Template or Project
bundle directories, so either surface can consume artifacts created by the
other. Interactive Profile `formal-guide` defaults its reusable highlighting
setting to enabled. Direct Profile initialization, Interactive Profile
`starter`, and direct `to-pdf` rendering keep their existing default of
disabled; the direct flags and renderer precedence are unchanged.

## Related Docs

- [Markdown PDF Usage](markdown-pdf-usage.md)
- [Markdown PDF Codex Profile Helper](markdown-pdf-codex-profile-helper.md)
- [Markdown PDF Codex Template Helper](markdown-pdf-codex-template-helper.md)
- [Markdown PDF Codex Project Helper](markdown-pdf-codex-project-helper.md)

[^node-tmp]: [Node.js `os.tmpdir()` documentation](https://nodejs.org/api/os.html#ostmpdir)
