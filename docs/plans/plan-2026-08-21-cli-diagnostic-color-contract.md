---
title: "CLI diagnostic color contract"
created-date: 2026-08-21
status: draft
agent: codex
---

## Goal

Consolidate the tool's existing color controls and local diagnostic presentation
patterns into one stream-aware CLI diagnostic color contract.

The implementation should:

- preserve the existing global `NO_COLOR`, `--no-color`, runtime, and TTY
  eligibility rules
- color only existing diagnostic labels or grouped warning headings
- use the actual output stream when deciding whether ANSI styling is eligible
- apply the contract consistently to Commander parser errors, warnings, and
  informational tips or notices
- preserve plain-text wording, output ownership, exit behavior, and
  machine-readable output

## Planning Boundary

This plan is `draft`. It is a separate CLI-wide presentation plan from the
active
[Codex request timeout contract plan](plan-2026-08-21-codex-request-timeout-contract.md).

The agreed execution order is:

1. complete this CLI diagnostic color contract
2. integrate its final reviewed closeout commit into the branch that will own
   timeout Phase 7
3. resume Phase 7 of the Codex request timeout contract

This ordering allows the timeout documentation and final built-output
inspection to use the completed diagnostic presentation contract. It is not a
timeout-semantic dependency.

The color implementation may change the ANSI presentation boundary of the
legacy Codex timeout warning, but it must not change that warning's canonical
plain text, deprecation behavior, replacement guidance, timeout semantics, or
exit behavior. Timeout guides, release notes, research closeout, and Phase 7
records remain owned by the timeout plan.

The timeout Phase 7 job record will name the integrated final diagnostic-color
closeout commit `COLOR_TIP`, record its full SHA and integration method, and
confirm that it is an ancestor of the timeout Phase 7 tip. Use fast-forward or
a non-rewriting merge so the reviewed `COLOR_TIP` full SHA remains in history.
Do not squash, cherry-pick, or rebase the final color closeout after review.

The intended implementation branch is:

```text
codex/cli-diagnostic-color-contract
```

This plan consolidates existing behavior. It does not introduce a logging
framework or redesign the CLI's command output.

## Why A Direct Plan

The repository already contains enough evidence to plan the work directly:

- `src/cli/colors.ts` centralizes global color eligibility
- `CliRuntime` already carries one execution-wide color setting
- `NO_COLOR` and `--no-color` behavior is implemented and tested
- the shared color helper already accepts an explicit target stream
- Markdown PDF warnings establish the accepted yellow-on-eligible-stderr
  presentation precedent
- Interactive tips and several human-readable report surfaces establish
  restrained cyan, green, yellow, and dim presentation patterns
- current source inspection identifies concrete inconsistent warning consumers
  and stderr renderers that still derive eligibility from stdout

The remaining work is an implementation audit, contract consolidation,
migration, and verification exercise rather than an unresolved research
question. Phase 1 owns the bounded inventory that might otherwise duplicate
existing research.

## Current State

### Shared Color Eligibility

`src/cli/colors.ts` currently provides:

- `resolveCliColorEnabled(...)` for `NO_COLOR` and `--no-color`
- `getCliColors(runtime, targetStream)` for runtime and target-TTY eligibility
- a compatibility default that assumes stdout when the target stream is
  omitted
- `getProcessColors(...)` for process-owned presentation such as the version
  label

This is a reusable color capability, but it does not define semantic diagnostic
styles or own diagnostic output.

Not every color-producing path currently uses `getCliColors(...)`:

- process-owned presentation may use `getProcessColors(...)`
- the Interactive analyzer-status renderer uses `createColors(...)` directly
  because it owns transient TTY frames
- transient terminal control may contain raw ANSI cursor or line-clearing
  sequences that are behavior, not semantic color

Phase 1 must inventory and classify these paths as adopted, retained
domain-owned presentation, or non-color terminal control. A global diagnostic
contract must not imply that unreviewed color-producing paths were migrated.

### Commander Output Ownership

`src/command.ts` currently creates the root Commander program without
`configureOutput(...)`. Commander therefore owns its default process stdout and
stderr writes even when `runCli(...)` receives injected runtime streams.

The diagnostic contract requires Commander output to use `cliRuntime.stdout`
and `cliRuntime.stderr` before parser-error styling can claim target-stream and
injected-runtime correctness.

