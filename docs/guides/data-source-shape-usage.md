## Data Source Shape

Use this guide for the reviewed source-shape artifact contract and the current shape-first workflow shared across `data extract` and `data query`.

Use `docs/guides/data-schema-and-mapping-usage.md` for semantic header-mapping artifacts.

Current first-pass boundary:

- persisted source-shape artifacts are JSON-only
- artifact family name: `data-source-shape-<uid>.json`
- artifact family is currently Excel-only
- `version` means the artifact schema-contract version, not the CLI app version
- first-pass reuse is strict exact matching on:
  - `input.path`
  - `input.format`
  - `input.source`
- accepted shape values may include:
  - `shape.range`
  - `shape.headerRow`
  - `shape.bodyStartRow`

Important layer split:

- source shape answers: "what part of the source becomes the logical table?"
- header mapping answers: "what should the current logical columns be called?"
- explicit headerless CSV or TSV handling through `--no-header` is a separate direct command/input-interpretation layer today; it is not persisted as a source-shape artifact

### Artifact Shape

Required first-pass fields:

- `version`
- `metadata.artifactType`
- `metadata.issuedAt`
- `input.path`
- `input.format`
- `input.source`
- `shape`

Valid `shape` contents:

- `range`
- `headerRow`
- `bodyStartRow`
- any valid combination of them

At least one of those shape fields must be present.

Illustrative shape:

```json
{
  "version": 1,
  "metadata": {
    "artifactType": "data-source-shape",
    "issuedAt": "2026-03-20T12:34:56.000Z"
  },
  "input": {
    "path": "examples/playground/data-extract/messy.xlsx",
    "format": "excel",
    "source": "Summary"
  },
  "shape": {
    "range": "B2:E11",
    "headerRow": 7
  }
}
```

### Direct CLI Review Flow

Reviewed source-shape work stays explicitly two-step:

1. run `data extract --codex-suggest-shape`
2. inspect or edit the JSON artifact
3. rerun `data extract --source-shape <path> --output <path>`

Examples:

```bash
cdx-chores data extract ./examples/playground/data-extract/messy.xlsx --source Summary --codex-suggest-shape --write-source-shape ./shape.json
cdx-chores data extract ./examples/playground/data-extract/messy.xlsx --source-shape ./shape.json --output ./examples/playground/.tmp-tests/messy.clean.csv --overwrite
cdx-chores data extract ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --codex-suggest-shape --write-source-shape ./stacked.shape.json
cdx-chores data extract ./examples/playground/data-extract/stacked-merged-band.xlsx --source-shape ./stacked.shape.json --output ./examples/playground/.tmp-tests/stacked.clean.csv --overwrite
```

If `--write-source-shape` is omitted, the CLI generates a filename in the shared `data-source-shape-<uid>.json` family.

### Current Query Relationship

`data query` and `data extract` share the same deterministic shape contract, but they do not currently replay reviewed shape artifacts in the same way.

Current shipped behavior:

- `data extract` can generate reviewed source-shape artifacts
- `data extract` can replay `--source-shape <path>`
- `data query` can consume the same accepted deterministic values as explicit flags
- `data query` does not yet accept `--source-shape <path>`

Planned follow-up:

- add direct query replay through `data query --source-shape <path>`
- keep that as a later command-surface follow-up rather than implying it is already shipped

Current direct query workflow:

1. use `data extract --codex-suggest-shape` if you need help discovering the correct Excel table boundary
2. inspect the accepted artifact
3. rerun `data query` with the accepted explicit flags plus `--sql`

Example:

```bash
cdx-chores data extract ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --codex-suggest-shape --write-source-shape ./stacked.shape.json
cdx-chores data query ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --header-row 7 --body-start-row 10 --sql "select id, question, status, notes from file order by id"
```

This is intentional in the current product split:

- `data extract` owns reviewed reusable shape generation
- `data query` owns SQL against an accepted deterministic shape

### Interactive Relationship

Interactive `data query` and interactive `data extract` can both inspect the current shaped source before continuing.

Current interactive boundary:

- reviewed source-shape choices stay in memory for the current session
- interactive mode does not currently write reusable `data-source-shape-<uid>.json` artifacts
- use direct CLI reviewed flows when you want a persisted artifact

### Rewrite Policy

When the CLI rewrites an existing supported artifact version:

- unknown top-level JSON fields are preserved
- unknown `metadata` fields are preserved
- unknown `shape` fields are preserved

If the artifact schema version is unsupported, the CLI fails clearly instead of rewriting destructively.
