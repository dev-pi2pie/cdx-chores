---
title: "cdx-chores Codex Request Timeout Contract"
created-date: 2026-07-05
modified-date: 2026-08-21
status: in-progress
agent: codex
---

## Goal

Decide how `cdx-chores` should expose a consistent timeout contract for its
Codex-backed CLI requests without changing existing behavior unexpectedly.

This research covers application-enforced request deadlines passed through
`AbortSignal.timeout(...)`. It does not define an upstream Codex service timeout
or treat Codex provider, stream-idle, or MCP timeout settings as equivalent.

All future-looking option names and precedence rules in this document are
recommendations. They are not shipped behavior until an implementation plan is
completed and verified.

## Executive Summary

- Keep the existing 30-second per-request defaults for compatibility. The
  controlled Markdown PDF smoke supports that default for the tested Markdown
  PDF path, not as a universal latency conclusion for every Codex workflow.
- Introduce a shared, duration-based `--codex-timeout <duration>` contract on
  relevant command surfaces. Treat it as a reusable command option rather than
  requiring one root-level CLI flag on commands that do not use Codex.
- Establish a rename-specific timeout standard with
  `--codex-images-timeout <duration>` and
  `--codex-docs-timeout <duration>` overriding the shared value.
- Replace the existing millisecond-only rename flags with exact duration-based
  equivalents over a compatibility period. Keep the old flags working, emit one
  deprecation notice when used, and do not schedule removal until a release
  boundary is chosen.
- Define timeout as applying to each Codex request attempt. Batches, retries,
  repair requests, phases, and user-triggered regeneration can make the total
  command duration longer.
- Keep retry configuration workflow-owned. Do not introduce a repository-wide
  `--codex-retries` option merely because timeout parsing becomes shared.
- Defer total command budgets, config-file and environment-variable sources,
  and report-schema changes until a concrete operational need is demonstrated.

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

| Area | Entry points | Current default | Public timeout option | Request multiplicity |
| --- | --- | --- | --- | --- |
| Rename image analyzer | `rename file`, `rename batch` | 30s | `--codex-images-timeout-ms` | One request per batch attempt; up to `batch count × (retries + 1)` attempts. |
| Rename document analyzer | `rename file`, `rename batch` | 30s | `--codex-docs-timeout-ms` | One request per batch attempt; up to `batch count × (retries + 1)` attempts. |
| Rename cleanup suggestion | interactive rename cleanup | 30s | none | One request per suggestion invocation. |
| Markdown PDF profile helper | `md pdf-profile codex` | 30s | none | One request per generation. |
| Markdown PDF template helper | `md pdf-template codex` | 30s | none | Up to two requests: the initial request and one application-repair request. |
| Markdown PDF project helper | `md pdf-project codex` | phase-owned 30s requests | none | Up to three requests in the assisted profile-and-template path: profile, template, and template repair. |
| Data query SQL drafting | `data query codex`, interactive Codex mode | 30s | none | One request per draft invocation. |
| Data stack Codex assist | `data stack --codex-assist`, interactive review | 30s | none | One request per assist invocation. |
| Header-mapping suggestions | data query/extract suggestion modes and interactive review | 30s | none | One request per suggestion invocation. |
| Source-shape suggestions | data extract suggestion mode and interactive review | 30s | none | One request per suggestion invocation. |

Rename remains the only shipped public timeout pattern.[^rename-timeout-history] Its options are
analyzer-specific, use milliseconds, and currently parse with raw
`Number(value)` conversion. Most other paths have internal `timeoutMs` seams but
do not expose them at the command boundary.

Timeout failure classification is also uneven. Timeout and abort failures often
flow through generic unavailable, failed, or suggestion-failed paths. Existing
reports do not consistently record the effective timeout value or its source.

Several adapters still construct `AbortSignal.timeout(...)` directly. Shared
Codex infrastructure exists, but there is no shared timeout parser and resolver
that owns defaults, validation, precedence, or user-facing classification.

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

Help text and failure messages should therefore use **per request attempt**. A
generic `--codex-timeout 30s` must not imply that the whole command finishes
within 30 seconds.

### Retry Configuration Boundary

Timeout is a shared boundedness policy. Retry is workflow behavior and should be
exposed only where the workflow can explain its retry unit, safety, and total
latency.

