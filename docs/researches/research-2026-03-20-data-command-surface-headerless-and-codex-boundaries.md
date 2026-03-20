---
title: "Data command surface headerless and Codex boundary evaluation"
created-date: 2026-03-20
modified-date: 2026-03-20
status: draft
agent: codex
---

## Goal

Evaluate two command-surface questions across `data preview`, `data query`, `data extract`, and interactive mode:

1. whether headerless CSV handling should stay split between explicit preview controls and DuckDB auto-detection in query/extract
2. whether `--codex-suggest-shape` should remain a direct-CLI `data extract` feature only, or expand into direct `data query`

## Key Findings

### 1. The current behavior is functionally usable but product-level inconsistent

Today the product behaves like this:

- `data preview`
  - lightweight in-memory lane for `.csv`, `.tsv`, `.json`
  - explicit headerless control through `--no-header`
  - interactive preview asks whether CSV/TSV input is headerless
- `data query`
  - DuckDB-backed SQL lane
  - CSV/TSV rely on DuckDB CSV header auto-detection
  - no direct `--no-header`
  - direct CLI supports `--codex-suggest-headers`
  - direct CLI does not support `--codex-suggest-shape`
- `data extract`
  - shaping/materialization lane
  - CSV/TSV also rely on DuckDB CSV header auto-detection
  - no direct `--no-header`
  - direct CLI supports `--codex-suggest-shape`
  - direct CLI supports `--codex-suggest-headers`
- interactive `data query`
  - can warn on suspicious Excel sheet shape
  - can ask Codex to suggest Excel shaping during review
  - keeps reviewed shaping in memory only
- interactive `data extract`
  - uses the same suspicious-sheet review and in-memory shaping flow
  - does not write reviewed artifacts unless the user reruns direct CLI flows later

This is coherent at the implementation-layer boundary, but not yet fully coherent at the product-layer boundary.

### 2. The current product boundary is shape-first for `extract`, SQL-first for `query`, and inspection-first for `preview`

The repo’s current docs consistently frame:

- `data preview` as read-only inspection
- `data extract` as shaping plus materialization
- `data query` as the expressive SQL lane when `extract` is too narrow

Within that framing, `--codex-suggest-shape` living on `data extract` does make sense today:

- it produces a reusable source-shape artifact
- source-shape artifacts are documented as a shaping/materialization concern
- `data query` can already consume the same deterministic shape inputs directly through `--source`, `--range`, `--header-row`, and `--body-start-row`

So the current `--codex-suggest-shape` split is not random. It reflects a product decision that reviewed reusable shaping belongs to the shaping lane, while query consumes accepted shape but does not own the artifact-producing reviewed flow.

### 3. The weakest part of the current surface is headerless CSV semantics across commands

Headerless behavior currently means different things depending on the lane:

- preview: explicit user-owned contract
- query/extract: implicit engine-owned contract
- header suggestions: shared `column_n` naming only after DuckDB happens to expose headerless placeholders

That creates three UX problems:

- users cannot carry the same “this file has no header row” intent across commands
- docs must explain two mental models for the same input class
- users may preview a file with explicit `--no-header`, then switch to query/extract and find no equivalent flag even though the same logical issue is in play

This is the more important inconsistency to fix first.

### 4. The missing direct `data query --codex-suggest-shape` surface is a smaller inconsistency

The inconsistency is real, but it is narrower:

- interactive `data query` can ask Codex to suggest Excel shaping
- direct `data query` cannot produce a reviewed source-shape artifact
- direct `data extract` can

That is mildly confusing, but the current docs can still explain it:

- reusable reviewed shaping belongs to `data extract`
- interactive `data query` offers in-session shaping help because it needs a recoverable path before SQL authoring

This boundary is defendable as intentional for now, even if it may not be the best long-term command surface.

## Main UX Confusion Points

- `data preview` teaches an explicit `--no-header` contract, but `data query` and `data extract` do not expose the same user intent.
- the same headerless CSV can appear to have a first-class contract in one command and only implicit auto-detection in the next.
- interactive `data query` can ask Codex for shape help, but direct `data query` has no equivalent reusable reviewed-shape command.
- the current split makes `data extract` look like the owner of shaping artifacts, while interactive `data query` partially behaves like it also owns reviewed shaping.
- docs are forced to explain behavior in terms of internal implementation seams instead of one stable user-facing rule.

## Design Directions

### Direction A. Keep the current split, document it harder

Contract:

- keep `--no-header` only on `data preview`
- keep CSV/TSV header handling in query/extract on DuckDB auto-detection
- keep `--codex-suggest-shape` only on direct `data extract`
- keep interactive query/extract reviewed shaping as in-memory guidance only

Pros:

- lowest implementation risk
- zero compatibility churn for `v0.0.8`
- preserves the current extract/query boundary exactly

Cons:

- headerless CSV remains the clearest cross-command coherence gap
- docs stay more complex than the command family deserves
- user expectations continue to drift between preview and query/extract

### Direction B. Unify explicit headerless contract across preview, query, and extract, but keep reviewed shape artifacts owned by `extract`

Contract:

- add `--no-header` to direct `data query`
- add `--no-header` to direct `data extract`
- add matching interactive prompts for query/extract when the chosen format is CSV/TSV
- keep the current `column_n` placeholder contract across preview/query/extract
- keep `--codex-suggest-shape` on direct `data extract` only for now
- keep interactive query/extract able to use temporary in-session shape review for Excel

Pros:

- fixes the most obvious user-facing inconsistency
- gives all tabular lanes one stable headerless story
- keeps the extract/query boundary mostly intact
- backward-compatible because existing auto-detection can remain the default when `--no-header` is omitted

Cons:

- query/extract docs grow a little
- the engine path must support explicit header override instead of only auto-detection
- `data query` still lacks a direct reviewed shape-artifact creation surface

### Direction C. Fully unify shaping: add `--no-header` and `--codex-suggest-shape` to `data query` too

Contract:

- do everything from Direction B
- also add direct `data query --codex-suggest-shape [--write-source-shape <path>]`
- allow `data query` to produce reusable reviewed source-shape artifacts, not just consume explicit shape flags

Pros:

- most symmetrical CLI surface
- easiest to explain as “all data lanes share the same shaping controls”
- reduces the specialness of `data extract` as the only direct reviewed-shape artifact producer

Cons:

- weakest product boundary: `query` starts to absorb shaping workflow ownership
- more docs duplication
- more chance of users asking why two commands now produce the same reviewed artifact before diverging later
- higher implementation and maintenance surface

## Tradeoff Comparison

### Docs

- Direction A keeps docs stable but forces more caveats.
- Direction B simplifies the headerless story substantially while keeping the shaping-artifact story focused.
- Direction C is the most symmetrical but creates more duplicate documentation around reviewed shaping.

### User Expectations

- Direction A preserves current behavior but leaves the most surprising gaps.
- Direction B matches user intuition better: “headerless is a property of the file, not of one command.”
- Direction C is easiest to reason about at first glance, but it weakens the product distinction between shaping/materialization and SQL authoring.

### Backward Compatibility

- Direction A is safest.
- Direction B is still safe if `--no-header` is additive and default auto-detection remains unchanged.
- Direction C is additive too, but it changes product perception more than raw compatibility.

### Implementation Complexity

- Direction A is trivial.
- Direction B is moderate because it requires explicit header override plumbing in DuckDB-backed query/extract and interactive prompts.
- Direction C is highest because it adds both headerless unification and a second reviewed shape-artifact entry point.

## Recommendation

Recommend Direction B for the next feature release after the current patch cycle.

Why this is the right cut:

- it fixes the biggest coherence problem without casually breaking `v0.0.8`
- it keeps `data extract` as the primary shaping/materialization lane
- it avoids turning `data query` into a second artifact-producing shaping workflow before there is stronger evidence that users need that duplication
- it lets the team improve the command family in a way users will immediately understand

Pragmatic position on `--codex-suggest-shape`:

- treat the current direct-CLI `data extract` ownership as intentional, not accidental
- describe the lack of direct `data query --codex-suggest-shape` as temporary-but-acceptable, not urgent
- revisit it only after the headerless contract is unified and after real usage shows whether users actually want reusable shaping artifacts from the query lane itself

## Concrete CLI and Docs Implications

Recommended future-release implications:

- add `--no-header` to `data query <input>`
- add `--no-header` to `data extract <input>`
- add interactive CSV/TSV headerless prompts to query and extract flows
- define one cross-command rule:
  - when `--no-header` is set, row 1 stays in the data row set and generated names use `column_n`
  - when omitted, current detection/default behavior remains unchanged for compatibility
- update guides so headerless CSV/TSV is described once as a shared contract, not separately per command
- keep `--codex-suggest-shape` documented as a direct `data extract` reviewed-artifact flow
- update interactive guides to say:
  - interactive query/extract may use temporary in-session reviewed shaping
  - reusable reviewed source-shape artifacts are still produced through direct `data extract`

## Related Plans

- `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`
