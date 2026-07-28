---
title: "Markdown PDF Codex Project Helper"
created-date: 2026-07-05
modified-date: 2026-07-28
status: completed
agent: codex
---

## Goal

Document the direct `md pdf-project codex` helper for drafting one coordinated
Markdown PDF project folder from shared document signals, intent, font hints,
base profiles, and local cover-image signals.

This guide covers the direct project helper only. For guided Project bundle
preparation, temporary or durable rendering, and saved-recipe handoff, see
[Interactive Markdown PDF Usage](markdown-pdf-interactive-usage.md).

## Command Shape

```bash
cdx-chores md pdf-project codex [input] [options]
```

Common options:

- `[input]`: Markdown sample for shared project signals.
- `-i, --input <path>`: same as the positional input, useful in scripts.
- `--intent <text>`: project render, layout, and design direction.
- `--font-hint <text>`: repeatable font preference hint for the same project
  request.
- `--base-profile <path>`: existing Markdown PDF profile to refine or target.
- `--cover-image <path>`: local PNG, JPEG, or WebP cover image.
- `-o, --output <directory>`: output project bundle directory.
- `--dry-run`: preview signal collection, phase decisions, synthesis, and
  validation without writing project bundle files.
- `--keep-codex-report`: write a diagnostic project Codex report.
- `--codex-report-output <path>`: explicit diagnostic report JSON path.
- `--overwrite`: allow selected project-generated outputs to be replaced when
  safe.

Example:

```bash
cdx-chores md pdf-project codex ./report.md \
  --intent "client report with a cover image, table of contents, readable code, and dense tables" \
  --cover-image ./cover.jpg \
  --output ./report-pdf-project \
  --keep-codex-report
```

## Generated Project

The helper writes a directory rather than a PDF:

```text
report-pdf-project/
  profile.yml
  template.html
  style.css
  assets/
    cover.jpg
  project.codex-report.json
```

`profile.yml` is the reusable render policy. `template.html` and `style.css`
are the reviewable template layer. `assets/` is created only when managed local
assets are needed. `project.codex-report.json` is written only when requested.

When `--output` is omitted, the helper creates a non-colliding default directory
with this shape:

```text
md-pdf-project-YYYYMMDDTHHMMSSZ-xxxxxxxx/
```

The generated name intentionally does not repeat the Markdown input filename.
Pass `--output` when the bundle needs a project-specific directory name.

## Render Boundary

`md pdf-project codex` does not render the final PDF automatically. It prints a
deterministic follow-up render command and writes the accepted render inputs.
Because all three artifacts share the generated project directory, the printed
command uses the optional `--bundle` discovery form:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-pdf-project \
  --output ./report.pdf
```

Once the project folder is written, `md to-pdf` does not need Codex.

The same project can be rendered by selecting each input directly:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-pdf-project/profile.yml \
  --template ./report-pdf-project/template.html \
  --css ./report-pdf-project/style.css \
  --output ./report.pdf
```

Both forms use the same renderer and input precedence. `--profile`,
`--template`, and `--css` remain fully supported for precise selection,
cross-directory composition, and role-specific troubleshooting.

By default, the follow-up render uses layered CSS: the profile-derived default
stylesheet stays enabled and the project `style.css` is applied after it. This
keeps the normal cascade available for deliberate user styling. Generated
Project CSS omits competing families for Profile-owned document font slots
while retaining Template-owned layout and cover typography. Reusable font
choices belong to the final `profile.yml`; Project validation recomputes that
ownership boundary from the final Profile and rejects a generated stylesheet
that bypasses it. Profile-owned page chrome, cover defaults, and Shiki hooks
remain active through their existing boundaries.

## Ownership Model

`md pdf-project codex` coordinates the direct helpers without becoming a third
rendering owner.

| Need | `md pdf-profile codex` | `md pdf-template codex` | `md pdf-project codex` |
| --- | --- | --- | --- |
| Output | Reusable profile YAML/JSON | Reviewable template bundle | Coordinated render project folder |
| Owns | Render policy | HTML/CSS/assets | Orchestration and coherence |
| ToC | Emits enabled/depth/page-break settings | Preserves and styles ToC hooks | Coordinates profile output with template hook validation |
| Code highlighting | Emits Shiki settings | Provides Shiki-compatible CSS | Coordinates profile output with CSS compatibility validation |
| Cover/title page | Emits text/metadata fields | Emits custom layout/composition | Persists compatible profile and template outputs together |
| Cover image asset | Not supported | Local managed asset | Routes asset input to project `assets/` through the template phase |
| Render with | `--profile <file>` or profile-only `--bundle <directory>` | `--bundle <directory>` or explicit `--template --css` | `--bundle <directory>` or explicit `--profile --template --css` |

