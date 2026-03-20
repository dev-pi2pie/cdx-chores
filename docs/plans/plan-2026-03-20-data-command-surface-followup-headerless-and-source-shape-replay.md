---
title: "Data command surface follow-up: headerless contract and source-shape replay"
created-date: 2026-03-20
status: draft
agent: codex
---

## Goal

Turn the current data command-surface research into an implementation-ready follow-up plan that:

- unifies explicit headerless delimited behavior across `data preview`, `data query`, `data extract`, and interactive mode
- smooths the current shape-first direct CLI workflow by allowing `data query` to replay accepted source-shape artifacts
- closes the shared documentation gap by introducing one source-shape guide parallel to the existing header-mapping guide

## Why This Plan

The current research now points to two separate but related follow-ups:

1. the most obvious cross-command inconsistency is headerless CSV/TSV behavior
2. the cleanest next direct-CLI smoothing step is `data query --source-shape <path>`, not `data query --codex-suggest-shape`

Those should be planned together because they touch the same product surface questions:

- what source interpretation is explicit versus implicit
- how shape generation and shape replay differ
- how direct CLI and interactive flows tell the same story without collapsing `data extract` and `data query` into one command

This plan should stay additive and backward-compatible with the current stable `v0.0.8` command surface.

## Current State

- `data preview` has explicit `--no-header` and interactive headerless prompting for `.csv` and `.tsv`
- `data query` and `data extract` rely on DuckDB CSV header auto-detection and do not expose `--no-header`
- direct `data extract` can generate and replay source-shape artifacts
- direct `data query` can consume explicit deterministic shape flags, but cannot replay a source-shape artifact directly
- `docs/guides/data-extract-usage.md` documents source-shape generation and replay from the extract lane
- `docs/guides/data-schema-and-mapping-usage.md` documents header-mapping artifacts only
- there is no shared guide for source-shape artifacts and replay semantics

## Scope

### Cross-command headerless contract

- add `--no-header` to direct `data query`
- add `--no-header` to direct `data extract`
- add matching interactive prompts to query and extract flows for `.csv` and `.tsv`
- preserve one generated placeholder naming family across preview/query/extract:
  - `column_1`, `column_2`, ...
- keep omission of `--no-header` backward-compatible with the current default detection behavior

### Source-shape replay in query

- add `--source-shape <path>` to direct `data query`
- treat the artifact as the source of effective deterministic shape:
  - `source`
  - `range`
  - `headerRow`
  - `bodyStartRow`
- keep source-shape artifact generation on direct `data extract`
- do not add `data query --codex-suggest-shape` in this slice

### Source-shape precedence and conflict contract

- freeze the direct query replay rule:
  - `--source-shape <path>` replaces explicit shape flags
  - it does not merge with `--source`, `--range`, `--header-row`, or `--body-start-row`
- fail clearly when `--source-shape` is combined with explicit deterministic shape flags
- keep `<input>` required and continue exact-match validation between artifact input and current invocation input

### Shared documentation

- add a shared guide:
  - `docs/guides/data-source-shape-usage.md`
- keep `docs/guides/data-schema-and-mapping-usage.md` focused on header mapping only
- update:
  - `docs/guides/data-query-usage.md`
  - `docs/guides/data-extract-usage.md`
  - `docs/guides/data-query-interactive-usage.md`
- describe:
  - shape generation
  - shape replay
  - exact-match compatibility
  - precedence/conflict behavior
  - shape-first CLI workflow versus interactive query workflow

### Product copy and command-surface alignment

- keep the command-family distinction:
  - `data extract` owns reviewed reusable shape generation
  - `data query` owns SQL against an accepted deterministic shape
- keep the new docs explicit that source shape and header mapping are different layers
- avoid wording that implies `data query` and `data extract` should collapse into one command

## Non-Goals

- `data query --codex-suggest-shape`
- changes to the source-shape artifact schema version unless strictly necessary
- automatic CSV header detection heuristics beyond the existing engine default when `--no-header` is omitted
- automatic source-shape artifact generation from interactive query
- unifying source-shape and header-mapping guides into one document

