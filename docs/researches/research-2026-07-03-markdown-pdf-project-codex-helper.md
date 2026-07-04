---
title: "Markdown PDF Project Codex Helper"
created-date: 2026-07-03
modified-date: 2026-07-04
status: in-progress
agent: codex
---

## Goal

Define the `md pdf-project codex` helper as the `v0.1.5-canary.4`
orchestration layer between the completed direct Markdown PDF profile and
template Codex helpers.

The project helper should produce a reviewable folder that contains the accepted
rendering ingredients:

```text
md-pdf-project-YYYYMMDDTHHMMSSZ-xxxxxxxx/
  profile.yml
  template.html
  style.css
  assets/
    cover.png
  project.codex-report.json  # optional
```

The main product boundary is:

```text
pdf-profile owns reusable render policy.
pdf-template owns reviewable HTML/CSS and managed assets.
pdf-project owns coordination between those artifacts.
md to-pdf remains the deterministic renderer.
```

## Milestone Goal

`v0.1.5-canary.4` should not be tagged until `md pdf-project codex` is
implemented, verified, and documented, or until a separate release decision
records why it moved out of the canary.

After `v0.1.5-canary.4` is complete, the intended release path is to review and
release `v0.1.5` before starting Interactive Markdown PDF mode as the
`v0.1.6` or `v0.1.6-canary.*` feature track.

## Why This Research

The existing direct helpers are useful but intentionally split:

- `md pdf-profile codex` drafts a reusable profile YAML/JSON artifact.
- `md pdf-template codex` drafts a reviewable `template.html` and `style.css`
  bundle, plus managed local assets when needed.
- `md to-pdf` renders accepted artifacts deterministically.

That split is correct for direct CLI users who already understand the profile
and template boundary. It is still too much product surface for users who ask for
one coherent PDF direction and should not have to decide up front whether the
request belongs in a profile, a template, or both.

The project layer is the bridge:

```text
user request
  -> one project command
  -> profile.yml plus template.html/style.css plus assets
  -> deterministic md to-pdf render command
```

This layer should make the direct helper split easier to use without weakening
the ownership rules that made the direct helpers safe and reviewable.

## Starting State

Current Markdown PDF support includes:

- `md to-pdf` through Pandoc-generated HTML and WeasyPrint.
- `md pdf-profile init` for deterministic starter profiles.
- `md pdf-profile codex` for Codex-assisted reusable profiles.
- `md pdf-template init` for deterministic editable template/CSS snapshots.
- `md pdf-template codex` for Codex-assisted reviewable template bundles and
  managed local cover images.

The current public guide distinguishes profile and template ownership:

| Need | `md pdf-profile codex` | `md pdf-template codex` |
| --- | --- | --- |
| Output | Reusable profile YAML/JSON | Reviewable template bundle |
| Best owner | Page shape, ToC, page numbers, fonts, code-highlight settings | Cover images, custom layout, custom CSS, managed assets |
| ToC | Owns reusable ToC render settings: enabled, depth, page break | Preserves and styles Pandoc ToC hooks only |
| Code highlighting | Owns Shiki render settings | Owns Shiki-compatible CSS only |
| Cover/title page | Text/metadata cover fields only | Custom cover layout and composition |
| Cover image asset | Not supported; use the template helper | `--cover-image` local managed asset |
| Render with | `md to-pdf --profile ...` | `md to-pdf --template ... --css ...` |

`md pdf-template codex` already established the bundle-output posture that the
project helper should reuse:

- the command resolves both a `bundleId` and an `outputDirectory`
- generated default directories use `md-pdf-template-<timestamp>-<uid>/`
- explicit `--output <directory>` is respected as provided
- explicit output directories do not replace the generated `bundleId`
- default directories are not derived from the Markdown input filename
- default output is planned only after signal classification allows the command
  to proceed
- collision retries use a bounded UID loop
- generated files, copied assets, and default in-bundle reports stay inside the
  effective output directory

## Scope

This research covers:

