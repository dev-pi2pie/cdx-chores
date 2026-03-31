---
title: "Data query workspace alias follow-up"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Revise the shipped workspace binding surface so single-source mode keeps the implicit `file` shorthand, while workspace mode allows deliberate explicit `file` bindings and continues to use `--relation` as the only workspace-binding flag.

## Why This Plan

The first shipped workspace implementation froze a stricter rule:

- implicit `file` for single-source mode
- reserved `file` in workspace mode

Later follow-up research changed that direction:

- keep `file` implicit in single-source mode
- allow `file` as an explicit alias in workspace mode
- do not introduce a separate `--workspace` flag
- expand `--relation` rather than adding another binding surface

That is a contract change, not just a prompt tweak. It affects direct CLI parsing, workspace validation, interactive prompts, Codex guidance, tests, and user-facing docs.

## Current State

- workspace mode is entered through repeatable `--relation <binding>`
- direct CLI currently supports:
  - bare `--relation users`
  - explicit `--relation alias=source`
- the parser already accepts `file` syntactically, but workspace validation rejects it later
- interactive workspace prompts also reject `file` as a relation name
- current docs still describe `file` as reserved in workspace mode

## Design Contract

### Alias rule

- single-source mode continues to expose the implicit compatibility alias `file`
- workspace mode no longer reserves `file`
- when `file` appears in workspace mode, it is explicit only, never implicit
- docs and prompts must make that distinction visible

### `--relation` contract

- keep `--relation <binding>` as the only workspace-binding flag
- keep repeatable usage valid
- keep exact source matching rules
- keep simple SQL identifier rules for aliases
- keep explicit aliasing for selectors that are not valid bare aliases

### Expanded binding input

This follow-up should extend `--relation` so one flag value may include multiple comma-separated bindings.

Examples:

- `--relation users,file`
- `--relation users,events=analytics.events`

Equivalent expanded forms:

- `--relation users --relation file`
- `--relation users --relation events=analytics.events`

### Non-goals inside this follow-up

- no new `--workspace` flag
- no relaxed dotted bare alias rule such as `--relation analytics.events`
- no case-insensitive source matching
- no new workspace semantics beyond the alias-policy change and binding-surface expansion

## Scope

### Direct CLI parsing and validation

- allow explicit workspace alias `file`
- remove the current workspace validation that rejects `file`
- extend `--relation` parsing so one value may contain a comma-separated bundle of bindings
- keep malformed alias validation deterministic

### Interactive workspace binding

- allow `file` as an explicit interactive relation name in workspace mode
- stop treating `file` as invalid during workspace alias entry
- keep source-name defaults when they are valid
- keep explicit alias entry for dotted selectors where needed

### Workspace execution and Codex drafting

- ensure direct query workspace execution accepts explicit `file` bindings
- ensure Codex workspace introspection and prompt construction treat explicit workspace `file` as an ordinary bound relation
- keep single-source Codex behavior unchanged

### Documentation

- update `docs/guides/data-query-usage.md`
- update `docs/guides/data-query-codex-usage.md`
- update `docs/guides/data-query-interactive-usage.md`
- replace the old “reserved `file` in workspace mode” rule with the new explicit-only distinction
- document comma-separated `--relation` bundles if they land in this follow-up

### Tests

- update command and action coverage for the new explicit workspace `file` behavior
- update interactive routing coverage so workspace alias entry accepts `file`
- add parser coverage for comma-separated `--relation` bundles
- keep single-source `file` shorthand coverage intact

## Risks and Mitigations

- Risk: users confuse implicit single-source `file` with explicit workspace `file`.
  Mitigation: make docs and interactive messaging explicit that workspace `file` is user-bound, not automatic.

- Risk: comma-separated `--relation` values make parsing ambiguous or weaken validation.
  Mitigation: expand the parser into the same normalized binding list used by repeatable flags, then validate aliases exactly as before.

- Risk: interactive prompts become inconsistent for simple names versus dotted selectors.
  Mitigation: keep the existing simple-alias rule and require explicit aliasing where source selectors are not valid bare aliases.

## Implementation Touchpoints

- `src/cli/options/parsers.ts`
- `src/cli/commands/data/query.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-query-codex.ts`
- `src/cli/duckdb/query/prepare-workspace.ts`
- `src/cli/interactive/data-query/source-selection.ts`
- `src/cli/data-query/codex.ts`
- query-related tests under `test/`
- `docs/guides/data-query-usage.md`
- `docs/guides/data-query-codex-usage.md`
- `docs/guides/data-query-interactive-usage.md`

## Phase Checklist

### Phase 1: Freeze revised alias contract

- [x] freeze explicit workspace `file` support
- [x] freeze single-source implicit `file` behavior unchanged
- [x] freeze no-new-`--workspace` decision
- [x] freeze whether comma-separated `--relation` bundles ship in this same slice

### Phase 2: Parser and workspace validation

- [x] update `--relation` parsing for the revised alias rule
- [x] allow explicit `file` bindings in workspace validation
- [x] add comma-separated bundle support if included in Phase 1
- [x] keep duplicate-alias and malformed-alias failures deterministic

### Phase 3: Interactive and Codex follow-up

- [x] allow interactive workspace alias entry for `file`
- [x] keep dotted-selector alias handling explicit
- [x] ensure workspace Codex introspection and prompts accept explicit `file`

### Phase 4: Docs and tests

- [x] update the query, codex, and interactive guides
- [x] replace old reserved-`file` wording
- [x] add or update direct CLI, action, and interactive coverage
- [x] add parser coverage for comma-separated `--relation` bundles when implemented

## Related Research

- `docs/researches/research-2026-03-31-workspace-file-alias-reservation-reconsideration.md`
- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
