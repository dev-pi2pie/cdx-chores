---
title: "CLI diagnostic color contract"
created-date: 2026-08-21
status: active
agent: codex
---

## Goal

Execute the phased implementation and validation defined by the
[CLI diagnostic color contract plan](../plan-2026-08-21-cli-diagnostic-color-contract.md).

## Starting Point

Starting commit: `3a846d175c627e8e4ed059d00944ba0b9036e56a`

Implementation branch: `codex/cli-diagnostic-color-contract`

The working tree was clean at this boundary. The agreed execution order is to
complete this plan before resuming Phase 7 of the
[Codex request timeout contract](../plan-2026-08-21-codex-request-timeout-contract.md).
The original timeout implementation review slice remains bounded by the
recorded Phase 6 implementation tip:

```text
efca21ea364d4765d1b780abb5e42cd3e499196f
```

The color work may change ANSI presentation around the existing timeout
`Warning:` label, but it does not own or change timeout semantics, canonical
plain wording, migration guidance, guides, release notes, or timeout closeout
records.

## Phase 1: Diagnostic Inventory And Contract Freeze

Status: completed.

Phase 1 inventories color-producing paths and user-facing diagnostic surfaces
before any production or test implementation change. Its gate freezes the
first-wave migration list, source and test ownership, structured-output risk,
and explicit deferrals.

### Inventory Evidence

```text
rg -n 'getCliColors|getProcessColors|createColors|from "picocolors"' src
rg -n '\\x1b|\\u001b' src
rg -n 'error:|Warning:|Info:|Tip:|warnings:' src/command.ts src/cli
completed

bun test test/cli-color.test.ts test/cli-markdown-pdf-warning-output.test.ts test/cli-command-rename-timeout.test.ts test/fonts-cli-list.test.ts test/fonts-cli-inspect-debug.test.ts test/fonts-cli-check-output.test.ts test/cli-command-data-stack/options.test.ts test/cli-command-data-stack/replay.test.ts test/cli-actions-md-to-pdf-bundle.test.ts test/cli-interactive-markdown-pdf/deterministic-service.test.ts test/cli-interactive-routing-data-query-source-shape.test.ts test/cli-interactive-markdown-pdf/render-sources.test.ts test/cli-interactive-notice.test.ts test/cli-interactive-contextual-tip.test.ts
217 pass, 0 fail

git diff --check
passed
```

No production or test code changed in Phase 1.

### Adopted-Surface Matrix

