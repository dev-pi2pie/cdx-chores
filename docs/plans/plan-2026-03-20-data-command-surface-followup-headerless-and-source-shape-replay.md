---
title: "Data command surface follow-up: headerless contract and source-shape docs alignment"
created-date: 2026-03-20
modified-date: 2026-03-20
status: active
agent: codex
---

## Goal

Turn the current data command-surface research into an implementation-ready follow-up plan that:

- unifies explicit headerless delimited behavior across `data preview`, `data query`, `data extract`, and interactive mode
- closes the shared documentation gap by introducing one source-shape guide parallel to the existing header-mapping guide

## Why This Plan

The current research now points to two separate but related follow-ups, but it recommends shipping them in sequence:

1. the most obvious cross-command inconsistency is headerless CSV/TSV behavior
2. the cleanest next direct-CLI smoothing step is `data query --source-shape <path>`, not `data query --codex-suggest-shape`

This plan intentionally covers only the first shipped slice from that research:

- Direction B now:
  - unify explicit headerless behavior across preview/query/extract and interactive mode
  - add the missing shared source-shape guide
- Direction D later:
  - add `data query --source-shape <path>` if the shape-first direct CLI workflow still feels too manual in practice

Why keep the first implementation slice narrower:

- what source interpretation is explicit versus implicit
- how direct CLI and interactive flows tell the same story without changing the current extract/query ownership boundary too early
- how to preserve the research recommendation that replay follow only after the headerless contract lands and real usage proves the remaining friction

This plan should stay additive and backward-compatible with the current stable `v0.0.8` command surface.

Progress status:

- Phases 1 through 5 are completed for Direction B
- the plan remains active because the direct query replay follow-up is still pending

## Current State

- `data preview` has explicit `--no-header` and interactive headerless prompting for `.csv` and `.tsv`
- `data query` and `data extract` rely on DuckDB CSV header auto-detection and do not expose `--no-header`
- direct `data extract` can generate and replay source-shape artifacts
- direct `data query` can consume explicit deterministic shape flags, but cannot replay a source-shape artifact directly
- `docs/guides/data-extract-usage.md` documents source-shape generation and replay from the extract lane
- `docs/guides/data-schema-and-mapping-usage.md` documents header-mapping artifacts only
- there is no shared guide for source-shape artifacts and replay semantics
- `data query codex` uses the shared query-family introspection path, but this plan does not change that lane yet

## Scope

### Cross-command headerless contract

- add `--no-header` to direct `data query`
- add `--no-header` to direct `data extract`
- add matching interactive prompts to query and extract flows for `.csv` and `.tsv`
- preserve one generated placeholder naming family across preview/query/extract:
  - `column_1`, `column_2`, ...
- keep omission of `--no-header` backward-compatible with the current default detection behavior

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
  - current extract-side shape replay
  - current exact-match compatibility
  - shape-first CLI workflow versus interactive query workflow

### Product copy and command-surface alignment

- keep the command-family distinction:
  - `data extract` owns reviewed reusable shape generation
  - `data query` owns SQL against an accepted deterministic shape
- keep the new docs explicit that source shape and header mapping are different layers
- avoid wording that implies `data query` and `data extract` should collapse into one command

### Deferred follow-up captured by this plan, but not implemented here

- `data query --source-shape <path>`
- direct query replay precedence rules
- helper generalization required to support query-side source-shape replay without reusing extract-specific validation text
- any `data query codex` alignment work that should accompany a later query-family replay feature

## Non-Goals

- `data query --codex-suggest-shape`
- `data query --source-shape <path>`
- changes to the source-shape artifact schema version unless strictly necessary
- automatic CSV header detection heuristics beyond the existing engine default when `--no-header` is omitted
- automatic source-shape artifact generation from interactive query
- `data query codex` command-surface changes in this slice
- unifying source-shape and header-mapping guides into one document

## Risks and Mitigations

- Risk: `--no-header` semantics drift across preview, query, and extract.
  Mitigation: freeze one shared rule for row retention and `column_n` naming and test all three lanes against the same examples.

- Risk: docs duplicate source-shape details across multiple guides.
  Mitigation: add one shared source-shape guide and make other guides link to it for contract details.

- Risk: excluding `data query codex` from this slice leaves the query-family surface uneven.
  Mitigation: state that exclusion explicitly now, and revisit Codex alignment only after the base headerless contract lands.

- Risk: the shared source-shape guide accidentally implies query-side replay already exists.
  Mitigation: document current shipped generation/replay behavior precisely and describe query replay only as a future follow-up when relevant.

## Implementation Touchpoints

- `src/cli/commands/data/query.ts`
- `src/cli/commands/data/extract.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-extract.ts`
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

- [x] freeze `--no-header` for direct `data query`
- [x] freeze `--no-header` for direct `data extract`
- [x] freeze interactive headerless prompts for query/extract on `.csv` and `.tsv`
- [x] freeze the shared documentation split:
  - `data-source-shape-usage.md` for shape
  - `data-schema-and-mapping-usage.md` for header mapping
- [x] freeze explicit exclusion of `data query codex` from this implementation slice

### Phase 2: Implement direct headerless query/extract support

- [x] extend DuckDB-backed query/extract preparation so `--no-header` can explicitly force headerless delimited interpretation
- [x] preserve the shared `column_n` placeholder contract
- [x] keep current behavior unchanged when `--no-header` is omitted
- [x] add focused direct CLI tests for:
  - query with headerless CSV
  - extract with headerless CSV
  - placeholder-name reuse with header mapping

### Phase 3: Implement interactive headerless parity

- [x] add `.csv` / `.tsv` headerless prompts to interactive query
- [x] add `.csv` / `.tsv` headerless prompts to interactive extract
- [x] carry accepted headerless state through introspection, header review, SQL authoring, and extraction
- [x] add focused interactive coverage for both flows

### Phase 4: Record deferred replay follow-up

- [x] no implementation work in this slice
- [x] record the future follow-up contract for `data query --source-shape <path>` without implementing it here
- [x] note that a later replay plan must first generalize the current extract-specific source-shape helper before query can reuse it safely
- [x] note that a later replay plan must decide whether `data query codex` aligns in the same slice or remains explicitly separate

### Phase 5: Documentation alignment

- [x] add `docs/guides/data-source-shape-usage.md`
- [x] move shared source-shape contract details out of extract-only narrative and into the new guide
- [x] update query usage examples to keep the current manual shape-first CLI workflow accurate:
  - `data extract --codex-suggest-shape`
  - then `data query` with explicit accepted shape flags
- [x] update extract docs to describe source-shape generation and replay without implying query owns generation
- [x] update schema/mapping docs to cross-link the new source-shape guide instead of absorbing shape semantics

### Phase 6: Implement direct query source-shape replay

- [ ] add `data query --source-shape <path>`
- [ ] define conflict and precedence rules for:
  - `--source-shape`
  - `--source`
  - `--range`
  - `--header-row`
  - `--body-start-row`
- [ ] generalize the current extract-specific reusable source-shape helper so query can reuse the same exact-match contract without extract-only validation text
- [ ] keep exact-match replay behavior explicit in direct query docs and errors
- [ ] decide whether direct `data query codex` stays explicitly out of scope for the replay slice or needs alignment in the same later phase
- [ ] add focused direct CLI tests for:
  - query replay from a reviewed source-shape artifact
  - explicit flag conflicts with `--source-shape`
  - exact-match failure reporting
- [ ] update docs after query replay ships

## Related Research

- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

## Related Plans

- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
