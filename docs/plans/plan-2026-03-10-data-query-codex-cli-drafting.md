---
title: "Data query Codex CLI drafting"
created-date: 2026-03-10
modified-date: 2026-03-10
status: completed
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
- this plan owns the shared Codex drafting contract that interactive `Codex Assistant` should reuse
- the resulting implementation order is:
  1. direct CLI `data query`
  2. CLI `data query codex`
  3. interactive `data query`

## Current State

- the research contract now reserves `data query codex <input> --intent "..."` as a separate future lane
- the direct CLI query plan exists separately
- the interactive query plan exists separately
- `data query codex <input> --intent "..."` now exists as a separate CLI drafting lane
- bounded schema/sample introspection now feeds Codex drafting before SQL output
- SQL-only output is now available through `--print-sql`
- doctor now exposes `data query codex` preflight state separately from DuckDB format capability

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
- the revealed SQL should be rendered on its own line in default output
- `--print-sql` should keep SQL as one copyable line for shell reuse
- while drafting is running, the CLI should surface progress before revealing the final result
- the progress surface should show an explicit introspection step first
- the Codex drafting wait state should use a mutable `Thinking` status treatment in TTY contexts
- when final output is ready, any mutable running-status line should be cleared before the result is rendered
- the human-readable default output should use the CLI color layer for scan-friendly styling in TTY contexts
- the `SQL` label and the revealed SQL text should use different colors in TTY contexts
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

- [x] add `data query codex <input> --intent "..."`
- [x] add `--input-format <format>`
- [x] add `--source <name>`
- [x] add `--print-sql`
- [x] define validation behavior for missing `--intent`
- [x] define validation behavior for ambiguous source selection
- [x] define validation behavior for incompatible flag combinations

### Phase 2: Introspection foundation

- [x] reuse or build bounded introspection for supported formats
- [x] support deterministic source selection for SQLite and Excel
- [x] freeze sample-size behavior for CLI Codex drafting
- [x] render a concise schema/sample summary for default output mode

### Phase 3: Codex integration

- [x] define the exact prompt/context bundle passed to Codex
- [x] draft SQL from natural-language intent
- [x] keep Codex advisory-only
- [x] define targeted failure messages for unavailable or failed Codex drafting

### Phase 4: Output behavior

- [x] implement default human-readable assistant output
- [x] implement SQL-only output for `--print-sql`
- [x] render revealed SQL on its own line in default output while keeping `--print-sql` one-line
- [x] surface progress feedback for introspection and Codex drafting before final output
- [x] clear mutable TTY status output before rendering the final result
- [x] add color styling for human-readable Codex drafting output
- [x] style the `SQL` label and revealed SQL text with different colors
- [x] keep default assistant output on stdout
- [x] keep diagnostics and failures on stderr
- [x] keep SQL-only output stable enough for shell workflows
- [x] keep assistant summaries and SQL output deterministic enough for testing

### Phase 5: Doctor and preflight support

- [x] add doctor reporting for `data query codex` availability
- [x] distinguish configured support, authentication or session availability, and ready-to-draft availability
- [x] define doctor behavior when Codex drafting is unavailable in the current environment

### Phase 6: Tests

- [x] add CLI coverage for basic drafting flow
- [x] add coverage for `--print-sql`
- [x] add coverage for `--input-format`
- [x] add coverage for `--source`
- [x] add coverage for ambiguous-source failures
- [x] add coverage for Codex configuration/unavailable failures
- [x] add coverage for stdout/stderr separation in default and SQL-only modes
- [x] add coverage for output-shape expectations in default and SQL-only modes

### Phase 7: Docs and verification

- [x] add a dedicated `data query codex` usage guide
- [x] document the split between execution and drafting lanes
- [x] document `--print-sql`
- [x] document the first-pass non-goal that `--execute` is not yet implemented
- [x] document doctor and preflight expectations for Codex drafting availability
- [x] run manual smoke checks across representative formats

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
- `bun test test/cli-actions-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-command-data-query.test.ts test/cli-command-data-query-codex.test.ts test/data-query-fixture-generator.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- manual smoke checks across representative formats using a deterministic Codex stub:
  - `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/basic.csv --intent "show id and name ordered by id"`
  - `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/basic.csv --intent "count rows" --print-sql`
  - `CDX_CHORES_CODEX_PATH=examples/playground/.tmp-tests/data-query-codex-smoke-stub.mjs bun src/bin.ts data query codex examples/playground/data-query/multi.sqlite --source users --intent "list users ordered by id"`
  - `bun src/bin.ts doctor --json`

## Related Research

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
