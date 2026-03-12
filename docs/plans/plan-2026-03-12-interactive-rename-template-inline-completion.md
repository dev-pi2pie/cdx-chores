---
title: "Interactive rename template inline completion"
created-date: 2026-03-12
status: draft
agent: codex
---

## Goal

Add token-aware inline completion to the interactive rename custom-template prompt so placeholder entry behaves more like the current inline path prompt, while preserving single-line editing and predictable literal-text entry.

## Why This Plan

The current interactive rename custom-template entry has already been upgraded from a plain multiline prompt body to a single-line inline prompt with a static helper block and one suggested ghost template.

That is enough for hinting, but it does not yet provide the behavior users expect from the project’s richer interactive prompts:

- typing part of a placeholder token does not narrow toward matching template tokens
- `Tab` does not accept the current token suggestion segment the way the user expects
- up/down navigation does not behave like sibling path searching for related template candidates
- timestamp-family variants are documented, but the prompt does not guide users through them interactively

This is now a focused feature request, not a bug fix.
The research audit also confirmed that this gap is isolated to the rename custom-template entry rather than the whole interactive prompt surface.

## Current State

- `src/cli/interactive/rename.ts` uses `promptTextWithGhost(...)` for the custom-template branch.
- `src/cli/prompts/text-inline.ts` supports:
  - one-time help lines
  - one dimmed helper line for a suggested template
  - a single ghost suffix accepted by right arrow
- `src/cli/prompts/path-inline.ts` already has richer inline behavior for:
  - ghost acceptance
  - `Tab` completion/cycling
  - sibling-style candidate browsing with arrow keys
- there is no template-specific candidate engine yet
- there is no token-aware completion boundary for `{...}` placeholders

## User Experience Targets

- The prompt remains a single-line active input with one-time static helper text above it.
- The first implementation keeps the current append/backspace editing model for inline text prompts:
  - no general cursor movement
  - no mid-string insertion workflow outside the current trailing text
- Suggestions begin only after `{` is typed.
- Accept behavior is token-local:
  - `Tab` behaves like right arrow
  - accept only inserts the current ghost token segment once
  - accept replaces the active trailing token fragment in place
- Already accepted earlier segments remain untouched because completion operates only on the current trailing token fragment.
- Separators and literal text stay editable without forcing placeholder-only mode.
- Up/down navigation behaves like sibling path searching:
  - broad prefixes can browse broad candidate siblings
  - narrowed prefixes such as `{timestamp_` stay within the timestamp family
- The primary candidate list stays small:
  - `{prefix}`
  - `{timestamp}`
  - `{date}`
  - `{stem}`
  - `{uid}`
  - `{serial}`
- Explicit timestamp and date variants appear only after the user narrows into the corresponding family.
- The prompt must not reintroduce multiline rerender duplication or noisy candidate jumps.

## In Scope

- add a template-specific inline completion model for the interactive rename custom-template prompt
- extend the existing inline text prompt helper or add a nearby helper that supports token-aware template candidates
- support token-local accept semantics for right arrow and `Tab`
- support sibling-style candidate navigation with up/down arrows
- add timestamp-family narrowing behavior
- add date-family narrowing behavior
- add focused regression tests for token replacement, candidate narrowing, and keyboard behavior
- update user-facing docs for the interactive custom-template prompt behavior and key controls if the final UX changes what users can do in practice
- align status metadata only for docs directly owned by this feature when implementation is completed
- document the implementation with a job record after behavior lands

## Out of Scope

- converting other plain text prompts to inline template completion
- reusing path suggestion resolution directly for templates
- changing general rename template semantics or placeholder contracts
- redesigning SQL, regex, numeric, or column-list prompts
- broad menu or command-flow changes in interactive mode
- adding a full-screen TUI surface or alternate-screen UI for template entry
- adding general cursor movement or arbitrary mid-string editing to the inline text prompt in this first pass

## Proposed Design Direction

### Template candidate model

Introduce a template-specific candidate registry and resolver instead of reusing filesystem path suggestions.

Initial root candidates:

- `{prefix}`
- `{timestamp}`
- `{date}`
- `{stem}`
- `{uid}`
- `{serial}`

Initial timestamp-family candidates:

- `{timestamp}`
- `{timestamp_local}`
- `{timestamp_utc}`
- `{timestamp_local_iso}`
- `{timestamp_utc_iso}`
- `{timestamp_local_12h}`
- `{timestamp_utc_12h}`

Initial date-family candidates:

- `{date}`
- `{date_local}`
- `{date_utc}`

Design rule:

- root-level suggestions stay small
- timestamp variants appear only after the active token has narrowed into the timestamp family
- date variants appear only after the active token has narrowed into the date family

### Token boundary model

The prompt should treat `{` as the start of a token-completion region.

Recommended first-pass rules:

- no token suggestion before `{`
- the active token fragment runs from the most recent unmatched `{` to the end of the current trailing input
- accept replaces only the active trailing token fragment
- separators such as `-`, `_`, and `.` remain ordinary literal text outside the token boundary
- the first pass does not add general cursoring into earlier text; completion applies only to the token fragment currently being typed at the end of the value

Examples:

- `{tim` + accept => `{timestamp}`
- `{timestamp}-{st` + accept => `{timestamp}-{stem}`
- `report-{uid}-{st` + accept => `report-{uid}-{stem}`

### Navigation model

Keyboard behavior should align with the repo’s existing inline prompt mental model:

- right arrow:
  - accept the current ghost token segment once
