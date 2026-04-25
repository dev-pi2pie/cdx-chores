---
title: "Data stack replay records, duplicate handling, and Codex schema assist"
created-date: 2026-04-24
modified-date: 2026-04-26
status: in-progress
agent: codex
---

## Goal

Define the next `data stack` development stage for replayable dry-run records, duplicate/key diagnostics, and Codex-assisted reviewed recommendations, without blurring the deterministic `data stack` command contract.

## Why This Research

The current `data stack` direction now has a clearer deterministic follow-up path:

- mixed-source interactive input
- strict `jsonl` input
- narrow `.json` input as one top-level array of objects
- opt-in `--union-by-name`
- explicit `--exclude-columns <name,name,...>`

That still leaves an adjacent workflow unowned:

- preserving a reviewed stack setup for replay
- adding dry-run review before materialized output is written
- identifying duplicate rows and possible unique keys during stack review
- allowing Codex to suggest noisy exclusions or possible schema repairs
- allowing Codex to explain duplicate/key workarounds from deterministic diagnostics
- keeping those suggestions reviewable instead of silently mutating stack output

The repo already has related patterns:

- `rename` has dry-run plan artifacts that can be applied later
- `data extract` has reviewed source-shape behavior for shaped extraction
- Codex-assisted flows generally propose reviewed changes rather than silently applying hidden transformations

This research now chooses the same safety shape for `data stack`: dry-run produces a reviewed deterministic plan, and `data stack replay <record>` runs that accepted plan later.

The first implementation pass now proves the deterministic pieces and reviewed Codex report flow, but interactive Codex prompting still needs refinement. The current interactive implementation exposes Codex as a peer of final write/save actions; the desired UX should feel closer to `data extract` and `rename`, where Codex appears as a contextual helper only when diagnostics show it can help.

## Starting State

At the start of this research, `data stack` had no replayable stack-record contract.

Current and planned deterministic behavior is expressed through command options:

- raw sources
- pattern and traversal options
- input format
- output format and output path
- schema mode such as strict matching or `--union-by-name`
- explicit exclusions such as `--exclude-columns`

Before this research and its linked implementation plan, the completed stack follow-up work only recorded replay and Codex schema suggestions as deferred reviewed-assist work. That earlier work did not define:

- a stack record file format
- a replay command
- a dry-run mode that writes or offers the replayable record
- duplicate-row diagnostics
- unique-key candidate diagnostics
- explicit duplicate policy options
- artifact lifecycle or retention rules
- how Codex suggestions become deterministic replayable input

## Scope

This research covers:

- the decision that a replayable stack record should exist
- the decision that the replay command should be `data stack replay <record>`
- the dry-run contract that prepares and reviews a stack plan without writing stack output
- what belongs in that record
- duplicate-row and unique-key handling for the next implementation plan
- how explicit exclusions and union-by-name should be represented
- how Codex schema and duplicate/key suggestions could produce reviewed recommendations
- how to keep Codex suggestions separate from deterministic stack execution

This research does not implement:

- replay command wiring
- Codex schema suggestion calls
- source-shape artifact changes
- rename artifact changes
- automatic stack-time repair

## Chosen Direction

### 1. `data stack replay <record>` should be the replay surface

Use a stack-owned replay command rather than a generic data replay command:

```bash
cdx-chores data stack ./inputs --pattern "*.csv" --output merged.csv --dry-run
cdx-chores data stack replay ./data-stack-plan-20260425T120000Z-a1b2c3d4.json
```

This mirrors the `rename` safety model:

- the normal command can produce a dry-run plan
- the dry-run plan is inspectable and replayable
- replay executes the reviewed plan without requiring Codex
- advisory analysis remains separate from replayable execution input

`data stack replay <record>` is preferred over `data replay <record>` because the first stack record is stack-specific:

- stack has source normalization and schema-mode settings
- stack has output materialization settings
- stack duplicate/key policy belongs to row assembly, not generic data execution

Implication:

- a broader `data replay` can be reconsidered only after multiple data actions share one artifact family
- the next implementation plan should treat `data stack replay <record>` as the committed command surface

### 2. Dry-run should author deterministic stack records

Dry-run should do real preparation but stop before writing materialized stack output.

