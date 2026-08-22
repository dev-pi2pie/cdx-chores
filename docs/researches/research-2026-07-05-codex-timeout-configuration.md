---
title: "cdx-chores Codex Request Timeout Contract"
created-date: 2026-07-05
modified-date: 2026-08-22
status: in-progress
agent: codex
---

## Goal

Record how `cdx-chores` exposes a consistent timeout contract for its
Codex-backed CLI requests without changing existing behavior unexpectedly.

This research covers application-enforced request deadlines passed through
`AbortSignal.timeout(...)`. It does not define an upstream Codex service timeout
or treat Codex provider, stream-idle, or MCP timeout settings as equivalent.

The inventory and implementation-evidence sections describe shipped behavior.
The staged reasoning remains here to explain why the completed implementation
keeps timeout, retry, repair, and regeneration under different ownership.

## Executive Summary

- The completed contract keeps the existing 30-second per-request defaults for
  compatibility. The
  controlled Markdown PDF smoke supports that default for the tested Markdown
  PDF path, not as a universal latency conclusion for every Codex workflow.
- A shared, duration-based `--codex-timeout <duration>` contract now appears on
  relevant command surfaces. Treat it as a reusable command option rather than
  requiring one root-level CLI flag on commands that do not use Codex.
- Rename also exposes analyzer-specific timeout overrides, with
  `--codex-images-timeout <duration>` and
  `--codex-docs-timeout <duration>` overriding the shared value.
- The duration-based rename equivalents coexist with the legacy millisecond
  flags during a compatibility period. The old flags keep working, emit one
  deprecation notice when used,
  provide exact replacements when values satisfy the new contract, and do not
  schedule removal until a release boundary is chosen.
- Timeout applies to each Codex request attempt. Batches, retries,
  repair requests, phases, and user-triggered regeneration can make the total
  command duration longer.
- Retry configuration remains workflow-owned. The implementation does not add a
  repository-wide `--codex-retries` option merely because timeout parsing
  becomes shared.
- Total command budgets, config-file and environment-variable sources, and
  report-schema changes remain non-goals until a concrete operational need is
  demonstrated.

## Key Findings

### Evidence Boundary

The completed Markdown PDF project-helper work kept 30 seconds as the committed
default. A controlled smoke passed after the Codex runner path was fixed, and the
earlier failure was not proven to be a timeout problem.[^markdown-pdf-smoke]

That evidence supports retaining 30 seconds for the tested Markdown PDF path. It
does not establish that 30 seconds is optimal for every Codex-backed command.
The repository-wide reason to retain current defaults is compatibility while
explicit overrides and better failure information are introduced.

### Current Timeout Surface Inventory

The inventory below reflects the implementation re-reviewed on the document's
`modified-date`.[^timeout-inventory]

| Area                         | Entry points                                               | Current default | Public timeout option                                                                                                                      | Request multiplicity                                                         |
| ---------------------------- | ---------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Rename image analyzer        | `rename file`, `rename batch`, `batch-rename`              | 30s             | `--codex-timeout`, `--codex-images-timeout`, and legacy `--codex-images-timeout-ms`; explicit Interactive sessions use their session value | One request per batch attempt; up to `batch count × (retries + 1)` attempts. |
| Rename document analyzer     | `rename file`, `rename batch`, `batch-rename`              | 30s             | `--codex-timeout`, `--codex-docs-timeout`, and legacy `--codex-docs-timeout-ms`; explicit Interactive sessions use their session value     | One request per batch attempt; up to `batch count × (retries + 1)` attempts. |
| Rename cleanup suggestion    | Interactive rename cleanup                                 | 30s             | `interactive --codex-timeout`                                                                                                              | One request per suggestion invocation.                                       |
| Markdown PDF profile helper  | `md pdf-profile codex`, Interactive authoring              | 30s             | direct `--codex-timeout`; explicit Interactive sessions use their session value                                                            | One request per generation.                                                  |
| Markdown PDF template helper | `md pdf-template codex`, Interactive authoring             | 30s             | direct `--codex-timeout`; explicit Interactive sessions use their session value                                                            | The initial request and a separate application-repair request when needed.   |
| Markdown PDF project helper  | `md pdf-project codex`, Interactive authoring              | 30s per request | direct `--codex-timeout`; explicit Interactive sessions use their session value                                                            | Profile, template, and template-repair requests receive independent windows. |
| Data query SQL drafting      | `data query codex`, Interactive Codex mode                 | 30s             | direct `--codex-timeout`; explicit Interactive sessions use their session value                                                            | One request per draft or user-triggered regeneration.                        |
| Data stack Codex assist      | `data stack --codex-assist`, Interactive review            | 30s             | direct `--codex-timeout`; explicit Interactive sessions use their session value                                                            | One request per assist invocation.                                           |
| Header-mapping suggestions   | data query/extract suggestion modes and Interactive review | 30s             | direct embedded helpers remain default-only; explicit Interactive sessions use their session value                                         | One request per suggestion invocation.                                       |
| Source-shape suggestions     | data extract suggestion mode and Interactive review        | 30s             | direct embedded helpers remain default-only; explicit Interactive sessions use their session value                                         | One request per suggestion invocation.                                       |

