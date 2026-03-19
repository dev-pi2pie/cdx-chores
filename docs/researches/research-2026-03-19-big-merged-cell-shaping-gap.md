---
title: "Big merged-cell workbook shaping gap"
created-date: 2026-03-19
modified-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Determine why the public-safe stacked merged-band workbook still fails after the `v0.0.8-canary.3` shaping follow-up, and identify the next solution direction before drafting another implementation plan.

## Milestone Goal

Confirm whether the remaining failure is primarily a bad reviewed-shape suggestion problem, a DuckDB import limitation, or both.

## Key Findings

- The reviewed Codex source-shape suggestion for this workbook is built from corrupted worksheet evidence, not from the true merged-cell layout.
- `collectXlsxSheetSnapshot(...)` in `src/cli/duckdb/xlsx-sources.ts` currently scans worksheet cells with a regex that only matches `<c ...>...</c>` nodes and skips self-closing `<c .../>` nodes.
- This workbook contains many self-closing cells inside merged regions. As a result, the snapshot parser drifts and assigns later non-empty values to earlier blank cell references.
- The corrupted snapshot reduced the apparent used range to `A5:AM20` and row summaries such as `A7`, `C7`, `F7`, and `AM7`, even though the actual logical table headers are anchored at `B7`, `E7`, `AL7`, and `AZ7`.
- Because the Codex source-shape prompt in `src/cli/duckdb/source-shape/suggestions.ts` is built from that snapshot, the accepted reviewed shape `--range A7:AM20 --header-row 7` is based on incomplete and partly incorrect evidence.
- Manual workbook inspection of the XML shows the real four-field merged structure:
  - row 7 header groups at `B7:D9`, `E7:AK9`, `AL7:AY9`, and `AZ7:BR9`
  - data rows at `10:20`
  - representative header anchors at `B7=id`, `E7=item`, `AL7=status`, `AZ7=description`
- Even when the extractor is given the corrected rectangle `--range B7:BR20 --header-row 7`, the built CLI still fails with `read_xlsx: Failed to parse cell 'E10' ... to DOUBLE`.
- That direct check confirms the remaining failure is not only a reviewed-shape suggestion problem. The current deterministic shaping contract is still insufficient for this stacked merged-header-band workbook class.
- The current shared Excel shaping contract in `src/cli/duckdb/query/prepare-source.ts` can only express:
  - sheet selection
  - rectangular `range`
  - `header-row`
- The tolerant Excel retry modes (`empty_as_varchar`, then `all_varchar`) do not solve this workbook once non-representative rows remain between the header row and the first true data row.

## Implications or Recommendations

- Fix the worksheet snapshot parser first. Reviewed Codex shaping cannot be trusted on hard merged sheets until the prompt reflects real cell anchors and the real used range.
- Treat the remaining parse failure as a shaping-contract gap, not as a prompt-tuning issue.
- If a new deterministic field is added, it should be `body-start-row`, not `data-start-row`, because the intent is specifically to mark the beginning of the body after the header band.
- `body-start-row` should use absolute worksheet row numbering like `header-row`, not numbering relative to the selected range.
- Keep the solution layered:
  - snapshot correctness and reviewed-shape prompt quality
  - deterministic source-shape contract extension
  - shared query and extract integration
- Avoid adding more heuristic-only recovery before the deterministic contract is clarified. This workbook already shows that better suggestions alone are not enough.

## Decision Update

- Preferred field name: `body-start-row`
- Preferred numbering model: absolute worksheet row numbers
- Preferred first-pass scope: Excel-only
- Expected usage: optional and additive
  - standard shaped Excel cases should continue to rely on `range` and `header-row`
  - `body-start-row` should only be needed for the remaining hard merged-band class
- First-pass validation should not require `header-row` whenever `body-start-row` is present
  - `header-row` answers where column names come from
  - `body-start-row` answers where real records begin
- those often appear together, but no-header body-start cases still need to remain valid
- Reviewed source-shape suggestions should be allowed to suggest `bodyStartRow` by itself when that is the only deterministic change needed
- `body-start-row` must change import-time shaping, not only post-import filtering, otherwise the current `read_xlsx(...)` failure class is untouched
- Source-shape artifacts should remain on `version: 1` in the current canary line, with `bodyStartRow` treated as an optional widening of the existing `shape` object
- The no-new-field fallback should be investigated, but it should not block freezing the explicit contract

