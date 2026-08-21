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

Status: in progress.

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

| Source owner | Stream | Role | Focused test owner | Structured-output risk | Phase |
| --- | --- | --- | --- | --- | --- |
| `src/cli/colors.ts` | caller-selected | shared color eligibility and semantic-label foundation | `test/cli-color.test.ts`; new focused diagnostic-color tests | helper must never enter stored data | 2 |
| aligned `getCliColors(...)` stdout consumers in doctor, preview, query, DuckDB, font, and debug renderers | stdout | domain-owned human presentation | existing doctor, preview, query, DuckDB, and font suites | JSON and other machine payloads must remain plain | 2 for explicit stream; semantic presentation deferred |
| `src/cli/interactive/data/stack/artifacts.ts` | stderr | domain-owned replay guidance | `test/cli-interactive-data-stack/dry-run-write.test.ts`; `test/cli-interactive-routing-data-stack.test.ts` | no stack-plan or report change | 2 for stream fix; Phase 4 regression only |
| `src/cli/interactive/data-query/execution.ts` | stderr | domain-owned SQL review | data-query review, formal, and manual routing suites | SQL-only and machine output excluded | 2 for stream fix; semantic presentation deferred |
| `src/cli/interactive/data-query/source-shape/introspection-rendering.ts` | stderr | domain-owned source/schema review | source-shape and header-routing suites | introspection data remains plain | 2 for stream fix; semantic presentation deferred |
| `src/cli/interactive/notice.ts` | stderr | contextual `Tip:` | `test/cli-interactive-notice.test.ts`; contextual-tip and routing suites | Interactive-only; prompt order must remain stable | 2 for stream fix; 4 for semantic adoption |
| `src/command.ts` Commander output | stderr | parser `error:` | new `test/cli-command-output-color.test.ts`; CLI UX and Interactive timeout regressions | help/version routing must not affect machine output | 3 |
| `src/cli/commands/rename.ts` with plain formatter in `src/cli/options/codex-timeout.ts` | stderr | legacy timeout compatibility `Warning:` | timeout option and rename command suites | formatter and timeout semantics remain plain and unchanged | 3 |
| `src/cli/actions/font.ts`; `src/cli/actions/font-check.ts` warning writers | stderr | discovery `Warning:` | font list, inspect-debug, and check-output suites | JSON warning arrays remain plain and suppress text-mode warning loop | 3 |
| `src/cli/actions/data-stack/reporting.ts` | stderr | compatibility `Warning:` | `test/cli-command-data-stack/options.test.ts` | stack data and plan artifacts unchanged | 3 |
| `src/cli/actions/data-stack-replay.ts` | stderr | per-source fingerprint `Warning:` | `test/cli-command-data-stack/replay.test.ts`; add missing-stat branch assertion | plan fingerprint data remains plain | 3 |
| `src/cli/actions/markdown/to-pdf.ts` | stderr | ignored-bundle `Warning:` heading | `test/cli-actions-md-to-pdf-bundle.test.ts` | PDF and bundle artifacts unchanged | 3 |
| `src/cli/actions/markdown/render-warnings.ts` | stderr | grouped warning heading and reference presentation | `test/cli-markdown-pdf-warning-output.test.ts`; Markdown diagnostics integration | warning arrays and structured diagnostics remain plain | 3 |
| `src/cli/interactive/markdown/authoring-review.ts` | stderr | deterministic authoring `Warning:` | deterministic service and authoring suites | diagnostic objects remain plain | 3 |
| `src/cli/interactive/data-query/source-shape/index.ts` | stderr | suspicious-sheet warning heading | source-shape routing suite | source-shape data remains plain | 3 |
| `src/cli/interactive/markdown/review.ts` | stderr | bundle warning heading | Interactive Markdown render-sources suite | pure review-line formatter remains ANSI-free | 3 |

### Explicit Deferrals And Exclusions

| Owner | Classification | Reason |
| --- | --- | --- |
| `src/cli/program/version.ts` and `getProcessColors(...)` | process-owned branding | aligned to process stdout; not a diagnostic |
| `src/cli/interactive/analyzer-status.ts` | transient progress | direct color and erase-line behavior is stream/TTY-owned and already aligned |
| TUI screen, inline renderer, and key modules | terminal control/input | cursor, erase, bell, and key sequences are not semantic diagnostic color |
| `src/cli/actions/codex-progress.ts` and Markdown font-hint cleanup | transient progress/control | raw control paths are gated by their supplied TTY stream |
| font `Info:` rows | stdout report fields | no true ancillary `Info:` diagnostic exists today |
| doctor states/headings, SQL review colors, tables, and highlights | domain presentation | retain current renderer ownership |
| `Replay later:` | domain remediation | retain yellow/cyan wording; Phase 2 fixes only its stream eligibility |
| raw `CliError` and top-level `Failed to run CLI:` messages | unlabeled operational failure | the plan does not invent or normalize new prefixes |
| model prompt text and Markdown code warning/error classes | non-terminal generated content | excluded from the CLI diagnostic contract |

### Frozen Migration Boundary

- Phase 2 owns the shared semantic-label seam, explicit streams for every
  `getCliColors(...)` caller, removal of the stdout default, and the four known
  stderr mismatch fixes.
- Phase 3 owns Commander parser errors and the ten warning families listed in
  the adopted-surface matrix.
- Phase 4 owns only the existing Interactive `Tip:` semantic family. It does
  not invent an `Info:` consumer or repeat stream migration.
- Canonical plain text, warning grouping/count, exit behavior, prompt order,
  structured diagnostics, JSON, artifacts, SQL-only output, and domain-owned
  presentation remain unchanged.

Phase 1 review and gate decision remain pending until the inventory checkpoint
is committed and reviewed over its exact range.