## Risks and Mitigations

- Risk: `--no-header` semantics drift across preview, query, and extract.
  Mitigation: freeze one shared rule for row retention and `column_n` naming and test all three lanes against the same examples.

- Risk: `--source-shape` plus explicit flags creates unclear override behavior.
  Mitigation: make them mutually exclusive in the first pass and fail clearly instead of inventing merge precedence.

- Risk: `data query` starts to look like a second source-shape generation lane.
  Mitigation: add replay only; keep reviewed shape generation owned by `data extract`.

- Risk: docs duplicate source-shape details across multiple guides.
  Mitigation: add one shared source-shape guide and make other guides link to it for contract details.

- Risk: the direct CLI workflow is documented before the replay path exists and becomes stale.
  Mitigation: update the query guide in the same implementation slice so examples and recommended workflows match shipped behavior.

## Implementation Touchpoints

- `src/cli/commands/data/query.ts`
- `src/cli/commands/data/extract.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-extract.ts`
- source-shape reuse helpers under `src/cli/data-workflows/` and `src/cli/duckdb/source-shape/`
- shared query-source preparation under `src/cli/duckdb/query/`
- interactive query and extract flows under `src/cli/interactive/data-query/` and `src/cli/interactive/data/`
- tests under `test/`
- `docs/guides/data-query-usage.md`
- `docs/guides/data-extract-usage.md`
- `docs/guides/data-query-interactive-usage.md`
- new `docs/guides/data-source-shape-usage.md`
- `docs/guides/data-schema-and-mapping-usage.md`

## Phase Checklist

### Phase 1: Freeze product contract

- [ ] freeze `--no-header` for direct `data query`
- [ ] freeze `--no-header` for direct `data extract`
- [ ] freeze interactive headerless prompts for query/extract on `.csv` and `.tsv`
- [ ] freeze `data query --source-shape <path>`
- [ ] freeze `--source-shape` as mutually exclusive with `--source`, `--range`, `--header-row`, and `--body-start-row`
- [ ] freeze the shared documentation split:
  - `data-source-shape-usage.md` for shape
  - `data-schema-and-mapping-usage.md` for header mapping

### Phase 2: Implement direct headerless query/extract support

- [ ] extend DuckDB-backed query/extract preparation so `--no-header` can explicitly force headerless delimited interpretation
- [ ] preserve the shared `column_n` placeholder contract
- [ ] keep current behavior unchanged when `--no-header` is omitted
- [ ] add focused direct CLI tests for:
  - query with headerless CSV
  - extract with headerless CSV
  - placeholder-name reuse with header mapping

### Phase 3: Implement interactive headerless parity

- [ ] add `.csv` / `.tsv` headerless prompts to interactive query
- [ ] add `.csv` / `.tsv` headerless prompts to interactive extract
- [ ] carry accepted headerless state through introspection, header review, SQL authoring, and extraction
- [ ] add focused interactive coverage for both flows

### Phase 4: Implement source-shape replay in query

- [ ] add `--source-shape <path>` to direct `data query`
- [ ] reuse the existing source-shape artifact resolution path rather than inventing a query-only parser
- [ ] apply accepted shape values before query source preparation
- [ ] fail clearly on mixed `--source-shape` plus explicit shape flags
- [ ] add focused tests for:
  - successful replay
  - exact-match failures
  - shape-flag conflict failures

### Phase 5: Documentation alignment

- [ ] add `docs/guides/data-source-shape-usage.md`
- [ ] move shared source-shape contract details out of extract-only narrative and into the new guide
- [ ] update query usage examples to include the replay form:
  - `data query --source-shape <path> --sql ...`
- [ ] update extract docs to describe source-shape generation and replay without implying query owns generation
- [ ] update schema/mapping docs to cross-link the new source-shape guide instead of absorbing shape semantics

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

## Related Plans

- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
