---
title: "Interactive Markdown PDF Usage"
created-date: 2026-07-22
modified-date: 2026-08-22
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

To use a longer per-attempt deadline for Codex-backed work throughout this
Interactive session, start the explicit command with:

```bash
cdx-chores interactive --codex-timeout 2m
```

The option belongs to `interactive`; the root spelling
`cdx-chores --codex-timeout 2m` is unsupported. Omitting the option keeps the
30-second default, and Interactive mode does not add a timeout setup prompt to
the Markdown workflows.

Choose `md`, then choose `to-pdf` or `pdf-recipes`.

Rendering requires Pandoc 2.0 or newer and WeasyPrint. Codex-assisted
preparation also requires configured Codex support. Check available
capabilities with:

```bash
cdx-chores doctor
```

From Interactive mode, choose `doctor`, then select `Summary`, `Details`, or
`JSON` for the same three doctor projections.

## Choose An Entry Goal

Use `to-pdf` when the current goal is a PDF:

```text
md -> to-pdf
  -> choose or prepare a recipe
  -> settle the render source or generated lifecycle
  -> choose code highlighting, then page numbers, for this PDF
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

| Recipe source    | Behavior                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| Built-in recipe  | Use renderer defaults.                                                         |
| Existing profile | Select one reusable Profile file.                                              |
| Existing bundle  | Discover top-level Profile, Template, and Stylesheet roles from one directory. |
| Custom inputs    | Select explicit roles, optionally filling unselected roles from a bundle.      |
| Create a recipe  | Prepare a new Profile, Template bundle, or Project bundle before rendering.    |

Custom inputs use two layers. First choose either `Explicit inputs` or
`Bundle + explicit inputs`. Then select one or more explicit roles: Profile,
Template, and Stylesheet. Explicit selections remain authoritative for their
roles; a selected bundle fills only unresolved roles.

The recipe review shows the selected source, resolved role provenance,
effective page settings, ToC behavior, separate reusable Profile settings,
the two one-render overrides, their effective results, and any bundle warnings.
No PDF is written before this review.

## Prepare A Recipe

The authoring matrix is the same under `to-pdf -> Create a recipe` and
`pdf-recipes`:

| Artifact        | `starter` | `formal-guide` | `Codex Assistant` |
| --------------- | --------- | -------------- | ----------------- |
| Profile         | yes       | yes            | yes               |
| Template bundle | yes       | yes            | yes               |
| Project bundle  | no        | no             | yes               |

Project bundle enters Codex Assistant directly because there is no direct
deterministic Project initializer. It therefore has no Formal Guide cover or
page-number questions; review and edit its contained Profile for the full
reusable contract.

Project bundle has no `starter` or `formal-guide` branch and no
preparation-mode menu. Its Codex-generated contained Profile may own reusable
code settings; the Project itself does not add another settings schema.

### Deterministic preparation

`starter` uses the deterministic starter configuration.

`formal-guide` asks Profile and Template artifacts for document preset, page
size, orientation, margins, and table-of-contents behavior. A Profile uses this
exact group order:

```text
layout -> margins -> cover -> table of contents -> code highlighting
  -> page numbers -> repeating header or footer text
