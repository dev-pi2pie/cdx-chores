---
title: "Delimited text preview, conversion, and interactive flow"
created-date: 2026-03-17
modified-date: 2026-03-18
status: completed
agent: codex
---

## Goal

Define a focused research baseline for extending the lightweight `data` delimited-text surface around the `csv` / `tsv` / `json` family, specifically:

- adding TSV support to `data preview`
- deciding the first-pass direct conversion surface across `csv`, `tsv`, and `json`
- deciding whether interactive `data` should group conversion actions under a separate conversion lane

This research is intentionally limited to the lightweight in-memory delimited-text path.

Out of scope for this track:

- DuckDB-backed query and preview formats such as Parquet, SQLite, and Excel
- source-shaping work such as header inference, workbook range selection, and messy-sheet cleanup
- a new generic direct CLI `data convert ...` command

## Milestone Goal

Choose a practical, implementation-ready direction for delimited-text support that:

- treats `csv`, `tsv`, and `json` as one coherent lightweight data family
- fits the current lightweight `data` command philosophy
- preserves clear direct-CLI command names even if interactive mode groups conversions differently
- improves interactive information architecture before the `data` submenu becomes crowded
- stays separate from the source-shaping research for headerless CSV and messy workbook inputs

## Key Findings

### 1. This track should be scoped to the lightweight `csv` / `tsv` / `json` family, not to the full `data` surface

The broader `data` command group now contains multiple lanes, but this research does not need to normalize all of them at once.

For this track, the relevant product surface is:

- lightweight preview of delimited or JSON-shaped tabular content
- direct file-to-file conversions among `csv`, `tsv`, and `json`
- interactive menu structure for those same lightweight conversions

Implication:

- the research should treat Parquet, SQLite, and Excel only as background context
- the decision target here is a coherent lightweight family contract, not total cross-feature symmetry

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

### 4. If `json` participates in the same family, format parity should be an explicit first-pass target

This track is not only about CSV/TSV parity.

The current direct conversions already make `json` part of the lightweight tabular story:

- `json-to-csv`
- `csv-to-json`

If TSV is added as a peer format, the most internally consistent direct-CLI family is:

- `csv-to-tsv`
- `tsv-to-csv`
- `csv-to-json`
- `json-to-csv`
- `tsv-to-json`
- `json-to-tsv`

Implication:

- if this track claims to cover `csv`, `tsv`, and `json`, the research should state that full family explicitly rather than implying TSV is only a CSV-adjacent add-on

### 5. Direct CLI should stay explicit even if implementation becomes generic

Even if the implementation is generalized around delimited text, the direct command surface should probably remain explicit.

Good direct-CLI properties:

- easy to discover in `--help`
- readable in shell history and scripts
- avoids overloading one conversion command with too many mode flags too early

Implication:

- explicit commands such as `csv-to-tsv` and `tsv-to-csv` are easier to understand than a generic `convert --from csv --to tsv` first pass

### 6. Interactive mode has a different problem: submenu crowding

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

### 7. A grouped interactive conversion lane scales better than one action per transform at the top level

A likely interactive shape is:

```text
data
├── preview
├── parquet preview
├── query
└── convert
    ├── choose source file
    ├── show detected source format
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

### Recommendation A. Treat `csv`, `tsv`, and `json` as one lightweight delimited-text capability family

Recommended scope:

- add TSV support to `data preview`
- expand direct conversions to the full explicit family:
  - `csv-to-tsv`
  - `tsv-to-csv`
  - `csv-to-json`
  - `json-to-csv`
  - `tsv-to-json`
  - `json-to-tsv`

Reasoning:

- TSV already fits the preview/query mental model
- the direct CLI becomes more internally consistent when all three formats participate under one clearly named family

### Recommendation B. Generalize internals lightly, but keep direct commands explicit in the first pass

Recommended implementation direction:

- create small delimiter-aware parse/stringify helpers
- reuse shared conversion plumbing internally
- keep direct CLI commands explicit instead of introducing a generic conversion command immediately
- preserve the current direct conversion usage pattern as the stable CLI contract:
  - `cdx-chores data <convert-action> -i <source> -o <output>`

Reasoning:

- reduces duplication
- preserves command clarity in shell history and scripts
- avoids avoidable direct-CLI churn while interactive mode evolves separately

### Recommendation C. Freeze one shared conversion contract for JSON and delimited formats

Recommended contract:

- `json-to-csv` and `json-to-tsv` use the same JSON normalization rules
- `csv-to-json` and `tsv-to-json` use the same header-first delimited parsing rules
- delimiter choice changes only parsing and stringification, not row/object normalization semantics
- `--pretty` applies only when the output format is JSON

Reasoning:

- avoids implementation guesswork once the command family grows
- keeps CSV and TSV behavior parallel instead of creating accidental format drift
- makes the six explicit commands feel like one coherent capability family

### Recommendation D. Add a generic `data -> convert` wizard in interactive mode

Recommended interactive direction:

- keep `preview`, `parquet preview`, and `query` as top-level `data` actions
- add a nested `convert` lane under `data`
- inside `convert`, ask for:
  - source file path
  - detected source format
  - target format from the remaining supported choices
  - output path and overwrite behavior as usual

Reasoning:

- matches user intent more cleanly
- scales better than one interactive entry per transformation
- allows CSV, TSV, and JSON conversions to feel like one guided workflow without forcing the same abstraction onto direct CLI

### Recommendation E. Keep this work separate from source-shaping research

This research should remain separate from the private issue-scenario research about:

- headerless CSV shaping
- workbook range extraction
- Codex-assisted source shaping

Reasoning:

- TSV support is a capability-expansion problem
- source-shaping is a table-selection and schema-quality problem

## Decision Updates

- Scope this research to the lightweight `csv` / `tsv` / `json` family.
- Treat broader DuckDB-backed formats as background context only, not as decision scope for this plan.
- Keep CSV and TSV named separately in help text and guides.
- It is still reasonable to describe `csv`, `tsv`, and `json` internally as one lightweight conversion family, but user-facing wording should continue to name the concrete file types explicitly because users will recognize them faster that way.
- Make `data preview` infer TSV by file extension in the first pass.
- Do not add explicit format override or delimiter-pattern detection in this research track's first implementation plan.
- Move interactive conversions toward one generic `data -> convert` wizard.
- Keep direct CLI conversion commands explicit in the first pass, even if interactive mode becomes generic.
- Do not introduce a new direct CLI `data convert ...` command in this plan.
- Keep the current direct conversion usage pattern as the stable CLI contract:
  - `cdx-chores data <convert-action> -i <source> -o <output>`
- Keep one shared contract across the conversion family:
  - `json-to-csv` and `json-to-tsv` share JSON normalization behavior
  - `csv-to-json` and `tsv-to-json` share header-first delimited parsing behavior
  - `--pretty` remains JSON-output-only
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
- this track covers only lightweight `csv` / `tsv` / `json` behavior and does not change DuckDB-backed `data query` or `data parquet preview` scope
- output-format-specific flags should remain narrow and predictable, for example:
  - `--pretty` applies only when the output format is JSON

Implication:

- the implementation plan should cover delimiter-aware preview support plus shared conversion plumbing that can serve all six explicit conversion commands coherently

## Related Research

- `docs/researches/archive/research-2026-03-02-tabular-data-preview-and-query-scope.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`