| Surface | Current retry-like behavior | Public retry configuration | Recommendation |
| --- | --- | --- | --- |
| Rename image analyzer | Repeats a failed image-title batch request; retry count is additional to the initial attempt. | `--codex-images-retries <count>` | Keep analyzer-specific and describe it as retries after the initial attempt, per batch. |
| Rename document analyzer | Repeats a failed document-title batch request; retry count is additional to the initial attempt. | `--codex-docs-retries <count>` | Keep analyzer-specific and describe it as retries after the initial attempt, per batch. |
| Markdown PDF template | May issue one new repair request with validation feedback. | none | Keep internal. This is semantic repair, not repetition of the same failed request. |
| Markdown PDF project | Inherits the template repair behavior inside a multi-phase workflow. | none | Keep internal and document request multiplicity instead of calling it a retry option. |
| Data query drafting | No workflow retry. | none | Do not add retry configuration without failure evidence and a defined replay contract. |
| Data stack assist | No workflow retry. | none | Do not add retry configuration without failure evidence and a defined replay contract. |
| Header-mapping suggestions | No workflow retry. | none | Keep timeout-only unless transient failures justify automatic retry later. |
| Source-shape suggestions | No workflow retry. | none | Keep timeout-only unless transient failures justify automatic retry later. |
| Rename cleanup suggestion | No workflow retry. | none | Keep timeout-only unless a safe, bounded retry need is demonstrated. |
| Interactive regeneration | The user may explicitly request another draft or suggestion. | user-controlled | Do not convert the user-controlled loop into an automatic global retry policy. |

The repository should not introduce a generic `--codex-retries` option in the
first timeout plan.

## Implications and Recommendations

### Shared Base Timeout Contract

Use the same base option name on relevant Codex-backed command surfaces:

```text
--codex-timeout <duration>
```

Recommended semantics:

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
- a deliberate upper bound must be chosen before implementation
- parsing and validation happen before any Codex request or artifact write

This is a shared option contract, not necessarily a root-level option. For
example, relevant commands can independently expose the same syntax:

```bash
cdx rename batch ./files --codex-timeout 30s
cdx data query codex ./data.csv --codex-timeout 30s
cdx md pdf-profile codex ./document.md --codex-timeout 2m
```

Commands that do not use Codex should not advertise the option.

### Rename Timeout Standard

Rename needs scoped duration overrides because image and document analysis can
run in the same command with different operational needs:

```text
--codex-timeout <duration>
--codex-images-timeout <duration>
--codex-docs-timeout <duration>
```

Recommended precedence:

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
cdx rename batch ./files \
  --codex \
  --codex-timeout 30s \
  --codex-docs-timeout 2m
```

The example gives image requests a 30-second timeout and document requests a
two-minute timeout.

The new and legacy scoped forms for the same analyzer must not be combined. The
command should reject an ambiguous invocation such as:

```bash
--codex-docs-timeout 30s --codex-docs-timeout-ms 60000
```

### Legacy Rename Flag Transition

The duration-based scoped flags provide exact replacements for the existing
millisecond-only flags:

```text
--codex-images-timeout-ms 30000
  -> --codex-images-timeout 30000ms

--codex-docs-timeout-ms 30000
  -> --codex-docs-timeout 30000ms
