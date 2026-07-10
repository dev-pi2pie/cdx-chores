---
title: "Markdown PDF render bundle Phase 7 documentation and closeout"
created-date: 2026-07-10
modified-date: 2026-07-10
status: completed
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

The initial Phase 7 review covered `13587e3..cb8a960` and found one actionable
documentation issue: the usage guide did not distinguish fatal invalid
profile-shaped YAML/JSON from ignored unclassified files. The correction at
`cab83fb` documents the structural and semantic validation failure path and was
verified by 51 focused bundle tests with 153 assertions.

The final Phase 7 rereview covered `13587e3..cab83fb`.

Verdict: `APPROVE` with no remaining actionable findings.

A different reviewer assessed the complete substantive plan range
`2a3b291..cab83fb` as one integrated feature. The reviewer covered command
wiring, discovery, report classification, profile admission, explicit
precedence, ambiguity handling, dependency and output ordering, renderer
compatibility, helper commands, Node-target compatibility, tests, guides,
lifecycle evidence, and public-record safety.

Verdict: `APPROVE` with no actionable findings.

The whole-plan review identified `afab6cf` as an interleaved dependency commit
outside this plan's attribution. It remains part of the validated repository
state. Independent CJS require and ESM CLI-help smoke also passed.

## Post-Closeout Follow-Up

A follow-up review found that explicitly resolving the profile role suppressed
bundle profile diagnostics but still opened unused YAML or JSON files. This
could block a valid mixed bundle render when one of those irrelevant files was
unreadable.

Discovery now defers profile-file inspection until after template and
stylesheet candidates are known. With an explicit profile and another admitted
bundle role, YAML and JSON files are not opened. Profile-only bundle admission
remains unchanged.

The correction is covered by candidate-selection, profile-only admission, and
unreadable-file render regressions. The 54-test bundle suite, 169-test related
suite, and 1,517-test full suite pass, together with lint, format, build, and
whitespace checks.

## Public Artifact Safety

The changed public documentation and this job record were scanned for private
URLs, machine-specific paths, sandbox traces, environment setup details, and
unsupported release claims. The only matches were the checklist and policy
phrases that name prohibited content; no prohibited resource identifiers or
unsupported claims were recorded.

## Outcome

Phase 7 is complete. The public guides describe the shipped bundle behavior,
focused and repository validation pass, live smoke covers the planned success
and failure paths, and the documentation, Phase 7, and complete-plan reviews
have no unresolved actionable findings after the recorded follow-up correction.
The plan and related research are closed in the evidence-only lifecycle commit
that records this outcome.
