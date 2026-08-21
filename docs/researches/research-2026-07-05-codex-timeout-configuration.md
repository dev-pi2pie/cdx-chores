---
title: "Codex Timeout Configuration"
created-date: 2026-07-05
modified-date: 2026-08-21
status: in-progress
agent: codex
---

## Goal

Define a consistent timeout override contract for every Codex-backed direct and
interactive flow.

The direction is tentatively chosen: keep the current 30-second per-request
default, expose one unit-aware override, and normalize the effective value to
milliseconds inside the application. Implementation and verification evidence
is still required before this research can be completed.

## Why This Research

Several commands call Codex through bounded `AbortSignal.timeout(...)` requests.
Most defaults are currently 30 seconds, but configurability is uneven:

- some paths expose public timeout flags
- some paths have internal `timeoutMs` seams for tests or injected runners
- some direct CLI commands have no timeout override
- there is no dedicated repository-wide config-file flow for this setting

The immediate Markdown PDF question was whether `md pdf-project codex` needed a
longer timeout default. The controlled Phase 7 and Phase 8 smoke results did not
confirm that hypothesis. A broader timeout-config decision should therefore be a
new research track, not a late expansion of the completed project-helper plan.

## Current Evidence

The completed Markdown PDF project-helper plan kept 30 seconds as the committed
default for direct Markdown PDF Codex helpers.

Concise evidence summary:

```text
30s passed the controlled Markdown PDF smoke after the Codex runner path was
fixed.

The earlier failure was not proven to be a timeout problem.

The evidence supports keeping 30s as the default, while still leaving room for
an explicit longer-timeout override in slower cases.
```

## Current Timeout Surfaces

### Inventory

Current Codex timeout surfaces:

| Area | Entry points | Current default | Public timeout flag | Threading depth | Notes |
| --- | --- | --- | --- | --- | --- |
| Rename image analyzer | `rename file`, `rename batch` | 30s | `--codex-images-timeout-ms` | CLI -> action -> analyzer -> adapter | Also exposes image retries and batch size. Current parsing uses raw `Number(value)`. |
| Rename document analyzer | `rename file`, `rename batch` | 30s | `--codex-docs-timeout-ms` | CLI -> action -> analyzer -> adapter | Also exposes document retries and batch size. Current parsing uses raw `Number(value)`. |
| Rename cleanup Codex suggestion | interactive rename cleanup flow | 30s | no direct public flag | adapter seam only | The helper accepts `timeoutMs`, but the interactive call currently does not pass one. |
| Markdown PDF profile helper | `md pdf-profile codex` | 30s | no | adapter seam only | Direct command does not expose or thread a timeout override. |
| Markdown PDF template helper | `md pdf-template codex` | 30s | no | adapter seam only | Direct command does not expose or thread a timeout override. |
| Markdown PDF project helper | `md pdf-project codex` | phase-owned 30s profile/template requests | no | phase adapter seams only | No project-level total timeout budget exists today. |
| Data query SQL drafting | `data query codex`, interactive data query Codex mode | 30s | no | action/runner seam for direct command; interactive call uses default | Direct action accepts `timeoutMs`, but command registration does not expose it. |
| Data stack Codex assist | `data stack --codex-assist`, interactive data stack review | 30s | no | action seam for direct command; fixed interactive constant | Direct command registration has no public flag. Interactive review passes a fixed timeout. |
| Header-mapping suggestions | `data query --codex-suggest-headers`, `data extract --codex-suggest-headers`, interactive header review | 30s | no | adapter seam only | Workflow and interactive call sites currently do not pass a timeout override. |
| Source-shape suggestions | `data extract --codex-suggest-shape`, interactive source-shape review | 30s | no | adapter seam only | Used by reviewed Excel source-shape flows. Direct workflow call does not pass a timeout override. |

Rename is the clearest existing public pattern. It is analyzer-specific, uses
milliseconds, and exposes timeout alongside retries and batch size. Most other
Codex-backed paths have internal seams but no user-facing timeout contract.

### Out Of Scope Timeout Uses

Non-Codex process timeouts also exist, such as font discovery command timeouts
and test-runner timeouts in job records. They should not drive the Codex timeout
contract except as naming collision context.

## Problem Statement

The repo needs a timeout policy that answers:

- how one override reaches all Codex-backed direct and interactive flows
- where the generic override is registered in the command hierarchy
- how the generic override coexists with existing analyzer-specific flags
- which duration units and fractional values are accepted
- how to validate unsafe values such as zero, negative numbers, decimals, and
  very large numbers