Required dry-run work:

- normalize raw sources
- resolve matched files
- validate input format
- validate header mode and headerless columns
- validate strict or union-by-name schema mode
- validate explicit exclusions
- compute file, row, schema, exclusion, and duplicate/key diagnostics
- show a review summary
- write or offer a replayable stack record:
  - direct dry-run writes a generated plan by default, with `--plan-output <path>` override
  - interactive dry-run offers the generated default first, with a custom destination option

Dry-run should not:

- write the merged `.csv`, `.tsv`, or `.json` output
- silently dedupe rows
- silently repair schema drift
- silently accept Codex suggestions

Implication:

- dry-run becomes the safest authoring path for repeatable stack runs
- interactive mode should mirror rename-style artifact-retention prompts without changing the deterministic replay contract

### 3. Interactive mode should borrow the rename preview/apply rhythm

Interactive `data stack` should keep the current setup-review rhythm, but insert a status preview and stack-plan lifecycle before any materialized output is written.

Recommended interactive rules:

- prepare a deterministic status preview before any write
- show matched-source, schema, row-count, duplicate/key, and output summaries
- surface a contextual Codex checkpoint only when deterministic diagnostics suggest it can help
- keep the no-signal path quiet and go straight to write/save choices
- after accepted or edited Codex recommendations, re-prepare and show the deterministic status preview
- ask whether to write now, save a dry-run plan only, change destination, revise setup, or cancel
- if writing now, execute the accepted stack plan
- after success, ask separate retention questions for execution and advisory artifacts

The status preview should include:

- matched file count and bounded source sample
- input format and schema mode
- output format and output path
- exact exclusions
- duplicate policy
- selected unique key, if any
- exact duplicate-row count
- duplicate-key conflict count, if `--unique-by` is selected
- candidate unique-key summary, when available
- Codex checkpoint status, when diagnostics surfaced it or a report was reviewed

Interactive artifact retention should follow the rename cleanup lesson:

- the stack plan is an execution/replay artifact
- Codex schema or duplicate/key reports are advisory artifacts
- these artifact classes need separate retention prompts
- a single auto-clean decision must not delete advisory evidence

If the user chooses to write after the status preview:

- run the accepted stack plan
- if the write succeeds, ask whether to keep the applied stack plan for later `data stack replay`
- if the user declines, auto-clean only the stack-plan artifact
- if advisory reports exist, ask separately whether to keep them
- if the write fails, skip cleanup prompts and keep all generated artifacts for diagnosis

Recommended prompt defaults:

- dry-run only:
  - `Keep dry-run stack plan for later data stack replay?`
  - default `Yes`
- write now succeeds:
  - `Keep applied stack plan?`
  - default `No`
- advisory report exists:
  - `Keep stack diagnostic report?`
  - default `Yes`

Auto-clean should never remove:

- the materialized stack output
- source files
- Codex diagnostic reports unless the user explicitly declines keeping that report

### 4. Interactive dry-run/replay ASCII sketches

The interactive flow is easier to read as three sketches: setup and optional Codex review, final action choice, and post-write retention.

#### Setup and contextual Codex checkpoint

```text
cdx-chores interactive
  |
  v
data
  |
  v
stack
  |
  v
collect sources, format, schema, duplicate policy
  |
  v
choose output destination
  |
  v
prepare status preview
  |
  v
show source/schema/duplicate/key/output summary
  |
  v
diagnostics show Codex-useful signals?
  |
  +-- no ----> final action menu
  |
  +-- yes ---> Codex assist checkpoint
                 |
                 +-- continue without Codex -> final action menu
                 |
                 +-- revise setup ----------> collect setup again
                 |
                 +-- cancel ----------------> stop
                 |
                 +-- review with Codex -----> review Codex recommendations
                                               |
                                               +-- skip review -----------> final action menu
                                               |
                                               v
                                             accept or edit recommendations
                                               |
                                               v
                                             apply reviewed changes to deterministic plan
                                               |
                                               v
                                             re-prepare status preview
                                               |
                                               v
                                             show updated summary
                                               |
                                               v
                                             final action menu
```

#### Final action menu