- the `md pdf-project codex` command name and product boundary
- project bundle identity and default folder naming
- fixed file names inside the project folder
- how the project helper coordinates profile and template phases
- how the project helper respects the `md to-pdf` rendering pipeline
- signal classification and decision modes for the project layer
- optional diagnostic report shape and traceability
- implementation implications for reusing the existing direct helpers
- the guide-table direction to apply after implementation
- the release boundary between `v0.1.5-canary.4`, stable `v0.1.5`, and
  Interactive mode

This research does not implement:

- command registration
- Codex SDK calls
- profile schema changes
- template schema changes
- invoking `md to-pdf`
- Interactive Markdown PDF mode, which belongs to `v0.1.6` or
  `v0.1.6-canary.*`
- guide updates that would describe unshipped behavior as current usage

## Settled Direction

Use the command:

```bash
cdx-chores md pdf-project codex [input] [options]
```

The noun `pdf-project` is preferred because the durable artifact is a folder of
coordinated PDF render inputs. It avoids exposing the internal "hybrid" idea and
does not imply that the command renders the final PDF.

Draft command surface:

```bash
cdx-chores md pdf-project codex ./report.md \
  --intent "client report with cover image, ToC, readable code, and dense tables" \
  --font-hint "prefer Noto Serif CJK TC for Traditional Chinese body text" \
  --base-profile ./base-profile.yml \
  --cover-image ./cover.png \
  --output ./report-pdf-project \
  --keep-codex-report
```

The `v0.1.5-canary.4` command surface should stay close to the direct helpers:

| Option | Role |
| --- | --- |
| `[input]` | optional Markdown sample for shared document signals |
| `-i, --input <path>` | script-friendly alias for positional input |
| `--intent <text>` | general render, layout, and design direction |
| `--font-hint <text>` | repeatable font preference hint |
| `--base-profile <path>` | existing profile to refine or use as a compatibility target |
| `--cover-image <path>` | local PNG, JPEG, or WebP cover image passed to the template phase |
| `-o, --output <directory>` | project bundle output directory |
| `--dry-run` | preview project decisions and paths without writing artifacts |
| `--keep-codex-report` | write the project diagnostic report |
| `--codex-report-output <path>` | write the diagnostic report to an explicit JSON path |
| `--overwrite` | replace selected generated files when safe |

Do not add direct recipe flags to this public command surface. In particular,
`md pdf-project codex` should not accept `--preset`, `--page-size`,
`--orientation`, `--margin*`, `--toc`, `--toc-depth`, or `--toc-page-break` as
hidden or visible options. Detailed render control belongs to direct profile
inputs, deterministic init commands, or the later `md to-pdf` render command.

Do not add narrow style flags just to expose prompt-internal categories. General
direction stays in `--intent`; font preference stays in repeatable
`--font-hint`; local cover media uses explicit `--cover-image`.

## Project Bundle Output Model

`md pdf-project codex` should follow the bundle-output model used by
`md pdf-template codex`, not the single-file output model used by
`md pdf-profile codex`.

The command should always resolve both:

- `projectBundleId`, the generated project identity
- `outputDirectory`, the effective folder where project files are written

When `--output` is omitted and the command has enough signal to proceed,
`outputDirectory` should be generated from `projectBundleId`:

```text
md-pdf-project-YYYYMMDDTHHMMSSZ-xxxxxxxx/
```

When `--output <directory>` is provided, `outputDirectory` stays exactly
user-selected, while `projectBundleId` remains the generated project identity
used in identity comments and the optional report.

The timestamp and UID format for generated project bundle IDs should mirror
`md pdf-template codex`.

Rules:

- the helper always resolves a `projectBundleId`
- explicit `--output <directory>` stays exactly user-selected as
  `outputDirectory`
- omitted `--output` generates `md-pdf-project-<timestamp>-<uid>/` in the
  current working directory
- generated default names are not derived from the Markdown input stem
- generated defaults are planned only after signal classification allows the
  command to proceed
- generated defaults retry with a bounded UID loop on collision
- a non-empty output directory fails unless `--overwrite` is passed
- generated files, copied assets, and default in-bundle reports stay inside the
  effective `outputDirectory`