```

The cover decision comes before ToC so the front matter is settled before the
ToC that follows it. `Add a cover page?` defaults to no. Enabling it uses the
Profile's metadata-backed cover fields; their full schema and placeholder rules
are documented in
[Covers, Repeating Content, And Page Numbers](markdown-pdf-usage.md#covers-repeating-content-and-page-numbers).
Recipe review offers `Revise cover page` without recollecting the other groups.

For a Profile, `formal-guide` also adds a Code highlighting section:

1. `Enable code highlighting in this Profile?` defaults to yes.
2. When enabled, the code highlighting `Theme` chooses one of the supported light themes.
3. Line numbers and transformer notation are optional and default to off.

`Theme` is part of Code highlighting. When highlighting is disabled,
Interactive mode skips Theme, line-number, and transformer prompts, retains a
valid inert theme, and forces both dependent features off. Recipe review
offers `Revise code highlighting` for this Profile section.

The page-number section first asks whether to enable reusable numbering. When
enabled, it keeps common authoring concise:

1. `Number which pages?` chooses `Body pages, starting at 1` (the default) or
   `Entire document, starting at 1`.
2. `Page-number label` chooses `Page 1` (recommended), `1` (compact), or a
   custom label.
3. `Page-number position` chooses one of the six header and footer slots.

The two numbering outcomes set the visible scope and counting origin together,
with start and increment fixed at `1`. A custom label uses the same inline
ghost-completion interaction as other guided text: `Page {page} of {pages}` is
suggested, Right Arrow accepts the suggestion, and the prompt explains the
logical `{page}`/`{pages}` and physical `{pdfPage}`/`{pdfPages}` tokens. The
label must contain a current-page token, `{page}` or `{pdfPage}`. See
[Covers, Repeating Content, And Page Numbers](markdown-pdf-usage.md#covers-repeating-content-and-page-numbers)
for the canonical token semantics and migration notes.

`Add repeating header or footer text?` then selects only the slots the Profile
needs instead of asking six unconditional questions. When page numbers are
enabled, their slot is shown as reserved and cannot also be selected for
repeating text. Revising page-number placement does not silently erase existing
content in the newly occupied slot: Interactive asks before clearing the
conflict. Each selected slot accepts literal text or `{title}`, `{company}`,
`{author}`, and `{date}` placeholders, shows a slot-aware ghost suggestion, and
explains that values resolve from CLI metadata, Markdown frontmatter, then
Profile metadata. Recipe review offers separate `Revise page numbers` and
`Revise repeating page content` actions.

Formal Guide deliberately does not expose every Profile field. Use the Profile
YAML or JSON directly for independent `scope` and `countFrom` values, custom
start or increment values, page-role visibility, cover fields and style, or
other advanced combinations. The canonical schema remains in
[Markdown PDF Usage](markdown-pdf-usage.md#profiles).

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

The session timeout is passed to Profile, Template, and Project preparation.
Each Profile, Template, or validation-driven application-repair request receives
an independent per-attempt window using the same session value; a Project does
not share one total timeout budget across its phases. Backtracking, revising the
setup, and returning to an accepted candidate preserve the session value.
User-triggered regeneration creates a new request with the same per-attempt
window, but Interactive mode does not retry a failed request automatically.
The timeout remains session state and is not written into saved recipe identity
or generated artifacts.

For the shared duration grammar and the distinction between timeouts,
workflow-owned retries, semantic repair, and user-triggered regeneration, see
[Codex Timeouts, Retries, and Recovery](codex-timeouts-retries-and-recovery.md).

### Font hints

The font-hint editor supports two direct addition paths:

- `Add guided font hint` builds a font preference and intended use.
- `Add complete custom hint` accepts the full direct-equivalent hint text.

Guided intended uses include general or body text, language-specific body text,
headings and titles, code text, code symbols, and artifact-supported page
headers and footers. The editor previews the compiled direct equivalent before
adding it. Accepted hints can be edited, removed, or reordered.

Choosing a language-specific intended use records a preference for that Profile
language slot; it does not annotate or classify the Markdown. For exact
mixed-language assignment, mark the relevant content with Pandoc attributes
such as a bracketed inline span or fenced block Div. Without those markers, the
selected family only participates in fallback ordering and an earlier family
that covers the same characters may be used instead. See
[Profile Fonts And Mixed Language](markdown-pdf-usage.md#profile-fonts-and-mixed-language)
for the full contract.

Interactive searches a local fontconfig inventory only. It groups each primary
family with its reported aliases and full names, ranks exact, prefix,
token-prefix, substring, and ordered-subsequence matches deterministically, and
returns at most six installed suggestions. An alias or styled full-name match
still selects the primary family reported by fontconfig. Custom text remains
the first choice and preserves what the user entered.

Interactive waits automatically for up to three seconds. If discovery is still
running, it offers one choice between continuing with custom input and waiting
for installed fonts. Continued waiting reuses the same discovery attempt under
one ten-second total safety ceiling measured from the original start. The
result is cached for the Interactive session. Missing, empty, failed, cancelled,
or timed-out discovery falls back to ordinary custom input.

There is no network catalogue, native platform fallback, or discovery-source
prompt in this flow. Fonts visible only through Font Book or a third-party font
manager—including some Adobe Fonts configurations—may therefore be absent when
fontconfig cannot report them. The local inventory is never sent to Codex; only
accepted hint text is included after the user reviews the setup and confirms
the request.

Installed suggestions and manually entered preferences do not prove glyph
coverage, WeasyPrint availability, or final font-role assignment. A custom
preference can name a font outside the fontconfig inventory, but the renderer
must still be able to resolve it.

The candidate review reports applied, blocked, and unresolved font directions
where the direct helper returns that information.

Codex Profile review shows reusable settings from the generated Profile.
Project review shows reusable font choices from its generated contained
Profile, with non-competing Template CSS beside it. Template review has no
reusable code-settings block; applied ordinary font directions for unowned
slots are reflected in generated `style.css`, while compatibility-Profile-owned
directions are reported as blocked.

## Prepare Once, Then Commit

Every generated path shares the same preparation boundary:

1. collect preparation answers
2. prepare one candidate
3. validate and review that candidate with no writes

A render-capable `to-pdf` continuation then:

4. choose the concrete save or render lifecycle
5. for rendering, choose code highlighting and then page numbers for this PDF
6. choose outputs and review the effective render
7. materialize and render without implicit regeneration

The `pdf-recipes` save-only path instead chooses a durable destination and
writes the reviewed candidate. Its optional render handoff starts the shared
`to-pdf` flow after that save.

Changing Codex setup invalidates the previous candidate. Changing only a local
destination or either one-render override does not request another candidate,
change artifact identity, or rewrite an already saved recipe.

## Code Highlighting For One Render

Every `to-pdf` render path asks `Code highlighting for this PDF` after its
render source is settled:

| Interactive choice        | Renderer input | Result                                                                                                            |
| ------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Use recipe setting`      | omitted        | Use the resolved Profile setting; without a Profile, highlighting remains off.                                    |
| `Enable for this render`  | `true`         | Enable highlighting without changing the Profile. Without Profile settings, use the default `github-light` theme. |
| `Disable for this render` | `false`        | Disable highlighting, line numbers, and transformer notation for this PDF only.                                   |