```text
final action menu
  |
  +-- write now ----------> execute accepted stack plan
  |
  +-- dry-run plan only --> write/offer stack plan
  |
  +-- change destination -> choose output destination
  |
  +-- revise setup -------> collect setup again
  |
  +-- cancel -------------> stop
```

#### Retention after write or dry-run save

```text
execute accepted stack plan
  |
  v
write output succeeds?
  |
  +-- no ----> keep all generated artifacts
  |
  +-- yes ---> Keep applied stack plan?
                |
                +-- yes -> keep stack plan
                |
                +-- no --> auto-clean stack plan only
                           |
                           v
                         Keep diagnostic report? (if present)

write/offer stack plan
  |
  v
Keep dry-run stack plan?
```

Implication:

- interactive Codex assist becomes a contextual review checkpoint, not a peer of write/save actions
- the final action menu stays focused on deterministic execution, dry-run plan saving, destination changes, revision, or cancellation
- quiet no-signal inputs skip Codex prompting entirely
- immediate write still runs through a concrete plan instead of recomputing hidden state
- auto-clean is scoped to execution artifacts and only after success
- advisory evidence survives unless the user explicitly removes it

### 5. Deterministic stack records should be separate from Codex suggestions

A replayable stack record should describe a deterministic stack run.

#### Stack Plan Artifact

The v1 stack-plan artifact should be JSON and follow the existing reviewed-artifact convention of `version` plus `metadata.artifactType`, with extra replay identity fields because this artifact is executable input.

Artifact family name:

- `data-stack-plan-<timestamp>Z-<uid>.json`

Required top-level keys:

- `version`
- `metadata`
- `command`
- `sources`
- `input`
- `schema`
- `duplicates`
- `output`
- `diagnostics`

Terminology note:

- `schema` in this artifact means the accepted stack output column/key contract.
- for CSV/TSV with headers, `schema.includedNames` comes from accepted header names
- for JSONL or `.json` array rows, `schema.includedNames` comes from accepted object keys
- for headerless CSV/TSV, `input.columns` supplies the accepted positional names and `schema.includedNames` mirrors those names
- this is not a DuckDB/database schema and should not be confused with schema-qualified query selectors such as `analytics.events`

Recommended v1 shape:

```json
{
  "version": 1,
  "metadata": {
    "artifactType": "data-stack-plan",
    "artifactId": "data-stack-plan-20260425T120000Z-a1b2c3d4",
    "payloadId": "stack-payload-20260425T120000Z-a1b2c3d4",
    "derivedFromPayloadId": null,
    "acceptedRecommendationIds": [],
    "recommendationDecisions": [],
    "issuedAt": "2026-04-25T12:00:00.000Z",
    "createdBy": "cdx-chores data stack --dry-run"
  },
  "command": {
    "family": "data",
    "action": "stack",
    "replayCommand": "data stack replay"
  },
  "sources": {
    "baseDirectory": ".",
    "raw": ["./inputs"],
    "pattern": "*.csv",
    "recursive": false,
    "maxDepth": null,
    "resolved": [
      {
        "path": "inputs/part-001.csv",
        "kind": "file",
        "fingerprint": {
          "sizeBytes": 1234,
          "mtimeMs": 1777118400000
        }
      }
    ]
  },
  "input": {
    "format": "csv",
    "headerMode": "header",
    "columns": []
  },
  "schema": {
    "mode": "strict",
    "includedNames": ["id", "name", "status"],
    "excludedNames": []
  },
  "duplicates": {
    "policy": "preserve",
    "uniqueBy": [],
    "exactDuplicateRows": 0,
    "duplicateKeyConflicts": 0
  },
  "output": {
    "format": "csv",
    "path": "merged.csv",
    "overwrite": false
  },
  "diagnostics": {
    "matchedFileCount": 1,
    "rowCount": 25,
    "schemaNameCount": 3,
    "candidateUniqueKeys": [
      {
        "columns": ["id"],
        "nullRows": 0,
        "duplicateRows": 0
      }
    ],
    "reportPath": null
  }
}
```

#### Payload Lineage

Payload identity:

