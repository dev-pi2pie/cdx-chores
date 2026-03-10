---
title: "Data query Codex CLI drafting"
created-date: 2026-03-10
modified-date: 2026-03-10
status: draft
agent: codex
---

## Goal

Implement a separate CLI authoring lane for `data query codex` that drafts SQL from user intent through bounded introspection, while keeping execution separate from assistance.

## Why This Plan

`data query codex` is not the same feature as direct CLI query execution and not the same feature as interactive query flow.

It deserves its own plan because it introduces a distinct CLI contract:

- introspection-first SQL drafting
- natural-language intent input
- human-readable assistant output by default
- SQL-only output through `--print-sql`
- advisory-only Codex behavior with no default execution

This keeps the command family clearer:

- `data query` executes SQL
- `data query codex` drafts SQL
- interactive `data query` guides and reviews SQL in prompt flow

## Dependency Note

- this plan should follow direct CLI `data query` implementation
- this plan should land before interactive `data query` implementation
- the resulting implementation order is:
  1. direct CLI `data query`
  2. CLI `data query codex`
  3. interactive `data query`

## Current State

- the research contract now reserves `data query codex <input> --intent "..."` as a separate future lane
- the direct CLI query plan exists separately
- the interactive query plan exists separately
- there is no `data query codex` command yet
- there is no CLI introspection-first drafting lane yet
- there is no SQL-only print mode for Codex-assisted query drafting yet

## Design Contract

### Command shape

- command: `data query codex <input> --intent "..."`
- one input file per invocation
- one bounded introspection pass before SQL drafting
- one generated SQL result per invocation

### Input and source selection

- support `--input-format <format>`
- support `--source <name>`
- apply the same multi-object source-selection contract as direct CLI query
- if multiple source objects exist and no `--source` is given, fail clearly and list candidates

### Default output contract

Default output is human-readable assistant output containing:

- detected format
- selected source
- brief schema/sample summary
- generated SQL

Output-channel rules:

- default human-readable assistant output is written to stdout
- `--print-sql` writes SQL only to stdout
- diagnostics and failures are written to stderr

### Additional flags

- `--print-sql` prints SQL only
- `--print-sql` is mutually exclusive with any future execution flag
- do not implement `--execute` in the first pass
- reserve `--execute` as a later explicit execution guardrail

### Advisory guardrails

- introspection happens before SQL drafting
- Codex drafts SQL but does not execute automatically
- generated SQL must always be visible to the user
- failures should remain explicit rather than silently falling back to another mode

## Scope

### CLI surface

- add `data query codex <input> --intent "..."`
- add `--input-format <format>`
- add `--source <name>`
- add `--print-sql`
- define output behavior when `--print-sql` is absent
- define validation behavior for missing `--intent`

### Introspection behavior

- detect input format or honor `--input-format`
- gather bounded schema/sample context before Codex drafting
- support source selection for SQLite and Excel through `--source`
- fail clearly when source ambiguity prevents deterministic introspection

### Codex drafting behavior

- provide Codex with:
  - user intent
  - detected format
  - selected source
  - bounded schema/sample payload
- receive candidate SQL
- render default human-readable assistant output or SQL-only output depending on flags

### Error behavior

- surface Codex availability/configuration failures clearly
- surface introspection failures clearly
- surface source ambiguity clearly
- surface SQL-generation failures clearly
- do not silently execute or silently fall back to another mode

### Doctor and preflight behavior

- doctor should expose `data query codex` capability separately from DuckDB format capability
- Codex drafting capability should report:
  - configured support
  - authentication or session availability
  - ready-to-draft availability

## Non-Goals

- direct SQL execution inside the first `data query codex` implementation
- `--execute`
- interactive query flow
- revise/regenerate multi-turn conversations
- file output modes for assistant summaries
- JSON machine-readable assistant output
- non-SQL query helper flags on base `data query`

