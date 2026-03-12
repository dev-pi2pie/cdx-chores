---
title: "DuckDB extension lifecycle for data query"
created-date: 2026-03-12
modified-date: 2026-03-12
status: draft
agent: codex
---

## Goal

Define a follow-up improvement plan for DuckDB extension lifecycle management used by `data query`, with a focus on reducing friction around extension-backed formats such as SQLite and Excel without weakening the current explicit-failure contract.

## Why This Plan

The current `data query` and `doctor` behavior is internally consistent, but the user experience still has a predictable gap:

- `doctor` can explain that a format is supported in principle but not loadable right now
- `data query` can explain which DuckDB extension is missing
- the CLI does not yet provide a first-class remediation path from that failure state

This is now visible in real local troubleshooting:

- DuckDB versioned extension caches can drift across runtime upgrades
- `sqlite` and `excel` can diverge in capability on the same machine
- users currently need manual DuckDB commands or repo-local scripts to restore capability

The gap is small enough to address without reopening the base `data query` contract, but it should be handled in a dedicated plan so lifecycle behavior stays explicit and testable.

## Relationship to Existing Plans

This plan is a follow-up to the existing DuckDB and `data query` work, not a replacement for it.

Current relationship:

- `plan-2026-03-09-duckdb-parquet-preview-integration.md` introduced DuckDB as an explicit backend family rather than silently widening lightweight preview behavior
- `plan-2026-03-10-data-query-cli-implementation.md` froze guidance-first extension handling for SQLite and Excel
- `plan-2026-03-10-data-query-codex-cli-drafting.md` reused the same format and source contract for the advisory Codex lane

This follow-up should stay scoped to extension lifecycle and should not reopen:

- SQL execution semantics
- output-shape contracts
- interactive query UX
- Codex drafting behavior beyond shared preflight and remediation support

## Current State

- DuckDB-backed formats are split into:
  - built-in formats: CSV, TSV, Parquet
  - extension-backed formats: SQLite, Excel
- `doctor` reports extension-backed formats with:
  - detected support
  - loadability
  - installability
- direct `data query` and `data query codex` require the extension to be loadable at runtime
- the CLI currently issues `LOAD <extension>` checks only
- automatic extension installation from the command path is intentionally out of scope for the implemented v1 contract
- the new troubleshooting guide now documents manual cleanup and reinstall flow for versioned DuckDB caches

## Problem Statement

The current UX exposes the failure correctly but leaves remediation fragmented:

- `doctor` can tell the user what is wrong
- command execution can fail with targeted guidance
- the docs can explain manual recovery
- the CLI itself cannot yet:
  - install the missing DuckDB extension on explicit request
  - report extension state in a DuckDB-focused management view

That forces users into a mixed shell-and-doc workflow even though the CLI already owns the capability model.

## Design Goals

- keep the current default behavior non-surprising and non-destructive
- preserve the distinction between:
  - supported in principle
  - loadable now
  - installable in the current environment
- add an explicit remediation path without turning ordinary query execution into a side-effect-heavy command
- keep DuckDB-specific lifecycle concerns grouped under a DuckDB-specific surface rather than leaking backend setup into unrelated command families
- reuse one shared extension-inspection layer for `doctor`, query execution, and any future install/uninstall commands

## Recommended Direction

### 1. Keep default query execution guidance-first

Do not silently auto-install missing DuckDB extensions during normal `data query` execution.

Reason:

- implicit network or cache writes from a query command are harder to reason about
- environment failures become less legible if install and load are collapsed together
- current plan and research already froze guidance-first failure as the safe default

### 2. Add an opt-in execution helper

Add `--install-missing-extension` to:

- `data query`

Recommended behavior:

- only applies to extension-backed formats
- only attempts install after a load failure that appears installable
- retries load after install
- preserves the existing targeted error if install or retry still fails
- writes install-attempt status to stderr so stdout result-payload contracts stay unchanged
- emits explicit status messaging so the user can see that install was attempted without contaminating JSON or table stdout

First-pass non-goal:

- do not add this flag to `data query codex` yet

Reason:

- `data query codex` is an advisory drafting lane rather than an execution lane
- adding install side effects there would widen that lane before the user-facing need is proven
- the base execution command is the highest-value place to solve the immediate remediation gap first

