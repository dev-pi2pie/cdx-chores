---
title: "Revise delimited-text research doc scope and contract"
created-date: 2026-03-17
modified-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Revise the delimited-text research doc so its scope, recommendations, and final implementation decision all agree on the same `csv` / `tsv` / `json` family contract.

## What Changed

- narrowed the stated research scope to the lightweight `csv` / `tsv` / `json` family
- clarified that DuckDB-backed Parquet, SQLite, and Excel surfaces are background context only for this track
- aligned the recommendations and scope decision around the full explicit CSV/TSV/JSON conversion triangle
- added an explicit shared conversion-contract section for JSON normalization, header-first delimited parsing, and JSON-only `--pretty`
- clarified that interactive `data -> convert` should show the detected source format, not introduce a hidden format-override step in the first-pass contract
- preserved the split design direction:
  - direct CLI stays explicit with `data <convert-action>`
  - interactive mode can group conversions under `data -> convert`

## Verification

- reviewed the updated research doc front matter, scope language, recommendations, decision updates, and scope decision for internal consistency
- resolved the remaining ambiguity between “show detected source format” in interactive convert and the first-pass decision to avoid explicit format override
- cross-checked the current CLI and interactive baseline in `src/command.ts`, `src/cli/interactive/data.ts`, and `src/cli/data-preview/source.ts`

## Related Research

- `docs/researches/archive/research-2026-03-17-delimited-text-preview-conversion-and-interactive-flow.md`
