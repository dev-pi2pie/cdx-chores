---
title: "Data stack replay records and Codex schema assist"
created-date: 2026-04-24
status: draft
agent: codex
---

## Goal

Explore whether `data stack` should gain replayable stack records and a later Codex-assisted schema suggestion workflow, without blurring the deterministic `data stack` command contract.

## Why This Research

The current `data stack` direction now has a clearer deterministic follow-up path:

- mixed-source interactive input
- strict `jsonl` input
- narrow `.json` input as one top-level array of objects
- opt-in `--union-by-name`
- explicit `--exclude-columns <name,name,...>`

That still leaves an adjacent workflow unowned:

- preserving a reviewed stack setup for replay
- allowing Codex to suggest noisy exclusions or possible schema repairs
- keeping those suggestions reviewable instead of silently mutating stack output

The repo already has related patterns:

- `rename` has replayable plan artifacts that can be applied later
- `data extract` has reviewed source-shape behavior for shaped extraction
- Codex-assisted flows generally propose reviewed changes rather than silently applying hidden transformations

This research should decide whether `data stack` needs a similar artifact boundary.

## Current State

`data stack` currently has no replayable stack-record contract.

Current and planned deterministic behavior is expressed through command options:

- raw sources
- pattern and traversal options
- input format
- output format and output path
- schema mode such as strict matching or `--union-by-name`
- explicit exclusions such as `--exclude-columns`

The current follow-up plan only records Codex schema suggestions as deferred reviewed-assist work. It does not define:

- a stack record file format
- a replay command
- artifact lifecycle or retention rules
- how Codex suggestions become deterministic replayable input

## Scope

This research covers:

- whether a replayable stack record should exist
- what belongs in that record
- whether the replay surface should be a command such as `data stack replay <record>`
- how explicit exclusions and union-by-name should be represented
- how Codex schema suggestions could produce reviewed recommendations
- how to keep Codex suggestions separate from deterministic stack execution

This research does not implement:

- replay command wiring
- Codex schema suggestion calls
- source-shape artifact changes
- rename artifact changes
- automatic stack-time repair

## Direction To Explore

### 1. Deterministic stack records should be separate from Codex suggestions

A replayable stack record should describe a deterministic stack run.

Likely record contents:

- record version
- command family and action
- raw sources
- pattern
- recursive and max-depth settings
- input format
- header mode
- columns for headerless input, if any
- schema mode:
  - strict
  - union-by-name
- explicit exclusions
- output format
- optional output path

Codex suggestions should not be required to replay the record.

Implication:

- a user can review, commit, and replay the record without Codex availability
- Codex remains an authoring aid, not an execution dependency

### 2. Codex schema assist should propose changes, not apply them silently

Possible future Codex suggestions:

- noisy columns or keys to exclude
- likely misspelled duplicate columns or keys
- possible rename or repair suggestions
- schema-drift summary before a user chooses union-by-name

Recommended contract:

- Codex suggestions produce a reviewed proposal
- accepted suggestions become explicit deterministic options or a replayable record
- no silent auto-exclude
- no silent auto-repair

Implication:

- the final stack output is explainable from CLI flags or a record file
- Codex behavior can improve without changing deterministic replay semantics

### 3. Replay and advisory artifacts should be different artifact classes

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

Implication:

- users can keep Codex evidence without confusing it for a stack execution plan
- future artifact-retention prompts can treat replay records and advisory reports separately

## Open Questions

- Should the replay command be `data stack replay <record>` or a broader `data replay <record>`?
- Should output path be required in the record, optional, or overridable at replay time?
- Should records store relative paths as entered, resolved paths, or both?
- Should records include source fingerprints or only source paths?
- Should accepted Codex suggestions be written back into the same record or a separate reviewed record?
- Should the first record format be JSON, YAML, or another repo-standard artifact format?
- Should interactive mode ask whether to save a stack record after review, before write, or after a successful write?

## Related Research

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-03-rename-cleanup-analyzer-report-artifact.md`
- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`

## Related Plans

- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
