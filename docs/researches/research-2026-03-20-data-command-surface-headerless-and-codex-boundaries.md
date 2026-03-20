---
title: "Data command surface headerless and Codex boundary evaluation"
created-date: 2026-03-20
modified-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Evaluate two command-surface questions across `data preview`, `data query`, `data extract`, and interactive mode:

1. whether headerless CSV handling should stay split between explicit preview controls and DuckDB auto-detection in query/extract
2. whether `--codex-suggest-shape` should remain a direct-CLI `data extract` feature only, or expand into direct `data query`

This document records the evaluation state and recommendation that drove the later follow-up plan work. Direction B and the later replay follow-up have since been implemented.

## Key Findings

### 1. The current behavior is functionally usable but product-level inconsistent

At evaluation time, the product behaved like this:

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

### 5. The smoother direct-CLI follow-up is replay, not duplicate reviewed-shape generation

Now that the query guide explicitly describes the current shape-first CLI workflow:

1. `data extract --codex-suggest-shape`
2. carry accepted shape flags into `data query --sql ...`

the main product gap becomes clearer:

- `data query` cannot replay an accepted source-shape artifact directly
- users must manually copy accepted `source`, `range`, `header-row`, and `body-start-row` values into the next command

That points to a better follow-up than adding `data query --codex-suggest-shape`:

- add `data query --source-shape <path>`

Why this is cleaner:

- it preserves the existing boundary that reviewed reusable source-shape generation belongs to `data extract`
- it smooths the direct CLI workflow that already mirrors interactive query behavior
- it reduces flag-copy friction without making `data query` a second reviewed-shape artifact producer
- it keeps the product distinction understandable:
  - `data extract` discovers or replays shape for shaping/materialization work
  - `data query` executes SQL against an accepted deterministic shape

### 6. Shared source-shape documentation was still missing

The current docs record source-shape behavior, but not yet in one shared place:

- `docs/guides/data-extract-usage.md` documents source-shape generation and replay from the `data extract` lane
- `docs/guides/data-schema-and-mapping-usage.md` documents header-mapping artifacts only
- there is no dedicated shared guide for source-shape artifacts and replay semantics

That creates a documentation gap:

- source shape and header mapping are different layers, but only header mapping has a shared contract guide
- the current shape-first CLI workflow has no single shared source-shape reference to point to
- if `data query --source-shape <path>` is added later, documenting source-shape only under `data extract` will no longer scale

Recommended documentation follow-up:

- add a shared guide such as `docs/guides/data-source-shape-usage.md`
- keep it separate from `data-schema-and-mapping-usage.md`
- define generation, replay, exact-match reuse, and precedence semantics there once the replay contract is accepted

## Main UX Confusion Points

- `data preview` teaches an explicit `--no-header` contract, but `data query` and `data extract` do not expose the same user intent.
- the same headerless CSV can appear to have a first-class contract in one command and only implicit auto-detection in the next.
- interactive `data query` can ask Codex for shape help, but direct `data query` has no equivalent reusable reviewed-shape command.
- the current split makes `data extract` look like the owner of shaping artifacts, while interactive `data query` partially behaves like it also owns reviewed shaping.
- docs are forced to explain behavior in terms of internal implementation seams instead of one stable user-facing rule.
- source-shape artifacts do not yet have one shared guide parallel to the shared header-mapping guide.

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

### Direction D. Keep reviewed shape generation on `extract`, but let `query` replay source-shape artifacts

Contract:

- do Direction B
- add `--source-shape <path>` to direct `data query`
- keep `--codex-suggest-shape` owned by direct `data extract`

Pros:

- preserves the current product boundary
- smooths the shape-first CLI workflow substantially
- reduces manual flag copying between review and SQL execution
- easier to explain than adding a second reviewed-shape generator entry point

Cons:

- `data query` gains one more shaping input surface
- docs must explain artifact replay separately from artifact generation