- `--codex-report-output <path>` must not collide with input Markdown, base
  profile, output directory, generated files, or managed asset source paths

The project helper should use fixed file names inside `outputDirectory`:

```text
profile.yml
template.html
style.css
assets/
project.codex-report.json
```

`profile.yml` should use the project-profile format even though the direct
profile helper can write YAML or JSON. The project bundle is optimized for
reviewable human artifacts, and a fixed YAML filename keeps follow-up render
commands predictable.

The project bundle identity should be distinct from the output directory. For
generated defaults, the folder name and `projectBundleId` match. For explicit
`--output`, they intentionally diverge.

Example generated identities:

```text
projectBundleId:  md-pdf-project-20260703T142501Z-a1b2c3d4
profile.id:       md-pdf-profile-20260703T142501Z-a1b2c3d4
templateBundleId: md-pdf-template-20260703T142501Z-a1b2c3d4
```

The implementation can create those identities from a shared timestamp and UID
suffix, while preserving the existing profile identity prefix and the template
bundle identity prefix. The project helper should not require a separate
`project.json` manifest unless implementation proves that identity comments and
the optional report are insufficient.

## Ownership Model

`md pdf-project codex` is not a third rendering owner. It is the coordinator that
keeps the direct owners aligned.

| Need | `md pdf-profile codex` | `md pdf-template codex` | `md pdf-project codex` |
| --- | --- | --- | --- |
| Output | Reusable profile YAML/JSON | Reviewable template bundle | Coordinated render project folder |
| Owns | Render policy | HTML/CSS/assets | Orchestration and coherence |
| ToC | Emits enabled/depth/page-break settings | Preserves and styles ToC hooks | Coordinates profile output with template hook validation |
| Code highlighting | Emits Shiki settings | Provides Shiki-compatible CSS | Coordinates profile output with CSS compatibility validation |
| Cover/title page | Emits text/metadata fields | Emits custom layout/composition | Persists compatible profile and template outputs together |
| Cover image asset | Not supported | Local managed asset | Routes asset input to the template phase and project `assets/` |
| Render with | `--profile` | `--template --css` | `--profile --template --css` |

Profile-owned decisions remain profile-owned even inside a project. Template-owned
decisions remain template-owned even when a final profile exists first.

## Orchestration Model

The project helper should collect shared inputs once, then run two artifact
phases before writing anything durable.

Recommended pipeline:

```text
Normalize command state
  |
  |-- resolve input, base profile, cover image, output, report paths
  |-- reject conflicting positional and --input paths
  |-- validate base profile and cover image before Codex
  |
  v
Collect shared signals
  |
  |-- document facts
  |-- intent and font hints
  |-- base profile summary
  |-- cover image metadata
  |-- font summaries and coverage warnings
  |
  v
Classify project signal mode
  |
  |-- too-low-signal
  |-- deterministic-base-profile
  |-- deterministic-cover-image
  |-- codex-assisted
  |
  v
Plan project output directory and fixed file paths
  |
  v
Profile phase
  |
  |-- create or adapt profile.yml
  |-- keep profile-only decisions in profile fields
  |-- preserve unmatched template-backed directions for template phase
  |
  v
Template phase
  |
  |-- use final profile.yml as the base-profile compatibility target
  |-- copy managed cover image into assets/ when present
  |-- synthesize template.html and style.css
  |-- call template Codex only when template-owned signals require it
  |
  v
Project validation
  |
  |-- profile parses and validates
  |-- template preserves later-render placeholders and hooks
  |-- CSS does not introduce unsafe references
  |-- copied assets and report paths stay inside allowed boundaries
  |-- follow-up md to-pdf command is well formed
  |
  v
Write artifacts or dry-run summary
```

The direct command actions should not be invoked as subprocess-like internal
steps. They print CLI summaries and write artifacts independently, which would
make project output harder to reason about. Instead, implementation should reuse
or extract shared service modules:

- template-Codex already has reusable modules under
  `src/cli/markdown-pdf/template-codex/`
