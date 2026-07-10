---
title: "Markdown PDF render bundle directory implementation"
created-date: 2026-07-10
modified-date: 2026-07-10
status: active
agent: codex
---

## Goal

Implement `md to-pdf --bundle <directory>` as a bounded shorthand for resolving
one or more Markdown PDF render inputs from a shared directory.

The implementation should support profile-only, template-only,
stylesheet-only, partial, and complete project bundles while preserving the
existing deterministic render contract:

```text
explicit artifact options
  -> bundle discovery for unspecified roles
  -> existing role validation and render precedence
  -> Pandoc and WeasyPrint render
```

`--bundle` must not become a new artifact owner, a recursive project loader, or
an automatic Codex/render workflow.

## Why This Plan

The related research settles the product behavior but does not divide the work
into implementation checkpoints. The renderer already accepts `--profile`,
`--template`, and `--css`; the missing layer is deterministic directory
discovery and conflict handling before those existing paths are consumed.

The main user-facing improvement is:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-pdf-project \
  --output ./report.pdf
```

instead of repeating three paths from the same project folder.

## Starting State

Current implementation seams:

- `src/cli/commands/markdown.ts` registers the `md to-pdf` options.
- `src/cli/actions/markdown/to-pdf.ts` resolves explicit profile, template, and
  stylesheet paths before normalizing the profile and rendering.
- existing profile parsing and validation is exposed through the Markdown PDF
  profile modules.
- existing template and stylesheet validation already runs for explicit paths.
- custom-template relative assets resolve from the selected template directory.
- `md pdf-template codex` prints and records follow-up commands using explicit
  `--template` and `--css` paths.
- `md pdf-project codex` prints and records follow-up commands using explicit
  `--profile`, `--template`, and `--css` paths.

Missing pieces:

- the public `--bundle <directory>` option
- bundle candidate discovery and report exclusion
- stable ambiguity reporting
- explicit per-role disambiguation
- resolved-bundle summary output
- profile-pattern admission before candidate counting
- helper follow-up commands that use the new shorthand
- bundle-specific tests and current-behavior guide updates

## Scope

### Command Surface

Add:

```text
--bundle <directory>  Discover Markdown PDF render inputs from a directory
```

Supported combinations include:

```bash
# Complete project bundle
cdx-chores md to-pdf --input ./report.md --bundle ./report-project

# Template bundle plus an external profile
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-template \
  --profile ./profiles/report.yml

# Explicitly resolve ambiguous bundle roles
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-project \
  --template ./report-project/detailed.html \
  --css ./report-project/print.css
```

The existing explicit `--profile`, `--template`, and `--css` options remain
supported.

### Discovery Contract

Inspect top-level regular files only:

| Role       | Candidate rule                                            |
| ---------- | --------------------------------------------------------- |
| Profile    | `.yml`, `.yaml`, or `.json` that passes profile admission |
| Template   | `.html`                                                   |
| Stylesheet | `.css`                                                    |

Do not descend into `assets/` or other subdirectories. Do not discover the
Markdown input or PDF output.

Exclude recognized Markdown PDF Codex report JSON through:

- generated report patterns ending in `-codex-report.json` or
  `.codex-report.json`
- `artifact.type: markdown-pdf-codex-profile-report`
- `artifactType: markdown-pdf-codex-template-report`
- `artifactType: markdown-pdf-codex-project-report`

A reserved report filename remains excluded even if its JSON is malformed.
Other YAML and JSON inputs must parse as non-empty plain objects, use only the
recognized Markdown PDF profile root namespace, and pass existing shape and
semantic validation before they become profile candidates. Unclassified files
are ignored with an aggregated warning; recognized Markdown PDF reports remain
silent. Explicit `--profile` selection retains its existing broader validation
contract.

### Conflict And Resolution Contract

Resolve explicit artifact options first, then discover only unspecified roles.

Rules:

- zero or one candidate for an unresolved role is valid
- more than one candidate for an unresolved role is an input error
- aggregate all ambiguous unresolved roles when practical
- list candidates in stable sorted order
- name the explicit resolving flag in each error
- never choose by modification time, filename order, or canonical-looking name
- the directory must contain at least one recognized candidate before explicit
  role selection is applied
- explicit options may resolve every role represented by the bundle

### Render Contract

After bundle resolution, reuse the existing paths and behavior:

- profile parsing, normalization, and recipe materialization
- explicit recipe flag precedence over profile fields
- custom template replacement behavior
- custom CSS ordering and `--no-default-css`
- code-highlight overrides
- template-relative managed asset loading
- output and intermediate HTML collision checks
- Pandoc and WeasyPrint dependency checks

Bundle discovery and ambiguity validation must finish before external renderer
dependency probes and before PDF or intermediate HTML writes.

### Out Of Scope

This plan does not implement:

- recursive directory discovery
- multiple files for one render role
- a required bundle manifest
- automatic rendering inside `md pdf-profile codex`,
  `md pdf-template codex`, or `md pdf-project codex`
- Markdown input or PDF output discovery
- new profile, template, or report schemas
- Interactive Markdown PDF behavior
- an invented release or milestone label

## Implementation Approach

Keep `src/cli/actions/markdown/to-pdf.ts` focused on orchestration. Add a small
renderer-side bundle module responsible for:

```text
validate directory
  -> inspect top-level regular files
  -> exclude recognized report JSON
  -> admit only profile-pattern YAML or JSON
  -> group and sort candidates by role
  -> apply explicit-role selection
  -> report unresolved ambiguity
  -> return resolved paths and provenance
