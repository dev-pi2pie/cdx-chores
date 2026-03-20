# cdx-chores

A Node.js CLI for file-processing chores, tabular data workflows, rename automation, and Codex-assisted tasks.

Stable release scope in `v0.0.9`:

- interactive mode + nested CLI commands
- `doctor` capability checks
- CSV / TSV / JSON conversion and preview workflows, including explicit headerless preview support
- `data extract` for shaped-table materialization across delimited, SQLite, and Excel inputs
- DuckDB-backed query, reviewed header-mapping, source-shape replay, and Parquet preview workflows
- `md to-docx` via `pandoc`
- preview-first rename flows
- `ffmpeg`-backed video wrappers

## Quick Start

Install globally from npm:

```bash
npm install -g cdx-chores
```

Recommended first check after install:

```bash
cdx-chores doctor
```

Show command help:

```bash
cdx-chores --help
```

Start interactive mode (default when no args are provided in a TTY):

```bash
cdx-chores
```

Runtime requirement:

- Node.js `>= 22.5.0`

## Command Overview

| Command group | Important subcommands | Purpose | Capability notes |
| ------------- | --------------------- | ------- | ---------------- |
| `doctor` | `doctor`, `doctor --json` | Inspect current tool and feature readiness | Run this first on a new machine or after environment changes |
| `data` | `preview`, `extract`, `query`, `query codex`, `parquet preview`, `duckdb doctor`, `duckdb extension install`, `(conversion actions)` | Tabular conversion, preview, extraction, DuckDB-backed SQL query, and Codex SQL drafting | lightweight `csv` / `tsv` / `json` preview and conversion stay on the in-memory PapaParse-backed path; `extract` is currently most useful for shaping one clean table, especially from awkward Excel inputs, while `query` is the more expressive lane for nontrivial filtering, projection, and output selection |
| `md` | `to-docx`, `frontmatter-to-json` | Markdown conversion and metadata extraction | `to-docx` requires `pandoc` |
| `rename` | `file`, `batch`, `cleanup`, `apply` | Safe rename previews, cleanup flows, and replayable apply runs | Codex analyzer routes are optional, not required for standard rename usage |
| `video` | `convert`, `resize`, `gif` | `ffmpeg`-backed video wrappers | Requires `ffmpeg` |
| `interactive` | `interactive` or no args | Guided menu flow for supported command groups | Requires a TTY |

Data notes:

- conversion actions are `json-to-csv`, `json-to-tsv`, `csv-to-json`, `csv-to-tsv`, `tsv-to-csv`, and `tsv-to-json`
- `data extract` materializes one shaped table from one input file to `.csv`, `.tsv`, or `.json`; today its strongest shaping surface is for Excel inputs, where it can target a sheet or range, set `--header-row` and `--body-start-row`, and replay reviewed source-shape or header-mapping artifacts for awkward header bands or merged-cell layouts
- `data query` is the current general-purpose lane when you need richer filtering or transformation logic than `data extract` exposes without SQL

## Capability Checks And External Tools

The npm package installs the CLI and its Node.js dependencies, but not every command is fully self-contained. Some workflows depend on machine-level tools or environment state outside the main CLI package.

Use `cdx-chores doctor` before relying on a command in a script, a CI job, or a fresh machine setup.

| Area | What ships with `cdx-chores` | Additional requirement | How to verify or repair |
| ---- | ---------------------------- | ---------------------- | ----------------------- |
| `md to-docx` | Markdown-to-DOCX command wrapper | `pandoc` must be installed on `PATH` | Run `cdx-chores doctor` |
| `video convert`, `video resize`, `video gif` | Video command wrappers | `ffmpeg` must be installed on `PATH` | Run `cdx-chores doctor` |
| `data extract`, `data query` for `csv`, `tsv`, `parquet` | Extract and query command surfaces plus DuckDB integration | DuckDB runtime must be available in the current install/runtime | Run `cdx-chores doctor` |
| `data extract`, `data query` for `sqlite`, `excel` | Extract and query command surfaces | Required DuckDB extension must be loadable for the current DuckDB runtime | Run `cdx-chores doctor`, then `cdx-chores data duckdb doctor` or `cdx-chores data duckdb extension install <name>` |
| `data extract` reviewed suggestions, `data query codex` | Codex-assisted source shaping, semantic header review, and natural-language SQL drafting | Codex support must be configured and an auth/session signal must be available | Run `cdx-chores doctor` |

