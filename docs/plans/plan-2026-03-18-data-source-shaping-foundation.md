---
title: "Data source-shaping foundation"
created-date: 2026-03-18
modified-date: 2026-03-18
status: draft
agent: codex
---

## Goal

Implement the deterministic source-shaping foundation from the edge-case research so lightweight preview and DuckDB-backed query paths can recover usable tables without relying on heuristics.

## Why This Plan

The research now closes the core product decisions for first-pass shaping:

- `data preview` should gain explicit headerless delimited support
- `data query` should gain explicit Excel range shaping
- query-side shaping should attach to the shared helper layer used by direct CLI, interactive query, and direct `data query codex`
- interactive query should become shape-first before schema inspection

This is the smallest implementation slice that turns the research conclusions into working, deterministic behavior without yet taking on header-mapping artifacts or the new `data extract` lane.

## Current State

- `data preview` supports `.csv`, `.tsv`, and `.json` on the lightweight in-memory path
- the current delimited preview contract is still header-first
- `data query` binds Excel sheets through whole-sheet `read_xlsx(..., sheet = ...)`
- interactive `data query` inspects schema before users can shape the sheet
- direct `data query codex` shares the same introspection helper
- the research now freezes:
  - `data preview --no-header` for delimited preview
  - `data query --range` for Excel query inputs
  - shape-first interactive query flow
  - conservative Excel-only suspicious-schema warnings

## Scope

### Lightweight preview shaping

- add `--no-header` to `data preview`
- apply it to `.csv` and `.tsv`
- when set:
  - do not consume row 1 as headers
  - generate deterministic preview column names `column_n`
  - keep `--columns` and `--contains` targeting those generated names
  - keep row counting and preview windowing based on all rows

### Query-side deterministic shaping

- add `--range <A1:Z99>` to Excel `data query`
- require `--source <sheet>` for Excel as today
- wire `--range` through the shared query relation-building path so it is usable by:
  - direct `data query`
  - interactive `data query`
  - direct `data query codex`
- treat the accepted `range` as part of the active shaped-source state so later introspection, SQL drafting, and SQL execution all operate on the same range-bound source

### Interactive shape-first follow-up

- update interactive `data query` so Excel source shaping happens before schema-and-sample introspection
- ask for optional `range` before rendering schema/sample context
- carry the accepted `range` through manual SQL execution, formal-guide execution, and Codex-assisted drafting so the previewed schema and later execution stay aligned
- keep the existing multiline-editor option for interactive `Codex Assistant`, but regenerate its seeded schema/sample hints from the accepted shaped source rather than the raw source
- add conservative Excel-only warning behavior when:
  - no explicit shaping was provided
  - introspection looks strongly suspicious
- keep warning copy focused on source interpretation, not SQL authoring

### Shared behavior

- keep shaping explicit and deterministic
- keep auto-detection and merge-aware cleanup out of scope
- keep query-side shaping representable as concrete CLI flags rather than hidden state

### Documentation and verification

- update `docs/guides/data-preview-usage.md`
- update `docs/guides/data-query-usage.md`
- update `docs/guides/data-query-interactive-usage.md`
- update `docs/guides/data-query-codex-usage.md`
- keep public docs behavior-oriented and do not disclose private local fixture names or paths under `examples/playground/issue-data/`

## Non-Goals

- `--codex-suggest-headers`
- header-mapping JSON artifacts
- `data extract`
- query-side `--header-row <n>`
- query-side `--no-header`
- automatic table-region detection
- automatic header detection
- merge-aware filler cleanup

## Risks and Mitigations

- Risk: `data preview --no-header` drifts into a second synthetic naming style.
  Mitigation: reuse the existing `column_n` family and keep all generated-column behavior aligned with current preview conventions.

- Risk: `--range` works in direct query but not in shared consumers.
  Mitigation: implement shaping in shared query helpers first, then wire command surfaces on top.

- Risk: interactive warnings become noisy on valid narrow tables.
  Mitigation: keep warnings Excel-only, suppress them when explicit shaping exists, and trigger only on strong structural signals.

- Risk: public docs leak private local repro fixture references.
  Mitigation: document scenarios by behavior only and keep private verification paths out of public plan text and guides.

## Implementation Touchpoints

- `src/command.ts`
- `src/cli/data-preview/source.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/duckdb/query.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-query-codex.ts`
- `src/cli/interactive/data-query.ts`
- preview/query tests under `test/`
- `docs/guides/data-preview-usage.md`
- `docs/guides/data-query-usage.md`
- `docs/guides/data-query-interactive-usage.md`
- `docs/guides/data-query-codex-usage.md`

## Phase Checklist

### Phase 1: Freeze shaping surface

- [ ] add `--no-header` to `data preview`
- [ ] freeze `--no-header` as `.csv` / `.tsv` only
- [ ] add `--range <A1:Z99>` to Excel `data query`
- [ ] freeze `--range` as Excel-only and still dependent on `--source`
- [ ] freeze interactive Excel prompt order so optional `range` happens before schema inspection

### Phase 2: Implement lightweight preview no-header path

- [ ] update delimited preview loading to support headerless mode
- [ ] preserve `column_n` naming for generated headers
- [ ] keep `--columns`, `--contains`, row counts, and windowing aligned with the headerless row set
- [ ] add focused tests for headerless CSV and TSV

### Phase 3: Implement shared Excel range shaping

- [ ] extend shared query relation-building to accept `range`
- [ ] wire `--range` into direct `data query`
- [ ] wire `--range` into direct `data query codex`
- [ ] keep existing whole-sheet behavior when `--range` is absent
- [ ] add focused tests for range-shaped Excel query and Codex introspection

### Phase 4: Interactive shape-first query flow

- [ ] prompt for optional Excel `range` before introspection
- [ ] re-run introspection against the shaped source
- [ ] keep the accepted interactive `range` active through manual execution, formal-guide execution, and Codex drafting/execution confirmation
- [ ] add conservative suspicious-schema warnings for raw whole-sheet Excel introspection
- [ ] keep prompt copy explicit that this is source shaping, not SQL authoring
- [ ] add interactive coverage for the new prompt order and warning behavior

### Phase 5: Docs and verification

- [ ] update preview/query/Codex guides for the new shaping flags
- [ ] keep docs behavior-oriented rather than fixture-path-oriented
- [ ] add manual verification notes that private local repro files stay undisclosed in public docs

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