| Source owner                                                                                              | Stream          | Role                                                   | Focused test owner                                                                                         | Structured-output risk                                               | Phase                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/cli/colors.ts`                                                                                       | caller-selected | shared color eligibility and semantic-label foundation | existing `test/cli-color.test.ts`; planned `test/cli-diagnostic-color.test.ts`                             | helper must never enter stored data                                  | 2                                                     |
| aligned `getCliColors(...)` stdout consumers in doctor, preview, query, DuckDB, font, and debug renderers | stdout          | domain-owned human presentation                        | existing doctor, preview, query, DuckDB, and font suites                                                   | JSON and other machine payloads must remain plain                    | 2 for explicit stream; semantic presentation deferred |
| `src/cli/interactive/data/stack/artifacts.ts`                                                             | stderr          | domain-owned replay guidance                           | `test/cli-interactive-data-stack/dry-run-write.test.ts`; `test/cli-interactive-routing-data-stack.test.ts` | no stack-plan or report change                                       | 2 for stream fix; Phase 4 regression only             |
| `src/cli/interactive/data-query/execution.ts`                                                             | stderr          | domain-owned SQL review                                | data-query review, formal, and manual routing suites                                                       | SQL-only and machine output excluded                                 | 2 for stream fix; semantic presentation deferred      |
| `src/cli/interactive/data-query/source-shape/introspection-rendering.ts`                                  | stderr          | domain-owned source/schema review                      | source-shape and header-routing suites                                                                     | introspection data remains plain                                     | 2 for stream fix; semantic presentation deferred      |
| `src/cli/interactive/notice.ts`                                                                           | stderr          | contextual `Tip:`                                      | `test/cli-interactive-notice.test.ts`; contextual-tip and routing suites                                   | Interactive-only; prompt order must remain stable                    | 2 for stream fix; 4 for semantic adoption             |
| `src/command.ts` Commander output                                                                         | stderr          | parser `error:`                                        | planned `test/cli-command-output-color.test.ts`; existing CLI UX and Interactive timeout regressions       | help/version routing must not affect machine output                  | 3                                                     |
| `src/cli/commands/rename.ts` with plain formatter in `src/cli/options/codex-timeout.ts`                   | stderr          | legacy timeout compatibility `Warning:`                | timeout option and rename command suites                                                                   | formatter and timeout semantics remain plain and unchanged           | 3                                                     |
| `src/cli/actions/font.ts`; `src/cli/actions/font-check.ts` warning writers                                | stderr          | discovery `Warning:`                                   | font list, inspect-debug, and check-output suites                                                          | JSON warning arrays remain plain and suppress text-mode warning loop | 3                                                     |
| `src/cli/actions/data-stack/reporting.ts`                                                                 | stderr          | compatibility `Warning:`                               | `test/cli-command-data-stack/options.test.ts`                                                              | stack data and plan artifacts unchanged                              | 3                                                     |
| `src/cli/actions/data-stack-replay.ts`                                                                    | stderr          | per-source fingerprint `Warning:`                      | `test/cli-command-data-stack/replay.test.ts`; add missing-stat branch assertion                            | plan fingerprint data remains plain                                  | 3                                                     |
| `src/cli/actions/markdown/to-pdf.ts`                                                                      | stderr          | ignored-bundle `Warning:` heading                      | `test/cli-actions-md-to-pdf-bundle.test.ts`                                                                | PDF and bundle artifacts unchanged                                   | 3                                                     |
| `src/cli/actions/markdown/render-warnings.ts`                                                             | stderr          | grouped warning heading and reference presentation     | `test/cli-markdown-pdf-warning-output.test.ts`; Markdown diagnostics integration                           | warning arrays and structured diagnostics remain plain               | 3                                                     |
| `src/cli/interactive/markdown/authoring-review.ts`                                                        | stderr          | deterministic authoring `Warning:`                     | deterministic service and authoring suites                                                                 | diagnostic objects remain plain                                      | 3                                                     |
| `src/cli/interactive/data-query/source-shape/index.ts`                                                    | stderr          | suspicious-sheet warning heading                       | source-shape routing suite                                                                                 | source-shape data remains plain                                      | 3                                                     |
| `src/cli/interactive/markdown/review.ts`                                                                  | stderr          | bundle warning heading                                 | Interactive Markdown render-sources suite                                                                  | pure review-line formatter remains ANSI-free                         | 3                                                     |

The planned `test/cli-diagnostic-color.test.ts` owner must cover label-only
red/yellow/cyan styling, independently eligible and ineligible target streams,
ANSI-stripped canonical text, `NO_COLOR`, and disabled runtime color.

### Complete Color-Path Appendix

| Source call site or function                                                                        | Helper                                  | Actual target                                        | Phase 2 assignment or deferral                                   | Exact focused test owner                                                                                                  |
| --------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/colors.ts:getCliColors`                                                                    | `createColors(...)`                     | caller-selected stream; currently defaults to stdout | require target stream; remove default after migration            | existing `test/cli-color.test.ts`; planned `test/cli-diagnostic-color.test.ts`                                            |
| `src/cli/colors.ts:getProcessColors`                                                                | `createColors(...)`                     | process stdout                                       | defer as process-owned version presentation                      | `test/cli-ux.test.ts`                                                                                                     |
| `src/cli/doctor/render.ts:renderCompactDoctorReport`                                                | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain doctor semantics                   | `test/cli-action-doctor.test.ts`; `test/cli-command-doctor.test.ts`                                                       |
| `src/cli/doctor/render.ts:renderDetailedDoctorReport`                                               | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain doctor semantics                   | `test/cli-action-doctor.test.ts`; `test/cli-command-doctor.test.ts`                                                       |
| `src/cli/data-preview/render.ts:renderTable`                                                        | `getCliColors(runtime)`                 | returned human lines written to stdout               | pass `runtime.stdout`; retain table semantics                    | `test/cli-actions-data-preview/rendering.test.ts`; `test/cli-actions-data-preview/highlighting.test.ts`                   |
| `src/cli/data-preview/render.ts:renderDataPreview`                                                  | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain preview semantics                  | `test/cli-actions-data-preview/rendering.test.ts`; `test/cli-color.test.ts`                                               |
| `src/cli/data-query/render.ts:renderTable`                                                          | `getCliColors(runtime)`                 | returned human lines written to stdout               | pass `runtime.stdout`; retain table semantics                    | `test/cli-actions-data-query.test.ts`                                                                                     |
| `src/cli/data-query/render.ts:renderDataQuery`                                                      | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain query semantics                    | `test/cli-actions-data-query.test.ts`; `test/cli-actions-data-query-workspace.test.ts`                                    |
| `src/cli/data-query/render.ts:renderDataQueryCodexDraft`                                            | `getCliColors(options.runtime)`         | stdout                                               | pass `options.runtime.stdout`; retain SQL/report semantics       | `test/cli-actions-data-query-codex.test.ts`; `test/cli-actions-data-query-codex-workspace.test.ts`                        |
| `src/cli/data-query/view.ts` type reference                                                         | `ReturnType<typeof getCliColors>`       | no output                                            | no runtime migration; retain as type-only dependency             | TypeScript check                                                                                                          |
| `src/cli/actions/data-duckdb.ts:renderDuckDbProbe`                                                  | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain report semantics                   | `test/cli-command-data-query-duckdb-lifecycle.test.ts`                                                                    |
| `src/cli/actions/data-duckdb.ts:actionDataDuckDbDoctor`                                             | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain doctor semantics                   | `test/cli-actions-doctor-markdown-video-deferred.test.ts`; `test/cli-command-data-query-duckdb-lifecycle.test.ts`         |
| `src/cli/actions/font.ts:actionFontList` text renderer                                              | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain font-report semantics              | `test/fonts-cli-list.test.ts`                                                                                             |
| `src/cli/actions/font.ts:printInspectFace`                                                          | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain font-detail semantics              | `test/fonts-cli-inspect-output.test.ts`                                                                                   |
| `src/cli/actions/font.ts:actionFontInspect` text renderer                                           | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain font-report semantics              | `test/fonts-cli-inspect-output.test.ts`; `test/fonts-cli-inspect-debug.test.ts`                                           |
| `src/cli/actions/font-check.ts:printFontCheckTextOutput`                                            | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain font-report semantics              | `test/fonts-cli-check-output.test.ts`                                                                                     |
| `src/cli/actions/font-common.ts:printFontDebugAttempts`                                             | `getCliColors(runtime)`                 | stdout                                               | pass `runtime.stdout`; retain debug-report semantics             | `test/fonts-cli-list.test.ts`; `test/fonts-cli-inspect-debug.test.ts`                                                     |
| `src/cli/actions/markdown/render-warnings.ts:printMarkdownPdfRenderWarnings`                        | `getCliColors(runtime, runtime.stderr)` | stderr                                               | already explicit; retain reference warning behavior              | `test/cli-markdown-pdf-warning-output.test.ts`                                                                            |
| `src/cli/interactive/data/stack/artifacts.ts:renderInteractiveStackReplayTip`                       | `getCliColors(runtime)`                 | stderr                                               | pass `runtime.stderr`; retain replay-guidance semantics          | `test/cli-interactive-data-stack/dry-run-write.test.ts`; `test/cli-interactive-routing-data-stack.test.ts`                |
| `src/cli/interactive/data-query/execution.ts:renderCandidateSql`                                    | `getCliColors(runtime)`                 | stderr                                               | pass `runtime.stderr`; retain SQL-review semantics               | `test/cli-interactive-routing-data-query-review.test.ts`                                                                  |
| `src/cli/interactive/data-query/execution.ts:renderOutputReview`                                    | `getCliColors(runtime)`                 | stderr                                               | pass `runtime.stderr`; retain review semantics                   | `test/cli-interactive-routing-data-query-review.test.ts`                                                                  |
| `src/cli/interactive/data-query/source-shape/introspection-rendering.ts:renderIntrospectionSummary` | `getCliColors(runtime)`                 | stderr                                               | pass `runtime.stderr`; retain source-review semantics            | `test/cli-interactive-routing-data-query-source-shape.test.ts`; `test/cli-interactive-routing-data-query-headers.test.ts` |
| `src/cli/interactive/notice.ts:writeInteractiveTip`                                                 | `getCliColors(runtime)`                 | stderr                                               | pass `runtime.stderr` in Phase 2; shared notice style in Phase 4 | `test/cli-interactive-notice.test.ts`; `test/cli-interactive-contextual-tip.test.ts`                                      |
| `src/cli/program/version.ts:getFormattedVersionLabel`                                               | `getProcessColors(...)`                 | process stdout                                       | defer as process-owned branding                                  | `test/cli-ux.test.ts`                                                                                                     |
| `src/cli/interactive/analyzer-status.ts` frame renderers                                            | direct `createColors(...)`              | supplied TTY stream                                  | defer as aligned transient progress                              | `test/cli-interactive-analyzer-status.test.ts`                                                                            |

