## Data Schema And Mapping

Use this guide for the shared header-mapping artifact contract behind reviewed semantic header suggestions used by `data query` and `data extract`.

Use `docs/guides/data-source-shape-usage.md` for reviewed source-shape artifacts and shape-first Excel workflows.

As of `v0.1.2`, this guide reflects the shipped split where header mappings stay a separate semantic-renaming layer on top of the current shaped source. They are reusable from both `data query` and `data extract`, but they are not a source-shape artifact and they do not change the `data query codex` surface.

Current stable contract:

- persisted artifacts are JSON-only
- artifact family name: `data-header-mapping-<uid>.json`
- `version` means the artifact schema-contract version, not the CLI app version
- reuse is strict exact matching on:
  - `input.path`
  - `input.format`
  - optional `input.noHeader`
  - optional `input.source`
  - optional `input.range`
  - optional `input.bodyStartRow`
  - optional `input.headerRow`
- file-content fingerprints and stale-file detection after in-place edits are deferred

### Artifact shape

Required fields:

- `version`
- `metadata.artifactType`
- `metadata.issuedAt`
- `input.path`
- `input.format`
- `mappings[].from`
- `mappings[].to`

Conditionally required fields:

- `input.noHeader` when the current reviewed header flow explicitly used `--no-header`
- `input.source` when the shaped source requires one
- `input.range` when shaping used an explicit Excel range
- `input.bodyStartRow` when shaping used an explicit Excel body-start row
- `input.headerRow` when shaping used an explicit Excel header row

Optional fields may appear on mapping entries, such as:

- `sample`
- `inferredType`

Illustrative shape:

```json
{
  "version": 1,
  "metadata": {
    "artifactType": "data-header-mapping",
    "issuedAt": "2026-03-18T12:34:56.000Z"
  },
  "input": {
    "path": "examples/playground/data-query/generic.csv",
    "format": "csv"
  },
  "mappings": [
    { "from": "column_1", "to": "id", "sample": "1001", "inferredType": "BIGINT" },
    { "from": "column_2", "to": "status", "sample": "active", "inferredType": "VARCHAR" }
  ]
}
```

Generated placeholder contract:

- reviewed semantic header suggestions use deterministic placeholder names such as `column_1`, `column_2`, ...
- when an underlying engine emits raw headerless names like `column0`, `column1`, ... the shared query/extract layer normalizes them to the `column_<n>` contract before reviewed header suggestions run

### Direct CLI Review Flow

Reviewed direct `data query` and `data extract` stay two-step and explicit:

1. suggest semantic headers and write the review artifact
2. inspect or edit the JSON artifact
3. rerun either:
   - `data query` with the accepted `--header-mapping <path>` plus `--sql`
   - `data extract` with the accepted `--header-mapping <path>` plus `--output <path>`

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/generic.csv --codex-suggest-headers --write-header-mapping ./header-map.json
cdx-chores data query ./examples/playground/data-query/generic.csv --header-mapping ./header-map.json --sql "select id, status from file order by id"
cdx-chores data extract ./examples/playground/data-query/generic.csv --codex-suggest-headers --write-header-mapping ./header-map.json
cdx-chores data extract ./examples/playground/data-query/generic.csv --header-mapping ./header-map.json --output ./examples/playground/.tmp-tests/generic.clean.csv --overwrite
```

If `--write-header-mapping` is omitted, the CLI generates a filename in the shared `data-header-mapping-<uid>.json` family.

### Interactive Review

Interactive query review is smaller and in-memory:

- `Accept all`
- `Edit one`
- `Keep generated names`

Accepted mappings trigger a re-inspection before SQL authoring continues.

Important boundary:

- this guide is about semantic column renaming only
- it does not define worksheet range selection, header-row selection, or body-start-row selection
- those source-interpretation concerns belong to `docs/guides/data-source-shape-usage.md`
- it also does not define reviewed source-shape artifact generation; that direct-CLI flow still starts from `data extract --codex-suggest-shape`
- interactive review does not currently write a persisted header-mapping artifact
- direct CLI reviewed flows are still the path that produces reusable `data-header-mapping-<uid>.json` artifacts

### Rewrite Policy

When the CLI rewrites an existing supported artifact version:

- unknown top-level JSON fields are preserved
- unknown `metadata` fields are preserved
- unknown mapping-entry fields are preserved for matching `from` entries

If the artifact schema version is unsupported, the CLI fails clearly instead of rewriting destructively.