- profile-Codex should gain a similar internal preflight/synthesis/write module
  before the project helper depends on it

## Signal Ladder

The project command always produces both a profile and a template bundle when it
succeeds. Signal handling should still avoid low-value empty projects.

| Inputs | Expected behavior |
| --- | --- |
| no input, no intent, no base profile, and no cover image | fail as too low-signal; recommend direct init commands |
| `--base-profile` only | deterministic project snapshot from the base profile and renderer defaults |
| `--cover-image` only | deterministic default profile plus `cover-media-layered` template with copied asset |
| Markdown input and/or `--intent` | profile Codex decision; template Codex only when template-owned directions are present |
| profile-Codex unmatched template directions | forward into the template phase as escalation signals |

Template-owned directions include local cover media, custom cover composition,
custom HTML/CSS layout, exact table styling, section or chapter treatment,
brand-like visual styling, and unsupported profile directions.

If the user supplies general render policy such as page shape, ToC, page
numbers, fonts, code highlighting, or text cover fields, the project helper
should prefer the profile phase and then synthesize a deterministic
`document-layered` template that preserves the hooks needed by `md to-pdf`.

## Decision Modes

The project layer should report a project-level decision mode derived from the
profile and template phases.

| Mode | Meaning | Write behavior | Exit |
| --- | --- | --- | --- |
| `deterministic` | no Codex was needed for either phase | write project unless `--dry-run` | 0 |
| `adapted` | at least one phase used a valid Codex decision | write project unless `--dry-run` | 0 |
| `conservative-fallback` | at least one phase reduced scope but still produced valid artifacts | write project unless `--dry-run` | 0 |
| `no-usable-project` | profile or template phase failed validation or Codex returned no usable path | write no project artifacts; write requested failure report only | 1 |

The project helper should avoid partial successful writes. Normal execution
should preflight both phases, validate both artifact sets, and only then write
the project files. If a failure report is explicitly requested, that report may
be written without writing `profile.yml`, `template.html`, `style.css`, or
copied assets.

`--dry-run` should run signal collection, Codex selection when needed, synthesis,
and validation, then print planned paths and decisions without writing project
artifacts. If `--dry-run --keep-codex-report` or `--codex-report-output` is
provided, the command may write only the diagnostic report.

## Render Pipeline Contract

`md pdf-project codex` should write reviewable render inputs and print the
deterministic follow-up command:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./md-pdf-project-20260703T142501Z-a1b2c3d4/profile.yml \
  --template ./md-pdf-project-20260703T142501Z-a1b2c3d4/template.html \
  --css ./md-pdf-project-20260703T142501Z-a1b2c3d4/style.css \
  --output ./report.pdf
```

The project helper must respect the current `md to-pdf` precedence model:

```text
profile recipe fields
  -> explicit md to-pdf recipe flags
  -> generated internal recipe
       -> --template replaces generated template HTML
       -> default CSS remains enabled
       -> --css applies after default CSS