```

Recommended module targets:

- `src/cli/markdown-pdf/render-bundle.ts`
- `src/cli/actions/markdown/to-pdf.ts`
- `src/cli/commands/markdown.ts`
- `test/cli-actions-md-to-pdf-bundle.test.ts`

If the bundle module becomes difficult to review as one file, split types and
report classification into adjacent modules. Do not pre-emptively create a
large directory hierarchy for this bounded resolver.

## Implementation Phases

### Phase 1: Command Surface And Resolver Types

Tasks:

- [x] Register `--bundle <directory>` on `md to-pdf`.
- [x] Add `bundle?: string` to command and action option types.
- [x] Resolve the bundle path from the CLI working directory without changing
      existing explicit artifact path behavior.
- [x] Define role, candidate, resolution-source, and resolved-input types.
- [x] Keep command-to-action forwarding explicit and testable.
- [x] Add help-output and command-wiring tests.
- [x] Reject empty option values through the existing CLI/input-error posture.
- [x] Keep the partially implemented flag fail closed until renderer integration.
- [x] Review the Phase 1 commit range and resolve all actionable findings.

Phase gate:

- `md to-pdf --help` documents `--bundle <directory>`.
- Command tests prove the raw directory value reaches the action unchanged.
- No bundle discovery or render behavior is claimed complete yet.

Phase record:

- [Phase 1 command surface](jobs/2026-07-10-markdown-pdf-render-bundle-phase-1-command-surface.md)

### Phase 2: Top-Level Discovery And Report Classification

Tasks:

- [x] Validate that `--bundle` resolves to an existing readable directory.
- [x] Read only direct directory entries and accept regular files only.
- [x] Classify profile, template, and stylesheet candidates case-insensitively
      by supported extension.
- [x] Sort candidate basenames deterministically.
- [x] Exclude `-codex-report.json` and `.codex-report.json` filename patterns.
- [x] Shallow-read remaining JSON only as needed to recognize the three current
      Markdown PDF Codex report discriminators.
- [x] Keep reserved report filenames excluded when their JSON is malformed.
- [x] Keep malformed or unrelated non-report JSON in the profile-candidate set.
- [x] Reject missing, non-directory, empty, and no-recognized-artifact bundles
      before external dependency checks.
- [x] Add focused unit tests for every artifact role and report form.
- [x] Review the Phase 2 commit range and resolve all actionable findings.

Phase gate:

- A single profile, template, or stylesheet is discoverable independently.
- Complete project folders ignore their optional Codex report and `assets/`.
- No recursive or heuristic filename selection exists.

Phase record:

- [Phase 2 discovery](jobs/2026-07-10-markdown-pdf-render-bundle-phase-2-discovery.md)

Phase 2 records the initial extension-level profile classification. Phase 5
reinforces that completed foundation with a parsed profile-admission gate; it
does not rewrite the Phase 2 implementation history.

### Phase 3: Ambiguity And Explicit Disambiguation

Tasks:

- [x] Apply explicit `--profile`, `--template`, and `--css` selections before
      checking ambiguity for their roles.
- [x] Use bundle discovery only for roles that remain unspecified.
- [x] Fail when any unresolved role contains multiple candidates.
- [x] Aggregate profile, template, and stylesheet conflicts into one stable
      error when practical.
- [x] List sorted candidate basenames and the matching resolving flag.
- [x] Use `CliError` with the normal invalid-input exit behavior.
- [x] Allow an explicit option to resolve the only ambiguous role in a bundle,
      even when no unresolved role remains.
- [x] Allow explicit artifact paths outside the selected bundle directory.
- [x] Return whether each resolved path came from an explicit option or bundle
      discovery for later summary output.
- [x] Add focused tests for single-role and multi-role conflicts, full explicit
      resolution, and mixed bundle/external inputs.
- [x] Review the Phase 3 commit range and resolve all actionable findings.

Phase gate:

- The resolver never guesses among multiple candidates.
- Every conflict has a deterministic, actionable error.
- The explicit-disambiguation examples from the research pass unchanged.

Phase record:

- [Phase 3 conflicts](jobs/2026-07-10-markdown-pdf-render-bundle-phase-3-conflicts.md)

### Phase 4: Renderer Integration And Resolution Summary

Tasks:

- [x] Invoke the resolver early in `actionMdToPdf` when `--bundle` is present.
- [x] Feed resolved bundle paths into the existing profile, template, and CSS
      variables without creating a parallel rendering path.
- [x] Preserve existing explicit-only behavior when `--bundle` is absent.
- [x] Run existing profile parsing and file validation after resolution.
- [x] Print a concise resolved-bundle summary before Pandoc and WeasyPrint are
      invoked, omitting absent roles.
- [x] Mark explicit versus discovered roles only where needed to explain mixed
      resolution.
- [x] Keep terminal paths user-facing and avoid persisting machine-local
      absolute paths.
- [x] Prove template-relative local assets still resolve from the selected
      template directory.
- [x] Prove discovery, ambiguity, and selected-file validation failures write no
      PDF or intermediate HTML.
- [x] Add action-level tests for profile-only, template-only, stylesheet-only,
      partial, and complete bundles.
- [x] Add precedence tests covering profile values, direct recipe flags,
      `--no-default-css`, and code-highlight overrides.
- [x] Review the Phase 4 commit range and resolve all actionable findings.

Phase gate:

- Every supported bundle shape reaches the same render pipeline as its explicit
  equivalent.
- Existing explicit render tests remain unchanged and passing.
- Failure occurs before renderer dependency probes and output writes.

Phase record:

- [Phase 4 render integration](jobs/2026-07-10-markdown-pdf-render-bundle-phase-4-render-integration.md)

### Phase 5 Onward Execution Protocol

The completed Phase 1–4 checklist wording and job records remain historical
evidence of what was implemented and verified at each phase. Later behavior
reinforcement must add new unchecked work rather than retroactively rewriting
checked tasks.

For Phases 5–7:

- Work one phase at a time and record the starting commit before implementation.
- Keep checklist items unchecked until the matching implementation and evidence
  exist.
- Run the phase-focused checks and update its job record before the
  phase-boundary commit.
- Notify through `auto_commit_notification`, then create at least one meaningful
  Conventional Commit for the phase when its implementation and evidence are
  ready.
- Review the commit range from the preceding phase boundary through the current
  phase commit.
- Resolve every actionable review finding, extend the recorded range when fixes
  add commits, and re-review that final range before beginning the next phase.
- Record the commit range, validation commands, results, review disposition,
  and any environment limitation in the phase job record.
- Keep public phase records scoped to repository-relative or sanitized behavior
  and verification evidence without machine-local environment setup details.
- Do not mark a phase complete while its review has unresolved actionable
  findings or its required evidence is missing.

### Phase 5: Profile Admission Gate And YAML/JSON Classification

Tasks:

- [x] Audit the completed Phase 2–4 resolver implementation and tests that
      encode extension-level profile candidacy, then list the affected tests in
      the Phase 5 job record before changing their expectations.
- [x] Add a non-throwing discovery classifier for potential YAML and JSON
      profile files.
- [x] Keep generated report filename exclusions and exact Markdown PDF report
      discriminators ahead of profile admission.
- [x] Keep the three Markdown PDF report discriminators local to the renderer
      resolver and document their producing commands without importing a
      cross-command artifact registry.
- [x] Extract or reuse a parse-only helper from the JSON and YAML behavior used
      by `readMarkdownPdfProfileFile` so discovery can inspect the parsed root
      before profile shape validation runs.
- [x] Convert parse failures and parsed roots that do not match the profile
      namespace pattern into an unclassified discovery result.
- [x] Add parser-classification fixtures for malformed input, empty documents,
      `null`, arrays, primitive roots, empty objects, multi-document YAML, and
      BOM-prefixed JSON and YAML; preserve the existing parser result rather
      than adding bundle-only input normalization.
- [x] Require a discoverable profile to be a non-empty plain object with at
      least one key from `MARKDOWN_PDF_PROFILE_ROOT_KEYS` and no root keys
      outside that namespace.
- [x] Reuse `validateMarkdownPdfProfileShape` for structural validation and
      `normalizeMarkdownPdfProfile` for a side-effect-free semantic admission
      check instead of defining a parallel schema.
- [x] Discard the admission-time normalized value and let the selected profile
      continue through the existing render-time parsing and normalization path.
- [x] Keep explicit `--profile <path>` behavior authoritative and compatible,
      including explicitly selected empty profiles.
- [x] Exclude malformed and unrelated YAML or JSON from profile conflict
      counting.
- [x] Fail with the existing invalid-profile posture when a file matches the
      discoverable profile root pattern but fails structural or semantic
      validation; do not count it as a candidate or downgrade it to a warning.
- [x] When any profile, template, or stylesheet is admitted, aggregate ignored
      unclassified filenames into one warning written once to stderr in stable
      basename order without changing the successful exit code.
- [x] When no render artifact is admitted, emit no separate warning and enrich
      the fatal no-recognized-artifact error with the stable ignored basenames.
- [x] Keep recognized Markdown PDF reports silent when they coexist with a
      valid profile, template, or stylesheet.
- [x] Avoid importing a cross-command registry of `data` or `rename` artifact
      discriminators into the Markdown PDF resolver.
- [x] Prove a profile can coexist with profile, template, and project report
      JSON, including custom report filenames with valid discriminators.
- [x] Prove data JSON whose root keys fall outside the profile namespace can
      coexist with one profile without creating a false ambiguity conflict.
- [x] Add before-and-after regression assertions proving malformed, unrelated,
      and out-of-namespace YAML or JSON no longer increment the profile
      conflict count introduced by the completed extension-level discovery.
- [x] Preserve the existing multiple-valid-profile ambiguity error.
- [x] Prove admission and classification failures write no PDF or intermediate
      HTML.
- [x] Update the Phase 5 job record with focused and repository validation.
- [x] Review the Phase 5 commit range and resolve all actionable findings.

Phase gate:

- Only files that pass the discoverable profile contract participate in profile
  candidate counting.
- Expected Markdown PDF reports remain silent bundle content.
- Ignored non-profile files remain visible through exactly one warning when a
  render artifact is admitted, or through the fatal error when none is admitted.
- Profile-pattern matches that fail validation remain fatal invalid profiles.
- Explicit profile selection retains its existing compatibility contract.
- Completed Phase 2–4 checklist wording and job records remain unchanged while
  Phase 5 evidence records the intentional behavior transition.

Phase record:

- [Phase 5 profile admission](jobs/2026-07-10-markdown-pdf-render-bundle-phase-5-profile-admission.md)

### Phase 6: Helper Follow-Up Commands And Compatibility Coverage

Tasks:

- [ ] Update template-Codex follow-up summaries to render the output directory
      through `--bundle` only after the Phase 5 admission gate, focused tests,
      manual smoke items 5–6, and commit-range review pass.
- [ ] Update template-Codex report follow-up commands to use a bundle-directory
      placeholder while preserving privacy-safe paths.
- [ ] Update project-Codex follow-up command generation to use the project
      output directory through `--bundle`.
- [ ] Update project report and summary tests for the shorter command.
- [ ] Keep profile-Codex follow-up commands on `--profile` because the profile
      helper writes a file rather than a directory.
- [ ] Retain integration tests proving explicit `--profile --template --css`
      rendering remains supported.
- [ ] Add render-equivalence coverage for template and project helper outputs
      through both bundle and explicit forms.

Phase gate:

- Generated template and project bundle summaries use the new shorthand.
- Advisory reports contain replayable, privacy-safe bundle commands.
- The old explicit render form remains a tested public contract.

Expected job record:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-6-helper-adoption.md`

