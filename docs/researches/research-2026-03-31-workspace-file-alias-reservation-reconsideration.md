---
title: "Workspace file alias reservation reconsideration"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Re-evaluate whether the logical name `file` should remain reserved in workspace mode after the first shipped `data query` workspace implementation exposed an interactive UX edge case for backend objects literally named `file`.

## Milestone Goal

Answer one narrow follow-up question without reopening the broader workspace contract:

- should workspace mode allow `file` as an explicit relation alias
- and if so, should the product keep one relation-binding surface rather than introducing a separate `--workspace` flag

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/research-2026-03-30-interactive-data-query-followup-ux.md`
- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-31-data-query-workspace-alias-followup.md`
- `docs/plans/plan-2026-03-31-data-extract-duckdb-file-parity.md`

Status note:

- the follow-up implementation tracked in `docs/plans/plan-2026-03-31-data-query-workspace-alias-followup.md` has now landed
- the shipped result keeps implicit `file` only in single-source mode, allows explicit workspace `file`, keeps `--relation` as the only workspace-binding surface, and supports comma-separated `--relation` bundles

## Problem

The first shipped workspace flow keeps `file` reserved in workspace mode, which matched the original contract. That contract avoided collisions with the legacy single-source logical table name `file`.

However, an interactive workspace flow can currently surface this awkward sequence:

1. a backend object is literally named `file`
2. interactive workspace binding uses the backend object name as the default alias
3. the validator rejects that alias because `file` is reserved in workspace mode

This creates a self-invalidating prompt:

- the user is shown `file` as the default
- the same flow then rejects `file`

That raised a follow-up question:

- should the product keep reserving `file` in workspace mode
- or should workspace mode deliberately free `file` while preserving the single-source compatibility alias

## Key Findings

### 1. The UX problem is real, but it also exposes a product preference question

The interactive defaulting behavior currently treats the backend object name as the default alias in workspace mode. That works for most sources, but it breaks down when the selected backend object is literally named `file`.

Implication:

- the shipped UX is confusing for this edge case
- and the confusion also exposes a broader product preference about whether backend object names should remain directly usable in workspace mode

### 2. Freeing `file` in workspace mode is a real contract change, but it can still be coherent

The broader workspace contract deliberately preserved:

- implicit `file` only for single-source compatibility mode
- explicit relation names for workspace mode

If workspace mode also permits `file` as an ordinary explicit alias, then the meaning of `file` changes across modes:

- sometimes it is an implicit compatibility alias
- sometimes it is just another explicit workspace alias

Implication:

- documentation must state the difference very clearly
- interactive recovery guidance must distinguish implicit `file` from explicit `file`
- Codex prompt language must continue to rely on mode, not token spelling alone

### 3. Allowing `file` directly in workspace mode better preserves backend-name fidelity

The original workspace contract already allowed a backend object named `file` through rebinding, for example:

```text
--relation f=file
```

But if the product preference is that backend object names should remain usable directly whenever possible, then forcing `f=file` is artificial friction rather than essential clarity.

Implication:

- the current contract is not functionally blocked
- but it is not the only coherent contract
- permitting `--relation file` or `--relation file=file` in workspace mode is a legitimate alternative if documented explicitly

### 4. One flag surface remains better than introducing a separate `--workspace` flag

The current product already has a usable relation-binding surface:

- repeatable `--relation <binding>`
- bare binding such as `--relation users`
- explicit alias binding such as `--relation events=analytics.events`

That surface can expand without introducing a separate `--workspace` flag.

Recommended direction:

- keep `--relation` as the only workspace-binding flag
- continue to support repeatable flags
- optionally allow comma-separated bundles in one `--relation` value later, such as:
  - `--relation users,file`
  - `--relation users,events=analytics.events`

Implication:

- the CLI keeps one concept and one binding flag
- future UX improvement can happen inside `--relation` rather than adding another parallel surface

### 5. Exact source matching and explicit alias rules should still stay intact

Freeing `file` in workspace mode does not require relaxing the other relation-binding rules.

The product can still keep:

- exact backend source matching
- explicit aliasing when source selectors are not valid SQL identifiers
- simple SQL identifier rules for aliases

Implication:

- `--relation file` can become valid in workspace mode
- `--relation analytics.events` should still not be the preferred bare form if alias identifiers must stay simple
- `--relation events=analytics.events` remains the explicit and stable way to bind dotted selectors

## Recommendation

Revise the workspace contract deliberately:

Instead:

- keep `file` as the implicit compatibility alias in single-source mode
- free `file` as an explicit relation name in workspace mode
- keep `--relation` as the only workspace-binding surface
- do not introduce a separate `--workspace` flag
- keep exact source matching and explicit aliasing rules where needed

## Suggested Follow-up

The next small follow-up should update both parser and prompt behavior to match the revised contract.

Recommended direction:

- allow `file` as an explicit workspace alias in both direct CLI and interactive mode
- keep default alias equal to source name when valid
- continue to require explicit aliasing for dotted selectors where the alias must remain a simple SQL identifier
- consider allowing comma-separated bundles under `--relation` instead of adding a new workspace flag

Deferred future consideration:

- if the product later wants less manual workspace setup for dotted selectors such as `analytics.events`, treat alias suggestion as a separate UX slice rather than part of this contract correction

## Resolved Follow-up Questions

- Dotted backend selectors such as `analytics.events` should continue to require explicit user choice in interactive mode rather than auto-defaulting to a cleaned alias like `events`.
  Rationale:
  keep alias behavior deterministic and avoid introducing a second UX policy change inside the same contract-fix slice.

- Comma-separated `--relation` bundles should land now under the same `--relation` surface rather than waiting for a later flag redesign.
  Rationale:
  they expand the existing binding surface without changing the workspace model or introducing a second workspace flag.