For automation or machine-readable checks, use:

```bash
cdx-chores doctor --json
```

## Examples

### Doctor

Text output:

```bash
cdx-chores doctor
```

JSON output:

```bash
cdx-chores doctor --json
```

### Data

JSON to CSV:

```bash
cdx-chores data json-to-csv -i ./input.json -o ./output.csv
```

JSON to TSV:

```bash
cdx-chores data json-to-tsv -i ./input.json -o ./output.tsv
```

CSV to JSON:

```bash
cdx-chores data csv-to-json -i ./input.csv -o ./output.json --pretty
```

CSV to TSV:

```bash
cdx-chores data csv-to-tsv -i ./input.csv -o ./output.tsv
```

TSV to CSV:

```bash
cdx-chores data tsv-to-csv -i ./input.tsv -o ./output.csv
```

TSV to JSON:

```bash
cdx-chores data tsv-to-json -i ./input.tsv -o ./output.json --pretty
```

Preview CSV, TSV, or JSON as a bounded table:

```bash
cdx-chores data preview ./input.csv --rows 20
cdx-chores data preview ./input.tsv --rows 20
```

Preview a headerless CSV with generated `column_n` names:

```bash
cdx-chores data preview ./input.csv --no-header
```

Interactive lightweight conversion groups these formats under:

```text
data -> convert
```

Extract one shaped table from an Excel sheet:

```bash
cdx-chores data extract ./input.xlsx --source Sheet1 --header-row 2 --body-start-row 3 -o ./output.tsv
```

Extract from a messier Excel range with explicit body rows:

```bash
cdx-chores data extract ./messy.xlsx --source Report --range A1:Z200 --header-row 4 --body-start-row 6 -o ./output.csv
```

Preview Parquet through DuckDB:

```bash
cdx-chores data parquet preview ./input.parquet --rows 20
```

Run a SQL query against one input file:

```bash
cdx-chores data query ./input.csv --sql "select * from file limit 20"
```

Draft SQL from natural-language intent:

```bash
cdx-chores data query codex ./input.csv --intent "show the top 10 rows with the highest revenue"
```

Inspect or repair DuckDB extension state for query inputs such as SQLite or Excel:

```bash
cdx-chores data duckdb doctor
cdx-chores data duckdb extension install sqlite
```

### Markdown

Markdown to DOCX:

```bash
cdx-chores md to-docx -i ./notes.md -o ./notes.docx
```

Markdown frontmatter to JSON:

```bash
cdx-chores md frontmatter-to-json -i ./notes.md --pretty
```

### Rename

Batch rename preview:

```bash
cdx-chores rename batch ./images --prefix gallery --dry-run
```

Single-file rename preview:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --prefix gallery --dry-run
```

Cleanup an existing filename by normalizing a matched timestamp:

```bash
cdx-chores rename cleanup ./captures/'Screenshot 2026-03-02 at 4.53.04 PM.png' --hint timestamp --style slug --dry-run
```

Cleanup a directory with mixed hint families and recursive traversal:

```bash
cdx-chores rename cleanup ./captures --hint date,serial,uid --recursive --max-depth 1 --dry-run
```

Codex-assisted batch rename preview:

```bash
cdx-chores rename batch ./images --prefix gallery --codex --dry-run
```

Apply an exact dry-run snapshot later:

```bash
cdx-chores rename apply ./rename-plan-20260225T214012Z-a1b2c3d4.csv
```

Recursive image rename with depth limit:

```bash
cdx-chores rename batch ./photos --recursive --max-depth 1 --ext jpg,png,webp --dry-run
```

Custom filename template:

```bash
cdx-chores rename batch ./images --prefix trip --pattern "{date}-{stem}-{serial}" --dry-run
```

UID-backed template example:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --pattern "{uid}-{stem}" --dry-run
```