### Canonical Baseline Appendix

| Adopted family               | Canonical plain text or shape                                                                                       | Emission and exit baseline                                                                                 | Exact focused test owner                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commander parser error       | lowercase `error: <message>`, blank line, then help                                                                 | one parser error; parse stops with exit `1`                                                                | planned `test/cli-command-output-color.test.ts`; existing `test/cli-command-interactive-timeout.test.ts`; `test/cli-ux.test.ts`                                                                                                                             |
| legacy timeout compatibility | singular/plural `Warning: legacy Codex timeout ... deprecated.` followed by migration and compatibility lines       | one multiline block per invocation; command behavior and exit remain action-owned                          | `test/cli-options-codex-timeout.test.ts`; `test/cli-command-rename-timeout.test.ts`                                                                                                                                                                         |
| font discovery               | `Warning: ${warning}`                                                                                               | one line per discovery warning in text mode; JSON retains plain warning arrays; exit remains command-owned | `test/fonts-cli-list.test.ts`; `test/fonts-cli-inspect-debug.test.ts`; `test/fonts-cli-check-output.test.ts`                                                                                                                                                |
| data-stack alias             | `Warning: --union-by-name is a canary compatibility alias. Use --schema-mode union-by-name.`                        | exactly once when alias is used; operation continues                                                       | `test/cli-command-data-stack/options.test.ts`                                                                                                                                                                                                               |
| replay fingerprint           | `Warning: source fingerprint changed for ${path}` or `Warning: source fingerprint could not be checked for ${path}` | zero or one per fingerprinted source; replay continues                                                     | `test/cli-command-data-stack/replay.test.ts`; add missing-stat assertion in Phase 3                                                                                                                                                                         |
| direct ignored bundle        | `Warning: ignored unclassified YAML or JSON bundle files:` plus stable bullets                                      | one heading when files are ignored; render continues                                                       | `test/cli-actions-md-to-pdf-bundle.test.ts`                                                                                                                                                                                                                 |
| Markdown render warnings     | `Markdown PDF render warnings:` plus one bullet per warning                                                         | nothing when empty; otherwise one heading; render result/exit unchanged                                    | `test/cli-markdown-pdf-warning-output.test.ts`; `test/cli-actions-md-to-pdf-diagnostics.test.ts`                                                                                                                                                            |
| deterministic authoring      | `Warning: ${diagnostic.message}`                                                                                    | empty-cover and occupied-slot warnings may each emit once; review/save continues                           | `test/cli-interactive-markdown-pdf/deterministic-service.test.ts`; `test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts`                                                                                                                      |
| suspicious sheet shape       | `Sheet shape warning: current Excel sheet shape looks suspicious.` plus explanation/reasons                         | one heading for suspicious shape followed by a user choice; no exit effect                                 | `test/cli-interactive-routing-data-query-source-shape.test.ts`                                                                                                                                                                                              |
| Interactive bundle warnings  | `Bundle warnings:` plus `- Ignored unclassified YAML or JSON file: ${filename}`                                     | one grouped section when applicable; workflow continues                                                    | `test/cli-interactive-markdown-pdf/render-sources.test.ts`                                                                                                                                                                                                  |
| Interactive tip              | blank line, `Tip: ${message}`, blank line                                                                           | at most one selected tip on supported flow entry; no exit effect                                           | `test/cli-interactive-notice.test.ts`; `test/cli-interactive-contextual-tip.test.ts`; `test/cli-interactive-routing-data-query-review.test.ts`; `test/cli-interactive-routing-data-stack.test.ts`; `test/cli-interactive-routing-data-extract-core.test.ts` |