## Tradeoff Comparison

### Docs

- Direction A keeps docs stable but forces more caveats.
- Direction B simplifies the headerless story substantially while keeping the shaping-artifact story focused.
- Direction C is the most symmetrical but creates more duplicate documentation around reviewed shaping.
- Direction D keeps docs slightly larger than B, but the added complexity is high-value because it removes a real two-command friction point.

### User Expectations

- Direction A preserves current behavior but leaves the most surprising gaps.
- Direction B matches user intuition better: “headerless is a property of the file, not of one command.”
- Direction C is easiest to reason about at first glance, but it weakens the product distinction between shaping/materialization and SQL authoring.
- Direction D aligns well with user expectations once the shape-first CLI workflow is taught: users can discover shape in one lane and replay it in the SQL lane.

### Backward Compatibility

- Direction A is safest.
- Direction B is still safe if `--no-header` is additive and default auto-detection remains unchanged.
- Direction C is additive too, but it changes product perception more than raw compatibility.
- Direction D is also additive and keeps the current stable mental model intact better than C.

### Implementation Complexity

- Direction A is trivial.
- Direction B is moderate because it requires explicit header override plumbing in DuckDB-backed query/extract and interactive prompts.
- Direction C is highest because it adds both headerless unification and a second reviewed shape-artifact entry point.
- Direction D is moderate-to-high, but more targeted than C because it reuses the existing source-shape artifact contract instead of duplicating reviewed-shape generation.

## Recommendation

Recommend Direction B as the first shipped slice, with Direction D as the remaining planned follow-up.

Current alignment with the plan:

- Direction B is the accepted and now-landed slice:
  - explicit `--no-header` parity across preview/query/extract
  - interactive CSV/TSV headerless prompts for query/extract
  - shared `column_n` placeholder contract
  - shared source-shape guide split from header-mapping guidance
- Direction D remains the next follow-up:
  - add `data query --source-shape <path>`
  - define replay conflict and precedence rules
  - generalize the current extract-specific replay helper before reusing it in query
  - decide whether `data query codex` stays explicitly separate in that replay slice or aligns at the same time

Why this is the right cut:

- it fixes the biggest coherence problem without casually breaking `v0.0.8`
- it keeps `data extract` as the primary shaping/materialization lane
- it avoids turning `data query` into a second artifact-producing shaping workflow before there is stronger evidence that users need that duplication
- it lets the team improve the command family in a way users will immediately understand
- the remaining direct-CLI smoothing step is still `data query --source-shape <path>`, not `data query --codex-suggest-shape`

Pragmatic position on `--codex-suggest-shape`:

- treat the current direct-CLI `data extract` ownership as intentional, not accidental
- describe the lack of direct `data query --codex-suggest-shape` as temporary-but-acceptable, not urgent
- do not make it the first smoothing step for the direct CLI workflow
- prefer `data query --source-shape <path>` first if replay friction becomes the next obvious pain point

## Concrete CLI and Docs Implications

Direction B implications now aligned with the shipped slice:

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
- add a shared source-shape guide rather than expanding `data-schema-and-mapping-usage.md` to cover both layers

Remaining planned follow-up after Direction B:

- add `--source-shape <path>` to `data query`
- document the direct CLI shape-first workflow as:
  - `data extract --codex-suggest-shape` to discover and confirm deterministic shape
  - `data query --source-shape <path> --sql ...` to run scoped SQL against the accepted shape
- keep source-shape artifact generation and source-shape artifact replay as separate concepts in the docs
- define replay conflict and precedence rules for:
  - `--source-shape`
  - `--source`
  - `--range`
  - `--header-row`
  - `--body-start-row`
- generalize the current extract-specific source-shape replay helper before wiring query-side replay
- keep exact-match replay behavior explicit in docs and user-facing errors
- decide whether direct `data query codex` remains explicitly out of scope for that replay slice or aligns in the same later phase

## Related Plans

- `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`
