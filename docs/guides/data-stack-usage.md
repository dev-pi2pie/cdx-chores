## `data stack`

`data stack` assembles one logical table from multiple local files or directories, then materializes the merged result to `.csv`, `.tsv`, or `.json`.

This command is the multi-source assembly lane in the current data-command split:

- use `data stack` when you need to combine many local sources into one table first
- use `data extract` when you need to shape one local input file into one clean output table
- use `data query` when you need SQL

For one-input shaping without SQL, see `docs/guides/data-extract-usage.md`.
For SQL over one local source or a query workspace, see `docs/guides/data-query-usage.md`.
For the interactive SQL flow, see `docs/guides/data-query-interactive-usage.md`.

Current stable boundary:

- accepts one or more raw `<source>` arguments
- raw sources may be files, directories, or both together
- matching-header CSV and TSV inputs are supported directly
- headerless CSV and TSV inputs are supported through `--no-header`
- strict `jsonl` is supported as one JSON object per line with the same key set across rows
- strict `.json` input is supported as one top-level array of objects with the same key set across rows
- strict schema matching is the default
- `--union-by-name` is available as an opt-in schema-flex mode
- `--exclude-columns <name,name,...>` removes exact column/key names from union-by-name output
- `--dry-run` writes a replayable stack-plan artifact and does not write stack output
- `data stack replay <record>` executes a reviewed stack-plan JSON artifact
- `--unique-by <name,name,...>` records an explicit unique key for duplicate-key diagnostics
- `--on-duplicate preserve|report|reject` controls deterministic duplicate handling
- `--codex-assist` can write an advisory report during dry-run
- mixed normalized input formats are rejected
- output requires `.csv`, `.tsv`, or `.json`
- direct CLI requires `--output <path>`
- interactive mode is available through `cdx-chores interactive` and supports mixed file/directory sources, CSV, TSV, JSONL, JSON, strict matching, union-by-name, exclusions, and generated default output paths

### Command shape

```bash
cdx-chores data stack <source...> --output <path> [--input-format <format>] [--pattern <glob>] [--recursive] [--max-depth <n>] [--no-header] [--columns <name,name,...>] [--union-by-name] [--exclude-columns <name,name,...>] [--unique-by <name,name,...>] [--on-duplicate preserve|report|reject] [--dry-run] [--plan-output <path>] [--codex-assist] [--codex-report-output <path>] [--overwrite]
cdx-chores data stack replay <record> [--output <path>] [--auto-clean]
```

Supported `--input-format` values:

- `csv`
- `tsv`
- `json`
- `jsonl`

### Direct CLI behavior

Mixed raw-source discovery:

- explicit file sources are included directly
- directory sources expand into candidate files
- `--pattern` filters only directory-expanded candidates
- raw source order is preserved
- candidates discovered from one directory are sorted deterministically
- hidden files are excluded by default
- `--recursive` is opt-in
- `--max-depth` is valid only with `--recursive`

Delimited header behavior:

- matching-header CSV and TSV files must agree on one header row
- `--no-header` treats every matched CSV or TSV input as headerless
- when `--columns` is omitted in headerless mode, placeholder names such as `column_1`, `column_2`, ... are generated
- headerless runs reject mismatched column counts across inputs

Structured JSON input behavior:

- `jsonl` input means one JSON object per non-empty line
- `.json` input means one top-level JSON array
- every `.json` array item must be an object
- top-level objects, scalar rows, scalar arrays, nested table discovery, and flattening are rejected
- empty structured JSON inputs are rejected
- strict mode rejects key mismatches rather than widening automatically
- `.json` output writes one JSON array of row objects
- `.json` output rejects duplicate output names because JSON objects cannot safely preserve repeated keys

Schema-flex behavior:

- strict schema matching is the default for direct CLI and interactive mode
- `--union-by-name` is opt-in for stacking named schemas that add or omit columns or JSON keys
- when enabled, it builds the output schema from the union of all header names or object keys
- the first source's name order comes first, with newly discovered names appended in first-seen order
- missing values are written using the stack materializer's empty-value policy
- duplicate names in one source are rejected in union-by-name mode because name-based alignment would otherwise be ambiguous
- `--exclude-columns <name,name,...>` is accepted only with `--union-by-name`
- excluded names are exact matches
- unknown exclusions are rejected after source discovery so typos are visible
- schema mode, output column/key count, and bounded exclusion names are disclosed in the write summary or interactive review
- union-by-name is supported for:
  - CSV and TSV inputs with header rows
  - JSONL object rows
  - `.json` top-level arrays of objects