### Phase 7: Documentation, Validation, And Closeout

Tasks:

- [ ] Update `docs/guides/markdown-pdf-usage.md` with single-role, partial, and
      complete bundle examples.
- [ ] Update the template and project Codex helper guides so their primary
      follow-up render examples match shipped `--bundle` behavior.
- [ ] Keep explicit render examples where composition or troubleshooting makes
      them clearer.
- [ ] Update helper comparison tables without changing artifact ownership.
- [ ] Confirm public docs contain no private URLs, machine-local absolute paths,
      sandbox traces, or unsupported release claims.
- [ ] Run a documentation review after implementation evidence is recorded.
- [ ] Link all phase job records from this plan.
- [ ] Update research and plan status only when the repository lifecycle policy
      and recorded evidence support the transition.
- [ ] Run focused tests, repository gates, and a proportional manual smoke.

Phase gate:

- Guides describe shipped behavior rather than proposed behavior.
- All implementation and documentation checks pass or record a concrete
  environment limitation.
- The plan moves to `completed` only after linked closeout evidence exists.

Expected job record:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-7-docs-closeout.md`

## Validation Plan

### Focused Tests

Run bundle, command, renderer, and helper integration coverage first:

```bash
bun test \
  test/cli-actions-md-to-pdf-bundle.test.ts \
  test/cli-actions-md-to-pdf-commands.test.ts \
  test/cli-actions-md-to-pdf-actions-validation.test.ts \
  test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts \
  test/cli-actions-md-to-pdf-actions-assets.test.ts