```

Default `v0.1.5-canary.4` project rendering should use layered CSS. The
profile-derived default CSS stays enabled, and `style.css` applies after it.
This lets profile-owned page chrome, fonts, cover defaults, and Shiki hooks
remain active while allowing the project stylesheet to override only the
template-backed decisions it owns.

Self-contained rendering with `--no-default-css` should remain an advanced future
posture. The project artifacts should not claim to own every page chrome, font,
cover, and code-block rule needed for a no-default-CSS render unless a later
phase explicitly adds that contract.

Render-specific implications:

- ToC is enabled, disabled, and configured by `profile.yml`; `template.html`
  must preserve the Pandoc ToC region and `style.css` may style it.
- Shiki highlighting is enabled by `profile.yml` or render-time
  `--code-highlight`; `style.css` may provide compatible `.cdx-code*` styling.
- Local cover images belong in `assets/` and are referenced from the generated
  template/CSS by bundle-relative paths.
- Profile text cover fields remain valid only when the generated template honors
  the corresponding hooks.
- Template/CSS is the stronger visual layer at render time, so project validation
  must check that template decisions do not silently defeat required profile
  hooks.

## Diagnostic Report

The default report path should be:

```text
project.codex-report.json
```

inside `outputDirectory` when `--keep-codex-report` is passed. An explicit
`--codex-report-output <path>` can place the report elsewhere, but must use a
`.json` path and pass the same collision checks used by the direct helpers.

The report should include:

- artifact type, such as `markdown-pdf-codex-project-report`
- `projectBundleId`, `profile.id`, and `templateBundleId`
- project output directory as a displayed path
- selected file paths as project-relative paths
- input and base-profile summaries
- intent and font hints
- cover-image metadata with source directories redacted
- profile phase signal mode and decision mode
- template phase signal mode and decision mode
- final project decision mode
- unsupported directions and fallback reasons
- validation results
- follow-up `md to-pdf` command

Persisted reports and generated artifacts should avoid raw absolute source paths
by default. Bundle-relative paths, source basenames, source labels such as
`--cover-image`, file formats, dimensions, and displayed non-persistent terminal
paths remain acceptable.

## Implementation Implications

The implementation should start with extraction rather than a new monolithic
action:

1. Extract profile-Codex preflight, synthesis, report, and write helpers from the
   direct action into a module comparable to `template-codex`.
2. Keep the existing `md pdf-profile codex` behavior unchanged by routing the
   action through the extracted service.
3. Build `md pdf-project codex` on top of the extracted profile service and the
   existing template-Codex service.
4. Add project-level output planning, collision checks, summary printing, and
   report writing.
5. Add tests for generated bundle-directory naming, fixed file paths, no partial
   writes, signal ladder behavior, phase decision composition, and render-command
   compatibility.

Validation should include at least:

- `bun test` coverage for project output planning and path collisions
- focused action tests for deterministic base-profile-only and cover-image-only
  paths
- focused Codex-runner tests for profile-assisted and template-assisted paths
- render-command compatibility tests that assert the project output feeds
  `md to-pdf --profile --template --css`
- `git diff --check`

## Guide Direction After Implementation

After the command is implemented and verified for `v0.1.5-canary.4`, the public
guide table can grow from two columns to three:

| Need | `md pdf-profile codex` | `md pdf-template codex` | `md pdf-project codex` |
| --- | --- | --- | --- |
| Output | Reusable profile YAML/JSON | Reviewable template bundle | Coordinated project folder |
| Best owner | Page shape, ToC, page numbers, fonts, code-highlight settings | Cover images, custom layout, custom CSS, managed assets | End-to-end profile/template coordination |
| ToC | Owns reusable ToC render settings | Preserves and styles Pandoc ToC hooks only | Coordinates profile ToC output with template hook validation |
| Code highlighting | Owns Shiki render settings | Owns Shiki-compatible CSS only | Coordinates profile highlighting output with CSS compatibility validation |
| Cover/title page | Text/metadata cover fields only | Custom cover layout and composition | Persists compatible profile and template cover outputs together |
| Cover image asset | Not supported; use the template helper | `--cover-image` local managed asset | Routes `--cover-image` into template-managed project `assets/` |
| Render with | `md to-pdf --profile ...` | `md to-pdf --template ... --css ...` | `md to-pdf --profile ... --template ... --css ...` |

The guide should not describe `md pdf-project codex` as current user-facing
behavior until implementation and verification records exist.

## Release Boundary

`md pdf-project codex` is not deferred. It is the current Markdown PDF Codex
target for `v0.1.5-canary.4`.

The intended sequence is:

| Milestone | Target | Status |
| --- | --- | --- |
| Profile helper | `v0.1.5-canary.2` | completed |
| Template helper | `v0.1.5-canary.3` | completed |
| PDF project helper | `v0.1.5-canary.4` | current target |
| Stable release review | `v0.1.5` | after canary.4 is complete |
| Interactive Markdown PDF mode | `v0.1.6` or `v0.1.6-canary.*` | next feature track |

Interactive mode should reuse the accepted direct and project contracts after
the `v0.1.5` stable release review. It should not be a blocker for
`v0.1.5-canary.4` or `v0.1.5`.

## Command Pattern To Preserve

The project helper should follow the split already used by `md pdf-profile
codex`, `md pdf-template codex`, deterministic init commands, and `md to-pdf`.
Codex helpers draft reviewable artifacts first. `md to-pdf` renders accepted
artifacts later.

This keeps the command surfaces clear:

- `md to-pdf` owns render-time inputs and overrides such as `--profile`,
  `--template`, `--css`, `--output`, `--html-output`, default CSS, remote asset
  policy, code highlighting, and recipe override flags.
- `md pdf-profile init` and `md pdf-template init` can expose direct recipe
  controls because they write deterministic starter artifacts.
- Codex helpers stay bounded to semantic signals and artifact controls:
  `[input]` or `--input`, `--intent`, repeatable `--font-hint`,
  `--base-profile`, owned local asset inputs such as `--cover-image`,
  `--output`, `--dry-run`, diagnostic report paths, and `--overwrite`.
- Recipe flags such as `--preset`, `--page-size`, `--orientation`, `--margin*`,
  `--toc`, `--toc-depth`, and `--toc-page-break` should stay off Codex helper
  command surfaces and should continue to fail as unknown options rather than
  becoming hidden pass-throughs.

## Settled Implementation Guidance

The remaining implementation guidance is settled for the
`v0.1.5-canary.4` project-helper scope.

### Project Metadata

Do not make `project.json` mandatory. Fixed project filenames,
`projectBundleId`, `profile.id`, `templateBundleId`, identity comments, and the
optional `project.codex-report.json` are enough for this milestone.

Add a manifest only after a concrete runtime feature needs one, such as project
replay, project listing, or a future apply command. `md to-pdf` consumes
`profile.yml`, `template.html`, and `style.css` directly, so a mandatory manifest
would add a second project contract without improving the current follow-up
render command.

### Profile Service Extraction

Extract profile-Codex preflight, signal collection, synthesis, validation,
report shaping, and write planning into a reusable service before implementing
the project helper. Route the existing `md pdf-profile codex` action through
that service first, then compose the project helper from the profile service and
the existing template-Codex service.

The project helper should not invoke direct CLI actions as subprocess-like
steps. Direct actions print summaries and write their own artifacts, which would
make no-partial-write project behavior harder to enforce.

### Project Report Shape

Use one project-level report schema with summarized phase decisions by default.
Include phase detail blocks only for data the project command already needs to
explain validation, fallback, unsupported directions, or render-command
compatibility. Do not embed full direct reports verbatim.

A normalized report keeps the project artifact readable and privacy-safe while
still preserving traceability. Persisted report paths should remain
project-relative where possible and should avoid raw absolute source paths by
default.

## Recommendations

1. Use `md pdf-project codex` for the orchestration layer.
2. Use `md-pdf-project-<timestamp>-<uid>/` as the generated default output
   directory.
3. Always write `profile.yml`, `template.html`, and `style.css` on successful
   normal execution; create `assets/` only when managed assets exist.
4. Keep `project.codex-report.json` optional and in-bundle by default.
5. Reuse a shared UID suffix across `projectBundleId`, `profile.id`, and
   `templateBundleId`.
6. Keep direct ownership stable: profile for render policy, template for
   HTML/CSS/assets, project for orchestration.
7. Keep `md to-pdf` deterministic and separate; project output should print a
   follow-up render command.
8. Extract profile-Codex internals into a reusable service before implementing
   the project helper.
9. Keep Interactive Markdown PDF mode out of the `v0.1.5-canary.4` scope.
10. Update guide docs only after the project command is implemented and verified.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown PDF Interactive Mode](research-2026-07-03-markdown-pdf-interactive-mode.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Markdown PDF Shiki Code Highlighting](research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Plans

- [Markdown PDF Codex profile helper implementation](../plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
- [Markdown PDF template Codex helper implementation](../plans/plan-2026-06-23-markdown-pdf-template-codex-helper.md)
