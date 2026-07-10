---
title: "Markdown PDF render bundle Phase 7 documentation and closeout"
created-date: 2026-07-10
status: in-progress
agent: codex
plan: ../plan-2026-07-10-markdown-pdf-render-bundle-directory.md
---

## Scope

Implement Phase 7 of the `md to-pdf --bundle` plan by documenting the shipped
bundle workflow, validating the integrated command and helper behavior, and
closing the related plan and research only after documentation and commit-range
reviews have no unresolved actionable findings.

This phase does not change artifact ownership or add another renderer. Runtime
code changes remain out of scope unless validation or review identifies a real
defect.

## Review Boundaries

- Phase 6 boundary: `13587e3`.
- Phase 7 planning revision: `e632ad8`.
- Whole-plan pre-initiative baseline: `2a3b291`.
- Interleaved dependency commit `afab6cf` is part of the validated repository
  state but is outside this plan's attribution.

The Phase 7 review begins at the Phase 6 boundary. The independent whole-plan
review begins at the pre-initiative baseline. Both ranges end at the final
substantive Phase 7 or correction commit; the later lifecycle closeout commit
records evidence and is not a new substantive implementation boundary.

## Documentation Implementation

- Updated the main usage guide with profile-only, template-only,
  stylesheet-only, partial template/CSS, and complete project bundle examples.
- Documented top-level discovery, report exclusion, unclassified YAML/JSON
  warnings, explicit composition, ambiguity resolution, and no-output failure
  behavior.
- Updated template and project helper guides so their primary follow-up render
  commands use `--bundle`.
- Preserved explicit render forms for composition and troubleshooting.
- Updated helper comparison tables without changing artifact ownership.

## Validation

- Bundle, command, renderer, validation, and asset focused suite:
  - Passed: 112 tests, 0 failures, 603 assertions.
- Template- and project-helper compatibility focused suite:
  - Passed: 71 tests, 0 failures, 1,019 assertions.
- `bun run lint`:
  - Passed.
- `bun run format:check`:
  - Passed.
- `bun run build`:
  - Passed.
- `bun test`:
  - Passed: 1,514 tests, 0 failures, 8,084 assertions.
- `git diff --check`:
  - Passed before documentation review.

## Manual Smoke

Proportional live render smoke used repository-relative fixtures and kept all
generated artifacts under the ignored `examples/playground/md-pdf/smoke/`
tree.

Sanitized results:

- A profile-only render role beside a recognized project report rendered
  without an ignored-file warning.
- A profile beside out-of-namespace data JSON rendered with one warning naming
  `data.json` and no false profile conflict.
- A template/stylesheet bundle with a bundle-relative local cover image
  rendered successfully through bundle and explicit forms; the PDFs were
  byte-identical.
- A complete project bundle rendered successfully through bundle and explicit
  profile/template/stylesheet forms; the PDFs were byte-identical.
- An unresolved two-template conflict failed before creating the requested PDF
  or intermediate HTML.
- Selecting one template explicitly resolved that conflict while bundle
  discovery supplied the stylesheet, and the PDF rendered successfully.

## Documentation Review

The initial independent documentation review found one actionable wording
issue: the usage guide described ignored unclassified YAML/JSON warnings as
unconditional. Shipped behavior instead emits the aggregated warning only when
the profile role remains unresolved and another render artifact is admitted;
an unclassified-only bundle fails once with the ignored basenames, while an
explicit profile suppresses bundle profile-file diagnostics for that resolved
role.

The guide now records those three cases and the no-PDF/no-intermediate-HTML
failure guarantee. The focused rereview returned `APPROVE` with no remaining
actionable findings and confirmed the Phase 7 documentation is ready to commit.

## Commit-Range Reviews

Pending Phase 7 and independent complete-plan reviews.

## Public Artifact Safety

The changed public documentation and this job record were scanned for private
URLs, machine-specific paths, sandbox traces, environment setup details, and
unsupported release claims. The only matches were the checklist and policy
phrases that name prohibited content; no prohibited resource identifiers or
unsupported claims were recorded.

## Outcome

In progress. The plan remains `active` and the related research remains
`in-progress` until all Phase 7 gates and both commit-range reviews pass.