- `Tab`:
  - same behavior as right arrow for template completion
- up/down:
  - cycle sibling candidates within the current scope
  - broad scope at root token level
  - family-only scope once narrowed, for example `{timestamp_`
- left arrow:
  - keep current text-inline semantics unless a concrete token-navigation need appears in a later plan

### Integration boundary

Keep the implementation narrow and local to the existing inline text prompt stack.

Preferred direction:

- keep `src/cli/prompts/text-inline.ts` as the public entrypoint for inline text prompting
- add template-specific parsing/candidate helpers under `src/cli/prompts/`
- keep low-level raw session and key parsing in `src/cli/tui/`
- avoid pulling path-domain state helpers directly into template code

Possible module shape:

```text
src/cli/prompts/
  text-inline.ts
  text-template-inline.ts
  text-template-candidates.ts
```

Alternative acceptable shape:

- keep everything inside `text-inline.ts` only if the template logic remains small and clearly isolated

## Phases

## Phase 1: Define template token parsing and candidate resolution

### Task Items

- [ ] identify the active token fragment from the current input value
- [ ] define root-level template candidates
- [ ] define timestamp-family candidate narrowing rules
- [ ] define date-family candidate narrowing rules
- [ ] define how broad prefixes widen or narrow candidate scope
- [ ] add deterministic tests for token-fragment parsing and candidate selection

### Phase Deliverable

- [ ] a stable template candidate resolver exists without any UI-side key handling yet

## Phase 2: Add token-local ghost rendering and accept semantics

### Task Items

- [ ] render the current token candidate as a ghost suffix without disturbing literal text outside the active token
- [ ] make right arrow replace the active trailing token fragment in place
- [ ] make `Tab` match right-arrow accept behavior
- [ ] preserve existing append/backspace-only inline text behavior when no template candidate is active
- [ ] add focused tests for accept behavior at the beginning, middle, and end of a template string

### Phase Deliverable

- [ ] token-local accept behavior works for the custom-template prompt

## Phase 3: Add sibling-style candidate navigation

### Task Items

- [ ] add up/down cycling across sibling candidates in the current scope
- [ ] keep root-level and timestamp-family scopes distinct
- [ ] widen scope again when the user edits back to a broader token prefix
- [ ] avoid noisy jumps across unrelated token families while narrowed
- [ ] add regression coverage for sibling-style navigation

### Phase Deliverable

- [ ] up/down candidate browsing behaves like sibling path searching for template tokens

## Phase 4: Wire into interactive rename and verify UX

### Task Items

- [ ] update `src/cli/interactive/rename.ts` to use the new template-aware inline completion path
- [ ] keep the existing static help lines and helper text concise
- [ ] confirm timestamp-family narrowing is discoverable without flooding the default candidate list
- [ ] confirm date-family narrowing is discoverable without flooding the default candidate list
- [ ] ensure fallback simple prompt behavior still works when the advanced prompt cannot run
- [ ] update relevant guides and README sections if the final prompt behavior introduces new documented key controls or interactive examples
- [ ] update status and modified-date fields only for this plan, its implementation job record, and directly supporting feature research docs after implementation lands
- [ ] record final behavior in a job document

### Phase Deliverable

- [ ] interactive rename custom-template entry supports template-aware inline completion with safe fallback behavior

## Test Plan

- add unit coverage for:
  - active token fragment detection
  - root candidate selection
  - timestamp-family narrowing
  - date-family narrowing
  - token-local trailing replacement
  - up/down sibling candidate cycling
- extend inline text prompt tests for:
  - `Tab` parity with right arrow
  - trailing token replacement after accepted earlier segments
  - no suggestion before `{`
  - stable literal text outside the active token
- run focused interactive rename prompt tests after integration

## Documentation Plan

- update `README.md` if the interactive rename walkthrough or capability summary should mention token-aware template completion
- update `docs/guides/rename-common-usage.md` if the custom-template interactive flow needs explicit key-control guidance
- update only docs directly owned by this feature:
  - this plan -> `completed`
  - the implementation job record -> `completed`
  - directly supporting research docs -> `completed` only if their open design questions are fully resolved by the shipped behavior; otherwise keep them `draft` and refresh `modified-date`
- do not rewrite status fields on older already-completed historical plans merely because they are linked as related context
- keep doc scope behavior-focused:
  - when suggestions start
  - how `Tab` and right arrow accept the current token
  - how up/down browse sibling candidates
  - how timestamp-family and date-family variants appear only after narrowing into the corresponding family
- avoid over-documenting internal prompt implementation details unless they become part of the public behavior contract

## Risks

- The biggest behavioral risk is over-eager suggestion logic that rewrites literal text or activates before the user has entered a token boundary.
- The biggest UX risk is candidate noise, especially if timestamp variants appear too early.
- The biggest implementation risk is blending path-prompt assumptions into template parsing and making the helper harder to reason about.

## Success Criteria

- A user can type `{tim` and accept `{timestamp}` with either right arrow or `Tab`.
- A user can continue a mixed template like `{timestamp}-{st` at the end of the current value without disturbing the earlier accepted token.
- A user can browse timestamp-family variants only after narrowing into the timestamp family.
- A user can browse date-family variants only after narrowing into the date family.
- The custom-template prompt remains single-line and free of repeated help-text rerender artifacts.
- No other interactive text prompt behavior changes as part of this work.

## Related Research

- `docs/researches/research-2026-03-12-interactive-template-inline-completion-audit.md`
- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`