The canonical baseline appendix covers semantic consumers adopted in Phases 3
and 4. The following Phase 2 callers receive stream arguments only; their
wording, emission, exit behavior, and domain colors remain unchanged and are
protected by existing focused tests.

### Phase 2 Stream-Only Baseline

| Caller family                                  | Canonical behavior retained                                                                   | Existing focused protection                                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| doctor compact/detailed reports                | same stdout headings, states, issue/action sections, and exit behavior                        | `test/cli-action-doctor.test.ts`; `test/cli-command-doctor.test.ts`                                                                                   |
| data preview table and summary                 | same stdout summary labels, table cells, highlighting, and result behavior                    | `test/cli-actions-data-preview/rendering.test.ts`; `test/cli-actions-data-preview/highlighting.test.ts`; `test/cli-color.test.ts`                     |
| data query table, report, and Codex draft view | same stdout schema, rows, SQL/report labels, and machine-output separation                    | `test/cli-actions-data-query.test.ts`; `test/cli-actions-data-query-workspace.test.ts`; `test/cli-actions-data-query-codex.test.ts`                   |
| DuckDB human reports                           | same stdout probe, doctor, cache, and remediation presentation                                | `test/cli-command-data-query-duckdb-lifecycle.test.ts`; `test/cli-actions-doctor-markdown-video-deferred.test.ts`                                     |
| font list/inspect/check/debug reports          | same stdout report fields, dim `Info:` rows, JSON separation, and command-owned exit behavior | `test/fonts-cli-list.test.ts`; `test/fonts-cli-inspect-output.test.ts`; `test/fonts-cli-inspect-debug.test.ts`; `test/fonts-cli-check-output.test.ts` |
| Interactive stack replay guidance              | same stderr `Replay later:` wording, plan-retention condition, and workflow result            | `test/cli-interactive-data-stack/dry-run-write.test.ts`; `test/cli-interactive-routing-data-stack.test.ts`                                            |
| Interactive data-query review                  | same stderr SQL, SQL-limit, and table-preview labels plus unchanged prompt/execution behavior | `test/cli-interactive-routing-data-query-review.test.ts`                                                                                              |
| Interactive source-shape summary               | same stderr input, format, schema, and sample-row review before unchanged choices             | `test/cli-interactive-routing-data-query-source-shape.test.ts`; `test/cli-interactive-routing-data-query-headers.test.ts`                             |
| existing Markdown warning renderer             | same explicit stderr eligibility, yellow heading, plain bullets, and empty-list behavior      | `test/cli-markdown-pdf-warning-output.test.ts`                                                                                                        |