### Existing Presentation Precedents

Current local precedents include:

- Markdown PDF grouped warning headings rendered yellow on eligible stderr
- Interactive `Tip:` labels rendered cyan
- doctor and tabular human views using cyan for headings, green for ready
  states, yellow for limited states, and dim for supporting detail
- font reports using dim `Info:` fields as report metadata on stdout
- Interactive Codex progress using its own transient TTY presentation

These roles are not interchangeable. A report field named `Info:` is not
automatically an informational diagnostic, and domain-specific state colors are
not global severity colors.

### Known Inconsistencies

The Phase 1 inventory starts with these observed surfaces:

| Surface | Current behavior | Intended treatment |
| --- | --- | --- |
| Commander parser errors | plain `error:` line followed by help | color only the existing `error:` label on eligible stderr |
| legacy Codex timeout notice | plain multiline `Warning:` notice | color only the first existing warning label |
| Markdown PDF render warnings | yellow grouped heading | retain as the reference warning-heading behavior |
| font discovery warnings | plain `Warning:` lines | use the shared warning-label style |
| data-stack compatibility and replay warnings | plain `Warning:` lines | use the shared warning-label style |
| Interactive tips | cyan label, but stdout-based eligibility | retain cyan and use stderr eligibility |
| Interactive data-query review rendering | writes stderr with stdout-based eligibility | use stderr eligibility without changing domain colors |
| Interactive stack replay tip | writes stderr with stdout-based eligibility | use stderr eligibility without changing its wording |

Phase 1 must complete the source inventory before migration begins. The
inventory should distinguish true diagnostics from headings, report fields,
progress, prompts, and primary command output.

## Product Contract

### Plain Text Is Canonical

ANSI styling is a presentation layer. Stripping ANSI from styled output must
produce the existing plain-text contract exactly.

The first implementation does not change:

- message wording or casing
- option names or remediation commands
- stdout or stderr ownership, except to correct color-eligibility checks for
  content already written to a known stream
- exit codes
- whether help is shown after a parser error
- warning grouping or emission count
- JSON, CSV, SQL-only, or other machine-readable payloads

### Diagnostic Label Palette

Use restrained standard terminal colors for existing labels:

| Semantic role | Existing label examples | Style on an eligible target stream |
| --- | --- | --- |
| parser error | `error:` | red label only |
| warning | `Warning:` | yellow label only |
| grouped warning | `Markdown PDF render warnings:` | yellow heading only |
| informational notice | `Info:`, when it is a true notice | cyan label only |
| contextual tip | `Tip:` | cyan label only |
| supporting detail | existing detail text | retain existing local dim styling where owned by that view |

The explanation after a diagnostic label remains in the terminal's normal
foreground color. Do not color a whole error or warning sentence merely because
it contains a diagnostic label.

Preserve current label casing. In particular, this plan does not rename
Commander's lowercase `error:` or existing uppercase `Warning:`, `Info:`, and
`Tip:` labels.

### Output Stream Ownership

The existing channel contract remains:

```text
stdout
  -> requested command results
  -> human reports and tables
  -> machine-readable payloads

stderr
  -> parser errors and operational failures
  -> warnings and compatibility notices
  -> remediation and contextual tips
  -> progress and Interactive review guidance
```

Color eligibility must be based on the stream receiving the styled text:

- stdout styling checks stdout TTY state
- stderr styling checks stderr TTY state
- redirected target streams receive plain text

The implementation should make the target stream explicit at color call sites.
Remove the implicit stdout default from shared runtime color acquisition only
after every caller has been audited and migrated.

### Shared Diagnostic Presentation

Add one small presentation seam that styles an existing diagnostic label or
heading through the shared color helper. It must:

- accept `CliRuntime`
- accept the actual target stream
- accept a semantic presentation role
- return or write presentation text without embedding ANSI in domain data,
  structured diagnostics, stored reports, or pure option-resolution results
- leave unknown or unclassified text unchanged

Keep message construction separate from presentation. For example, the legacy
Codex timeout migration formatter should remain testable as plain text; its
warning label should be styled only when the notice is written to stderr.

### Commander Parser Errors

Configure the root Commander program through its supported output boundary:

```ts
program.configureOutput({
  writeOut: (value) => cliRuntime.stdout.write(value),
  writeErr: (value) => cliRuntime.stderr.write(value),
  outputError: (value, write) => {
    // Style only the known leading `error:` label, then call `write`.
  },
});
```

The concrete implementation may extract this into a small program-output
configuration helper, but it must keep runtime stream ownership explicit.

Use `outputError` to style the existing leading `error:` label. The hook must
not color:

- the invalid option or argument text
- the blank separator
- the usage block
- help headings or option descriptions

If Commander emits an unexpected error shape without the known label, write it
unchanged rather than guessing at severity boundaries.

### Warning Migration

Migrate only user-facing warning labels and grouped warning headings confirmed
by the Phase 1 inventory. Preserve each warning owner's existing:

- emission condition
- deduplication or grouping behavior
- explanation and remediation text
- exit behavior
- structured diagnostic representation, when present

Do not infer warning severity from arbitrary use of the word `warning` inside
generated content, source data, code examples, or report payloads.

### Information, Tips, And Domain Presentation

Use cyan only for genuine ancillary notice or tip labels. Do not globally
recolor every `Info:` string.

Specifically:

- font-report `Info:` rows remain report metadata on stdout
- doctor headings and health-state colors remain doctor-owned
- SQL labels and SQL text remain data-query-owned
- tabular headers and match highlighting remain renderer-owned
- transient Codex progress remains owned by the Interactive status renderer

The first adoption wave should repair known stderr eligibility mismatches for
tips and Interactive review presentation without redesigning their visual
language.

## No-Goals

This plan does not introduce:

- a logging framework, logger dependency, timestamps, namespaces, or verbosity
  levels
- a new `--verbose`, `--quiet`, or log-level option
- a global `success:` label or new success messages
- new error or warning prefixes on messages that do not already own one
- automatic casing normalization for diagnostic labels
- changes to machine-readable schemas or payloads
- ANSI sequences inside stored artifacts or structured diagnostics
- a redesign of Commander help, Interactive prompts, progress animations,
  doctor reports, SQL previews, or table rendering
- broad stdout/stderr rerouting
- semantic per-value colorization

## Execution Record Strategy

Create one job record when implementation begins:

```text
docs/plans/jobs/2026-08-21-cli-diagnostic-color-contract.md
```

The job record should contain one concise section per phase with:

- starting commit and implementation commits
- focused and full validation evidence
- accepted findings and constraints
- the exact phase `base..tip` review range
- the Continue, Constrain, or Stop gate decision

Phase 1 must also record an adopted-surface matrix with:

- source owner
- actual output stream
- semantic or domain-owned presentation role
- focused test owner
- structured-output risk
- migration phase or explicit deferral

Keep this plan `draft` during Phase 1 inventory and contract confirmation. Mark
it `active` only when the first production or test implementation change begins.

## Phased Implementation

### Phase 1: Diagnostic Inventory And Contract Freeze

Complete the user-facing output inventory and confirm the migration boundary
before changing presentation code.

Status: completed.

Tasks:

- [x] Record the agreed execution order: complete this plan before resuming
      timeout Phase 7.
- [x] Confirm the color migration does not modify timeout semantics, canonical
      warning wording, timeout guides, release notes, or timeout closeout
      records.
- [x] Record the current timeout Phase 6 implementation tip and preserve it as
      the end of the original timeout implementation review slice.
- [x] Create the execution job record and record the clean starting commit.
- [x] Inventory every `getCliColors(...)`, `getProcessColors(...)`, and direct
      `createColors(...)` call and record its actual output stream.
- [x] Inventory raw ANSI sequences and distinguish semantic color from
      terminal-control behavior such as transient-line clearing.
- [x] Inventory user-facing `error:`, `Warning:`, `Info:`, and `Tip:` labels and
      grouped warning headings.
- [x] Classify each candidate as parser diagnostic, operational diagnostic,
      compatibility notice, informational notice, contextual tip, report field,
      progress, prompt, or domain presentation.
- [x] Record stdout/stderr ownership, current wording, exit behavior, and
      structured-output implications for each adopted surface.
- [x] Confirm which stderr renderers currently derive color eligibility from
      stdout.
- [x] Freeze the first migration list and explicitly defer unclassified or
      domain-owned presentation.
- [x] Record the adopted-surface matrix in the job record with source owner,
      stream, role, focused test owner, structured-output risk, and migration
      phase or deferral.

