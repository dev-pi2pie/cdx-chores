---
title: "Excel-like workflows scope and tooling (beyond CSV)"
created-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Define a launch-phase research baseline for Excel-like/tabular document workflows (for example `.xlsx`, `.xlsb`, `.ods`) so `cdx-chores` can scope work beyond JSON/CSV conversion without overcommitting to a single tool too early.

## Key Findings

### 1. CSV is only one slice of the tabular workflow problem

Your current `data` commands (`json-to-csv`, `csv-to-json`) cover plain-text tabular interchange, but Excel-like workflows introduce additional concerns:

- workbook/sheet structure
- cell types and formatting
- formulas and calculated values
- binary formats (for example `.xlsb`)
- multi-sheet exports

This justifies a separate research track before implementation.

### 2. `pandas` is a strong orchestration layer for read/write tabular conversions

Pandas `read_excel()` supports multiple spreadsheet formats and multiple engines (including `openpyxl`, `calamine`, `odf`, `pyxlsb`, and `xlrd`, depending on file type), which is useful for a CLI that may need flexible backend selection.[^pandas-read-excel]

Pandas `DataFrame.to_excel()` provides a consistent export surface for writing spreadsheet outputs.[^pandas-to-excel]

This makes pandas a strong candidate for:

- cross-format tabular extraction
- conversion workflows (`xlsx -> csv`, `xlsx -> json`)
- multi-sheet handling (with explicit CLI options)

### 3. `openpyxl` is a primary tool for `.xlsx/.xlsm` editing and structured workbook access

The openpyxl project is focused on reading/writing Excel 2010 files (`xlsx/xlsm`) and includes optimized read-only / write-only modes for large files (with tradeoffs/limitations).[^openpyxl-index][^openpyxl-optimized]

This makes `openpyxl` a strong fit for:

- workbook-aware workflows
- metadata/sheet inspection
- structured extraction where cell semantics matter

### 4. `pyxlsb` is a targeted option for `.xlsb`, but intentionally limited

`pyxlsb` is a parser for Excel binary workbook (`.xlsb`) files and explicitly notes limitations (for example, formulas and some metadata are not preserved/interpreted the same way as richer workbook libraries).[^pyxlsb-pypi]

This suggests `pyxlsb` is useful as:

- a backend for reading `.xlsb` data into normalized rows/tables

But it is not a full workbook-editing solution.

### 5. `xlsx2csv` is a practical CLI-oriented converter for one-way exports

`xlsx2csv` provides CLI and Python usage for converting `.xlsx` files to CSV, supports converting all sheets, and is positioned as handling large XLSX files.[^xlsx2csv-pypi]

This makes it a useful benchmark or fallback for:

- fast one-way `xlsx -> csv`
- batch exports

It is not a general spreadsheet processing framework.

### 6. `pandoc` lists `xlsx` as an input format, but lossy conversion rules still matter

Pandoc’s manual lists `xlsx` among supported input formats.[^pandoc-manual]

However, pandoc also states that conversions are through an intermediate document model and not every format combination preserves all information.[^pandoc-manual]

Implication: `pandoc` may be useful for specific document-centric transformations, but it should not be assumed to be the primary backend for spreadsheet data integrity workflows.

## Comparison Table

| Tool | Best For | Formats (Relevant) | Read | Write | Strengths | Limits / Risks | CLI Fit in `cdx-chores` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pandas` | General tabular conversion/orchestration | `xls`, `xlsx`, `xlsm`, `xlsb`, `ods`, `odf`, `odt` (via engines) | Yes | Yes (`to_excel`, CSV/JSON) | Unified API, strong ecosystem, flexible engines | Engine dependencies vary by format; may normalize away workbook-specific semantics | High for conversion commands |
| `openpyxl` | Workbook-aware `.xlsx/.xlsm` processing | `xlsx`, `xlsm` | Yes | Yes | Rich workbook/cell access, optimized modes for large files | Limited to OOXML Excel family; not ideal for `.xlsb` | High for workbook inspection/editing commands |
| `pyxlsb` | Reading Excel Binary Workbook data | `xlsb` | Yes | No (practical focus) | Fills `.xlsb` gap | Limited feature coverage vs full workbook libraries | Medium (backend adapter for `.xlsb`) |
| `xlsx2csv` | Fast one-way conversion | `xlsx` -> `csv` | Yes (convert) | CSV output | Simple CLI/Python API, batch-friendly | Narrow scope (conversion only) | Medium (optional backend/benchmark) |
| `pandoc` | Document-centric conversions | includes `xlsx` input | Yes (document model) | Many document outputs | Already available locally; useful in some pipelines | Conversion may be lossy for spreadsheet semantics | Low/conditional for spreadsheet data workflows |

## Implications or Recommendations

### A. Keep JSON/CSV internal in TypeScript, but add a Python adapter layer for Excel-like workflows

Recommended separation:

- internal TS: `json <-> csv` (simple and deterministic)
- Python-backed adapters: spreadsheet formats requiring mature parsers/writers

This preserves the project’s Node.js runtime goal while allowing best-of-breed spreadsheet tooling.

### B. Start with a conversion-first scope before workbook editing features

Initial Excel-like workflow scope should focus on:

- `xlsx -> csv`
- `xlsx -> json`
- `xlsb -> csv/json` (if backend chosen)
- sheet listing / sheet selection

Defer until later:

- formatting-preserving edits
- formula authoring/recalculation semantics
- macro-sensitive workflows (`xlsm`)

### C. Model these as a separate command group (or subgroup), not just `data`

Because workbook workflows have distinct options (sheet names, sheet indexes, multi-sheet export modes), consider:

- `excel to-csv`
- `excel to-json`
- `excel sheets`

and keep `data json-to-csv` / `csv-to-json` for simple text-table conversions.

Aliases can still bridge the two groups if needed.

### D. `doctor` should validate Python runtime and package backends (not only shell commands)

For Excel-like features, dependency checks may need to validate Python modules, for example:

- `python` executable presence/version
- import checks for `pandas`, `openpyxl`, `pyxlsb` (when those backends are selected)

This is different from command-only checks like `ffmpeg` or `pandoc`.

## Open Questions

1. Which Python runtime should be the supported baseline for spreadsheet features (system Python vs venv-managed Python)?
2. Should `cdx-chores` bundle Python helper scripts in-repo, or only shell out to user-managed Python commands?
3. Is `.xlsb` support a launch-phase requirement, or can it be deferred until after `.xlsx` workflows are stable?
4. Should multi-sheet exports default to one file per sheet, or a combined JSON object/CSV directory layout?
5. Where should spreadsheet commands live long-term: `excel` command group, `data excel-*` subcommands, or both with aliases?

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

## References

[^pandas-read-excel]: [pandas `read_excel` API docs](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)
[^pandas-to-excel]: [pandas `DataFrame.to_excel` API docs](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_excel.html)
[^openpyxl-index]: [openpyxl documentation index](https://openpyxl.readthedocs.io/en/stable/)
[^openpyxl-optimized]: [openpyxl optimized modes](https://openpyxl.readthedocs.io/en/stable/optimized.html)
[^pyxlsb-pypi]: [pyxlsb on PyPI](https://pypi.org/project/pyxlsb/)
[^xlsx2csv-pypi]: [xlsx2csv on PyPI](https://pypi.org/project/xlsx2csv/)
[^pandoc-manual]: [Pandoc manual](https://pandoc.org/MANUAL.html)