- `--union-by-name` is rejected with `--no-header` in this slice because generated `column_<n>` names are not a stable user-authored schema
- `--union-by-name` is not used automatically; it exists to make schema widening deliberate

Dry-run and replay behavior:

- `--dry-run` runs source discovery, schema normalization, duplicate diagnostics, and plan writing, then skips materialized output writing
- direct dry-run still requires `--output` so the plan records the intended output path and format
- when `--plan-output` is omitted, the CLI writes `data-stack-plan-<timestamp>Z-<uid>.json`
- `data stack replay <record>` accepts a filesystem path to a stack-plan JSON artifact
- replay warns when stored source size or mtime fingerprints changed
- replay can override the recorded output path with `--output <path>`
- replay rejects advisory Codex reports and other non-stack-plan JSON files
- `--auto-clean` on replay removes only the stack-plan JSON after successful replay

Duplicate and unique-key behavior:

- exact duplicate rows compare every normalized output column or key
- `--unique-by` switches duplicate-key diagnostics to the selected key columns
- candidate unique keys are reported in the stack-plan diagnostics
- `preserve` keeps all rows and records diagnostics
- `report` keeps all rows and records findings for review
- `reject` fails before writing materialized output when exact duplicates or selected-key conflicts are found
- stack never silently drops rows or applies keep-first/keep-last behavior

Codex assist behavior:

- direct `--codex-assist` is valid only with `--dry-run`
- `--codex-report-output <path>` writes the advisory report to a custom JSON path
- interactive Codex review uses the same advisory report model, but it appears as a contextual checkpoint only when deterministic diagnostics show useful signals
- Codex reports link to the analyzed stack plan through payload metadata
- recommendations are advisory until accepted or edited in a review flow
- accepted or edited recommendations become deterministic stack-plan fields with a new `payloadId`
- stack replay executes only stack-plan artifacts, not Codex report artifacts
- supported recommendation areas are headerless column names, union exclusions, unique-key selection, duplicate policy selection, and schema-drift explanation

### Examples

Matching-header CSV from a directory:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-matching-headers --pattern "*.csv" --output ./examples/playground/.tmp-tests/matching.stack.csv --overwrite
```

Mixed explicit file and directory TSV sources:

```bash
cdx-chores data stack ./examples/playground/stack-cases/tsv-matching-headers/part-001.tsv ./examples/playground/stack-cases/tsv-matching-headers --pattern "*.tsv" --output ./examples/playground/.tmp-tests/matching.stack.tsv --overwrite
```

Headerless CSV with explicit columns:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-headerless --pattern "*.csv" --no-header --columns id,name,status --output ./examples/playground/.tmp-tests/headerless.stack.csv --overwrite
```

Strict `jsonl` stacking:

```bash
cdx-chores data stack ./examples/playground/stack-cases/jsonl-basic --pattern "*.jsonl" --input-format jsonl --output ./examples/playground/.tmp-tests/events.stack.json --overwrite
```

Strict `.json` array-of-objects stacking:

```bash
cdx-chores data stack ./examples/playground/stack-cases/json-array-basic --pattern "*.json" --input-format json --output ./examples/playground/.tmp-tests/json-array.stack.csv --overwrite
```

Union-by-name with exact exclusions:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-union --pattern "*.csv" --union-by-name --exclude-columns noise --output ./examples/playground/.tmp-tests/union.stack.json --overwrite
```

Dry-run plan without writing stack output:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-matching-headers --pattern "*.csv" --output ./examples/playground/.tmp-tests/matching.stack.csv --dry-run
```

Replay a reviewed stack plan:

```bash
cdx-chores data stack replay ./data-stack-plan-20260425T120000Z-a1b2c3d4.json --output ./examples/playground/.tmp-tests/replayed.stack.csv
```