## Validation Decisions

- First-pass validation should use the selected range as the primary boundary:
  - if `range` is present, `body-start-row` must fall within the selected range
  - if `range` is absent, `body-start-row` should validate against the detected sheet used range
- `header-row` is not required when `body-start-row` is present
- when `header-row` is also present, `header-row` becomes the governing boundary and `body-start-row` must be greater than `header-row`

## Import-Time Semantics Decisions

- `body-start-row` is import-time shaping, not only a later row filter.
- `bodyStartRow` without `headerRow`:
  - narrows the effective import range so the imported rectangle starts at `bodyStartRow`
  - if `range` is present, reuse that column span and end row
  - if `range` is absent, derive the column span and end row from the detected used range
  - resulting columns continue through the existing no-header path and can later be renamed through reviewed header suggestions
- `range + bodyStartRow`:
  - derive the effective import range from the selected range by replacing its start row with `bodyStartRow`
- `headerRow + bodyStartRow` without `range`:
  - use the detected used-range columns
  - import the header row separately from the body rows
  - import the body rows starting at `bodyStartRow`
  - stitch header names and body rows together in application code before downstream shaping continues
- `range + headerRow + bodyStartRow`:
  - use the selected range columns
  - import the header row separately from the body rows
  - import the body rows starting at `bodyStartRow`
  - stitch header names and body rows together in application code before downstream shaping continues

## Reviewed Shape Decisions

- Reviewed source-shape prompts should explicitly allow:
  - `range`
  - `headerRow`
  - `bodyStartRow`
  - any valid combination of them
- This keeps reviewed shaping compatible with:
  - no-header cases
  - already-correct-header cases
  - hard merged-band cases

## Generalization Decisions

- The cleanest first pass is Excel-only, because the current problem is tied to worksheet row structure and merged-cell bands.
- If later generalization is needed, the most practical route is:
  - keep the artifact schema capable of representing `bodyStartRow`
  - keep first-pass CLI validation format-specific
  - only widen to CSV or TSV if a real banner-row body-start case appears
- SQLite and Parquet do not currently present the same row-band shaping problem and should stay out of scope for this field.

## No-New-Field Fallback Notes

- There is a technically possible two-pass recovery path for this workbook without a new user-facing field:
  - header-only read such as `B7:BR7`
  - body-only read such as `B10:BR20`
  - stitch header names and body rows together in application code
- That path proves the workbook is not fundamentally unreadable, but it still has practical limits:
  - the application still needs a way to know where the body starts
  - if that body boundary is inferred heuristically, the behavior becomes opaque and harder to replay
  - if that body boundary is captured explicitly, the system is already close to an explicit `body-start-row` contract
- Because of that, the two-pass path is worth investigating as an internal remediation or fallback note, but not as a complete replacement for a deterministic shaping contract.
- Even if the fallback proves robust, it should remain an internal remediation note unless there is a strong reason to expose it as explicit user-visible behavior.

## Artifact Compatibility Decision

- Existing `version: 1` source-shape artifacts should remain readable by newer binaries.
- Widened source-shape artifacts that include `bodyStartRow` should remain on `version: 1` in the current canary line.
- Newer binaries in this line should read both older v1 artifacts and widened v1 artifacts.
- Older binaries are not guaranteed to replay widened v1 artifacts that include `bodyStartRow`.
- This keeps the schema version stable without overstating replay compatibility across older binaries.

## Related Plans

- `docs/plans/plan-2026-03-18-interactive-data-shaping-ux-and-excel-header-row-followup.md`
- `docs/plans/plan-2026-03-19-big-merged-cell-source-shape-followup.md`

## References

- [1] `examples/playground/data-extract/stacked-merged-band.xlsx`
- [2] `src/cli/duckdb/xlsx-sources.ts`
- [3] `src/cli/duckdb/source-shape/suggestions.ts`
- [4] `src/cli/duckdb/query/prepare-source.ts`
- [5] `docs/plans/jobs/2026-03-19-placeholder-normalization-docs-and-built-dist-verification.md`