```

During the compatibility phase:

- keep both legacy flags functional with their current semantics
- emit one deprecation notice per command invocation when either legacy flag was
  explicitly supplied
- write the notice to stderr without changing the success exit status
- show the exact duration-based replacement
- do not emit the notice once per batch or retry attempt
- do not announce a removal release until that release boundary is approved

Suggested notice:

```text
Warning: --codex-docs-timeout-ms is deprecated.
Use --codex-docs-timeout 30000ms instead.
The legacy option remains supported during the current compatibility phase.
```

Removing the legacy options later is a breaking change even though introducing
their duration-based replacements is additive.

### Failure Semantics

The first public timeout implementation should include timeout-specific user
feedback. A configurable timeout is difficult to use when expiration is reported
only as generic Codex unavailability.

Recommended behavior:

- distinguish a timeout from malformed output, validation failure, missing
  authentication, and user cancellation when the SDK error preserves that cause
- include the effective per-attempt duration in the timeout message
- identify the analyzer or phase when a composed command can do so safely
- preserve the current no-partial-write posture for failed preflight or
  generation phases
- keep report-schema changes separate unless an existing report cannot explain
  the failure without them

### Smallest First Implementation Wave

The smallest coherent first plan should:

1. add a shared duration parser, validation contract, and effective-timeout
   resolver
2. expose `--codex-timeout`, `--codex-images-timeout`, and
   `--codex-docs-timeout` on rename
3. preserve the legacy rename flags with the documented precedence and
   deprecation notices
4. normalize timeout-specific user-facing failures
5. test duration parsing, precedence, legacy conflicts, one-notice behavior,
   retry multiplication, and multi-analyzer routing

After that foundation is verified, a follow-up plan can add the shared option to
selected non-rename direct Codex commands without also globalizing retry.

## Deferred Decisions

The first timeout plan should not introduce:

- a repository-wide config-file system
- an environment-variable timeout source
- a total command or project budget
- generic retry configuration
- automatic retry for interactive regeneration
- timeout source metadata in every report schema

If config or environment sources are considered later, the design must separate
source precedence from scope precedence. An explicit CLI value should not be
silently overridden by a less visible configuration source, while an explicit
scoped value should remain more specific than a shared value from the same
source.

## Open Questions

- What maximum accepted duration prevents accidental multi-hour waits while
  allowing legitimate slow local workflows?
- Should the initial duration grammar remain limited to positive integer
  `ms`, `s`, and `m` values, or is an additional unit needed?
- Which non-rename direct Codex commands should receive
  `--codex-timeout <duration>` in the first follow-up wave?
- Should `md pdf-project codex` use one shared value independently for every
  profile, template, and repair request, or eventually expose phase overrides?
- At which approved release boundary may the legacy rename millisecond flags be
  removed?
- Which existing failure result types can preserve a timeout-specific cause
  without broadening the first plan into a full Codex error taxonomy rewrite?

## Non-Goals

This research does not implement:

- timeout flag wiring or duration parsing
- legacy-option warnings
- retry or batch-size changes
- config-file or environment-variable behavior
- total command budgets
- report schema changes
- default timeout changes
- Markdown PDF rendering changes

This research also does not reopen the completed Markdown PDF project-helper
plan. Implementation should happen in a new focused plan after this research is
reviewed.

## References

[^markdown-pdf-smoke]: [Markdown PDF project Codex phase 7 validation and render compatibility](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-7-validation-render-compatibility.md) and [phase 8 report, summary, writes, and dry run](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-8-report-summary-writes-dry-run.md).

[^rename-timeout-history]: [Tune Codex rename timeout, add progress feedback, and fallback tests](../plans/jobs/2026-02-25-codex-rename-progress-timeout-tuning-and-fallback-tests.md).

[^timeout-inventory]: Current timeout and retry behavior is implemented across [`src/cli/commands/rename.ts`](../../src/cli/commands/rename.ts), [`src/adapters/codex/shared.ts`](../../src/adapters/codex/shared.ts), [`src/adapters/codex/image-rename-titles.ts`](../../src/adapters/codex/image-rename-titles.ts), [`src/adapters/codex/document-rename/batch.ts`](../../src/adapters/codex/document-rename/batch.ts), [`src/cli/actions/rename/cleanup-codex.ts`](../../src/cli/actions/rename/cleanup-codex.ts), [`src/adapters/codex/markdown-pdf-profile/index.ts`](../../src/adapters/codex/markdown-pdf-profile/index.ts), [`src/adapters/codex/markdown-pdf-template/index.ts`](../../src/adapters/codex/markdown-pdf-template/index.ts), [`src/cli/data-query/runner.ts`](../../src/cli/data-query/runner.ts), [`src/cli/data-stack/codex-assist.ts`](../../src/cli/data-stack/codex-assist.ts), [`src/cli/duckdb/header-mapping/suggestions.ts`](../../src/cli/duckdb/header-mapping/suggestions.ts), and [`src/cli/duckdb/source-shape/suggestions.ts`](../../src/cli/duckdb/source-shape/suggestions.ts).

## Related Plans

- [Markdown PDF project Codex helper implementation](../plans/plan-2026-07-04-markdown-pdf-project-codex-helper.md)
