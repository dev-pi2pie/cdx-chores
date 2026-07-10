---
title: "Markdown PDF Render Bundle Directory"
created-date: 2026-07-10
modified-date: 2026-07-10
status: completed
agent: codex
---

## Goal

Define a bounded `md to-pdf --bundle <directory>` input-discovery contract for
rendering from a directory that contains one or more accepted Markdown PDF
artifacts.

The flag should shorten deterministic render commands without changing artifact
ownership:

- profiles still own reusable render policy
- templates and stylesheets still own HTML/CSS presentation
- project folders still coordinate compatible artifacts
- `md to-pdf` still owns rendering and render-time overrides

This research is `completed`. The linked implementation plan and phase records
provide the implementation, validation, live-smoke, documentation, and review
evidence needed to support its settled conclusions.

## Starting State

`md to-pdf` currently accepts profile, template, and stylesheet paths
individually:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-pdf-project/profile.yml \
  --template ./report-pdf-project/template.html \
  --css ./report-pdf-project/style.css \
  --output ./report.pdf
```

`md pdf-project codex` writes those three accepted inputs into one project
folder. `md pdf-template init` and `md pdf-template codex` write partial bundles
containing `template.html`, `style.css`, and optional managed assets.

The renderer can already consume all of these artifacts. The missing behavior
is a concise way to discover the available render inputs from their shared
directory.

## Scope

This research covers:

- the `--bundle <directory>` option on `md to-pdf`
- partial and complete bundle behavior
- top-level artifact discovery
- profile-pattern admission before candidate counting
- conflict detection and explicit disambiguation
- interaction with existing `--profile`, `--template`, and `--css` options
- validation, failure, and user-facing summary behavior

This research does not add:

- a new artifact owner or helper command
- automatic rendering inside a Codex helper
- recursive directory discovery
- a required bundle manifest
- Markdown input or PDF output discovery
- multiple templates, profiles, or stylesheets in one render
- changes to the existing render-time recipe precedence
- Interactive Markdown PDF behavior

## Settled Direction

Add the option to `md to-pdf`:

```text
--bundle <directory>  Discover Markdown PDF render inputs from a directory
```

The common project render becomes:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-pdf-project \
  --output ./report.pdf
```

`--bundle` is an input shorthand. After discovery and conflict resolution, the
renderer should use the same internal profile, template, and CSS paths that the
existing explicit options provide.

## Partial Bundle Model

A bundle needs at least one discoverable render artifact. It does not need to
contain all three roles.

Profile-only bundle:

```text
report-policy/
  report-profile.yml
```

Template-only bundle:

```text
report-template/
  template.html
```

Stylesheet-only bundle:

```text
report-styles/
  print.css
```

Template and stylesheet bundle:

```text
report-template/
  template.html
  style.css
  assets/
    cover.jpg
```

Complete project bundle:

```text
report-pdf-project/
  profile.yml
  template.html
  style.css
  assets/
    cover.jpg
  project.codex-report.json
```

All five shapes are valid when each unresolved role has no more than one
candidate.

## Discovery Boundary

Discovery should inspect only regular file entries directly inside the selected
directory.

| Role       | Top-level candidate rule                                           |
| ---------- | ------------------------------------------------------------------ |
| Profile    | `.yml`, `.yaml`, or `.json` that passes the profile admission gate |
| Template   | `.html`                                                            |
| Stylesheet | `.css`                                                             |

Discovery should not descend into `assets/` or any other subdirectory. Managed
assets remain reachable through bundle-relative references from the selected
template or stylesheet.

Codex report JSON should be excluded through both the generated filename
contracts and the persisted report discriminators:

- filenames ending in `-codex-report.json` or `.codex-report.json`
- profile reports with
  `artifact.type: markdown-pdf-codex-profile-report`
- template reports with
  `artifactType: markdown-pdf-codex-template-report`
- project reports with
  `artifactType: markdown-pdf-codex-project-report`

Payload discrimination covers a report written through an explicit
`--codex-report-output` path whose filename does not follow a generated naming
pattern. Discovery needs only the bounded top-level discriminator needed for
classification; the report's full schema remains owned by its existing report
reader.

A malformed JSON file whose name matches a reserved report pattern should stay
excluded from profile discovery. Other YAML and JSON files should not become
profile candidates by extension alone; they should first pass the profile
admission gate defined below.

An empty directory or a directory with no recognized render artifacts should
fail before Pandoc or WeasyPrint is invoked.

## Reinforced Profile Admission

The initial implementation routes every non-report `.yml`, `.yaml`, or `.json`
file directly into profile candidate counting:

```text
Potential profile-extension file
          |
          v
       Is JSON?
      | no      | yes
      v         v
   Profile    JSON report?
  candidate     | yes     | no
      |         v         v
      |       Ignore   Profile candidate
      |                     |
      +----------+----------+
                 |
                 v
         Candidate counting
                 |
                 v
        Selected-file parsing
```

This is deterministic, but unrelated JSON can create a false profile conflict
before the existing profile parser gets a chance to reject it. The reinforced
flow should separate artifact routing from profile admission.

