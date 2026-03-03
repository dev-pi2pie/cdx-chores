---
title: "Codex analyzer-assisted rename cleanup suggestions"
created-date: 2026-03-03
status: in-progress
agent: codex
---

## Goal

Define the first practical contract for Codex analyzer-assisted `rename cleanup` in interactive mode without blurring deterministic cleanup and analyzer suggestion into one opaque path.

## Status Note

This research remains in progress while analyzer-assisted cleanup is still deferred from implementation and tracked in a dedicated follow-up plan.

## Milestone Goal

Set a narrow first-pass design that:

- keeps `rename cleanup` deterministic by default
- uses Codex only to suggest cleanup settings
- keeps user confirmation explicit before any cleanup run
- avoids file-content reading in the initial analyzer-assisted pass

## Related Plans

- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Key Findings

### 1. Filename lists are the right first analyzer input

The cleanup problem is primarily about filename pattern recognition:

- timestamps
- dates
- serial-like counters
- existing `uid-<token>` fragments

That means the first analyzer-assisted pass does not need file contents.

Recommended first-pass input:

- bounded filename lists only
- preferably basename-focused
- optionally enriched with light local grouping or counts before sending to Codex

Implication:

- the first analyzer pass should not read file contents
- this keeps privacy, cost, and runtime complexity lower

### 2. Analyzer output should be structured suggestions, not free-form prose

If Codex returns only open-ended prose, the interactive flow becomes hard to map back into the deterministic cleanup controls.

Recommended first-pass response shape:

- `recommended_hints`
- `recommended_style`
- `recommended_timestamp_action`
- `confidence`
- `reasoning_summary`

Implication:

- the analyzer-assisted path should produce machine-usable suggestions that can prefill or seed the normal cleanup flow

### 3. Codex should suggest, never silently decide

Cleanup can materially rename many files, so analyzer output should not auto-run.

Recommended interaction rule:

- Codex proposes
- user accepts or edits
- deterministic cleanup executes

Implication:

- analyzer assistance should be recommendation-only in the first implementation

### 4. The analyzer-assisted step should stay visibly separate from normal deterministic cleanup

Hiding Codex inside the default cleanup prompt flow would make the product harder to reason about.

Recommended interaction entry:

- `Suggest cleanup hints with Codex?`

If accepted:

1. collect a bounded filename sample from the current scope
2. send it to Codex
3. show the suggestion summary
4. let the user accept or edit the proposed cleanup settings
5. continue with normal deterministic cleanup

Implication:

- the default path remains explicit manual hint selection
- analyzer assistance becomes an opt-in helper, not a hidden dependency

### 5. Local preprocessing should reduce noisy payloads before Codex sees them

Large directories can produce repetitive filename lists.

Recommended local preprocessing:

- cap the total number of filenames sent
- group obviously repeated shapes when feasible
- send representative samples plus counts when that helps

Example direction:

```json
{
  "scope": "directory",
  "file_count": 84,
  "sample_names": [
    "Screenshot 2026-03-02 at 4.53.04 PM.png",
    "Screenshot 2026-03-02 at 4.55.10 PM.png",
    "Meeting Notes 2026-03-02.txt",
    "scan_003.pdf"
  ]
}
```

Implication:

- local grouping/sampling should happen before the Codex request layer

### 6. Fallback behavior must remain deterministic and explicit

Analyzer-assisted cleanup should degrade cleanly when:

- Codex is unavailable
- the request fails
- no clear pattern is detected

Recommended fallback:

- show a short failure or low-confidence note
- continue with the existing manual deterministic cleanup flow

Implication:

- analyzer assistance should not block cleanup usage

## Implications or Recommendations

Recommended first implementation boundary:

- interactive-only first
- filename-list analysis only
- bounded sample / grouping before request
- structured suggestion response
- explicit accept/edit step before deterministic cleanup

Recommended first-pass non-goals:

- no file-content analysis
- no arbitrary regex generation in the first version
- no automatic execution from analyzer output
- no hidden analyzer invocation during normal cleanup

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`
- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## References

- `src/cli/actions/rename/cleanup.ts`
- `src/cli/actions/rename/codex.ts`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
