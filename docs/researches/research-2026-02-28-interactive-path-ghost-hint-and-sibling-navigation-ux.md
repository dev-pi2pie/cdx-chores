---
title: "Interactive path ghost hint and sibling navigation UX research"
created-date: 2026-02-28
status: draft
agent: codex
---

## Goal

Evaluate how the interactive path prompt should evolve beyond the current MVP ghost-hint behavior, with particular focus on same-level path navigation and better keyboard semantics for sibling switching.

## Milestone Goal

Define a more capable input-first path prompt UX that preserves the current shell-like typing model while improving navigation between sibling candidates and clarifying how ghost hints should interact with arrow keys.

## Key Findings

### 1. The current prompt already has a clear input-first foundation

The current path prompt implementation in `src/cli/prompts/path-inline.ts` already provides:

- direct typing as the primary interaction
- dimmed ghost-suffix rendering for the best suggestion
- `Tab` to accept/cycle suggestions
- `Right Arrow` to accept the current ghost suffix
- `Left Arrow` to jump back to the previous path segment boundary

This means the next UX step does not require a fresh prompt model. It requires refinement of navigation behavior inside the existing model.

### 2. `Up` and `Down` are currently explicit no-ops

The current implementation handles `Up Arrow` and `Down Arrow` as an intentional MVP no-op:

- no history behavior
- no sibling navigation behavior
- prompt simply re-renders without changing the input

This leaves useful keyboard space unassigned, especially for users who expect arrow keys to browse nearby filesystem candidates.

### 3. Sibling navigation is a better fit than shell-history behavior for this prompt

For a path-entry prompt, `Up` / `Down` history is less valuable than same-level path navigation.

Example intent:

- user types `./docs/re`
- prompt identifies sibling candidates under `./docs/`
- `Up` / `Down` moves among candidates such as `README.md`, `researches/`, `reports/`

This keeps navigation anchored to the current directory level instead of introducing unrelated command-history semantics.

### 4. Sibling navigation needs a stricter model than current `Tab` cycling

The existing `Tab` behavior cycles full replacements derived from the suggestion list. That is useful, but it does not fully answer these questions:

- what counts as the current "sibling set"
- whether navigation should operate on the current segment only or the whole suffix
- whether ghost hints should update immediately when moving among siblings
- whether directories and files should be mixed in the same sibling cycle

Without explicit rules, adding `Up` / `Down` could make the prompt feel unpredictable.

### 5. Ghost-hint visibility still has room for refinement

The current ghost hint is a single best-suggestion suffix. That works for the MVP, but sibling navigation raises further questions:

- should the ghost hint always represent the currently selected sibling
- should a selected sibling be considered "committed input" or still just a suggestion
- should segment-local sibling navigation visually differ from plain ghost suffixing
- should directory siblings be emphasized differently from files

These are UX decisions, not just keybinding changes.

## Implications or Recommendations

### Recommendation A. Treat `Up` / `Down` as sibling-navigation keys, not history keys

The best next experiment is:

- `Up Arrow`: previous sibling candidate within the current path segment scope
- `Down Arrow`: next sibling candidate within the current path segment scope

This matches the user's mental model more closely than command history inside a file-path prompt.

### Recommendation B. Define sibling scope at the current editable segment

Recommended initial rule:

- split the typed path into parent path + current segment prefix
- resolve candidates only within that parent path
- cycle among entries whose names match the current segment prefix
- rewrite only the current segment plus any required trailing slash

This keeps navigation local and prevents surprising rewrites of earlier path segments.

### Recommendation C. Keep `Tab` and arrow keys distinct

Recommended role split:

- `Tab`: accept the current best completion or cycle the general suggestion set
- `Right Arrow`: accept the current ghost suffix
- `Left Arrow`: move to parent segment boundary
- `Up` / `Down`: browse sibling candidates for the current segment

This preserves the current shell-like completion model while giving arrows a navigation-specific job.

### Recommendation D. Research visual state before implementation

Before coding, define how the prompt should render these states:

- plain typed input with passive ghost hint
- sibling-selected candidate
- accepted completion
- directory candidate versus file candidate

If these states are not visually distinct enough, navigation may feel ambiguous.

## Open Questions

- Should `Up` and `Down` wrap around at the ends of the sibling list, or stop and beep?
- Should sibling navigation work when the current segment prefix is empty, such as `./docs/`?
- When a sibling candidate is selected with arrows, is it immediately written into the input, or previewed as a ghost state first?
- Should directories sort before files during sibling navigation?
- Should hidden entries participate in sibling navigation only when hidden-file suggestions are enabled globally?
- How should `Tab` cycling interact with an active sibling-navigation state?

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## Related Research

- `docs/researches/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`

## References

- `src/cli/prompts/path-inline.ts`
- `docs/guides/interactive-path-prompt-ux.md`