Rename supplied the earlier shipped timeout pattern.[^rename-timeout-history]
The completed contract preserves those millisecond options while adding strict
duration parsing, shared and scoped precedence, consolidated migration notices,
and command/action separation.

The shared timeout module now owns the 30-second default, 10-minute maximum for
new duration-based options, strict parsing, repeated-option detection, pure
resolution, conflicts, and migration text. A bounded failure classifier
recognizes preserved timeout causes without treating every abort or unknown SDK
error as a timeout. Existing public report schemas remain unchanged.

### Per-Request Timeout Is Not a Total Command Budget

A timeout applies to one Codex request attempt. It does not cap the complete
command lifecycle.

For one sequential rename analyzer, the approximate worst-case request time is:

```text
batch count × (retries + 1) × per-attempt timeout
  + retry delays
  + local processing
```

When both rename analyzers run, their elapsed time is additive. A direct Markdown
PDF template command can consume two timeout windows because its repair request
is a second Codex request. A project command can consume three windows when the
profile, template, and template repair requests all run.

Help text and failure messages therefore use **per request attempt**. A
generic `--codex-timeout 30s` must not imply that the whole command finishes
within 30 seconds.

### Retry Configuration Boundary

Timeout is a shared boundedness policy. Retry is workflow behavior and remains
exposed only where the workflow can explain its retry unit, safety, and total
latency.

| Surface                    | Current retry-like behavior                                                                      | Public retry configuration       | Settled boundary                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------- |
| Rename image analyzer      | Repeats a failed image-title batch request; retry count is additional to the initial attempt.    | `--codex-images-retries <count>` | Keep analyzer-specific and describe it as retries after the initial attempt, per batch. |
| Rename document analyzer   | Repeats a failed document-title batch request; retry count is additional to the initial attempt. | `--codex-docs-retries <count>`   | Keep analyzer-specific and describe it as retries after the initial attempt, per batch. |
| Markdown PDF template      | May issue one new repair request with validation feedback.                                       | none                             | Keep internal. This is semantic repair, not repetition of the same failed request.      |
| Markdown PDF project       | Inherits the template repair behavior inside a multi-phase workflow.                             | none                             | Keep internal and document request multiplicity instead of calling it a retry option.   |
| Data query drafting        | No workflow retry.                                                                               | none                             | Do not add retry configuration without failure evidence and a defined replay contract.  |
| Data stack assist          | No workflow retry.                                                                               | none                             | Do not add retry configuration without failure evidence and a defined replay contract.  |
| Header-mapping suggestions | No workflow retry.                                                                               | none                             | Keep timeout-only unless transient failures justify automatic retry later.              |
| Source-shape suggestions   | No workflow retry.                                                                               | none                             | Keep timeout-only unless transient failures justify automatic retry later.              |
| Rename cleanup suggestion  | No workflow retry.                                                                               | none                             | Keep timeout-only unless a safe, bounded retry need is demonstrated.                    |
| Interactive regeneration   | The user may explicitly request another draft or suggestion.                                     | user-controlled                  | Do not convert the user-controlled loop into an automatic global retry policy.          |

The timeout contract does not introduce a generic `--codex-retries` option.

## Settled Contract And Implementation Outcome

### Shared Base Timeout Contract

Relevant Codex-backed command surfaces use the same base option name:

```text
--codex-timeout <duration>
```

Shipped semantics:

- timeout applies to each Codex request attempt
- accepted input requires an explicit unit, initially `ms`, `s`, or `m`
- examples include `500ms`, `30s`, and `2m`
- bare numbers are rejected because their unit would be ambiguous
- parsed values are normalized to positive integer milliseconds internally
- zero, negative, decimal, malformed, unknown-unit, and overflowing values are
  rejected with an option-specific error
