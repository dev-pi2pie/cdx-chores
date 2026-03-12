---
title: "Interactive template inline completion audit"
created-date: 2026-03-12
modified-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Clarify whether the remaining interactive rename custom-template UX gap is still a bug in the current prompt implementation or a separate feature track, and audit the rest of interactive mode for similar prompt patterns.

## Milestone Goal

Decide whether the next step should be:

- a narrow implementation follow-up on the current inline text prompt
- a broader prompt-system plan across interactive mode
- or no additional prompt work outside rename templates

## Key Findings

### 1. The current rename custom-template gap is now a feature gap, not the previous rerender bug

The rerender issue was caused by feeding a multiline prompt body into a single-line raw TTY renderer.
That problem is now separate from the remaining request.

What still does not exist:

- token-aware template completion while typing
- placeholder matching such as typing `sta` and completing toward `{timestamp}`
- cycling or browsing template tokens similar to path completion
- accepting a partially matched placeholder with `Tab` or arrow navigation

Current behavior for the rename custom-template entry is limited to:

- one-time help lines
- one dimmed suggested template line
- a single ghost suggestion that can be accepted wholesale with right arrow

That means the current state is best described as "inline ghost hint support" rather than "template autocomplete".

### 2. This gap is isolated to rename custom-template entry in the current interactive surface

The current interactive mode uses the inline path prompt for path entry and uses plain `input(...)` prompts for most other free-form values.

Interactive text-helper usage audit:

- `src/cli/interactive/rename.ts`
  - custom rename template is the only current caller of `promptTextWithGhost(...)`

Other interactive free-form prompts remain plain input prompts:

- rename
  - serial start
  - serial width
  - extension filters
  - recursive depth
- data preview / parquet preview
  - row counts
  - offsets
  - column lists
  - contains filters
- data query
  - SQL text
  - selected columns
  - filter values
  - group-by columns
  - order-by specs
- video
  - scale
  - gif width
  - gif fps

Implication:

- there is no broader "all interactive text prompts should already behave like path prompts" regression
- the rename template case is the only current prompt that is close enough to path-like token completion to justify dedicated inline-assist work

### 3. Path completion and template completion are similar in interaction shape but different in data model

The path prompt can reuse filesystem-derived candidates with a clear prefix-completion model.

Template entry needs a different candidate model:

- known placeholders such as `{prefix}`, `{timestamp}`, `{date}`, `{stem}`, `{uid}`, `{serial}`
- possible explicit timestamp variants
- possible parameterized serial forms
- static separators and literal text that must remain fully user-controlled

This means template assistance should not be implemented by trying to bend the path prompt logic directly onto template strings.

Better framing:

- reuse the raw TTY interaction style
- build a template-specific candidate source and matching strategy

### 4. Not every plain text prompt should be upgraded

The audit does not support a broad conversion of all text prompts to inline ghost/autocomplete behavior.

Prompts that are currently fine as plain input:

- numeric prompts
- regex prompts
- extension-list prompts
- one-off filter values

Prompts that may deserve future, separate research but are not the same feature:

- SQL entry in `data query`
  - likely wants history, editor mode, or multiline support more than ghost placeholders
- column-list prompts in data preview/query
  - likely want schema-aware completion rather than generic ghost text

Recommendation:

- keep this follow-up scoped to rename template entry
- avoid broad prompt-system churn unless another concrete UX gap appears

## Implications or Recommendations

### Recommended next step

Create a focused implementation plan for "interactive rename template inline completion" as a follow-up feature.

That plan should treat the following as first-class requirements:

- typing part of a placeholder token should surface matching template candidates
- `Tab` should behave like right arrow and accept only the current ghost segment once
- right arrow should continue to accept the current ghost completion
- the prompt must remain single-line and must not reintroduce multiline rerender artifacts
- literals, separators, and mixed template text must stay editable without forcing placeholder-only mode
- already accepted segments should remain stable while the prompt predicts only the next candidate token
- up/down navigation should feel closer to sibling path searching than a separate menu

### Recommended implementation boundary

Prefer a template-specific prompt helper layered on the current raw TTY text prompt behavior.

Avoid:

- reusing path suggestion resolution directly
- converting every `input(...)` prompt to the new helper
- mixing SQL or schema-aware prompt ideas into this work

### Suggested initial candidate set

For a first feature pass, the candidate registry should likely include:

- `{prefix}`
- `{timestamp}`
- `{date}`
- `{stem}`
- `{uid}`
- `{serial}`

Explicit timestamp variants should stay behind a narrower prefix rather than appearing in the primary candidate list.

Recommended direction:

- primary candidate list stays small and core-token-oriented
- once the user narrows into the timestamp family, for example with `{timestamp` or `{timestamp_`, timestamp-family variants can be cycled like sibling path candidates

Mock direction:

```text
Template {t
ghost -> {timestamp}
up/down cycles:
  {timestamp}
  {timestamp_local}
  {timestamp_utc}
  {timestamp_local_iso}
  {timestamp_utc_iso}
  ...
tab/right accepts the current token once
```

```text
Template {timestamp}-{
ghost -> {stem}
up/down cycles:
  {stem}
  {serial}
  {uid}
tab/right accepts only the current next token
```

### Recommended sibling-cycle scope

Cycle within the current token family once the prefix is narrow enough.

Recommended behavior:

- `{t` can still resolve across root-level token matches such as `{timestamp}`
- `{timestamp_` should cycle only within timestamp-family variants
- editing back from `{timestamp_` to a broader prefix such as `{t` should widen the candidate scope again

Reason:

- this matches the sibling-path-searching mental model more closely
- it avoids noisy jumps across unrelated token families once intent is already narrowed

### Recommended token-start detection

Begin suggestions only after `{` is typed.

Recommended behavior:

- plain text such as `tim` should not trigger template-token suggestions
- token text such as `{tim` can suggest `{timestamp}`

Reason:

- it avoids hijacking normal literal text entry
- it keeps the feature explicitly token-oriented
- it reduces accidental completions for ordinary filename words

### Recommended replacement boundary

Accept should replace the current partial token fragment in place.

Recommended behavior:

- `{tim` + accept => `{timestamp}`
- `{timestamp}-{st` + accept => `{timestamp}-{stem}`
- the same rule should apply consistently after separators such as `-`, `_`, and `.`

Replacement rule:

- replace only from the active token start `{` through the current token fragment
- never rewrite already accepted earlier segments
- keep separators and literal text outside the active token untouched

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Related Research

- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`

## References

- [^interactive-rename]: `src/cli/interactive/rename.ts`
- [^text-inline]: `src/cli/prompts/text-inline.ts`
- [^path-inline]: `src/cli/prompts/path-inline.ts`
- [^interactive-data-query]: `src/cli/interactive/data-query.ts`
- [^interactive-data]: `src/cli/interactive/data.ts`
- [^interactive-video]: `src/cli/interactive/video.ts`
