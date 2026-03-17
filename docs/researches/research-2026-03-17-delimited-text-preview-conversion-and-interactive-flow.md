---
title: "Delimited text preview, conversion, and interactive flow"
created-date: 2026-03-17
modified-date: 2026-03-17
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
    ├── choose source file
    ├── confirm source format
    ├── choose target format
    └── choose output path
```

Benefits:

- keeps top-level `data` choices task-oriented
- makes future delimited-text additions easier to place without growing the menu one transform at a time
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

### Recommendation B. Generalize internals lightly, but keep direct commands explicit in the first pass

Recommended implementation direction:

- create small delimiter-aware parse/stringify helpers
- reuse shared conversion plumbing internally
- keep direct CLI commands explicit instead of introducing a generic conversion command immediately
- preserve existing `json-to-csv` and `csv-to-json` commands in the first pass
- add new direct conversions, if approved, using the same explicit pattern:
  - `cdx-chores data <convert-action> -i <source> -o <output>`

Reasoning:

- reduces duplication
- preserves command clarity in shell history and scripts
- avoids avoidable direct-CLI churn while interactive mode evolves separately

### Recommendation C. Add a generic `data -> convert` wizard in interactive mode

Recommended interactive direction:

- keep `preview`, `parquet preview`, and `query` as top-level `data` actions
- add a nested `convert` lane under `data`
- inside `convert`, ask for:
  - source file path
  - inferred or confirmed source format
  - target format from the remaining supported choices
  - output path and overwrite behavior as usual

Reasoning:

- matches user intent more cleanly
- scales better than one interactive entry per transformation
- allows CSV, TSV, and JSON conversions to feel like one guided workflow without forcing the same abstraction onto direct CLI

### Recommendation D. Keep this work separate from source-shaping research

This research should remain separate from the private issue-scenario research about:

- headerless CSV shaping
- workbook range extraction
- Codex-assisted source shaping

Reasoning:

- TSV support is a capability-expansion problem
- source-shaping is a table-selection and schema-quality problem

## Decision Updates

- Keep CSV and TSV named separately in help text and guides.
- It is still reasonable to describe them internally as one delimited-text family, but user-facing wording should continue to name `CSV` and `TSV` explicitly because users will recognize the file types faster that way.
- Make `data preview` infer TSV by file extension in the first pass.
- Do not add explicit format override or delimiter-pattern detection in this research track's first implementation plan.
- Move interactive conversions toward one generic `data -> convert` wizard.
- Keep direct CLI conversion commands explicit in the first pass, even if interactive mode becomes generic.
- Do not introduce a new direct CLI `data convert ...` command in this plan.
- Keep the current direct conversion usage pattern as the stable CLI contract:
  - `cdx-chores data <convert-action> -i <source> -o <output>`
- Do not treat the interactive wizard decision as justification for removing, renaming, or duplicating existing direct CLI commands immediately.

## Scope Decision

The first implementation should cover:

- add TSV support to `data preview`
- expand conversions to a full CSV/TSV/JSON triangle using explicit direct CLI actions:
  - `csv-to-tsv`
  - `tsv-to-csv`
  - `csv-to-json`
  - `json-to-csv`
  - `tsv-to-json`
  - `json-to-tsv`

Clarifications:

- this expands format parity, but it does not introduce a generic direct CLI `data convert ...` command
- direct CLI remains explicit and action-shaped
- interactive mode can still present conversion as one guided `data -> convert` lane while dispatching to the existing explicit actions underneath
- output-format-specific flags should remain narrow and predictable, for example:
  - `--pretty` applies only when the output format is JSON

Implication:

- the implementation plan should cover delimiter-aware preview support plus shared conversion plumbing that can serve all six explicit conversion commands coherently

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