## Risks and Mitigations

- Risk: `data query codex` may blur the line between assistance and execution.
  Mitigation: keep execution out of the first pass and reserve `--execute` as a later guardrail.

- Risk: assistant output may become inconsistent or too verbose for CLI usage.
  Mitigation: freeze the default output shape and provide `--print-sql` for strict SQL-only output.

- Risk: introspection may become expensive or ambiguous on SQLite and Excel sources.
  Mitigation: keep introspection bounded and require `--source` when automatic selection is not deterministic.

- Risk: Codex availability failures may create confusing behavior relative to normal `data query`.
  Mitigation: keep `data query codex` as a separate command so failures do not affect the base execution lane.

## Implementation Touchpoints

- `src/command.ts`
- new `src/cli/actions/data-query-codex.ts`
- shared query/introspection helpers under `src/cli/duckdb/`
- any shared Codex integration helpers under `src/cli/` or adapter modules
- focused tests under `test/`
- future usage guide docs under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze CLI drafting contract

- [ ] add `data query codex <input> --intent "..."`
- [ ] add `--input-format <format>`
- [ ] add `--source <name>`
- [ ] add `--print-sql`
- [ ] define validation behavior for missing `--intent`
- [ ] define validation behavior for ambiguous source selection
- [ ] define validation behavior for incompatible flag combinations

### Phase 2: Introspection foundation

- [ ] reuse or build bounded introspection for supported formats
- [ ] support deterministic source selection for SQLite and Excel
- [ ] freeze sample-size behavior for CLI Codex drafting
- [ ] render a concise schema/sample summary for default output mode

### Phase 3: Codex integration

- [ ] define the exact prompt/context bundle passed to Codex
- [ ] draft SQL from natural-language intent
- [ ] keep Codex advisory-only
- [ ] define targeted failure messages for unavailable or failed Codex drafting

### Phase 4: Output behavior

- [ ] implement default human-readable assistant output
- [ ] implement SQL-only output for `--print-sql`
- [ ] keep default assistant output on stdout
- [ ] keep diagnostics and failures on stderr
- [ ] keep SQL-only output stable enough for shell workflows
- [ ] keep assistant summaries and SQL output deterministic enough for testing

### Phase 5: Doctor and preflight support

- [ ] add doctor reporting for `data query codex` availability
- [ ] distinguish configured support, authentication or session availability, and ready-to-draft availability
- [ ] define doctor behavior when Codex drafting is unavailable in the current environment

### Phase 6: Tests

- [ ] add CLI coverage for basic drafting flow
- [ ] add coverage for `--print-sql`
- [ ] add coverage for `--input-format`
- [ ] add coverage for `--source`
- [ ] add coverage for ambiguous-source failures
- [ ] add coverage for Codex configuration/unavailable failures
- [ ] add coverage for stdout/stderr separation in default and SQL-only modes
- [ ] add coverage for output-shape expectations in default and SQL-only modes

### Phase 7: Docs and verification

- [ ] add a dedicated `data query codex` usage guide
- [ ] document the split between execution and drafting lanes
- [ ] document `--print-sql`
- [ ] document the first-pass non-goal that `--execute` is not yet implemented
- [ ] document doctor and preflight expectations for Codex drafting availability
- [ ] run manual smoke checks across representative formats

## Success Criteria

- users can draft SQL from intent through a dedicated CLI lane without changing the semantics of `data query`
- multi-object formats behave deterministically through `--source`
- default output is readable and useful for humans
- `--print-sql` is stable and useful for shell workflows
- stdout and stderr behavior is deterministic enough for piping and tests
- users can tell ahead of time whether Codex drafting is available through doctor or equivalent preflight checks
- Codex failures remain isolated to the drafting lane and do not affect direct query execution

## Verification

- `bunx tsc --noEmit`
- focused `bun test` Codex drafting suites
- manual smoke checks across representative formats

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