- repeated occurrences of the same timeout option are rejected instead of
  silently applying last-value-wins behavior
- the existing 30-second default remains when no override is supplied
- the upper bound for new duration-based CLI options is 10 minutes
- parsing and validation happen before any Codex request or artifact write

This is a shared command-local option contract, not a root-level option. For
example:

```bash
cdx-chores rename batch ./files --codex --codex-timeout 30s
cdx-chores data query codex ./data.csv --codex-timeout 30s
cdx-chores md pdf-profile codex ./document.md --codex-timeout 2m
```

Commands that do not use Codex do not advertise the option.

### Interactive Entry And Discoverability Boundary

Interactive timeout configuration belongs to the explicit `interactive`
command rather than the root command or individual workflow prompts:

```text
cdx-chores
  -> Interactive mode with the shared 30-second default

cdx-chores interactive --codex-timeout 2m
  -> Interactive mode with one 2-minute per-attempt session value

cdx-chores --codex-timeout 2m
  -> unsupported root-level spelling
```

The explicit session value is parsed once, retained through menu routing,
backtracking, revision, and user-triggered regeneration, and forwarded only when
a selected workflow invokes Codex. It must not add a timeout setup prompt to the
Interactive entry or to each Codex-assisted workflow.

Discoverability comes from `interactive --help`, timeout-specific
remediation when appropriate, and one canonical cross-feature guide. The guide
compares timeout, scoped timeout, retry, semantic repair, and user-triggered
regeneration before linking to workflow-specific rename, data, Markdown, and
Interactive guidance. Workflow guides keep only their local examples and
behavior instead of duplicating the shared contract.

### Rename Timeout Standard

Rename exposes scoped duration overrides because image and document analysis
can run in the same command with different operational needs:

```text
--codex-timeout <duration>
--codex-images-timeout <duration>
--codex-docs-timeout <duration>
```

Shipped precedence:

```text
effective image timeout:
  --codex-images-timeout
    -> --codex-images-timeout-ms  # deprecated compatibility input
    -> --codex-timeout
    -> built-in default

effective document timeout:
  --codex-docs-timeout
    -> --codex-docs-timeout-ms    # deprecated compatibility input
    -> --codex-timeout
    -> built-in default
```

A shared value and a scoped value may be combined. The scoped value overrides
the shared value for its analyzer:

```bash
cdx-chores rename batch ./files \
  --codex \
  --codex-timeout 30s \
  --codex-docs-timeout 2m
```

The example gives image requests a 30-second timeout and document requests a
two-minute timeout.

The new and legacy scoped forms for the same analyzer must not be combined. The
command rejects an ambiguous invocation such as:

```bash
--codex-docs-timeout 30s --codex-docs-timeout-ms 60000
```

### Legacy Rename Flag Transition

The duration-based scoped flags provide exact replacements when the legacy
value is a positive integer within the new 10-minute bound:

```text
--codex-images-timeout-ms 30000
  -> --codex-images-timeout 30000ms

--codex-docs-timeout-ms 30000
  -> --codex-docs-timeout 30000ms
```

The 10-minute maximum is a validation rule for the new duration-based options.
It is not a retroactive restriction on the deprecated rename millisecond flags
during their compatibility period or on existing internal numeric timeout
inputs.

During the compatibility phase:

- keep both legacy flags functional with their current semantics
- emit one deprecation notice per command invocation when either legacy flag was
  explicitly supplied
- write the notice to stderr without changing the success exit status
- show the exact duration-based replacement when the legacy value satisfies the
  new duration grammar and maximum
- otherwise explain that the current value cannot migrate unchanged and must be
  reduced or normalized before using the duration-based flag
- do not emit the notice once per batch or retry attempt
- do not announce a removal release until that release boundary is approved

Shipped single-option plain-text notice:

```text
Warning: legacy Codex timeout option is deprecated.
Use --codex-docs-timeout 30000ms instead of --codex-docs-timeout-ms.
The legacy option remains supported during the current compatibility phase.
```

Removing the legacy options later is a breaking change even though introducing
their duration-based replacements is additive.

### Failure Semantics

The implementation includes timeout-specific user feedback where the preserved
error structure makes classification reliable.

Shipped behavior:

- distinguish a timeout from malformed output, validation failure, missing
  authentication, and user cancellation when the SDK error preserves that cause
- include the effective per-attempt duration in the timeout message
- identify the analyzer or phase when a composed command can do so safely
- preserve the current no-partial-write posture for failed preflight or
  generation phases
- keep report-schema changes separate unless an existing report cannot explain
  the failure without them

### Implemented Stages

The completed plan kept adoption layers independently reviewable:

1. added a shared duration parser, validation contract, and pure resolver
2. exposed shared and scoped duration options on rename while preserving legacy
   compatibility and workflow-owned retry behavior
3. added the narrow shared timeout classifier and proved it through rename
4. added the shared option to the selected explicit data and Markdown commands
5. added one session-owned timeout to explicit Interactive mode and threaded it
   through current Interactive Codex request paths
6. created one canonical cross-feature timeout/retry/recovery guide, linked local
   workflow guidance to it, and closed public documentation and research only
   after the complete staged contract is verified

Retry remained workflow-owned while timeout configuration broadened.

## Contract Non-Goals

The current timeout contract and implementation plan do not include:

- a repository-wide config-file system
- an environment-variable timeout source
- a total command or project budget
- generic retry configuration
- automatic retry for interactive regeneration
- timeout source metadata in every report schema
- a root-level global CLI option
- Markdown PDF phase-specific timeout overrides
- default timeout changes
- removal of the legacy rename millisecond flags

These exclusions are not scheduled follow-up work. Later research may reconsider
one only when concrete operational evidence justifies reopening it.

If later research introduces config or environment sources, it must separate
source precedence from scope precedence. An explicit CLI value must not be
silently overridden by a less visible configuration source, while an explicit
scoped value remains more specific than a shared value from the same source.

## Resolved Decisions

The completed implementation resolves the earlier open questions as follows:

- values accepted through the new duration-based CLI options are capped at 10 minutes
  (`600_000ms`) per request attempt; this is not a whole-command SLA and does
  not retroactively cap the deprecated rename millisecond flags during their
  compatibility period
- only positive integer `ms`, `s`, and `m` values are accepted; hours,
  decimals, compounds, bare numbers, and case-insensitive aliases remain
  rejected
- the first non-rename direct option wave covers `data query codex`,
  `data stack --codex-assist`, `md pdf-profile codex`,
  `md pdf-template codex`, and `md pdf-project codex`
- one Markdown PDF project value applies independently to every profile,
  template, and repair request attempt; defer phase-specific overrides
- the legacy rename millisecond flags remain for at least one stable
  compatibility release and may be removed only through a separately approved
  breaking release
- one narrow internal `timeout | aborted | other` classifier was introduced
  without rewriting all public Codex result or report schemas
- one session-owned `interactive --codex-timeout <duration>` value uses rename
  as the reference helper contract for Interactive data and Markdown Codex
  paths, reusing the shared parser, resolver, 30-second default, numeric
  `timeoutMs` seams, per-request-attempt meaning, and narrow failure classifier
  without helper-local fixed timeout constants, per-workflow prompts, or
  automatic retry
- `cdx-chores --codex-timeout <duration>` remains unsupported; custom Interactive
  configuration requires the explicit
  `cdx-chores interactive --codex-timeout <duration>` spelling
- `docs/guides/codex-timeouts-retries-and-recovery.md` is the canonical
  comparison-first public guide, with the README and workflow-specific guides
  linking to it rather than repeating the complete shared contract

These decisions are implemented and verified through the
[Codex request timeout implementation plan](../plans/plan-2026-08-21-codex-request-timeout-contract.md).

## Implementation Evidence

The original Phase 1 through Phase 6 timeout implementation is bounded by:

```text
6636a88bb962946c9e51defbf144c1a7bcd4b995..efca21ea364d4765d1b780abb5e42cd3e499196f
```

Phase 8 records the accepted final-review corrections and final closeout in:

```text
24ddbfe0dd383677e5c3d6db61d572a6ae7e7815..TIMEOUT_PHASE8_TIP
```

The staged records are:

1. [Phase 1: duration parser and pure resolver](../plans/jobs/2026-08-21-codex-request-timeout-phase-1.md)
2. [Phase 2: rename command surface and compatibility](../plans/jobs/2026-08-21-codex-request-timeout-phase-2.md)
3. [Phase 3: action routing and retry preservation](../plans/jobs/2026-08-21-codex-request-timeout-phase-3.md)
4. [Phase 4: timeout-specific fallback information](../plans/jobs/2026-08-21-codex-request-timeout-phase-4.md)
5. [Phase 5: explicit direct-command adoption](../plans/jobs/2026-08-21-codex-request-timeout-phase-5.md)
6. [Phase 6: Interactive session timeout](../plans/jobs/2026-08-21-codex-request-timeout-phase-6.md)
7. [Phase 7: public documentation and integration](../plans/jobs/2026-08-22-codex-request-timeout-phase-7.md)
8. [Phase 8: final validation and lifecycle closeout](../plans/jobs/2026-08-22-codex-request-timeout-phase-8.md)

Final validation reran the cumulative rename/shared, direct data/Markdown, and
Interactive timeout suites, followed by type checking, lint, format checking,
the full repository suite, and the Node-target build. Cumulative review also
confirmed fresh per-attempt production retry signals and corrected the remaining
Interactive suggestion fallbacks to use the shared default and preserve
timeout-specific duration information. The built help for all three rename
surfaces, five direct commands, and explicit Interactive mode matches the
shipped contract. The root-level spelling remains unsupported.

Current public guidance lives in
[Codex Timeouts, Retries, And Recovery](../guides/codex-timeouts-retries-and-recovery.md).

## Research Document Boundary

This research records the timeout contract, planning evidence, and completed
implementation outcome. The research document itself did not implement:

- timeout flag wiring or duration parsing
- legacy-option warnings
- retry or batch-size changes
- Codex request execution or failure handling
- Markdown PDF rendering changes

The linked focused timeout plan owns the completed implementation. This research
does not reopen the completed Markdown PDF project-helper plan.

## References

[^markdown-pdf-smoke]: [Markdown PDF project Codex phase 7 validation and render compatibility](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-7-validation-render-compatibility.md) and [phase 8 report, summary, writes, and dry run](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-8-report-summary-writes-dry-run.md).

[^rename-timeout-history]: [Tune Codex rename timeout, add progress feedback, and fallback tests](../plans/jobs/2026-02-25-codex-rename-progress-timeout-tuning-and-fallback-tests.md).

[^timeout-inventory]: Current timeout and retry behavior is implemented across [`src/utils/codex-timeout.ts`](../../src/utils/codex-timeout.ts), [`src/cli/options/codex-timeout.ts`](../../src/cli/options/codex-timeout.ts), [`src/cli/options/codex-timeout-option.ts`](../../src/cli/options/codex-timeout-option.ts), [`src/cli/commands/rename.ts`](../../src/cli/commands/rename.ts), [`src/cli/commands/data/query.ts`](../../src/cli/commands/data/query.ts), [`src/cli/commands/data/stack.ts`](../../src/cli/commands/data/stack.ts), [`src/cli/commands/markdown.ts`](../../src/cli/commands/markdown.ts), [`src/cli/interactive/session.ts`](../../src/cli/interactive/session.ts), [`src/adapters/codex/shared.ts`](../../src/adapters/codex/shared.ts), [`src/adapters/codex/image-rename-titles.ts`](../../src/adapters/codex/image-rename-titles.ts), [`src/adapters/codex/document-rename/batch.ts`](../../src/adapters/codex/document-rename/batch.ts), [`src/cli/actions/rename/cleanup-codex.ts`](../../src/cli/actions/rename/cleanup-codex.ts), [`src/adapters/codex/markdown-pdf-profile/index.ts`](../../src/adapters/codex/markdown-pdf-profile/index.ts), [`src/adapters/codex/markdown-pdf-template/index.ts`](../../src/adapters/codex/markdown-pdf-template/index.ts), [`src/cli/data-query/runner.ts`](../../src/cli/data-query/runner.ts), [`src/cli/data-stack/codex-assist.ts`](../../src/cli/data-stack/codex-assist.ts), [`src/cli/duckdb/header-mapping/suggestions.ts`](../../src/cli/duckdb/header-mapping/suggestions.ts), and [`src/cli/duckdb/source-shape/suggestions.ts`](../../src/cli/duckdb/source-shape/suggestions.ts).

## Related Plans

- [Codex request timeout contract implementation](../plans/plan-2026-08-21-codex-request-timeout-contract.md)
- [Markdown PDF project Codex helper implementation](../plans/plan-2026-07-04-markdown-pdf-project-codex-helper.md)
