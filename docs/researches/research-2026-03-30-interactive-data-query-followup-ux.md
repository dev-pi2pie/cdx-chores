---
title: "Interactive data query follow-up UX"
created-date: 2026-03-30
modified-date: 2026-03-30
status: draft
agent: codex
---

## Goal

Refine the next interactive `data query` UX direction around `formal-guide` result limiting, filter guidance, and safer session-exit guidance, while keeping the current flow intentionally smaller than a full query wizard.

This research draft records the currently preferred direction, but implementation planning and execution are still pending.

## Key Findings

### 1. `formal-guide` should keep one optional SQL-level `limit`, but should not add slice or range-style result controls

The current implementation in `src/cli/interactive/data-query/sql/formal-guide.ts` gathers:

- selected columns or `all`
- simple filters
- optional aggregate summary intent
- optional ordering

That boundary was intentional, but adding one optional `limit` prompt still fits the mode.

Why this is acceptable:

- it remains a real SQL semantic rather than a display tweak
- it is still much smaller than adding joins, expressions, nested conditions, or computed fields
- it covers a common exploratory need without forcing users into `manual`

Recommended contract:

- add one optional prompt after ordering
- use friendly wording such as `Maximum result rows (optional)`
- compile it directly into SQL as `limit n`
- keep it optional so the current no-limit behavior remains the default
- do not add slice, offset, page, or row-range prompts in `formal-guide`

Why slice/range should stay out:

- it starts to overlap with a future pagination or record-browsing model
- it depends too heavily on explicit stable ordering to be trustworthy
- it would make `formal-guide` feel more like a partial query builder than a focused structured helper

### 2. `limit` and `Rows to show` must stay separate concepts

The current output step in `src/cli/interactive/data-query/execution.ts` already asks `Rows to show (optional)` for table output.

That setting controls terminal rendering only.

The new `formal-guide` limit should mean something different:

- `limit` narrows the SQL result set itself
- `Rows to show` bounds only terminal table rendering

Implication:

- table output may use both settings at once
- JSON stdout and file output should respect the SQL `limit`
- the existing table-output question should remain unchanged

### 3. The next `formal-guide` improvement after `limit` should be better filter guidance, not broader query-power features

The current filter flow is still intentionally generic:

- choose column
- choose operator
- enter value

That is a reasonable baseline, but it is the part of `formal-guide` with the clearest UX headroom.

Recommended improvement direction:

- make filter choices more type-aware when column types are known
- improve the wording of filter operators for non-SQL-first users
- add a few common filter intents before adding heavier query controls

Good candidate additions:

- text-focused matching such as `starts with` and `ends with`
- null checks such as `is null` and `is not null`
- emptiness checks where they are meaningfully distinct from null
- narrower boolean-friendly choices such as `is true` and `is false`

What should still stay out of scope:

- `or` groups
- nested conditions
- freeform expressions
- offset/slice/range controls

Reason:

- better filters improve the main exploratory path without changing `formal-guide` into a partial SQL editor
- advanced conditional logic should still route to `manual`

### 4. Interactive `data query` needs a short width-aware abort notice

The current flow has `Back` and `Cancel` at menu entry, but once the user enters `data query`, most prompt chains are linear.

That makes a lightweight session-exit notice worthwhile even before any deeper backtracking work happens.

The runtime already exposes terminal width through `runtime.stdout` TTY properties, matching the same style used elsewhere for width-sensitive rendering.

Recommended notice strategy:

- render one short informational line near the start of interactive `data query`
- adapt the wording to available terminal width
- keep the copy strictly about aborting the current session

Suggested wording tiers:

- narrow terminals: `Ctrl+C to abort.`
- medium terminals: `Press Ctrl+C to abort.`
- wider terminals: `Press Ctrl+C to abort this session.`

### 5. Full mid-flow `Back` support should still wait

The current interactive query flow is a sequence of prompt calls rather than a shared wizard controller.

Adding `Back` at every step would require:

- a shared navigation contract across prompt stacks
- restoration of prior answers
- consistent handling for `back`, `cancel`, and hard abort paths

That is larger and riskier than the immediate UX gains needed here.

Recommendation:

- keep the immediate follow-up small
- add the abort notice now
- continue using late-stage revise loops where they already exist

## Recommendations

### Recommended next slice

1. Add one optional SQL-level `limit` prompt to `formal-guide`.
2. Keep `Rows to show (optional)` exactly where it is today.
3. Improve `formal-guide` filter guidance before adding broader query-power features.
4. Add a width-aware abort notice early in interactive `data query`.
5. Keep broader backtracking work out of this slice.

### Decision updates

#### 1. `limit` should align with the current preview-style table behavior

The generated SQL review step should surface the chosen SQL `limit` explicitly when it is present.

When no SQL-level `limit` is chosen:

- table output should continue to follow the existing bounded preview-style behavior
- JSON stdout should continue to have no implicit SQL-level limit
- file output should continue to have no implicit SQL-level limit

Implication:

- `formal-guide` should not silently inject a SQL `limit` just because table mode is bounded
- the bounded table preview remains an execution/output behavior
- JSON stdout should remain separate from file output and should not prompt for a destination path

Recommended wording split:

- at SQL review:
  - when `limit` is present: `SQL limit: <n>`
  - when `limit` is absent: show nothing extra about limit yet
- at output review or confirmation:
  - for table output with no SQL `limit`: `Table preview rows: default bounded`
  - for table output with explicit preview rows: `Table preview rows: <n>`
  - for table output with SQL `limit`: also keep `SQL limit: <n>`