### Reproducible Stream-Mismatch Map

| Exact source function                                                                               | Current eligibility | Actual write | Phase 2 target  | Focused test owner                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/interactive/data/stack/artifacts.ts:renderInteractiveStackReplayTip`                       | implicit stdout     | stderr       | explicit stderr | `test/cli-interactive-data-stack/dry-run-write.test.ts`; `test/cli-interactive-routing-data-stack.test.ts`                |
| `src/cli/interactive/data-query/execution.ts:renderCandidateSql`                                    | implicit stdout     | stderr       | explicit stderr | `test/cli-interactive-routing-data-query-review.test.ts`                                                                  |
| `src/cli/interactive/data-query/execution.ts:renderOutputReview`                                    | implicit stdout     | stderr       | explicit stderr | `test/cli-interactive-routing-data-query-review.test.ts`                                                                  |
| `src/cli/interactive/data-query/source-shape/introspection-rendering.ts:renderIntrospectionSummary` | implicit stdout     | stderr       | explicit stderr | `test/cli-interactive-routing-data-query-source-shape.test.ts`; `test/cli-interactive-routing-data-query-headers.test.ts` |
| `src/cli/interactive/notice.ts:writeInteractiveTip`                                                 | implicit stdout     | stderr       | explicit stderr | `test/cli-interactive-notice.test.ts`; `test/cli-interactive-contextual-tip.test.ts`                                      |

The inventory describes four renderer modules with mismatches and five exact
functions because `execution.ts` owns two distinct rendering call sites. Tip
availability and width remain intentionally stdout-TTY-owned; only its color
eligibility follows the stderr write target.

### Explicit Deferrals And Exclusions

| Owner                                                              | Classification                         | Reason                                                                       |
| ------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| `src/cli/program/version.ts` and `getProcessColors(...)`           | process-owned branding                 | aligned to process stdout; not a diagnostic                                  |
| `src/cli/interactive/analyzer-status.ts`                           | transient progress                     | direct color and erase-line behavior is stream/TTY-owned and already aligned |
| `src/cli/tui/screen.ts:dim` and inline-renderer hint/default use   | deferred domain-owned TUI presentation | raw SGR dim styling is not a global diagnostic role; retain TUI ownership    |
| TUI cursor, erase, bell, visibility, and key-sequence paths        | terminal control/input                 | control and input sequences are not semantic diagnostic color                |
| `src/cli/actions/codex-progress.ts` and Markdown font-hint cleanup | transient progress/control             | raw control paths are gated by their supplied TTY stream                     |
| font `Info:` rows                                                  | stdout report fields                   | no true ancillary `Info:` diagnostic exists today                            |
| doctor states/headings, SQL review colors, tables, and highlights  | domain presentation                    | retain current renderer ownership                                            |
| `Replay later:`                                                    | domain remediation                     | retain yellow/cyan wording; Phase 2 fixes only its stream eligibility        |
| raw `CliError` and top-level `Failed to run CLI:` messages         | unlabeled operational failure          | the plan does not invent or normalize new prefixes                           |
| model prompt text and Markdown code warning/error classes          | non-terminal generated content         | excluded from the CLI diagnostic contract                                    |

### Frozen Migration Boundary

- Phase 2 owns the shared semantic-label seam, explicit streams for every
  `getCliColors(...)` caller, removal of the stdout default, and the four known
  stderr mismatch fixes.
- Phase 3 owns Commander parser errors and the nine warning families listed in
  the adopted-surface matrix.
- Phase 4 owns only the existing Interactive `Tip:` semantic family. It does
  not invent an `Info:` consumer or repeat stream migration.
- Canonical plain text, warning grouping/count, exit behavior, prompt order,
  structured diagnostics, JSON, artifacts, SQL-only output, and domain-owned
  presentation remain unchanged.

### Review And Gate

Phase 1 commits:

- `4ec9c8f6` — opened the execution record, froze the first adopted/deferred
  surface matrix, recorded inventory evidence, and updated evidenced checklist
  items
- `490b6c94` — added the complete per-call-site appendix, canonical semantic
  baselines, exact stream-mismatch map, concrete test ownership, and separate
  TUI presentation/control classifications
- `164d349b` — corrected the warning-family count, distinguished planned tests
  from existing evidence, and added the Phase 2 stream-only baseline

Final widened review range:

```text
3a846d175c627e8e4ed059d00944ba0b9036e56a..164d349b
```

The first source-contract and documentation reviews found grouped call-site
ownership, incomplete canonical baselines, an unreproducible mismatch summary,
and a conflated TUI dim/control classification. The first test review also
found that future test owners were unnamed. Those findings were accepted and
addressed in `490b6c94`.

The widened documentation review then found an incorrect warning-family count,
an unstated boundary between semantic and stream-only baselines, and planned
test owners presented as existing evidence. Those findings were accepted and
addressed in `164d349b`.

Final widened source-contract, test-quality, and documentation reviews passed
with no remaining material findings.

Decision gate: `Continue`. Phase 1 is complete. The first migration wave is
unambiguous: Phase 2 owns the semantic helper and every explicit stream
argument, Phase 3 owns Commander plus nine warning families, and Phase 4 owns
the existing `Tip:` family without inventing an `Info:` consumer. No production
or test code changed in this phase.

## Phase 2: Shared Stream-Aware Presentation Foundation

Status: completed.

Starting commit: `998a525a64c633d43e4a5332def2edd5dedd11a2`

Phase 2 adds the shared semantic-label presentation seam, requires explicit
target streams for runtime color acquisition, fixes the five recorded
function-level stream mismatches across four renderer modules, and preserves
all domain-owned semantics. Parser, warning, and tip consumers remain assigned
to Phases 3 and 4.

### Validation

```text
bun test test/cli-diagnostic-color.test.ts test/cli-color.test.ts test/cli-interactive-notice.test.ts test/cli-interactive-data-stack/dry-run-write.test.ts test/cli-interactive-routing-data-stack.test.ts test/cli-interactive-routing-data-query-review.test.ts test/cli-interactive-routing-data-query-source-shape.test.ts test/cli-interactive-routing-data-query-headers.test.ts test/cli-action-doctor.test.ts test/cli-command-doctor.test.ts test/cli-actions-data-preview/rendering.test.ts test/cli-actions-data-preview/highlighting.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-query-workspace.test.ts test/cli-command-data-query-duckdb-lifecycle.test.ts test/fonts-cli-list.test.ts test/fonts-cli-inspect-output.test.ts test/fonts-cli-inspect-debug.test.ts test/fonts-cli-check-output.test.ts test/cli-markdown-pdf-warning-output.test.ts
177 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
passed
```

The focused suite covers the semantic helper, independently eligible streams,
all five recorded mismatch functions, explicit stdout callers, domain-owned
report regressions, machine-output separation, runtime color disabling,
`NO_COLOR`, `--no-color`, and ANSI-stripped canonical text.

### Review And Gate

Implementation commit:

- `fecd314d` — added the shared semantic-label seam, required explicit streams,
  migrated all runtime callers, fixed stderr eligibility, and added independent
  stream regressions

Review range:

```text
998a525a64c633d43e4a5332def2edd5dedd11a2..fecd314d4dc69b8ce90cf0877bba6b2cd141c270
```

Correctness, test-quality, and maintainability reviews passed with no material
findings. No review-fix commit or widened range was required.

Decision gate: `Continue`. Phase 2 is complete. Every runtime
`getCliColors(...)` call names its actual target stream, the implicit stdout
default is removed, the five mismatch functions use stderr eligibility, and
real parser, warning, and tip semantic adoption remains deferred to Phases 3
and 4.

## Phase 3: Parser Error And Warning Adoption

Status: completed.

Starting commit: `6b85f7866dab60206264dff1944ab0c3b8383f65`

Phase 3 routes the existing Commander `error:` label and nine approved warning
families through the shared semantic-label seam. Plain wording, help layout,
warning emission behavior, exit behavior, structured diagnostics, and machine
outputs remain unchanged.

Implementation checkpoints:

- `0f5f5523b61adb88a38129c06d073349e8fa527c` — routed Commander output
  through the injected runtime streams and colored only the leading parser
  `error:` label.
- `a1ea19f2afa244069b0a854904f4bdeaef31cdcf` — adopted the shared yellow
  warning style across the nine approved warning families.
- `8cddec57b5a765d12ef1a750f3e8376b94a2c7b7` — recorded the initial Phase 3
  implementation and validation checkpoint.
- `d4128cfc43d084116ab0d21754249172adff4508` — resolved review findings by
  using prefix-safe legacy-notice formatting and deriving version color
  eligibility from the injected stdout stream.

Validation evidence:

- The combined Phase 3 focused selection passed 338 tests across 19 files with
  no failures.
- The review-fix selection passed 111 tests with no failures.
- Type checking, linting, formatting, the production build, and
  `git diff --check` passed.
- The built root-command unknown-option smoke retained exit code `1`, the
  canonical error text, and the existing help layout.
- Eligible, redirected, `NO_COLOR`, `--no-color`, and disabled-runtime cases
  keep plain and stripped output equivalent.

Initial review range:

```text
6b85f7866dab60206264dff1944ab0c3b8383f65..8cddec57b5a765d12ef1a750f3e8376b94a2c7b7
```

The initial review found two accepted presentation-boundary issues: the legacy
timeout notice replaced an unverified substring, and version output checked the
process-owned stdout rather than its injected destination. Both were corrected
without changing canonical text or command behavior.

Final widened review range:

```text
6b85f7866dab60206264dff1944ab0c3b8383f65..d4128cfc43d084116ab0d21754249172adff4508
```

Correctness, test-quality, and maintainability re-reviews passed with no
remaining material findings.

Decision gate: `Continue`. Phase 3 is complete. Commander parser errors and all
nine approved warning families use the shared semantic style while plain text,
stream routing, warning cardinality, structured data, help output, and exit
behavior remain unchanged. Phase 4 may adopt the existing Interactive `Tip:`
family.