- `metadata.artifactId` identifies the replay artifact file family and should match the generated filename stem by default.
- `metadata.payloadId` identifies the deterministic stack setup inside the artifact.
- `metadata.derivedFromPayloadId` records the earlier payload when the current plan was produced by accepting or editing recommendations.
- `metadata.acceptedRecommendationIds` records which advisory recommendations shaped this plan when the user accepted them without edit.
- `metadata.recommendationDecisions` records accepted and edited recommendation decisions when advisory review shaped the new payload.
- `metadata.issuedAt` is an ISO UTC timestamp for artifact creation.
- replay should preserve those values when reading an existing plan instead of regenerating them.

Payload lifecycle:

- the first dry-run plan mints a `payloadId` for the prepared deterministic setup
- a Codex report references that analyzed payload
- accepting or editing any Codex recommendation creates a new deterministic setup and therefore a new `payloadId`
- the new plan should set `derivedFromPayloadId` to the analyzed payload from the report
- accepted recommendations may be recorded in `acceptedRecommendationIds`
- edited recommendations should not be treated as exact accepted recommendations
- edited recommendations should be recorded in `recommendationDecisions` with `decision: "edited"` while the edited values live in deterministic plan fields
- replay always uses the final stack-plan `payloadId` and never follows advisory reports at execution time

The split lets a future tool distinguish:

- two files that contain the same accepted payload
- one file rewritten with a new accepted payload
- advisory reports that reference the accepted payload without becoming executable input

#### Field Usage

Key usage table:

| Key | Required | Replay usage | Notes |
| --- | --- | --- | --- |
| `version` | Yes | Selects the parser and compatibility rules | Artifact schema version, not CLI package version |
| `metadata.artifactType` | Yes | Rejects non-stack-plan JSON | Must be `data-stack-plan` |
| `metadata.artifactId` | Yes | Names and audits the plan artifact | Defaults from `data-stack-plan-<timestamp>Z-<uid>` |
| `metadata.payloadId` | Yes | Links accepted setup to diagnostics/advisory reports | Stable for the accepted deterministic payload |
| `metadata.derivedFromPayloadId` | No | Audits recommendation acceptance/edit lineage | Set when a new payload is created from a previous analyzed payload |
| `metadata.acceptedRecommendationIds` | No | Audits exact accepted recommendations | Empty for edited recommendations or no Codex assist |
| `metadata.recommendationDecisions` | No | Audits accepted or edited recommendations | Entries identify report artifact, recommendation id, and `accepted` or `edited` decision |
| `metadata.issuedAt` | Yes | Audits when the plan was written | ISO UTC timestamp |
| `command.family` | Yes | Verifies command family | `data` |
| `command.action` | Yes | Verifies command action | `stack` |
| `command.replayCommand` | Yes | Documents replay surface | `data stack replay` |
| `sources.baseDirectory` | Yes | Resolves relative source paths | Captures the authoring base path |
| `sources.raw` | Yes | Audits original source intent | Raw paths as entered |
| `sources.pattern` | No | Replays directory expansion | Required when directory discovery used a pattern |
| `sources.recursive` | Yes | Replays traversal mode | Boolean |
| `sources.maxDepth` | No | Replays traversal bound | `null` means no explicit bound |
| `sources.resolved[]` | Yes | Replays the accepted source list | Exact normalized files from dry-run |
| `sources.resolved[].fingerprint` | No | Warns on drift by default | Size and mtime are v1 baseline; content hash can be later |
| `input.format` | Yes | Selects parser | `csv`, `tsv`, `jsonl`, or `json` |
| `input.headerMode` | Yes | Replays header handling | `header` or `no-header` |
| `input.columns` | Conditional | Replays headerless names | Required for `no-header` |
| `schema.mode` | Yes | Replays strict vs union behavior | `strict` or `union-by-name` |
| `schema.includedNames` | Yes | Audits accepted output schema | Ordered output names |
| `schema.excludedNames` | Yes | Replays explicit exclusions | Empty array when none |
| `duplicates.policy` | Yes | Replays duplicate behavior | v1 supports `preserve`, `report`, `reject` |
| `duplicates.uniqueBy` | Yes | Replays selected unique key | Empty array means exact-row diagnostics only |
| `duplicates.exactDuplicateRows` | Yes | Audits dry-run finding | Bounded fact, not execution input by itself |
| `duplicates.duplicateKeyConflicts` | Yes | Audits dry-run finding | Applies when `uniqueBy` is non-empty |
| `output.format` | Yes | Selects writer | `csv`, `tsv`, or `json` |
| `output.path` | No | Default replay destination | Replay may require `--output` if missing |
| `output.overwrite` | Yes | Replays overwrite intent | Replay can still require explicit confirmation in interactive mode |
| `diagnostics.*` | Yes | Supports review and stale-plan warnings | Bounded diagnostics, not Codex-owned |
| `diagnostics.candidateUniqueKeys[]` | Yes | Shows deterministic key candidates | Entries should list `columns`, `nullRows`, and `duplicateRows` |

