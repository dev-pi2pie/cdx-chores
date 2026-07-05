---
title: "Codex Timeout Configuration"
created-date: 2026-07-05
modified-date: 2026-07-05
status: draft
agent: codex
---

## Goal

Research whether Codex-backed CLI flows should expose a consistent timeout
configuration contract.

This is early-stage research. It records the current implementation shape,
recent Markdown PDF timeout evidence, and the design questions that should be
answered before creating an implementation plan.

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

- which Codex-backed commands should expose user-tunable timeouts
- whether the override should be command-specific, global, or both
- whether timeout values should be milliseconds or duration strings
- how to validate unsafe values such as zero, negative numbers, decimals, and
  very large numbers
- whether timeout override details should be recorded in reports
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

Reporting is not standardized either. Existing Markdown PDF and data-stack Codex
reports do not record the effective timeout value or whether it came from a
flag, a default, a future config source, or an environment variable.

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

## Candidate Direction To Evaluate

Start narrow:

- Keep 30 seconds as the default for Codex-backed CLI requests.
- Prefer direct CLI flags before introducing a repository-wide config file.
- Add public timeout flags only to commands where live Codex latency is a real
  user-facing concern.
- Use one generic flag name on single-Codex-command surfaces:
  `--codex-timeout-ms <ms>`.
- Keep analyzer-specific names where the command already has separate analyzer
  lanes, such as rename images versus rename docs.
- Preserve internal `timeoutMs` seams for tests and service composition.
- Validate timeout values with shared positive-integer parsing before any Codex
  work begins.
- Treat rename's existing raw numeric parsing as an alignment question: either
  grandfather it for compatibility or migrate it to the shared validation rule.
- Keep timeout classification/reporting changes separate unless a first-wave
  command needs them to explain user-visible failures clearly.
- Do not record raw local environment details in timeout evidence or reports.

This direction is not settled. It is a starting hypothesis because it matches
existing rename flags while avoiding a broad config-file system before the repo
has one.

## Config File Question

No dedicated repo-wide config-file flow is currently established for these CLI
helpers.

A config file could eventually support shared defaults, but it would raise
larger questions:

- discovery path and precedence
- local-only versus committed config
- interaction with CLI flags
- schema versioning
- privacy expectations for generated reports
- migration behavior for existing scripts

Because this is broader than timeout alone, the first timeout plan should avoid
introducing a config-file system unless later evidence shows that per-command
flags are not enough.

## Environment Variable Question

A timeout environment variable would be easy to add, but it is less explicit
than a flag and can make command behavior harder to replay from logs or job
records.

If an environment variable is considered later, the research should decide:

- whether it applies globally or only to Codex-backed commands
- whether public reports should include the effective timeout value
- whether CLI flags always override environment values
- whether hidden environment behavior is acceptable for replayable workflows

Initial leaning:

```text
CLI flag first.
Environment variable only if repeated operational use proves a need.
```

## Precedence Model To Evaluate

If the repo later supports more than one timeout configuration source, the
likely precedence should be:

```text
explicit CLI flag
  -> command-scoped config, if a config system exists
  -> global config, if a config system exists
  -> environment variable, if accepted
  -> built-in default
```

This is only a candidate model. It should not be documented as shipped behavior
until implemented and verified.

## Reporting And Replay

Timeout configuration should support replay without leaking local environment
details.

Recommended reporting questions:

- Should diagnostic reports store the effective timeout value?
- Should reports store whether the value came from a flag, config, environment,
  or default?
- Should timeout values appear in follow-up commands?
- Should failed timeout reports classify the failure separately from generic
  Codex unavailability?

Initial leaning:

- record the effective numeric timeout in advisory reports when reports already
  exist
- treat that as a future report-schema change because no current Codex report
  stores timeout source metadata
- avoid recording environment variable names or local configuration paths unless
  the future config contract explicitly requires it
- prefer replayable follow-up commands that include explicit flags only when the
  user supplied them

## Failure Semantics

Timeouts should fail in the same safety posture as other Codex failures:

- deterministic commands should not hang indefinitely
- partial generated artifacts should not be written after failed preflight
- reports, if requested and safe, may record sanitized failure context
- user-facing messages should distinguish timeout from malformed output,
  validation failure, and missing Codex availability when practical

This is desired behavior, not current uniform behavior. Current adapters mostly
route timeout or abort failures through generic failure classifications. A
future plan should decide whether timeout classification is part of the first
implementation wave or a separate cleanup.

Markdown PDF project behavior should stay especially strict because one project
can involve multiple Codex phases. A timeout in either phase should not leave a
half-written project bundle.

## Open Questions

- Should Markdown PDF direct helpers expose `--codex-timeout-ms` on
  `md pdf-profile codex`, `md pdf-template codex`, and `md pdf-project codex`?
- Should project helper timeout apply independently to each Codex phase, or
  should there also be a project-level total budget?
- Should `data query codex` and `data stack --codex-assist` expose the same
  public flag name?
- Should `data extract --codex-suggest-shape`, `data query --codex-suggest-headers`,
  and `data extract --codex-suggest-headers` expose timeout flags, or stay
  default-only until evidence appears?
- Should existing rename timeout flags remain analyzer-specific forever, or
  should a generic parent-level timeout alias be added later?
- Should timeout validation allow only milliseconds, or support duration strings
  such as `30s` and `2m`?
- What upper bound prevents accidental multi-hour hangs while still allowing
  slow but legitimate local workflows?
- Should timeout values be stored in advisory reports as part of request facts?
- Should timeout classification be normalized across all Codex adapters?

## Non-Goals

This research does not implement:

- timeout flag wiring
- a config-file system
- environment-variable timeout behavior
- default timeout changes
- retry or batch-size changes
- report schema changes
- Markdown PDF rendering changes

This research also does not reopen the completed Markdown PDF project-helper
plan. Any implementation should happen in a new focused plan after this research
is reviewed.

## Suggested Next Review

Before implementation planning, review:

- all Codex-backed command surfaces and their current default timeout values
- existing public timeout/retry/batch-size flags in rename
- whether data and Markdown PDF commands should share one flag name
- whether timeout should be included in diagnostic report schemas
- whether per-phase versus total-budget semantics matter for project-style
  commands
- whether first-wave work should only thread existing seams or also normalize
  failure classification and report metadata

The smallest likely first plan would only add validated `--codex-timeout-ms`
flags to selected direct Codex commands and thread them through existing
`timeoutMs` seams.

## Related Docs

- [Markdown PDF project Codex helper implementation](../plans/plan-2026-07-04-markdown-pdf-project-codex-helper.md)
- [Markdown PDF project Codex phase 7 validation and render compatibility](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-7-validation-render-compatibility.md)
- [Markdown PDF project Codex phase 8 report, summary, writes, and dry run](../plans/jobs/2026-07-04-markdown-pdf-project-codex-phase-8-report-summary-writes-dry-run.md)
- [Tune Codex rename timeout, add progress feedback, and fallback tests](../plans/jobs/2026-02-25-codex-rename-progress-timeout-tuning-and-fallback-tests.md)
