---
title: "Markdown PDF render bundle Phase 6 helper adoption"
created-date: 2026-07-10
status: completed
agent: codex
plan: ../plan-2026-07-10-markdown-pdf-render-bundle-directory.md
---

## Scope

Implement Phase 6 of the `md to-pdf --bundle` plan by updating template and
project Codex helper follow-up commands to use their generated output directory
as one bundle input.

This phase preserves profile-helper ownership, explicit profile/template/CSS
rendering, no-usable decision behavior, report shapes, and privacy-safe path
display. Public guide updates remain owned by Phase 7.

Starting commit: `2fcff90`.

## Baseline Audit

Before implementation, helper follow-up command ownership was:

- template summary: explicit generated template and stylesheet paths
- template report: `<template-bundle>/template.html` and
  `<template-bundle>/style.css` placeholders
- project summary and report: structured explicit profile, template, and
  stylesheet paths derived from the project output directory
- profile helper: one generated profile file with no directory follow-up command

The affected expectations were concentrated in template summary/report tests,
project render-command and report tests, command-layer summary tests, and the
existing explicit helper-output render integration tests.

## Implementation Notes

- Added one template follow-up render-command builder shared by terminal
  summaries and advisory reports.
- Updated template summaries to render the actual output directory through
  `--bundle`.
- Updated template reports to use the privacy-safe `<template-bundle>`
  placeholder with `--bundle`.
- Updated project render-command generation to use the public project output
  directory through `--bundle`.
- Preserved the structured project report command shape with `executable`,
  `args`, and `display` fields.
- Preserved project path redaction, shell quoting, and Windows-style path
  normalization behavior.
- Kept no-usable template and project decisions from generating follow-up
  render commands.
- Left the profile helper implementation unchanged because it owns one profile
  file rather than a bundle directory.

## Tests

- Covered template summary output using the actual bundle directory without
  explicit template or stylesheet flags.
- Covered template report output using `--bundle '<template-bundle>'` without
  individual bundle artifact paths.
- Covered quoted input aliases and privacy-safe report placeholders.
- Covered project summary and structured report commands using one project
  bundle argument.
- Covered external project directories falling back to `<project-bundle>`.
- Covered project directory quoting and Windows-style relative path display.
- Preserved no-usable decisions without follow-up commands.
- Rendered generated template and project helper outputs through both bundle and
  explicit forms and compared their effective templates, stylesheets, HTML, and
  PDF output.
- Ran the existing profile-Codex action suite without changing the profile
  helper contract.

## Live Smoke

Live smoke kept generated artifacts under
`examples/playground/md-pdf/smoke/render-bundle-phase6/`.

Template helper output was generated with a repository-relative base profile:

```bash
node dist/esm/bin.mjs md pdf-template codex \
  --base-profile examples/playground/md-pdf/smoke/render-bundle-phase6/base-profile.yml \
  --output examples/playground/md-pdf/smoke/render-bundle-phase6/template-helper \
  --keep-codex-report \
  --overwrite
```

Project helper output used the same bounded input:

```bash
node dist/esm/bin.mjs md pdf-project codex \
  --base-profile examples/playground/md-pdf/smoke/render-bundle-phase6/base-profile.yml \
  --output examples/playground/md-pdf/smoke/render-bundle-phase6/project-helper \
  --keep-codex-report \
  --overwrite
```

Sanitized results:

- The template summary used the generated template directory through
  `--bundle`; its report used `<template-bundle>`.
- The project summary and structured report used the project output directory
  through `--bundle`.
- Template-helper output rendered successfully through bundle and explicit
  template/stylesheet forms.
- Project-helper output rendered successfully through bundle and explicit
  profile/template/stylesheet forms.
- Bundle and explicit live outputs were byte-identical for both helper types.
- All smoke outputs remained inside the ignored smoke tree.

## Verification

- Focused bundle, command, template-helper, project-helper, and profile-helper
  suite
  - Passed: 197 tests, 0 failures.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed.
- `bun run build`
  - Passed.
- `bun test`
  - Passed: 1514 tests, 8084 assertions.
- `git diff --check`
  - Passed.
- Template and project bundle-versus-explicit live render smoke
  - Passed with byte-identical output per helper type.

## Artifact Safety

- Manual smoke artifacts remain under the ignored
  `examples/playground/md-pdf/smoke/` tree.
- Template advisory reports use a bundle placeholder rather than local output
  paths.
- Project reports use repository-relative paths when safe and the existing
  bundle placeholder otherwise.
- This record uses repository-relative commands and sanitized results without
  machine-local resource identifiers.

## Review

The independent code review covered `2fcff90..64b0936`.

Verdict: `APPROVE` with no actionable findings.

The reviewer independently confirmed:

- template follow-up commands use only the bundle directory
- project commands preserve their structured shape and public path behavior
- no-usable decisions still omit follow-up commands
- profile-helper ownership remains unchanged
- bundle and explicit tests compare effective templates, stylesheets, HTML, and
  PDF output
- 147 focused tests passed
- whitespace and public-record privacy checks passed
- live bundle and explicit PDFs had matching hashes for each helper type

## Outcome

Phase 6 is complete. Template and project helper summaries and reports now use
the directory-level bundle shorthand, explicit artifact flags remain a tested
render contract, and profile helpers remain file-oriented. Phase 7 can update
the public guides and close the plan against the recorded implementation
evidence.

## Related Plan

- [Markdown PDF render bundle directory implementation](../plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Render Bundle Directory](../../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
