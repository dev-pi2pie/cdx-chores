---
title: "Delimited text preview, conversion, and interactive flow"
created-date: 2026-03-17
status: draft
agent: codex
---

## Goal

Define a focused research baseline for extending the `data` command group around delimited text, specifically:

- adding TSV support to `data preview`
- adding direct CSV/TSV conversion commands
- deciding whether interactive `data` should group conversion actions under a separate conversion lane

## Milestone Goal

Choose a practical, implementation-ready direction for delimited-text support that:

- fits the current lightweight `data` command philosophy
- preserves clear direct-CLI command names
- improves interactive information architecture before the `data` submenu becomes crowded
- stays separate from the source-shaping research for headerless CSV and messy workbook inputs

## Key Findings

### 1. The current `data` surface is asymmetric across preview, query, and conversion

Current command boundaries are not aligned:

- `data preview` supports `.csv` and `.json`
- `data query` supports `.csv`, `.tsv`, `.parquet`, `.sqlite`, and `.xlsx`
- `data` conversion currently exposes only:
  - `json-to-csv`
  - `csv-to-json`

Implication:

- TSV already exists conceptually inside the broader tabular-data story
- the gap is now product-surface inconsistency, not lack of a plausible use case

### 2. TSV belongs with delimited-text support, not with source-shaping edge cases

TSV is not primarily an edge-case parsing problem.

It fits the same general model as CSV:

- header-first delimited rows
- bounded preview as a terminal table
- straightforward tabular conversion

This makes TSV support a better fit for a dedicated delimited-text research thread than for:

- workbook range selection
- merged-cell cleanup
- header inference or Codex-assisted shaping

Implication:

- TSV support should be documented and planned separately from the private issue-scenario research

### 3. The current implementation is CSV-specific and should likely be generalized before TSV is added

The current helpers are intentionally CSV-shaped:

- parsing uses a fixed comma delimiter
- stringification uses CSV-oriented helpers and naming
- preview normalization identifies only CSV or JSON
- direct conversions are hard-coded around JSON/CSV pairs

Implication:

- the clean implementation path is likely a small delimited-text abstraction
- adding TSV should avoid copy-pasted `parseTsv` / `stringifyTsv` branches everywhere if a delimiter-aware helper can keep the surface coherent

### 4. Direct CLI should stay explicit even if implementation becomes generic

Even if the implementation is generalized around delimited text, the direct command surface should probably remain explicit.

Good direct-CLI properties:

- easy to discover in `--help`
- readable in shell history and scripts
- avoids overloading one conversion command with too many mode flags too early

Implication:

- explicit commands such as `csv-to-tsv` and `tsv-to-csv` are easier to understand than a generic `convert --from csv --to tsv` first pass

### 5. Interactive mode has a different problem: submenu crowding

The current interactive `data` submenu is flat:

- `preview`
- `query`
- `parquet preview`
- `json-to-csv`
- `csv-to-json`

If CSV/TSV conversions are added, the flat list will grow further.

Preview/query actions are not the same kind of task as conversions:

- preview/query are inspection tasks
- conversions are transformation tasks

Implication:

- direct CLI and interactive mode do not need identical information architecture
- interactive mode would likely benefit from grouping conversions under a dedicated `convert` lane

### 6. A grouped interactive conversion lane scales better than one action per transform at the top level

A likely interactive shape is:

```text
data
├── preview
├── parquet preview
├── query
└── convert
    ├── json to csv
    ├── csv to json
    ├── csv to tsv
    └── tsv to csv
```

Benefits:

- keeps top-level `data` choices task-oriented
- makes future delimited-text additions easier to place
- leaves room for later conversions without making the `data` menu noisy

Implication:

- if conversion growth continues, interactive grouping should happen sooner rather than later

## Implications or Recommendations

### Recommendation A. Treat CSV and TSV as one delimited-text capability family

Recommended scope:

- add TSV support to `data preview`
- add `csv-to-tsv`
- add `tsv-to-csv`

Reasoning:

- TSV already fits the preview/query mental model
- the direct CLI becomes more internally consistent

### Recommendation B. Generalize internals lightly, but keep direct commands explicit

Recommended implementation direction:

- create small delimiter-aware parse/stringify helpers
- reuse shared conversion plumbing internally
- keep user-facing commands explicit instead of introducing a generic conversion command immediately

Reasoning:

- reduces duplication
- preserves command clarity

### Recommendation C. Group conversions under `data -> convert` in interactive mode

Recommended interactive direction:

- keep `preview`, `parquet preview`, and `query` as top-level `data` actions
- move conversion actions into a nested `convert` submenu

Reasoning:

- matches user intent more cleanly
- scales better than a flat menu
- avoids making the `data` submenu increasingly action-shaped instead of task-shaped

### Recommendation D. Keep this work separate from source-shaping research

This research should remain separate from the private issue-scenario research about:

- headerless CSV shaping
- workbook range extraction
- Codex-assisted source shaping

Reasoning:

- TSV support is a capability-expansion problem
- source-shaping is a table-selection and schema-quality problem

## Open Questions

- Should TSV preview be documented simply as “CSV-family delimited text,” or should CSV and TSV remain named separately in help and guides?
- Should `data preview` infer TSV by file extension only, or also allow explicit format override for atypical filenames later?
- Should interactive conversion eventually become one generic wizard, or should it remain a submenu of explicit transformations?
- Is `tsv-to-json` or `json-to-tsv` part of the same first expansion, or should the first pass stay narrowly on CSV/TSV parity?

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