```

After helper adoption:

```bash
bun test \
  test/cli-actions-md-to-pdf-template-codex/action.test.ts \
  test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts \
  test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts \
  test/cli-actions-md-to-pdf-project-codex/action-write.test.ts \
  test/cli-actions-md-to-pdf-project-codex/validation.test.ts
```

### Repository Gates

```bash
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

### Manual Smoke

Use `examples/playground/` for temporary smoke artifacts.

When Pandoc and WeasyPrint are available:

1. Render a profile-only bundle.
2. Render a template/CSS bundle with a bundle-relative local image.
3. Render a complete `md pdf-project codex` output directory.
4. Resolve one ambiguous role through an explicit artifact option.
5. Render one profile alongside recognized report JSON without a warning.
6. Render one profile alongside data JSON whose root keys fall outside the
   profile namespace, with one ignored-file warning and no false conflict.
7. Confirm an unresolved conflict fails before creating PDF or HTML output.
8. Compare the successful bundle route with the equivalent explicit command.

Record environment limitations rather than treating unavailable external PDF
tools as product failures.

## Expected Job Records

Create phase-specific records as implementation lands, replacing `YYYY-MM-DD`
with the UTC date when each record begins:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-1-command-surface.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-2-discovery.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-3-conflicts.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-4-render-integration.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-5-profile-admission.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-6-helper-adoption.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-render-bundle-phase-7-docs-closeout.md`

This plan is `active` from the start of Phase 1. Move it to `completed` only
after Phase 7 evidence and the expected job records are linked.

## Completion Criteria

This plan is complete only when:

- `md to-pdf --bundle <directory>` is implemented and documented
- every single-role and combined bundle shape is covered
- report JSON cannot become a false profile conflict under the settled rules
- unclassified YAML or JSON that does not satisfy the discoverable profile
  contract cannot become a false profile conflict
- ignored unclassified files produce stable diagnostics without warning for
  recognized Markdown PDF reports
- unresolved ambiguity never selects a candidate silently
- explicit role options resolve bundle conflicts as documented
- existing render precedence and asset behavior remain intact
- template and project helper follow-up commands use the accepted bundle form
- explicit render flags remain supported and tested
- focused tests and repository gates pass
- manual-smoke evidence or environment limitations are recorded
- phase job records and documentation-review evidence are linked

## Related Research

- [Markdown PDF Render Bundle Directory](../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
- [Markdown PDF Project Codex Helper](../researches/research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)

## Related Plans

- [Markdown PDF project Codex helper implementation](plan-2026-07-04-markdown-pdf-project-codex-helper.md)
- [Markdown PDF template Codex helper implementation](plan-2026-06-23-markdown-pdf-template-codex-helper.md)