`Use recipe setting` is the default. Theme, line numbers, and transformer
notation remain reusable Profile settings; Interactive mode does not offer
render-time overrides for them.

The prompt appears at the boundary appropriate to the source:

```text
existing / built-in / Custom
  -> source selected
  -> code highlighting for this PDF
  -> page numbers for this PDF
  -> authoritative renderer preparation

generated Profile / Template / Project
  -> candidate accepted
  -> temporary-render or save-and-render selected
  -> code highlighting for this PDF
  -> page numbers for this PDF
  -> Codex report choice when applicable
  -> artifact and PDF outputs

saved-recipe handoff
  -> Markdown input chosen or reused
  -> code highlighting for this PDF
  -> page numbers for this PDF
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

## Page Numbers For One Render

Immediately after code highlighting, every `to-pdf` path asks `Page numbers for
this PDF`:

| Interactive choice           | Renderer input | Result                                                                                        |
| ---------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `Keep recipe setting`        | omitted        | Use the resolved Profile setting; without enabled Profile numbering, page numbers remain off. |
| `Turn on for this PDF only`  | `true`         | Enable page numbers for this PDF without changing the Profile.                                |
| `Turn off for this PDF only` | `false`        | Disable page numbers for this PDF without changing the Profile.                               |

`Keep recipe setting` is the default. This override changes only whether page
numbers are enabled; reusable label, position, scope, counting origin, start,
and increment values still come from the Profile or renderer defaults.

The code and page-number choices are independent retained state for the current
render source. `Back` from page numbers returns to code highlighting. Returning
to the same accepted generated candidate or recovering output planning retains
both choices. Final review offers `Change code highlighting` and `Change page
numbers` without rebinding or rewriting a saved recipe. Changing the Markdown
input, recipe source, artifact, preparation mode, or generated candidate resets
both choices to their recipe-setting defaults. `Cancel` performs no implicit
write or render.

## Lifecycle Choices

| Entry and source                      | Available lifecycle                                                      |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `to-pdf`, existing or built-in recipe | Render the PDF; never remove the selected recipe.                        |
| `to-pdf`, generated recipe            | Render with a CLI-owned temporary recipe, or save the recipe and render. |
| `pdf-recipes`, generated recipe       | Save the Profile or bundle.                                              |
| `pdf-recipes`, after save             | Render through a `to-pdf` handoff, create another recipe, or exit.       |

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

| Platform                                    | Temporary-directory selection                                    |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Windows                                     | `TEMP`, then `TMP`, then the Windows system temporary directory. |
| macOS, Linux, and other non-Windows systems | `TMPDIR`, then `TMP`, then `TEMP`, then `/tmp`.                  |

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
one-render overrides, and their effective results before rendering starts.
Changing only code highlighting or page numbers from this review preserves the
applicable outputs, report, cleanup ownership, and accepted artifact. Generated
materialization is not repeated.

## Codex Reports

Report choices appear only for Codex-assisted candidates:

- do not keep a report
- keep it with a durably saved recipe
- write it to a separate path

Temporary rendering supports no report or a separate report path only. The
separate report must not collide with the PDF or temporary session.
For a generated Codex candidate, report retention is chosen after the
code-highlighting and page-number prompts. `Back` or `Cancel` at either
override boundary therefore does not collect a report output path.

## `pdf-recipes` Handoff

After a successful save, `pdf-recipes` can open `to-pdf` with the accepted
artifact already selected:

- a Profile enters as `Existing profile`
- a Template or Project bundle enters as `Existing bundle`

If Codex preparation used a Markdown sample, the handoff asks whether to reuse
it or choose another Markdown input. Without a saved sample, the handoff asks
for the render input. Rendering still occurs only inside the shared `to-pdf`
flow. The same `Code highlighting for this PDF` prompt appears after the
Markdown input is chosen or reused, followed by `Page numbers for this PDF`.
The saved Profile, or a Profile contained by the saved bundle, remains reusable
state; the handoff choices remain one-render state.

## Navigation And Safety

- `Back` returns to the nearest meaningful recipe, artifact, mode, setup, or
  output checkpoint.
- `Cancel` exits without an implicit save or render.
- `Back` from the initial highlighting prompt returns to the current source,
  candidate, or handoff-input checkpoint without writing or rendering.
- `Back` from page numbers returns to code highlighting.
- Changing only either one-render override reuses the accepted source or
  candidate and applicable output state.
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
  [--page-numbers | --no-page-numbers]
```

Interactive artifacts remain ordinary Profile files and Template or Project
bundle directories, so either surface can consume artifacts created by the
other. Interactive Profile `formal-guide` defaults its reusable highlighting
setting to enabled. Direct Profile initialization, Interactive Profile
`starter`, and direct `to-pdf` rendering keep their existing default of
disabled. Direct render flags remain transient, and renderer precedence is
unchanged.

## Related Docs

- [Codex Timeouts, Retries, and Recovery](codex-timeouts-retries-and-recovery.md)
- [Markdown PDF Usage](markdown-pdf-usage.md)
- [Markdown PDF Codex Profile Helper](markdown-pdf-codex-profile-helper.md)
- [Markdown PDF Codex Template Helper](markdown-pdf-codex-template-helper.md)
- [Markdown PDF Codex Project Helper](markdown-pdf-codex-project-helper.md)

[^node-tmp]: [Node.js `os.tmpdir()` documentation](https://nodejs.org/api/os.html#ostmpdir)