- how timeout failures should be classified and surfaced to users
- whether retries and batch size should stay separate from timeout controls

Without a contract, new helpers will keep copying local defaults and option
names, which makes behavior harder to predict.

## Current State Gaps

The codebase has timeout primitives, but they are not a consistent contract yet.

Seam depth is uneven:

- adapter-level `timeoutMs` exists in several places
- direct action or workflow options thread timeout only in some paths
- public CLI flags exist only for rename image/document analyzers
- interactive flows mostly use defaults or fixed constants

Failure classification is also uneven. Timeout and abort failures generally flow
through existing generic Codex failure paths such as unavailable, failed, or
suggestion failed. The code does not yet provide one normalized
`timeout`-specific classification across adapters.

Finally, timeout wiring is duplicated. Several adapters call
`AbortSignal.timeout(...)` directly instead of using one shared resolver for
effective timeout defaults, validation, and failure classification.

## Per-Request Versus Total Budget

Current timeout values are per Codex request, not necessarily per user command.

This distinction matters because some commands can issue more than one Codex
request:

- rename can split work into batches and retry failed batches
- `md pdf-project codex` can run a profile phase and then a template phase
- interactive flows can regenerate suggestions or drafts in a loop

A 30-second per-request timeout can therefore allow a longer wall-clock command
without violating the timeout contract. That behavior is acceptable only if it
is documented and intentional.

Each retry receives a fresh request timeout. Each batch and each Markdown PDF
phase also receives its own request timeout. Repeated interactive requests do
not share a cumulative timeout budget. User cancellation should abort the active
request promptly and remain distinguishable from timeout expiration; when safe,
the surrounding interactive workflow should remain available.

Before implementation, decide whether each command needs:

- only a per-request timeout
- a total command budget
- both, with separate names and precedence

Initial leaning:

```text
Start with per-request timeout flags.
Do not add total-budget flags until a concrete command needs them.
Keep `md pdf-project codex` explicit that the timeout applies per Codex phase.
```

## Tentative Direction

Use one unit-aware public override:

- Keep 30 seconds as the default for Codex-backed CLI requests.
- Use `--codex-timeout <duration>` as the generic public form.
- Require an explicit unit on the generic flag; bare numbers are ambiguous and
  should fail before Codex work begins.
- Accept integer milliseconds and integer or fractional seconds and minutes.
- Normalize every accepted value to a positive whole number of milliseconds.
- Preserve the existing analyzer-specific millisecond flags for compatibility.
- Resolve analyzer-specific flags before the generic override when both are
  supplied.
- Register the generic option through one shared helper on Codex-capable direct
  commands and the explicit `interactive` command.
- Keep zero-argument interactive mode on the built-in 30-second default.
- Preserve internal `timeoutMs` seams for tests and service composition.
- Keep the timeout scoped to one Codex request, not the total wall-clock command
  or interactive session.
- Normalize timeout failures separately from malformed output, unavailable
  Codex support, and user cancellation.
- Do not record raw local environment details in timeout evidence or reports.

Examples:

```text
--codex-timeout 500ms  -> 500 milliseconds
--codex-timeout 1.5s   -> 1,500 milliseconds
--codex-timeout 0.5m   -> 30,000 milliseconds
--codex-timeout 2m     -> 120,000 milliseconds
--codex-timeout 30     -> invalid because the unit is missing
```

Fractional parsing should preserve millisecond precision without relying on
floating-point rounding. Millisecond input must be an integer. Fractional
seconds or minutes are valid only when they resolve exactly to a whole
millisecond. For example, `1.234s` is valid and `1.2345s` is not.

The normative input grammar should be:

```text
duration = number unit
number   = digits | digits "." digits
unit     = "ms" | "s" | "m"
```

Units are lowercase and no internal whitespace is accepted. The parser may trim
surrounding whitespace, but a leading zero is required for fractional values:
`0.5s` is valid and `.5s` is not. Decimal milliseconds, unsupported units such
as `us`, non-finite values, zero, negative values, unsafe integers, and values
that do not resolve exactly to a whole millisecond are invalid. Conversion must
not round. The accepted range after exact conversion is 1 millisecond through
30 minutes.

Invalid input should identify the supplied value and show valid examples without
starting Codex work:

```text
Invalid --codex-timeout "30": include a unit, such as 500ms, 30s, or 2m.
```

The generic precedence for the first implementation should be:

```text
existing analyzer-specific timeout override
  -> generic --codex-timeout override
  -> built-in 30-second request default
```