Record a unique key and report duplicate diagnostics:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-matching-headers --pattern "*.csv" --output ./examples/playground/.tmp-tests/matching.stack.csv --unique-by id --on-duplicate report --dry-run
```

Reject duplicate rows before writing:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-matching-headers --pattern "*.csv" --output ./examples/playground/.tmp-tests/matching.stack.csv --on-duplicate reject
```

Write an advisory Codex report during dry-run:

```bash
cdx-chores data stack ./examples/playground/stack-cases/csv-union --pattern "*.csv" --union-by-name --output ./examples/playground/.tmp-tests/union.stack.json --dry-run --codex-assist --codex-report-output ./examples/playground/.tmp-tests/union.codex-report.json
```

Recursive directory discovery:

```bash
cdx-chores data stack ./examples/playground/stack-cases/recursive-depth --recursive --max-depth 1 --pattern "*.csv" --output ./examples/playground/.tmp-tests/recursive.stack.csv --overwrite
```

### Interactive mode

Start with:

```bash
cdx-chores interactive
```

Choose:

1. `data`
2. `stack`

Current interactive flow:

1. Enter one input source.
2. Optionally add more sources.
3. Choose CSV, TSV, JSON, or JSONL input format.
4. Enter a filename pattern.
5. Choose shallow or recursive traversal.
6. Choose strict matching or union-by-name schema mode.
7. If union-by-name is selected, optionally enter exact column/key exclusions.
8. Choose output format.
9. Choose destination style:
   - use generated default output path
   - custom output path
10. Review the normalized source summary, schema mode, matched files, row count, duplicate/key status, stack-plan path, advisory report status, output format, and write setup.
11. If diagnostics show useful signals, choose one Codex checkpoint action:
   - review with Codex
   - continue without Codex
   - revise stack setup
   - cancel
12. At the write boundary, choose one of:
   - write now
   - dry-run plan only
   - revise stack setup
   - change destination
   - cancel

Current interactive default output rule:

- interactive defaults use generated stack artifact names rooted at the current working directory
- the naming rule is the same for single-source and mixed-source runs:
  - `data-stack-<timestamp>-<uid>.csv`
  - `data-stack-<timestamp>-<uid>.tsv`
  - `data-stack-<timestamp>-<uid>.json`
- direct CLI stays explicit and still requires `--output <path>`
- generated default collisions are rare, but they still go through overwrite confirmation
- if overwrite is declined, the destination prompt can choose a custom path or generate a new default candidate
- dry-run plan only writes a stack-plan JSON artifact and defaults to keeping it
- successful write asks whether to keep the applied stack plan
- declining retention removes only the generated stack-plan JSON
- Codex or diagnostic reports have a separate keep prompt
- failed writes keep all generated artifacts for troubleshooting

Interactive Codex review:

- Codex recommendations are requested from a contextual checkpoint before write or plan save
- the checkpoint is shown only when diagnostics indicate likely value, such as generated headerless columns, sparse union-by-name columns, duplicate rows, candidate unique keys, selected-key conflicts, or schema drift
- no-signal runs skip the checkpoint and go straight to the final action menu
- interactive review is not a materialized write; it produces an advisory report plus a reviewed deterministic plan when recommendations are accepted or edited
- recommendations are shown as patch-style changes with a short reason
- each recommendation can be accepted, edited, skipped, or used to cancel review
- accepted and edited recommendations create a new deterministic plan payload before write or dry-run save
- the status preview is shown again after accepted or edited recommendations
- if Codex fails, the interactive flow keeps the current deterministic setup and lets the user continue

Example:

- selected output format: JSON
- default JSON output: `data-stack-20260424T120000Z-a1b2c3d4.json`

Interactive JSON wording:

- JSON output means the stacked table is written as one JSON array of row objects
- JSON input means each matched `.json` source is one top-level array of row objects
- JSON output support does not imply arbitrary JSON input inference

### Fixture reproduction

The public stack examples live under `examples/playground/stack-cases/`.

Reset that tracked fixture tree with:

```bash
node scripts/generate-data-stack-fixtures.mjs reset
```

Guarded clean behavior:

- the generator refuses to delete the default tracked fixture root with `clean`
- use `reset` for the committed playground tree
- use `clean --output-dir <path>` only for alternate generated fixture roots under `examples/playground/.tmp-tests/`