Verification:

- [x] Confirm every first-wave surface has one source owner and focused test
      owner.
- [x] Confirm no JSON, CSV, SQL-only, or stored-artifact output is in the
      migration list.
- [x] Record the inventory and gate decision in the job record.
- [x] Commit the Phase 1 plan/job inventory checkpoint.
- [x] Review the exact Phase 1 starting-commit-to-checkpoint range for plan
      clarity, inventory completeness, and public-safe evidence.
- [x] Record the Phase 1 commit, review range, findings, and decision in the job
      record before implementation begins.

Gate:

- [x] Continue only when error, warning, notice/tip, report, and domain-owned
      presentation boundaries are unambiguous.

### Phase 2: Shared Stream-Aware Presentation Foundation

Add the shared semantic-label seam and complete explicit-stream migration for
existing color-helper callers. Defer semantic diagnostic adoption by consumer
family to Phases 3 and 4.

Status: not started.

Tasks:

- [ ] Add one shared diagnostic-label or heading presentation helper.
- [ ] Reuse `picocolors` and the existing runtime color setting; do not add a
      dependency or raw ANSI literals.
- [ ] Require the actual target stream for the new presentation helper.
- [ ] Migrate shared `getCliColors(...)` callers to explicit stdout or stderr
      arguments.
- [ ] Correct known stdout-derived styling for content already written to
      stderr while making those call sites explicit.
- [ ] Treat the explicit-stream migration as stream ownership only; do not
      adopt parser-error, warning, notice, or tip consumers through the shared
      semantic helper until Phase 3 or Phase 4.
- [ ] Remove the compatibility stdout default only after all call sites are
      explicit.
- [ ] Keep pure diagnostic data and option-resolution formatters ANSI-free.
- [ ] Preserve explicitly deferred `getProcessColors(...)`, analyzer-status,
      and terminal-control paths under their recorded owners.
- [ ] Add focused tests for red error, yellow warning, cyan notice/tip, and
      unchanged message bodies at the shared-helper boundary.

Verification:

- [ ] Assert stdout TTY and stderr TTY eligibility independently.
- [ ] Assert redirected target streams remain plain even when the other stream
      is a TTY.
- [ ] Assert every known stderr renderer derives eligibility from stderr after
      the explicit-stream migration.
- [ ] Confirm real parser, warning, notice, and tip consumer-adoption tests
      remain assigned to Phase 3 or Phase 4.
- [ ] Assert `NO_COLOR`, `--no-color`, and disabled runtime color remain plain.
- [ ] Assert stripping ANSI from styled output returns the exact canonical
      plain text.
- [ ] Run typecheck, lint, formatting, and focused color tests.
- [ ] Record the exact Phase 2 review range and gate decision.

Gate:

- [ ] Continue only when the shared seam is stream-correct and does not change
      existing plain output.

### Phase 3: Parser Error And Warning Adoption

Apply the shared contract to parser errors and the approved warning inventory.

Status: not started.

Tasks:

- [ ] Configure Commander `writeOut` and `writeErr` to use the injected CLI
      runtime streams.
- [ ] Configure Commander `outputError` to style only the existing leading
      `error:` label.
- [ ] Preserve help-after-error output as normal foreground text.
- [ ] Apply the warning-label style to the legacy Codex timeout compatibility
      notice at its stderr presentation boundary.
- [ ] Migrate approved font, data-stack, Markdown, and Interactive warning
      surfaces from the Phase 1 inventory.
- [ ] Retain the existing Markdown PDF grouped-warning behavior through the
      shared presentation seam.
- [ ] Preserve warning wording, grouping, count, remediation, and exit behavior.
- [ ] Keep structured diagnostic severity and messages ANSI-free.

Verification:

- [ ] Assert an unknown root option renders only `error:` in red on eligible
      stderr.
- [ ] Assert parser output and help use injected runtime streams rather than
      bypassing them through process-owned defaults.
- [ ] Assert the invalid option text and following help remain unstyled.
- [ ] Assert the legacy timeout notice renders one yellow warning label and
      unchanged migration lines.
- [ ] Assert repeated or grouped warnings retain their existing emission count.
- [ ] Assert plain and stripped styled outputs match existing snapshots.
- [ ] Run focused parser, timeout, font, data-stack, and Markdown warning tests.
- [ ] Record the exact Phase 3 review range and gate decision.