`--bundle` is optional discovery shorthand only. It does not change which
helper owns the selected profile, template, stylesheet, or managed assets. The
direct options remain authoritative when combined with `--bundle`, allowing a
specific role to be selected explicitly while the remaining roles are
discovered from the directory.

Use `md pdf-profile codex` first when the main goal is reusable typography, page
shape, ToC, page numbers, page chrome, or Shiki code-highlight settings. Use
`md pdf-template codex` when the main goal is a reusable HTML/CSS bundle or
cover-image layout. Use `md pdf-project codex` when one request needs both
owners to stay compatible.

## Signal Behavior

The project helper collects shared inputs once, then runs profile-first
orchestration followed by template synthesis against the final profile contract.

Useful inputs include:

- Markdown document facts from `[input]` or `--input`.
- General direction from `--intent`.
- Repeatable `--font-hint` values.
- A compatibility target from `--base-profile`.
- A local managed cover asset from `--cover-image`.

Low-signal runs with none of those inputs fail before writing a project. Use
`md pdf-profile init` or `md pdf-template init` when you want deterministic blank
starter artifacts.

`--font-hint` is repeatable. Use one flag per distinct font preference:

```bash
cdx-chores md pdf-project codex ./multilingual-notes.md \
  --intent "mixed-language notes with readable body text and code symbols" \
  --font-hint "use Source Serif 4 for English body text" \
  --font-hint "use Noto Serif JP for Japanese body text" \
  --font-hint "use Noto Serif TC for Traditional Chinese body text" \
  --font-hint "use JetBrains Mono for code" \
  --output ./multilingual-pdf-project
```

Accepted reusable font hints are persisted in the generated `profile.yml`.
The coordinated Template phase then treats those Profile slots as owned, so
generated `style.css` omits competing document families. The Project bundle
therefore carries reusable font policy in its Profile and presentation-only
Template CSS beside it.

Recipe flags such as `--preset`, `--page-size`, `--orientation`, `--margin*`,
`--toc`, `--toc-depth`, and `--toc-page-break` are not part of the project Codex
helper surface. Use direct profile/init flows or the final `md to-pdf` render
command for exact recipe controls.

## Preview And Diagnostics

Use `--dry-run` to preview project signal collection, phase decisions, synthesis,
validation, and planned paths without writing project bundle files:

```bash
cdx-chores md pdf-project codex ./report.md \
  --intent "board report with table of contents and readable code" \
  --dry-run
```

Keep a diagnostic report when you need review evidence:

```bash
cdx-chores md pdf-project codex ./report.md \
  --intent "client report with cover image and readable code" \
  --cover-image ./cover.jpg \
  --output ./report-pdf-project \
  --keep-codex-report
```

The report records bounded request facts, phase decisions, validation results,
unsupported directions, managed asset metadata, and the follow-up render command.
It is advisory; the replayable rendering inputs are `profile.yml`,
`template.html`, and `style.css`.

Persisted reports and generated artifacts avoid raw absolute source paths.
Managed cover assets are copied into the project folder and reported by
bundle-relative paths plus source basenames and metadata.

## Related Docs

- [Interactive Markdown PDF Usage](markdown-pdf-interactive-usage.md)
- [Markdown PDF Usage](markdown-pdf-usage.md)
- [Markdown PDF Project Codex Helper Research](../researches/research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF project Codex helper implementation plan](../plans/plan-2026-07-04-markdown-pdf-project-codex-helper.md)
- [Phase 9 integration coverage and render compatibility](../plans/jobs/2026-07-05-markdown-pdf-project-codex-phase-9-integration-coverage-render-compatibility.md)
- [Phase 10 docs validation and closeout](../plans/jobs/2026-07-05-markdown-pdf-project-codex-phase-10-docs-validation-closeout.md)
