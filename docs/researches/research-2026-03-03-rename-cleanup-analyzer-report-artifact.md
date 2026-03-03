---
title: "Rename cleanup analyzer report artifact"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Decide whether analyzer-assisted `rename cleanup` should produce a separate grouped report artifact, and define the safest first-pass contract if it does.

## Milestone Goal

Settle the artifact boundary without blurring:

- replayable rename plans
- analyzer evidence and suggestions
- grouped pattern recommendations that are not yet implemented

## Related Plans

- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

## Key Findings

### 1. The report should be separate from `rename-plan-*.csv`

The existing rename plan CSV contract is replayable input for `rename apply <csv>`.

That means analyzer output must not reuse:

- the `rename-plan-*.csv` filename pattern
- the same column contract
- any naming that implies executable apply input

Recommended artifact family:

- `rename-cleanup-analysis-<utc-timestamp>Z-<uid>.csv`

Implication:

- report artifacts stay advisory and cannot be confused with replayable rename plans

### 2. The first useful report can be group-based evidence plus one overall suggestion

Current analyzer-assisted cleanup returns one overall recommendation for the chosen scope:

- `recommended_hints`
- `recommended_style`
- `recommended_timestamp_action`
- `confidence`
- `reasoning_summary`

Current analyzer evidence already provides grouped local pattern rows:

- grouped pattern
- count
- representative examples

That means the first report can already be valuable without inventing per-group AI recommendations.

Recommended first-pass report shape:

- one row per grouped local filename pattern
- duplicated overall analyzer suggestion columns on each row
- advisory only

Implication:

- we can ship a grouped CSV report before expanding Codex into true per-pattern recommendations

### 3. True per-pattern cleanup recommendations are a larger follow-up

If the product goal becomes:

- pattern A -> suggested `timestamp`
- pattern B -> suggested `serial`
- pattern C -> suggested `uid`

then the Codex response contract must change materially.

That would require new structured output such as:

- `grouped_suggestions[]`
- local group identifiers
- per-group hints/style/timestamp decisions

Implication:

- “export grouped CSV” and “support per-group analyzer recommendations” are related but not the same feature
- the first one is a reporting enhancement
- the second one is a deeper analyzer redesign

### 4. The report should stay interactive-only and opt-in in its first pass

Analyzer-assisted cleanup itself is currently interactive-only.

Recommended first-pass trigger:

- run analyzer-assisted cleanup interactively
- after suggestions are shown, optionally ask:
  - `Write grouped cleanup analysis report CSV?`

Implication:

- the report stays attached to analyzer review workflows
- CLI deterministic cleanup does not gain a new artifact unexpectedly

## Recommended CSV Contract

Recommended filename pattern:

- `rename-cleanup-analysis-<utc-timestamp>Z-<uid>.csv`

Recommended columns:

- `report_id`
- `generated_at`
- `scope_kind`
- `scope_path`
- `total_candidate_count`
- `sampled_count`
- `group_index`
- `grouped_pattern`
- `group_count`
- `representative_examples`
- `recommended_hints`
- `recommended_style`
- `recommended_timestamp_action`
- `confidence`
- `reasoning_summary`

Column notes:

- `representative_examples` can use a pipe-delimited value in the CSV cell
- `recommended_*`, `confidence`, and `reasoning_summary` represent the overall analyzer suggestion in the first pass, not per-group AI decisions
- no row in this CSV is executable by `rename apply`

## Implications or Recommendations

Recommended decision:

- yes, add an optional grouped analyzer report artifact
- keep it separate from `rename-plan-*.csv`
- keep it interactive-only and advisory in the first pass
- do not pretend it contains per-group AI recommendations until the Codex response contract grows to support that

Recommended next implementation boundary:

- write grouped local evidence rows plus the overall analyzer suggestion
- avoid changing the current cleanup execution path
- defer true grouped recommendation output to a later analyzer phase

## References

- `docs/guides/rename-plan-csv-schema.md`
- `src/cli/actions/rename/cleanup-analyzer.ts`
- `src/cli/actions/rename/cleanup-codex.ts`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