V1 duplicate policies should stay conservative:

- `preserve`
- `report`
- `reject`

`keep-first` and `keep-last` are deterministic, but data-losing. They should remain out of v1 unless a later implementation plan explicitly widens duplicate handling after `report` and `reject` are validated.

Codex suggestions should not be required to replay the record.

Implication:

- a user can review, commit, and replay the record without Codex availability
- Codex remains an authoring aid, not an execution dependency

### 6. Duplicate rows and unique-key handling belong in this dev stage

Duplicate handling should be part of the next implementation plan, not a vague future follow-up.

Default behavior:

- preserve rows unless the user explicitly chooses a duplicate policy
- report duplicate diagnostics in dry-run and interactive review
- make the selected duplicate policy replayable

The next implementation plan should complete the diagnostic and deterministic-control layer:

- exact duplicate-row detection
- candidate unique-key detection
- explicit unique-key selection
- explicit duplicate policy selection
- replay-record persistence for the selected policy

Recommended direct CLI options:

```bash
cdx-chores data stack ./inputs --output merged.csv --dry-run
cdx-chores data stack ./inputs --output merged.csv --unique-by order_id --on-duplicate report
cdx-chores data stack ./inputs --output merged.csv --unique-by order_id --on-duplicate reject
```

Recommended first duplicate policies:

- `preserve`:
  - default behavior
  - writes all rows
  - reports duplicate diagnostics when dry-run/review is requested
- `report`:
  - writes all rows
  - records duplicate-key or exact-duplicate findings in the plan/report
- `reject`:
  - fails when duplicates are detected for the selected key or exact-row mode
- `keep-first`:
  - deterministic but data-losing
  - keep out of the first duplicate-policy implementation
- `keep-last`:
  - deterministic but data-losing
  - keep out of the first duplicate-policy implementation

Exact duplicate rows and duplicate business keys should be treated differently:

- exact duplicate rows compare all output columns/keys after normalization
- duplicate business keys compare only user-selected unique-key columns
- rows with the same key but different non-key values are conflicts, not safe automatic repairs

Implication:

- `data stack` can identify duplicate risk without guessing the business meaning of a row
- the user chooses the key and conflict behavior
- replay captures that explicit choice

### 7. Codex assist should produce reviewed proposals from deterministic facts

Codex assistance is useful in this dev stage, but only downstream of deterministic diagnostics.

Deterministic analyzers should compute facts such as:

- schema mismatch details
- sparse or always-empty columns
- exact duplicate-row counts
- candidate unique columns or column groups
- duplicate-key conflict counts
- headerless column counts, samples, null counts, and enum-like value summaries
- example conflicting rows or bounded summaries

Codex can then help explain or recommend reviewed proposals:

- headerless CSV/TSV column names
- likely unique-key candidates from names plus uniqueness statistics
- safer duplicate policy choices such as `report` or `reject`
- suspicious duplicate-key conflicts such as same order id with different totals
- noisy columns or keys to exclude
- likely misspelled duplicate columns or keys
- possible rename or repair suggestions
- schema-drift summary before a user chooses union-by-name

Recommended assist surfaces:

| Surface | Deterministic facts | Codex may suggest | Patch target | Accepted result |
| --- | --- | --- | --- | --- |
| Headerless input | Column count, samples, null counts, uniqueness, enum-like values | Human-readable `input.columns` names | `/input/columns`, `/schema/includedNames` | Stored in `input.columns` and mirrored in `schema.includedNames` |
| Noisy union columns | Sparseness, always-empty columns, source distribution | Names for `schema.excludedNames` | `/schema/excludedNames` | Stored as explicit exclusions |
| Unique key choice | Null, uniqueness, duplicate, and bounded candidate-key stats | `duplicates.uniqueBy` candidate | `/duplicates/uniqueBy` | Stored as selected unique key |
| Duplicate policy | Exact duplicate counts, duplicate-key conflict counts, example conflicts | `preserve`, `report`, or `reject` | `/duplicates/policy` | Stored as `duplicates.policy` |
| Schema drift | Strict mismatch details, first-seen names, missing names by source | Use union-by-name, revise columns, or exclude explicit names | `/schema/mode`, `/schema/includedNames`, `/schema/excludedNames` | Stored as `schema.mode`, `schema.includedNames`, and `schema.excludedNames` |

Recommended contract:

- Codex suggestions produce a reviewed proposal
- accepted suggestions become explicit deterministic options or a replayable record
- no silent auto-exclude
- no silent auto-repair
- no silent unique-key selection
- no silent dedupe

Implication:

- the final stack output is explainable from CLI flags or a record file
- Codex behavior can improve without changing deterministic replay semantics

### 8. Codex reports should be advisory and payload-linked

Codex recommendations should be written to a separate advisory report when the user wants to preserve the review evidence.

Artifact family name:

- `data-stack-codex-report-<timestamp>Z-<uid>.json`

Recommended advisory shape:

```json
{
  "version": 1,
  "metadata": {
    "artifactType": "data-stack-codex-report",
    "artifactId": "data-stack-codex-report-20260425T120500Z-d4c3b2a1",
    "payloadId": "stack-payload-20260425T120000Z-a1b2c3d4",
    "issuedAt": "2026-04-25T12:05:00.000Z",
    "createdBy": "cdx-chores data stack",
    "mode": "codex-assist"
  },
  "facts": {
    "matchedFileCount": 2,
    "rowCount": 50,
    "schemaNameCount": 3
  },
  "recommendations": [
    {
      "recommendationId": "rec-001",
      "kind": "headerless-columns",
      "patches": [
        {
          "op": "replace",
          "path": "/input/columns",
          "value": ["id", "name", "status"]
        },
        {
          "op": "replace",
          "path": "/schema/includedNames",
          "value": ["id", "name", "status"]
        }
      ],
      "confidence": "medium",
      "evidence": [
        "column 1 is unique and numeric",
        "column 3 has repeated active/inactive values"
      ],
      "reportStatus": "proposed-at-issue-time"
    },
    {
      "recommendationId": "rec-002",
      "kind": "unique-key",
      "patches": [
        {
          "op": "replace",
          "path": "/duplicates/uniqueBy",
          "value": ["id"]
        }
      ],
      "confidence": "high",
      "evidence": ["id has no nulls and no duplicates"],
      "reportStatus": "proposed-at-issue-time"
    }
  ]
}
```

Recommendation patch rules:

- each recommendation must have a stable `recommendationId`
- each recommendation must include one or more JSON Pointer style `patches`
- v1 should support only `replace` patches against known stack-plan fields
- multi-field suggestions must include every deterministic field that needs to change together
- patches must be validated as one set against the report's analyzed payload before any value is applied
- patch application is atomic: either every patch in the accepted recommendation applies, or none of them apply
- partial acceptance of one recommendation is not supported in v1; users who want only part of a recommendation must choose the edit path
- overlapping patches in the same recommendation are invalid unless they target the same path with the same value
- accepting multiple recommendations in one review batch is valid only when their patch paths do not conflict; conflicting batches must be rejected and returned to review
- accepting a recommendation applies its patches exactly into a new stack plan
- editing a recommendation uses the same target fields but stores the user-edited values in the new stack plan
- the advisory report should keep `reportStatus: "proposed-at-issue-time"` unless the implementation later writes an updated advisory report; the executable plan is the source of truth for accepted values

Report rules:

- `metadata.payloadId` must reference the deterministic stack payload that was analyzed when the report was produced.
- report recommendations are advisory and are not replayed directly.
- accepted or edited recommendations must be copied into deterministic fields such as `input.columns`, `schema.excludedNames`, `duplicates.uniqueBy`, or `duplicates.policy`.
- accepting or editing recommendations must mint a new stack-plan `payloadId`; the old report remains linked to the analyzed payload through `metadata.payloadId`.
- exact accepts should be recorded in both `acceptedRecommendationIds` and `recommendationDecisions`.
- edited accepts should be recorded only in `recommendationDecisions` with `decision: "edited"`.
- report retention should be independent from stack-plan retention.

Implication:

- Codex evidence can be audited without making replay depend on Codex availability
- implementation has a concrete report boundary instead of an implicit "suggestions" concept

#### Example: headerless assist

The strongest first Codex assist case is headerless CSV/TSV naming. For example, if deterministic analysis sees three positional fields:

```csv
1001,Alice,active
1002,Bob,inactive
```

Codex may propose:

```json
{
  "recommendationId": "rec-001",
  "kind": "headerless-columns",
  "patches": [
    {
      "op": "replace",
      "path": "/input/columns",
      "value": ["id", "name", "status"]
    },
    {
      "op": "replace",
      "path": "/schema/includedNames",
      "value": ["id", "name", "status"]
    }
  ],
  "evidence": [
    "column 1 is unique and numeric",
    "column 2 contains person-like text",
    "column 3 has repeated active/inactive values"
  ]
}
```

The user must accept or edit those names. Only the accepted names enter the replay plan:

```json
{
  "metadata": {
    "payloadId": "stack-payload-20260425T120300Z-e5f6a7b8",
    "derivedFromPayloadId": "stack-payload-20260425T120000Z-a1b2c3d4",
    "acceptedRecommendationIds": ["rec-001"],
    "recommendationDecisions": [
      {
        "reportArtifactId": "data-stack-codex-report-20260425T120500Z-d4c3b2a1",
        "recommendationId": "rec-001",
        "decision": "accepted"
      }
    ]
  },
  "input": {
    "format": "csv",
    "headerMode": "no-header",
    "columns": ["id", "name", "status"]
  },
  "schema": {
    "mode": "strict",
    "includedNames": ["id", "name", "status"],
    "excludedNames": []
  }
}
```

### 9. Replay and advisory artifacts should be different artifact classes

The rename cleanup research already distinguishes replayable execution plans from advisory analyzer reports.

`data stack` should likely follow the same split:

- stack record:
  - replayable
  - deterministic
  - safe to use as execution input
- Codex schema report:
  - advisory
  - not directly replayed unless accepted into a record or flags
  - useful for review and audit
- duplicate/key report:
  - diagnostic
  - may be embedded in dry-run output or exported separately
  - should not be confused with replayable execution input unless accepted into the stack record

Implication:

- users can keep Codex evidence without confusing it for a stack execution plan
- future artifact-retention prompts can treat replay records and advisory reports separately

## Recommended Implementation Plan Commitments

The next implementation plan should treat these as in-scope commitments:

- add `--dry-run` to direct `data stack`
- add `data stack replay <record>`
- define JSON stack-plan artifacts
- generate stack-plan artifacts from dry-run
- update interactive mode with the status-preview, write-now, dry-run-only, revise, and cancel flow
- add stack-plan retention prompts in interactive mode
- support post-success stack-plan auto-clean when the user declines keeping the applied plan
- support direct replay `--auto-clean` as an explicit flag that removes only the stack-plan JSON after successful replay
- keep diagnostic/advisory report retention separate from stack-plan retention
- validate replay records strictly before execution
- support output-path override at replay time
- include duplicate/key diagnostics in dry-run review
- add deterministic headerless column diagnostics for Codex-assisted naming
- define `data-stack-codex-report-<timestamp>Z-<uid>.json`
- add reviewed Codex assist for headerless columns, explicit exclusions, unique-key selection, duplicate policy, and schema drift explanation
- add explicit `--unique-by <name[,name...]>`
- add explicit `--on-duplicate preserve|report|reject`
- persist duplicate policy and selected unique keys in the replay record
- keep Codex recommendations optional, reviewed, and downstream of deterministic facts

Out of scope for that plan:

- automatic schema repair
- automatic row repair
- arbitrary JSON flattening
- schema-aware query workspace redesign
- broad generic `data replay`

## Resolved Questions

Resolved in this revision:

- replay command:
  - use `data stack replay <record>`
- first record format:
  - use JSON
- replay artifact identity:
  - include both `metadata.artifactId` and `metadata.payloadId`
- replay artifact timestamp:
  - include `metadata.issuedAt` as an ISO UTC timestamp
- direct dry-run artifact writing:
  - write a generated `data-stack-plan-<timestamp>Z-<uid>.json` by default and allow `--plan-output <path>` override
- interactive dry-run-only artifact writing:
  - offer the same generated default plan path first, with a custom destination option
- direct replay auto-clean:
  - support explicit `--auto-clean`, default false, and remove only the stack-plan JSON after successful replay
- source fingerprints:
  - store v1 size and mtime fingerprints when available, warn on mismatch by default, and allow a strict replay mode later if needed
- replay output path:
  - store `output.path` when known, allow `data stack replay <record> --output <path>` override, and require an output path at replay time if the record omits one
- duplicate reports:
  - embed bounded duplicate/key diagnostics in the stack plan, and allow a separate advisory report only for detailed or Codex-assisted review evidence
- unique-key candidate search:
  - detect single-column candidates by default and bounded two-column candidates under a documented cap
- duplicate-policy v1:
  - ship `preserve`, `report`, and `reject`; keep `keep-first` and `keep-last` out of v1 because they drop data
- duplicate/key handling:
  - include diagnostic and deterministic-control work in the next implementation plan
- Codex role:
  - use Codex for reviewed recommendations from deterministic diagnostics, not execution
- Codex report shape:
  - use `data-stack-codex-report-<timestamp>Z-<uid>.json` with recommendations tied to the analyzed stack `payloadId`
- Codex assist surfaces:
  - cover headerless columns, noisy exclusions, unique-key choice, duplicate policy, and schema drift
- recommendation application:
  - use stable recommendation ids plus atomic JSON Pointer style `replace` patches into known stack-plan fields
- payload lifecycle:
  - accepting or editing Codex recommendations creates a new stack-plan `payloadId` and records lineage through `derivedFromPayloadId`
- recommendation provenance:
  - use `recommendationDecisions` to record accepted and edited recommendation review decisions

The core replay, duplicate/key, and advisory-report contract is settled in this research. The linked implementation plan should keep those decisions as the source of truth for exact command naming, validation rules, and tests. The remaining open thread is the interactive Codex trigger UX described below.

## Follow-Up Direction

The remaining open question is not whether Codex can participate in `data stack`; that is settled. The open UX question is when interactive mode should ask for Codex help.

Current Phase 7 behavior:

- prepares deterministic stack status
- offers `Request Codex recommendations` beside final actions such as write and dry-run
- reviews recommendations and re-runs the status preview after accepted or edited recommendations

That works, but it feels late in the flow. The refined direction is the section 4 ASCII sketch:

- first prepare deterministic status
- only then decide whether diagnostics justify a Codex checkpoint
- keep `review with Codex`, `continue without Codex`, `revise setup`, and `cancel` inside that checkpoint
- after accepted or edited recommendations, apply them into deterministic plan fields and re-preview
- keep the final action menu focused on write, dry-run plan, destination change, setup revision, and cancel
- leave the direct CLI contract unchanged: `--codex-assist` remains valid only with `--dry-run`

Codex should be offered only when deterministic diagnostics suggest it can add value:

- headerless CSV/TSV using generated column names
- union-by-name output with extra or noisy columns
- exact duplicate rows
- candidate unique keys when no unique key is selected
- duplicate-key conflicts when a unique key is selected
- schema drift or schema mismatch context where a review explanation can help

This keeps the deterministic contract unchanged while making interactive Codex assist feel like a review helper instead of a final write action.

## Related Research

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-03-rename-cleanup-analyzer-report-artifact.md`
- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`

## Related Plans

- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-04-25-data-stack-plan-artifact-foundation.md`
- `docs/plans/jobs/2026-04-26-data-stack-diagnostics-dry-run-replay.md`
- `docs/plans/jobs/2026-04-26-data-stack-interactive-preview-and-codex-reports.md`
- `docs/plans/jobs/2026-04-26-data-stack-interactive-codex-and-guide-closeout.md`