Future model and reasoning configuration may add an effort-aware default
between the explicit override and built-in fallback. That later research must
not change the duration syntax or allow an inferred default to override an
explicit user value.

### Direct And Interactive Parity

Interactive data stack currently passes a fixed 30-second constant, while
several other interactive helpers rely on adapter defaults. The explicit
`interactive` command should accept the shared timeout option and pass it to
Codex-backed interactive actions. Zero-argument interactive mode should retain
the 30-second default rather than introducing a root-option configuration path.

A timed-out Codex request should return control to the interactive workflow when
that workflow can safely continue. It should not terminate the entire session
or discard deterministic state merely because an advisory request expired.

This timeout remains Codex-specific. It must not affect unrelated interactive
deadlines such as installed-font discovery soft waits and hard ceilings.

## Config File Boundary

No dedicated repo-wide config-file flow is currently established for these CLI
helpers.

The timeout implementation should not introduce one. Config-file discovery,
precedence, schema versioning, and privacy rules are broader repository concerns
that are not required for the command-scoped override.

## Environment Variable Boundary

A timeout environment variable is not part of this research. It would introduce
hidden precedence and replay behavior without an established repository-wide
environment configuration contract.

## Reporting And Replay

The first implementation should not change advisory report schemas. The command
invocation remains the replayable source for an explicit timeout override.

When a request times out, transient terminal output should include the effective
duration, for example:

```text
Codex request timed out after 30s.
```

Reports should not store timeout source metadata, environment details, or local
configuration paths.

## Failure Semantics

Timeouts should fail in the same safety posture as other Codex failures:

- deterministic commands should not hang indefinitely
- partial generated artifacts should not be written after failed preflight
- reports, if requested and safe, may record sanitized failure context
- user-facing messages should distinguish timeout from malformed output,
  validation failure, and missing Codex availability when practical

Current adapters mostly route timeout or abort failures through generic failure
classifications. The first implementation should normalize timeout detection
and its user-facing message only. Existing unavailable, malformed-output, and
safe-fallback behavior should remain unchanged.

Markdown PDF project behavior should stay especially strict because one project
can involve multiple Codex phases. A timeout in either phase should not leave a
half-written project bundle.

## Recommended First Implementation

- Register `--codex-timeout <duration>` through one shared option helper on
  Codex-capable direct commands and the explicit `interactive` command.
- Keep zero-argument interactive mode on the 30-second default.
- Do not add root, environment, or config-file timeout settings.
- Accept exact durations from 1 millisecond through 30 minutes.
- Keep existing analyzer-specific millisecond flags. A specific override wins
  over the generic option.
- Do not change advisory report schemas.
- Normalize timeout failures only; preserve other Codex fallback behavior.

## Non-Goals

This research does not implement:

- timeout flag wiring
- a config-file system
- environment-variable timeout behavior
- default timeout changes
- retry or batch-size changes
- report schema changes
- Markdown PDF rendering changes
- model or provider overrides
- reasoning-effort configuration
- Codex session persistence changes

This research also does not reopen the completed Markdown PDF project-helper
plan. Any implementation should happen in a new focused plan after this research
is reviewed.

## Suggested Next Review

Before implementation planning, review:

- the complete direct and interactive Codex call-site inventory
- existing public timeout/retry/batch-size flags and compatibility tests in
  rename
- the shared option helper and routing seam for direct commands and the explicit
  `interactive` command
- timeout, user cancellation, retry, and batch failure classification
- a bounded duration parser test matrix, including fractional values
- direct and interactive parity tests for precedence, retries, batches,
  multi-phase helpers, timeout failure classification, and cancellation

The first implementation plan should centralize duration parsing and runtime
policy resolution before adding the generic flag to public help. That prevents
the new option from shipping while interactive or multi-phase paths still
bypass it.

## Related Research

- [Codex execution configuration](./research-2026-08-21-codex-execution-configuration.md)

## Related Docs

- [Markdown PDF project Codex helper implementation](../plans/plan-2026-07-04-markdown-pdf-project-codex-helper.md)
- [Markdown PDF project Codex phase 7 validation and render compatibility](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-7-validation-render-compatibility.md)
- [Markdown PDF project Codex phase 8 report, summary, writes, and dry run](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-8-report-summary-writes-dry-run.md)
- [Tune Codex rename timeout, add progress feedback, and fallback tests](../plans/jobs/2026-02-25-codex-rename-progress-timeout-tuning-and-fallback-tests.md)
