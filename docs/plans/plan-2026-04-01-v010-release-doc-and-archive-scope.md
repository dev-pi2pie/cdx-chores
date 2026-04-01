---
title: "0.1.0 Release Docs And Archive Scope"
created-date: 2026-04-01
status: active
agent: codex
---

## Goal

Lock the `0.1.0` stable-release wording, restore clean verification gates, and define the next documentation archive scope without moving historical records prematurely.

## Release Readiness Targets

- update `README.md` and public guides so they describe the current stable release as `v0.1.0` instead of the previous `v0.0.9` baseline
- avoid prerelease-sounding wording where the behavior is now part of the stable contract
- keep genuinely provisional guidance marked clearly when a feature is still intentionally deferred
- restore a clean local verification baseline for stable release work:
  - `bun run build`
  - `bunx tsc --noEmit`
  - `bun test`

## Proposed Archive Scope

### Phase 1: Status Normalization

Before moving files, normalize stale top-level statuses so archive actions reflect document state instead of guesswork.

Review these first:

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md`
- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-02-25-excel-like-workflows-scope-and-tooling.md`
- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

Expected outcome:

- mark completed work `completed`
- keep still-relevant references in place
- mark abandoned or replaced work `superseded` or `cancelled` before archiving

### Phase 2: Candidate Plan Archive Batch

After status cleanup, archive completed top-level plans that no longer need to stay as primary working references for `0.1.x`.

Strong candidates:

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`
- `docs/plans/plan-2026-03-17-delimited-text-preview-and-conversion-parity.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-18-header-mapping-artifacts-and-codex-review.md`
- `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`
- `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`
- `docs/plans/plan-2026-03-29-inline-ghost-prompt-wrap-fix.md`
- `docs/plans/plan-2026-03-30-interactive-contextual-tip-followup.md`
- `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`
- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-31-data-query-workspace-alias-followup.md`

Keep in `docs/plans/` for now:

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`
- `docs/plans/plan-2026-03-31-data-extract-duckdb-file-parity.md`
- any plan still marked `active`, `blocked`, or `draft` after the status pass

### Phase 3: Candidate Research Archive Batch

Archive completed research only when a stable guide or plan has clearly replaced it as the current reader-facing reference.

Conservative candidates:

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
- `docs/researches/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
- `docs/researches/research-2026-03-19-big-merged-cell-shaping-gap.md`
- `docs/researches/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`
- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/research-2026-03-31-workspace-file-alias-reservation-reconsideration.md`

Keep active/current:

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`
- `docs/researches/research-2026-04-01-dependency-upgrade-safety-check.md`
- any research still marked `draft`, `in-progress`, or `blocked`

## Archive Rules For The Follow-Up Pass

- do not move job records out of `docs/plans/jobs/`
- update repository-relative links when a plan or research doc moves into `archive/`
- prefer updating guide links to current non-archived docs where possible
- if an archived document remains linked from a guide, label it as historical context