Gate:

- [ ] Continue only when all approved first-wave errors and warnings use the
      shared contract without behavioral or plain-text drift.

### Phase 4: Informational Diagnostic Adoption

Adopt the notice/tip contract after Phase 2 has completed stream alignment.
Phase 4 verifies stream correctness but does not repeat the stream migration.

Status: not started.

Tasks:

- [ ] Route Interactive `Tip:` labels through the shared cyan notice style,
      using the explicit stderr target established in Phase 2.
- [ ] Apply the cyan notice style only to true ancillary notices approved in
      Phase 1.
- [ ] Verify that Interactive stack replay, data-query review, and source
      introspection remain stderr-correct after Phase 2.
- [ ] Preserve font `Info:` report rows and other stdout report fields under
      their current renderer ownership.
- [ ] Preserve doctor, SQL, table, and progress-specific visual semantics.
- [ ] Avoid adding new informational chatter to non-interactive commands.

Verification:

- [ ] Re-run stdout-TTY/stderr-redirected and stdout-redirected/stderr-TTY cases
      for every adopted informational renderer family.
- [ ] Assert tips and notices remain on their existing stream.
- [ ] Assert machine-readable stdout remains free of ANSI and ancillary text.
- [ ] Assert Interactive prompt order and workflow behavior are unchanged.
- [ ] Run focused Interactive notice, data-query, data-stack, font, and color
      regression tests.
- [ ] Record the exact Phase 4 review range and gate decision.

Gate:

- [ ] Continue only when true notices use the shared style, every adopted
      stderr surface remains stream-correct, and report-owned presentation is
      unchanged.

### Phase 5: Documentation, Full Validation, And Closeout

Document the steady-state contract and close the plan only after the built CLI
and full regression suite are verified.

Status: not started.

Tasks:

- [ ] Create `docs/guides/cli-output-and-color.md` as the current guide for
      global color controls, diagnostic labels, and stdout/stderr behavior.
- [ ] Document that plain text is canonical and color is TTY-only enhancement.
- [ ] Document `NO_COLOR` and `--no-color` examples.
- [ ] Record the final adopted-surface matrix and deferred domain presentation
      in the job record.
- [ ] Link the completed guide from the final job-record closeout section.
- [ ] Record that timeout Phase 7 resumes after this plan and must retain the
      original timeout implementation review boundary through Phase 6.
- [ ] Record the handoff requirement that the timeout Phase 7 job capture the
      integrated final color closeout commit as `COLOR_TIP`, including its full
      SHA, integration method, and ancestry evidence.
- [ ] Require fast-forward or non-rewriting merge integration so the reviewed
      `COLOR_TIP` remains unchanged; do not squash, cherry-pick, or rebase it
      after final review.
- [ ] Inspect built CLI unknown-option, warning, help, and no-color output.
- [ ] Run the full test suite and repository static checks.
- [ ] Review the complete implementation range from the plan's starting commit
      through the final implementation fix.
- [ ] Resolve accepted findings, then re-review the widened range.
- [ ] Mark phase checklists and plan status only from recorded evidence.

Verification:

- [ ] Run focused color and diagnostic suites.
- [ ] Run `bun test`.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `bun run lint`.
- [ ] Run `bun run format:check`.
- [ ] Run `bun run build`.
- [ ] Run `git diff --check`.
- [ ] Confirm the final working tree and documentation links are clean.

Gate:

- [ ] Complete the plan only when styled TTY output, plain redirected output,
      global color disabling, machine-output safety, and exact-range review all
      pass.

## Related Research

- [Markdown PDF page roles and counter semantics](../researches/research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)
  records the accepted yellow warning-label or warning-heading behavior,
  explicit stderr eligibility, and plain-output requirements.

## Historical Context

- [Data preview interactive mode and color polish](archive/plan-2026-03-09-data-preview-interactive-and-color-polish.md)
  established the global runtime ownership of `NO_COLOR` and `--no-color` while
  keeping presentation restrained and plain-text-first.
- [Doctor output information hierarchy](plan-2026-08-16-doctor-output-information-hierarchy.md)
  demonstrates domain-owned human presentation that remains outside this
  diagnostic-severity migration.
