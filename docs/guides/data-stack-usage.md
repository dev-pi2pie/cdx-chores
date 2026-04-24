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
- mixed normalized input formats are rejected
- output requires `.csv`, `.tsv`, or `.json`
- direct CLI requires `--output <path>`
- interactive mode is available through `cdx-chores interactive`
- first-pass interactive `data stack` stays narrower than the direct CLI:
  - directory-first only
  - CSV and TSV only

Important current restriction:

- interactive `data stack` does not yet mirror the full direct CLI contract
- if you need mixed file-plus-directory input or strict `jsonl`, use direct CLI `data stack` today
- the planned widening is tracked in `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`

### Command shape

```bash
cdx-chores data stack <source...> --output <path> [--input-format <format>] [--pattern <glob>] [--recursive] [--max-depth <n>] [--no-header] [--columns <name,name,...>] [--overwrite]
```

Supported `--input-format` values:

- `csv`
- `tsv`
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

`jsonl` behavior:

- each line must be one JSON object
- empty files are rejected
- non-object rows are rejected
- first-pass key mismatches are rejected rather than widened automatically
- `.json` output writes one JSON array of row objects

Planned schema-flex behavior:

- strict schema matching is the default today and should remain the default
- `--union-by-name` is planned as an opt-in mode for stacking named schemas that add or omit columns or JSON keys
- when enabled, it should build the output schema from the union of all header names or object keys
- the first source's name order should come first, with newly discovered names appended in first-seen order
- missing values should be written using the stack materializer's empty-value policy
- explicit exclusions are planned through `--exclude-columns <name,name,...>` for union-by-name runs
- excluded names should be exact matches, should be rejected when unknown, and should be disclosed before or after writing
- first supported inputs should be:
  - CSV and TSV inputs with header rows
  - `jsonl` object rows
  - planned `.json` top-level arrays of objects
- `--union-by-name` should not be used automatically; it exists to make schema widening deliberate

Deferred Codex schema assistance:

- a later canary may add Codex-assisted suggestions for noisy exclusions or possible schema repairs
- those suggestions should be reviewed and turned into explicit flags or artifacts
- Codex should not silently exclude, rename, or repair stack output
- replayable stack records and Codex schema-assist questions are separate future work, tracked in `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`

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

1. choose the input directory
2. choose CSV or TSV input format
3. enter a filename pattern
4. choose shallow or recursive traversal
5. choose output format
6. choose destination style:
   - use default output path
   - custom output path
7. review the matched-file summary and write setup
8. at the write boundary, choose one of:
   - write now
   - revise stack setup
   - change destination
   - cancel

Current limitation:

- interactive mode still starts from one directory only
- interactive mode still limits input selection to CSV or TSV
- interactive mode does not yet expose direct file inputs, mixed-source runs, `jsonl` input, or `json` input
- interactive mode does expose JSON as an output format
- current direct CLI supports strict `jsonl` input but not `.json` input
- the interactive mixed-source follow-up is expected to add `.json` input with a narrow top-level array-of-objects contract

Current interactive default output rule:

- the input directory is the current primary label
- the default output path is a sibling path derived from that directory name
- the suffix is stack-specific and follows the chosen output format:
  - `.stack.csv`
  - `.stack.tsv`
  - `.stack.json`

Example:

- input directory: `examples/playground/stack-cases/csv-matching-headers`
- default JSON output: `examples/playground/stack-cases/csv-matching-headers.stack.json`

### Fixture reproduction

The public stack examples live under `examples/playground/stack-cases/`.

Reset that tracked fixture tree with:

```bash
node scripts/generate-data-stack-fixtures.mjs reset
```

Guarded clean behavior:

- the generator refuses to delete the default tracked fixture root with `clean`
- use `reset` for the committed playground tree
- use `clean --output-dir <path>` only for alternate generated fixture roots
