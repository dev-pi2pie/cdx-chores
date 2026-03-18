---
title: "Header-mapping artifacts and Codex review"
created-date: 2026-03-18
modified-date: 2026-03-18
status: draft
agent: codex
---

## Goal

Implement the header-mapping artifact family and reviewed `--codex-suggest-headers` flow so semantic header suggestions can be proposed, reviewed, persisted, and reused under strict first-pass matching rules across query and extraction workflows.

## Why This Plan

This work is meaningfully different from deterministic source shaping:

- it introduces a new JSON artifact contract
- it introduces a reviewed Codex suggestion flow
- it introduces reuse and rewrite semantics for persisted mappings
- it requires a dedicated schema-and-mapping guide

Those are review-artifact and AI-assistance concerns, not just query or preview flag wiring.

## Current State

- the edge-case research now freezes:
  - `--codex-suggest-headers` as an in-scope review-first shaping feature
  - direct CLI `data query` using an explicit mapping-artifact review flow
  - one shared filename convention: `data-header-mapping-<uid>.json`
  - JSON-only mapping artifacts in the first implementation slice
  - strict normalized input-reference matching for reuse in the first implementation slice
  - preserve-unknown-fields behavior on rewrite
- no implementation exists yet for:
  - mapping artifact schema helpers
  - Codex header-suggestion engine
  - reviewed direct query flow
  - dedicated schema-and-mapping guide

## Dependency Note

- this plan should follow the shared source-shaping foundation plan
- `--range` and general query-side shape-state plumbing should already exist before header suggestions are layered on top
- query-side `--no-header` is not a prerequisite for this plan's first implementation slice
- `data extract` can reuse the results of this plan rather than inventing a second mapping system

## Scope

### Mapping artifact contract

- define JSON-only header-mapping artifacts
- freeze the required first-pass field set:
  - `version`
  - `metadata.artifactType`
  - `metadata.issuedAt`
  - `input.path` stored in one normalized CLI-facing representation
  - `input.format`
  - optional `input.source`
  - optional `input.range`
  - `mappings[].from`
  - `mappings[].to`
- freeze one shared filename family:
  - `data-header-mapping-<uid>.json`
- freeze first-pass reuse as normalized input-reference matching on `input.path`, `input.format`, optional `input.source`, and optional `input.range`
- explicitly defer file-content fingerprints and stale-file detection after in-place edits

### Shared engine

- collect suggestion evidence from the current shaped source:
  - deterministic column names
  - sample values
  - inferred types when available
- call Codex for semantic header suggestions
- validate suggestions:
  - non-empty names
  - uniqueness
  - collision handling
- serialize and read the mapping artifact
- normalize input references before writing or matching artifacts
- preserve unknown JSON fields when rewriting
- fail closed on unsupported schema versions that cannot be safely preserved
- reuse accepted mappings only when the current normalized input reference matches exactly
- apply accepted mappings and rebuild the shaped source

### Direct CLI `data query` reviewed flow

- add `--codex-suggest-headers`
- add explicit mapping-artifact output and input flags
- reviewed first-pass flow:
  - suggest headers
  - write mapping artifact
  - stop before SQL execution
  - rerun with accepted `--header-mapping <path>` plus `--sql`
- keep this flow scriptable and explicit

### Interactive review flow

- allow interactive shape flows to review Codex header suggestions
- keep the review surface small:
  - mapping table
  - `Accept all`
  - `Edit one`
  - `Keep generated names`
- keep deterministic `column_n` names visible during review

### Documentation

- add one dedicated schema-and-mapping guide
- link `data query` and later `data extract` docs back to that shared guide
- keep the guide public-safe and avoid disclosing private local repro paths under `examples/playground/issue-data/`

## Non-Goals

- `data extract` command implementation itself
- query-side `--header-row <n>`
- query-side `--no-header`
- looser mapping-compatibility heuristics
- TTY-only accept-in-place shortcut
- non-JSON persisted mapping artifacts

## Risks and Mitigations

- Risk: a reviewed direct-CLI header flow becomes too interactive to script.
  Mitigation: keep the first direct-CLI flow artifact-based and two-step rather than prompt-driven.

- Risk: older CLI versions delete metadata from newer mapping artifacts.
  Mitigation: preserve unknown fields and fail closed when schema versions are unsupported.

- Risk: users assume accepted mappings remain valid after in-place input-file edits.
  Mitigation: document first-pass reuse as normalized input-reference matching only, and defer file-content fingerprints or stale-file detection to later work.

- Risk: users confuse semantic suggestions with deterministic contract names.
  Mitigation: always keep `column_n` visible during review and acceptance.

- Risk: docs duplicate the artifact contract across multiple guides.
  Mitigation: add one dedicated schema-and-mapping guide and keep command guides brief.

## Implementation Touchpoints

- `src/command.ts`
- shared helpers under `src/cli/duckdb/` or adjacent modules for:
  - mapping artifact schema
  - Codex header suggestion
  - mapping application
- `src/cli/actions/data-query.ts`
- `src/cli/interactive/data-query.ts`
- tests for mapping artifacts and reviewed flows under `test/`
- new schema/mapping guide under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze artifact contract

- [ ] define the JSON schema helper surface
- [ ] freeze required and optional first-pass fields
- [ ] freeze one normalized CLI-facing representation for `input.path`
- [ ] freeze filename generation as `data-header-mapping-<uid>.json`
- [ ] freeze strict reuse as normalized input-reference matching on `path` / `format` / optional `source` / optional `range`
- [ ] explicitly defer file-content fingerprints and in-place edit detection
- [ ] freeze preserve-unknown-fields rewrite policy

### Phase 2: Shared suggestion and mapping engine

- [ ] implement suggestion-evidence collection from shaped sources
- [ ] implement Codex header-suggestion call and normalization
- [ ] implement mapping validation and collision handling
- [ ] implement mapping artifact read/write helpers
- [ ] implement accepted-mapping application and re-introspection helpers

### Phase 3: Direct CLI reviewed query flow

- [ ] add direct CLI flags for suggestion and mapping artifact reuse
- [ ] implement the two-step reviewed `data query` flow
- [ ] stop before SQL execution when only suggestion output was requested
- [ ] add focused tests for artifact writing, reuse, matching, and rewrite preservation

### Phase 4: Interactive review flow

- [ ] add interactive review UI for suggested headers
- [ ] support `Accept all`
- [ ] support `Edit one`
- [ ] support `Keep generated names`
- [ ] re-introspect the shaped source after accepted mappings

### Phase 5: Documentation

- [ ] add dedicated schema-and-mapping guide
- [ ] link command docs back to that guide
- [ ] document JSON-only first-pass artifacts
- [ ] keep public docs free of private fixture names or paths

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`

## Related Plans

- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