This gives a short-path recovery flow without changing the default command contract.

### 3. Add a DuckDB-focused management surface

Add an explicit DuckDB lifecycle command family for inspection and maintenance.

Recommended first-pass shape:

- `data duckdb doctor`
- `data duckdb extension install <name>`
- `data duckdb extension install --all-supported`

Recommended supported extension names in the first pass:

- `sqlite`
- `excel`

Why this surface is worth adding even if `--install-missing-extension` lands:

- it keeps setup and repair workflows explicit
- it gives users a place to fix the environment before rerunning query commands
- it creates one backend-oriented home for future DuckDB maintenance work

### 4. Keep uninstall out of the first implementation

Uninstall should not be part of the first implementation.

If uninstall is revisited later, it should be supported only if the implementation can be made both predictable and version-aware.

Recommended future semantics:

- uninstall removes the extension for the current DuckDB runtime version only
- uninstall should never wipe all of `$HOME/.duckdb`
- uninstall should require explicit extension naming
- uninstall should print the resolved cache target before deleting anything

Install and doctor should land first. Uninstall can remain deferred until the safety model is strong enough.

### 5. Keep interactive remediation lightweight

Do not add a dedicated interactive extension-management entry in the first pass.

Recommended first-pass interactive behavior:

- interactive `doctor` remains read-only
- interactive `data query` and related failure paths should explain the current issue in plain language
- when the environment appears installable, interactive mode should print the exact CLI remediation command the user can run outside the prompt flow

Reason:

- extension management is a low-frequency backend-maintenance workflow
- adding a dedicated interactive entry would widen the menu for a narrow operational task
- the immediate gap is discoverability of the remediation command, not lack of a wizard

## Scope

### In scope

- shared DuckDB extension inspection helpers
- opt-in install-and-retry flow for extension-backed query commands
- explicit DuckDB lifecycle command design
- doctor wording and JSON support refinements where needed
- interactive remediation messaging that points users to explicit CLI install commands
- docs and troubleshooting updates for the new lifecycle surface
- focused tests for installable, not-installable, and already-installed cases

### Out of scope

- silent install during ordinary `data query` execution
- generic package-manager-style backend management for non-DuckDB tools
- widening DuckDB support beyond the current SQLite and Excel extension-backed query formats
- changing the SQL-first `data query` execution contract
- changing the advisory-only `data query codex` execution boundary
- hidden cleanup of arbitrary user cache directories

## Proposed UX Contract

### `doctor`

Keep `doctor` as read-only capability inspection.

Potential follow-up refinements:

- add a short remediation hint when `installability=yes` but `loadability=no`
- in interactive mode, print the exact CLI command to install the missing extension rather than trying to install from the doctor flow
- in JSON mode, keep returning the underlying detail string for exact diagnosis
- consider exposing the current DuckDB runtime version in the query capability payload

### `data query ... --install-missing-extension`

Recommended flow:

1. detect format
2. try `LOAD <extension>`
3. if load succeeds, continue normally
4. if load fails and the failure appears installable, run `INSTALL <extension>`
5. retry `LOAD <extension>`
6. continue or fail with targeted guidance

Failure rules:

- if install appears blocked, fail clearly without retry loops
- if the format is built-in, reject the flag explicitly so the behavior stays predictable
- if install succeeds but load still fails, surface the load failure detail
- install-attempt progress and remediation messaging go to stderr

Success-path messaging should include:

- extension name
- current DuckDB runtime version
- whether the extension was newly installed or already present
- load-check result
- resolved extension cache path or cache directory when that path can be determined reliably

User-facing path rule:

- sanitize home-directory prefixes in user-facing messages
- prefer `$HOME/.duckdb/...` over revealing machine-specific absolute home paths
- if only the version-scoped cache directory can be determined reliably, print that directory instead of inventing a file path

### `data duckdb doctor`

Recommended output:

- current DuckDB runtime version
- supported extension-backed formats
- per-extension installed state
- per-extension loadability
- per-extension installability
- cache-path detail when available

This command should be more backend-oriented than the top-level `doctor` report and should help diagnose version-specific extension cache drift directly.

### Interactive mode

Recommended first-pass rule:

- do not add a dedicated interactive entry for DuckDB extension management

Instead:

- keep backend management as explicit CLI commands
- let interactive flows surface exact remediation commands when they detect installable-but-missing extensions
- revisit an interactive entry only if the DuckDB lifecycle command family grows beyond one or two rarely used commands

## Risks and Mitigations

- Risk: adding `--install-missing-extension` may blur the current clean line between execution and setup.
  Mitigation: keep it opt-in, explicit, and limited to one install attempt plus one retry.

- Risk: uninstall could become destructive or ambiguous across DuckDB versions.
  Mitigation: scope uninstall to one named extension for the current runtime version only, or defer uninstall until the safety model is strong enough.

- Risk: command surface could sprawl if both query flags and a DuckDB management family are added without clear roles.
  Mitigation: define one split clearly:
  `data query` handles execution, optional inline remediation, and user-facing results.
  `data duckdb ...` handles backend inspection and maintenance.

- Risk: adding backend-maintenance entries to interactive mode may make the menu wider without materially improving common workflows.
  Mitigation: keep first-pass interactive support to remediation messaging only, not a dedicated menu entry.

- Risk: network and permission failures during install may produce confusing user experiences.
  Mitigation: preserve the existing installability classification and keep exact DuckDB detail text available in failures and doctor output.

## Implementation Touchpoints

- `src/cli/duckdb/query.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/doctor.ts`
- `src/command.ts`
- `src/cli/interactive/`
- new DuckDB lifecycle helpers and actions under `src/cli/duckdb/` and `src/cli/actions/`
- focused query, doctor, and lifecycle tests under `test/`
- `docs/guides/data-query-usage.md`
- new DuckDB lifecycle guide if the command family lands

## Phase Checklist

### Phase 1: Freeze lifecycle contract

- [ ] confirm that default query execution remains guidance-first and non-installing
- [ ] freeze the exact semantics of `--install-missing-extension`
- [ ] freeze stderr-only status messaging for install attempts so stdout payload contracts remain stable
- [ ] freeze rejection behavior for `--install-missing-extension` on built-in formats
- [ ] freeze `$HOME`-sanitized path display for user-facing DuckDB cache messages
- [ ] defer `data query codex` install side effects out of the first implementation
- [ ] defer uninstall out of the first implementation
- [ ] freeze the first-pass `data duckdb ...` command names
- [ ] freeze first-pass interactive behavior as remediation guidance only, not a dedicated extension-management entry

### Phase 2: Shared inspection and install helpers

- [ ] extract shared DuckDB extension lifecycle helpers so doctor and command execution do not duplicate logic
- [ ] add explicit install helper(s) for supported DuckDB extensions
- [ ] add retry-after-install behavior for opt-in execution paths
- [ ] preserve detailed error classification for install and load failures

### Phase 3: CLI wiring

- [ ] add `--install-missing-extension` to direct `data query`
- [ ] add `data duckdb doctor`
- [ ] add `data duckdb extension install <name>`
- [ ] add `data duckdb extension install --all-supported`

### Phase 4: Doctor and UX refinement

- [ ] refine `doctor` messaging to point users toward the explicit remediation surface when applicable
- [ ] expose any newly needed DuckDB runtime metadata in JSON output
- [ ] keep human-readable output concise while preserving exact detail in machine-readable output
- [ ] in interactive flows, print the exact CLI remediation command when a missing extension appears installable

### Phase 5: Tests and docs

- [ ] add tests for already-installed extension paths
- [ ] add tests for install-and-retry success
- [ ] add tests for install-blocked environments
- [ ] add tests for stale-version-cache-style failures where one extension is present and another is missing
- [ ] update `docs/guides/data-query-usage.md`
- [ ] add a dedicated guide for DuckDB extension lifecycle commands if a separate command family lands

## Recommendation for Immediate Next Step

Start with a narrow implementation slice:

- Phase 1 contract freeze
- shared install helper extraction
- `--install-missing-extension` for `data query`
- guide and doctor wording update
- interactive remediation messaging that points users to the explicit install command

Do not start with uninstall first.

Reason:

- install is the highest-value missing remediation path
- uninstall is more safety-sensitive and less frequently needed
- the query lane already has the context needed to choose the required extension deterministically

After that lands, evaluate whether the dedicated `data duckdb ...` family is still necessary or whether the opt-in install flow plus top-level doctor guidance is sufficient.

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