### Step 1: Bundle Artifact Routing

```text
Top-level regular file
          |
          v
     File extension
          |
   +------+------+-------------+
   |             |             |
.html          .css      .yml/.yaml/.json
   |             |             |
   v             v             v
Template      CSS       JSON report check
candidate   candidate      when applicable
                              |
                       +------+------+
                       |             |
                    report       not report
                       |             |
                       v             v
                     Ignore    Profile admission
                                     gate
```

The report check applies only to JSON. YAML proceeds directly to profile
admission. A recognized Markdown PDF report is expected bundle content and is
ignored without a warning.

### Step 2: Profile Admission Gate

```text
Potential profile file
          |
          v
 Parse as plain object
          |
     +----+----+
     |         |
   fail       pass
     |         |
     v         v
Unclassified  Profile root
              pattern matches?
                  |
             +----+----+
             |         |
            no        yes
             |         |
             v         v
      Unclassified  Validate shape
                    and normalize
                         |
                    +----+----+
                    |         |
                  fail       pass
                    |         |
                    v         v
              Invalid profile  Admit as
                   error       candidate
                                   |
                                   v
                            Candidate counting
```

A file matches the discoverable profile pattern when it is a non-empty plain
object, contains at least one recognized Markdown PDF profile root key, and
contains no root key outside that namespace. Shape validation and semantic
normalization remain the final admission checks. This reuses the existing
profile contract and does not introduce a new profile schema.

Automatic discovery intentionally has a higher confidence threshold than an
explicit `--profile <path>`. An explicitly selected empty profile can retain
its existing behavior, while an empty `{}` file does not automatically become
a discovered profile candidate.

Classification behavior should be:

| Classification                              | Bundle behavior                         |
| ------------------------------------------- | --------------------------------------- |
| Recognized Markdown PDF report              | Ignore without warning                  |
| Valid discoverable profile                  | Admit as a profile candidate            |
| Parsed non-profile YAML or JSON             | Ignore with one aggregated warning      |
| Malformed potential profile                 | Ignore with the same aggregated warning |
| Profile-pattern match that fails validation | Fail as an invalid profile              |
| Multiple admitted profiles                  | Use the existing ambiguity error        |

When ignored files coexist with another admitted render artifact, print one
concise warning that lists their stable sorted basenames. When no render
artifact is admitted, enrich the existing no-artifacts error with the ignored
filenames instead of emitting a warning followed by a separate error.

This permits a profile and any recognized Markdown PDF report to coexist
without a conflict or warning. It also permits data artifacts whose root keys
fall outside the profile namespace to coexist with a profile: they are not
profile candidates, but their ignored status remains visible. A generic object
that independently satisfies the discoverable profile contract remains a
profile candidate because content alone cannot prove another intended role.
The classifier should not import a registry of every artifact type owned by the
`data` or `rename` command families.

## Conflict Contract

Automatic discovery must not guess when an unresolved role has more than one
candidate.

For example:

```text
report-bundle/
  compact.html
  detailed.html
  style.css
```

This command is ambiguous:

```bash
cdx-chores md to-pdf --input ./report.md --bundle ./report-bundle
```

It should fail before rendering with a stable, actionable error:

```text
Ambiguous Markdown PDF bundle: ./report-bundle

Multiple template candidates were found:
- compact.html
- detailed.html

Select one with --template <path>, or remove the extra candidate.
```

Conflict rules:

- sort candidate names for stable output
- report every ambiguous unresolved role in one error when practical
- identify the resolving flag for each role
- do not select by filename order, modification time, or canonical-looking name
- do not write the PDF or intermediate HTML after a bundle conflict
- use the normal invalid-input exit behavior for CLI ambiguity

The same rule applies to multiple profile or stylesheet candidates.

## Explicit Disambiguation

Existing explicit artifact options should select their role before bundle
discovery. `--bundle` should then discover only roles that remain unspecified.

Given:

```text
report-bundle/
  profile-a.yml
  profile-b.yml
  template.html
  light.css
  print.css
```

This command is deterministic:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-bundle \
  --profile ./report-bundle/profile-b.yml \
  --css ./report-bundle/print.css \
  --output ./report.pdf
```

The explicit flags select the profile and stylesheet. Bundle discovery supplies
the only template candidate.

An explicit path may remain outside the bundle directory because the existing
options already support composing artifacts from different locations:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-template \
  --profile ./profiles/report.yml \
  --output ./report.pdf
```

The directory must contain at least one recognized candidate before explicit
role selection is applied. It does not need to contribute a still-unresolved
role. This allows an explicit option to resolve the only ambiguous role in a
bundle, including a directory that contains two templates and no profile or
stylesheet.

## Resolution And Render Precedence

Path resolution should happen in this order:

```text
explicit --profile / --template / --css
  -> bundle discovery for unspecified roles
  -> role-specific file validation
  -> existing profile normalization and recipe resolution
  -> existing explicit render-time recipe overrides
  -> deterministic render
```

The flag does not change current render precedence:

- direct layout and ToC flags still override matching profile fields
- a selected custom template still replaces generated template HTML
- selected custom CSS still applies after generated CSS
- `--no-default-css` still disables generated CSS
- `--code-highlight` and `--no-code-highlight` keep their existing behavior

## Successful Resolution Summary

Because `--bundle` performs automatic discovery, the command should print a
concise resolved-input summary before invoking external render tools:

```text
Resolved Markdown PDF bundle: ./report-pdf-project
- profile: profile.yml
- template: template.html
- css: style.css
```

Omit absent roles. Mark explicitly selected roles only when that distinction is
useful for explaining a mixed bundle/explicit command. Keep displayed paths
user-facing and avoid persisting machine-specific absolute paths.

## Validation And Safety

Bundle discovery should reuse existing file and render validation rather than
creating a weaker parallel path.

The implementation should verify:

- `--bundle` resolves to an existing readable directory
- discovered entries are top-level regular files
- every unresolved role has zero or one candidate
- the bundle contains at least one recognized candidate before explicit role
  selection
- the selected profile parses and validates normally
- selected template and CSS files pass their current render checks
- template-relative managed asset behavior remains unchanged
- output and intermediate HTML collision checks still run before rendering

Bundle discovery should finish before checking for Pandoc and WeasyPrint so
invalid or ambiguous local inputs fail without unnecessary dependency probes.

## Command And Documentation Impact

The explicit render form remains supported for scripting, composition, and
troubleshooting:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./project/profile.yml \
  --template ./project/template.html \
  --css ./project/style.css
```

After implementation, the shorter form should become the primary documented
project-folder example:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./project
```

The helper comparison can then describe rendering as:

| Helper output   | Render input                                                    |
| --------------- | --------------------------------------------------------------- |
| Profile file    | `--profile <file>` or a profile-only `--bundle <directory>`     |
| Template bundle | `--bundle <directory>` or explicit `--template --css`           |
| Project bundle  | `--bundle <directory>` or explicit `--profile --template --css` |

`md pdf-project codex` may print the shorter follow-up command after this render
contract is implemented. Existing explicit follow-up commands remain valid.

## Verification Direction

An implementation plan should cover:

- command wiring and help output for `--bundle <directory>`
- one test for each single-role bundle
- partial and complete bundle resolution tests
- report JSON exclusion tests
- profile admission tests for valid, invalid, empty, malformed, and unrelated
  YAML or JSON
- coexistence tests for a profile with report JSON and unrelated data JSON
- missing, empty, and non-directory bundle failures
- multiple-candidate failures for every role
- stable multi-role conflict reporting
- explicit per-role disambiguation
- mixed external explicit paths plus bundle discovery
- conflicts fully resolved by explicit role selection, including a bundle that
  has candidates for only that role
- unchanged profile and render-time override precedence
- template-relative managed asset rendering
- no PDF or intermediate HTML writes after discovery failure
- `git diff --check`, lint, format, build, and focused/full test validation

## Recommendations

1. Add `--bundle <directory>` only to `md to-pdf`.
2. Treat one discovered profile, template, or stylesheet as a valid partial
   bundle.
3. Discover top-level render artifacts only.
4. Fail instead of guessing when an unresolved role has multiple candidates.
5. Use existing explicit artifact options to disambiguate individual roles.
6. Keep the current explicit render form supported.
7. Reuse existing validation, precedence, asset, and output-safety behavior.
8. Admit discovered profiles by parsed profile pattern and existing validation,
   not by extension alone.
9. Warn once for ignored unclassified YAML or JSON without treating recognized
   Markdown PDF reports as warning-worthy content.
10. Do not require a manifest unless a later runtime feature demonstrates that
    filename discovery and explicit disambiguation are insufficient.

## Implementation Evidence

The settled direction was implemented and verified through the linked plan.
The key completion records are:

- [Phase 4 renderer integration](../plans/jobs/2026-07-10-markdown-pdf-render-bundle-phase-4-render-integration.md)
- [Phase 5 profile admission](../plans/jobs/2026-07-10-markdown-pdf-render-bundle-phase-5-profile-admission.md)
- [Phase 6 helper adoption](../plans/jobs/2026-07-10-markdown-pdf-render-bundle-phase-6-helper-adoption.md)
- [Phase 7 documentation and closeout](../plans/jobs/2026-07-10-markdown-pdf-render-bundle-phase-7-docs-closeout.md)

## Related Plans

- [Markdown PDF render bundle directory implementation](../plans/plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown PDF Project Codex Helper](research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Interactive Mode](research-2026-07-03-markdown-pdf-interactive-mode.md)

## Related Guides

- [Markdown PDF Usage](../guides/markdown-pdf-usage.md)
- [Markdown PDF Codex Profile Helper](../guides/markdown-pdf-codex-profile-helper.md)
- [Markdown PDF Codex Template Helper](../guides/markdown-pdf-codex-template-helper.md)
- [Markdown PDF Codex Project Helper](../guides/markdown-pdf-codex-project-helper.md)