Reason:

- before output mode is chosen, the CLI should not imply that all outputs are preview-bounded
- after table mode is chosen, the preview-style bounded behavior should be made explicit

Decision:

- keep `Table preview rows: default bounded`

Why:

- it is the clearest and least ambiguous wording
- it makes the bounded table-preview contract visible without implying a SQL-level limit

#### 2. Filter improvements should ship as one coherent follow-up slice

The recommended filter additions should land together rather than as isolated piecemeal tweaks.

Preferred first-pass filter set:

- text matching:
  - `contains`
  - `starts with`
  - `ends with`
- null checks:
  - `is null`
  - `is not null`
- boolean-specialized choices:
  - `is true`
  - `is false`
- emptiness checks where useful:
  - `is empty`
  - `is not empty`

Reason:

- these additions form one coherent "guided filter" story
- shipping only one category first would leave the flow feeling uneven
- this is still materially smaller than adding grouped logic or expression-building

#### 3. Width-aware interactive notices should become a shared global pattern later

The first implementation can begin in interactive `data query`, but the width-tier wording strategy should be treated as a reusable global interactive-notice pattern rather than a one-off local rule.

Practical direction:

- start with `data query`
- keep the implementation small
- extract or standardize only after the wording and width cutoffs feel correct in real use

Recommended first-pass width cutoffs:

- width `< 24`: `Ctrl+C to abort.`
- width `24-39`: `Press Ctrl+C to abort.`
- width `>= 40`: `Press Ctrl+C to abort this session.`

Reason:

- the tiers follow the actual message lengths with a small safety margin
- the shortest variant remains usable in narrow terminals
- the wider variant stays readable without wrapping in normal TTY conditions

#### 4. If backtracking is added later, it should begin at major checkpoints only

The safest first backtracking model is checkpoint-based rather than prompt-by-prompt.

Recommended checkpoints:

- mode selection
- SQL review / execution confirmation
- output selection

Why this boundary:

- checkpoint navigation is understandable to users
- it avoids restoring every intermediate prompt answer one field at a time
- it fits the current flow architecture better than fully general prompt history

Mock behavior:

Example A. From SQL review:

1. user completes `formal-guide`
2. CLI shows generated SQL
3. prompt: `Execute this SQL?`
4. if user chooses `Revise`, prompt:
   - `Edit formal-guide answers`
   - `Change mode`
   - `Cancel`

Example B. From output selection:

1. user confirms SQL execution
2. CLI shows output choices
3. if user selects a `Back` or `Revise` action here, prompt:
   - `Change output settings`
   - `Back to SQL review`
   - `Cancel`

Example C. From mode selection:

1. user reaches `Choose mode`
2. if later they back out from SQL review, they can return to:
   - `manual`
   - `formal-guide`
   - `Codex Assistant`
3. they do not step backward through every prior source-shape or header-review prompt unless a future larger workflow explicitly supports that

Recommended first-pass scope:

- apply the checkpoint model to all three query authoring modes
- keep the checkpoint locations shared
- keep one consistent action layout across modes
- keep the action labels mode-specific where needed

Suggested mode-specific review actions:

- `manual`:
  - `Edit SQL`
  - `Change mode`
  - `Cancel`
- `formal-guide`:
  - `Edit formal-guide answers`
  - `Change mode`
  - `Cancel`
- `Codex Assistant`:
  - `Revise intent`
  - `Regenerate SQL`
  - `Change mode`
  - `Cancel`

Reason:

- users should not need to learn a different backtracking model per mode
- the shared checkpoint structure provides consistency without forcing identical mode internals

Decision:

- keep both `Revise intent` and `Regenerate SQL` for `Codex Assistant`

Why:

- they represent different user intents
- the distinction already fits the current `Codex Assistant` interaction model
- combining them into one action would remove a useful recovery path

Decision:

- use one standardized checkpoint-review layout across all three `data query` interactive modes

Recommended layout rule:

- primary revise action first
- secondary mode-specific recovery action second when applicable
- `Change mode` next
- `Cancel` last

Why:

- the user should not need to relearn navigation behavior after switching between `manual`, `formal-guide`, and `Codex Assistant`
- consistent ordering improves scan speed and trust during revision flows
- shared structure still allows each mode to keep the action names that best match its authoring model

### Suggested prompt wording

For the new `formal-guide` field:

- `Maximum result rows (optional)`

For the early interactive notice:

- narrow: `Ctrl+C to abort.`
- medium: `Press Ctrl+C to abort.`
- wide: `Press Ctrl+C to abort this session.`

### Documentation follow-up guidance

If the implementation lands, the usage guide should be updated in `docs/guides/data-query-interactive-usage.md`.

Wording caution:

- do not describe the new `limit` prompt or richer filter behavior as already shipped until the implementation actually lands
- avoid vague stability wording such as `stable version` when the guide really means `current shipped behavior`
- prefer explicit wording such as `Current interactive flow` or `As of vX.Y.Z` only when tied to the actual released behavior

## Remaining Open Questions

- none for this follow-up draft

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`

## Related Plans

- `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`

## References

- `src/cli/interactive/data-query/index.ts`
- `src/cli/interactive/data-query/sql/formal-guide.ts`
- `src/cli/interactive/data-query/execution.ts`
- `src/cli/data-query/render.ts`
- `docs/guides/data-query-interactive-usage.md`