Template notes:

- available placeholders include `{prefix}`, `{timestamp}`, `{timestamp_local}`, `{timestamp_utc}`, `{timestamp_local_iso}`, `{timestamp_utc_iso}`, `{timestamp_local_12h}`, `{timestamp_utc_12h}`, `{date}`, `{date_local}`, `{date_utc}`, `{stem}`, `{uid}`, and `{serial...}`
- `--prefix` is optional
- `--codex` is the common smart-routing flag for CLI mode
- `--codex-images` and `--codex-docs` are explicit analyzer overrides
- `{uid}` renders a deterministic `uid-<token>` fragment
- `{serial...}` enables serial controls
- `--serial-width` uses a digit count such as `2` or `4`, not `#`

Timestamp placeholder notes:

- `{timestamp}` uses UTC as the backward-compatible default
- `{timestamp_local}` uses local time explicitly
- `{timestamp_utc}` uses UTC explicitly
- `{timestamp_local_iso}` uses local time with a numeric offset such as `+0800`
- `{timestamp_utc_iso}` uses UTC with `Z`
- `{timestamp_local_12h}` and `{timestamp_utc_12h}` use compact `12hr` output with `AM` or `PM`
- `--timestamp-timezone local|utc` overrides `{timestamp}` only

Route A examples:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --pattern "{timestamp_utc_iso}-{stem}" --dry-run
cdx-chores rename batch ./images --pattern "{timestamp_local_12h}-{stem}" --dry-run
```

Cleanup notes:

- `rename cleanup <path>` accepts either a single file or a directory
- `--hint` is the canonical flag and `--hints` is accepted as an alias
- supported hint families are `date`, `timestamp`, `serial`, and `uid`
- cleanup applies multiple hint families in this order: `timestamp`, then `date`, then `serial`, then `uid`
- `--style` defaults to `preserve`; supported values are `preserve` and `slug`
- `--timestamp-action keep|remove` applies only when `--hint timestamp` is active
- `--conflict-strategy` currently supports `skip`, `number`, and `uid-suffix`

Cleanup option comparison:

| Surface | Current role | Current values / scope |
| ------- | ------------ | ---------------------- |
| `--hint` | Choose fragment families to clean | `date`, `timestamp`, `serial`, `uid` |
| `--style` | Format surviving text after cleanup | `preserve`, `slug` |
| `--timestamp-action` | Keep or remove matched timestamp text | `keep`, `remove` with `--hint timestamp` |
| `--conflict-strategy` | Resolve collisions only when the cleaned target conflicts | `skip`, `number`, `uid-suffix` |

### Video

Video to GIF:

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --width 480 --fps 10
```

Video resize with aspect-ratio-preserving scale:

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-small.mp4 --scale 0.5
```

Video resize with explicit dimensions override:

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-720p.mp4 --width 1280 --height 720
```

## Guides

Rename:

- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-timestamp-format-matrix.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`

Data:

- `docs/guides/data-preview-usage.md`
- `docs/guides/data-extract-usage.md`
- `docs/guides/data-schema-and-mapping-usage.md`
- `docs/guides/data-query-usage.md`
- `docs/guides/data-duckdb-usage.md`
- `docs/guides/data-query-codex-usage.md`

Video:

- `docs/guides/video-resize-usage-and-ux.md`

## Local Development

Install dependencies:

```bash
bun install
```

Build the package:

```bash
bun run build
```

Run the built CLI locally:

```bash
bun run cli --help
```

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/dev-pi2pie/cdx-chores/blob/main/LICENSE) file for details.
