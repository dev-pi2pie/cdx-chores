---
title: "Partial analyzer-assisted cleanup scope"
created-date: 2026-03-04
modified-date: 2026-03-05
status: draft
agent: codex
---

## Goal

Define a safer and more flexible follow-up contract for Codex-assisted `rename cleanup` so interactive cleanup can target only part of a mixed directory instead of always steering toward one full-scope cleanup run.

## Milestone Goal

Set a practical draft direction that:

- keeps deterministic cleanup explicit and replayable
- preserves grouped analyzer review as a useful discovery step
- adds a lightweight include/exclude scope layer for Codex-assisted cleanup
- avoids introducing regex-heavy scoping or opaque whole-directory inference in the first partial-cleanup design

## Key Findings

### 1. The current analyzer-assisted flow is still biased toward one overall cleanup suggestion

The existing analyzer-assisted cleanup research and implementation already support:

- bounded filename sampling
- grouped local pattern evidence
- one overall Codex suggestion for cleanup settings

That works for narrow directories, but it is weak for mixed folders because the user may want to:

- clean only screenshot-like names
- exclude files that already contain `uid-`
- focus on one repeated filename family first

Implication:

- the next analyzer-assisted cleanup step should refine cleanup scope, not just improve the one overall suggestion

### 2. Partial cleanup should be selection-first, not full-scope-first

For mixed directories, the better mental model is:

1. analyze candidate filenames
2. understand repeated filename families
3. choose which families to include or exclude
4. run deterministic cleanup only on that scoped subset

This is safer than:

- inferring one cleanup rule and applying it to the whole directory

Implication:

- analyzer-assisted cleanup should become selection-first for mixed-pattern cases

### 3. Analyzer-side include/exclude hints are simpler than regex as the first new scope layer

Raw include/exclude regex could eventually be useful, but it adds a second syntax-heavy layer on top of:

- cleanup hints
- grouped analyzer output
- deterministic preview/apply

That is too much complexity for the first partial-cleanup design.

Recommended first-pass scoping layer:

- interactive include/exclude selectors for analyzer-visible filename families
- candidate CLI names for a later non-interactive surface, if one is added:
  - `--codex-include-hint`
  - `--codex-exclude-hint`
  - with optional plural aliases for typo tolerance and plural instinct:
    - `--codex-include-hints`
    - `--codex-exclude-hints`

If a later CLI surface is added, multi-family selection should follow the existing `rename cleanup --hint` convention:

- repeatable singular flags such as `--codex-include-hint uid --codex-include-hint timestamp`
- or comma-separated values such as `--codex-include-hint "uid,timestamp"` or `--codex-include-hint "uid, timestamp"`

First-pass contract boundary:

- partial analyzer-assisted cleanup should remain interactive-only while the family-selection UX is still being stabilized
- the flag names above should be treated as provisional naming, not as a first-pass implementation commitment

Implication:

- the first partial-cleanup scope layer should stay hint-like and cleanup-local, not regex-driven
- the research should not be read as approval to add new CLI flags before the interactive contract is settled

### 4. Codex hints and cleanup hints should be treated as separate layers even though both use the word `hint`

Inside `rename cleanup`, `--hint` already means deterministic cleanup fragment families such as:

- `date`
- `timestamp`
- `serial`
- `uid`

The proposed Codex scope layer would mean something different:

- which analyzer-discovered groups or cleanup-relevant families should be included
- which analyzer-discovered groups or cleanup-relevant families should be excluded

Recommended interpretation rule:

- `--hint` controls what deterministic cleanup can remove or normalize
- analyzer-side include/exclude controls select which grouped families stay in review before deterministic cleanup planning
- if a CLI surface is added later, `--codex-include-hint` / `--codex-exclude-hint` should refer only to that analyzer-side review layer
- if a CLI surface is added later, its multi-value behavior should mirror the existing cleanup hint surface instead of inventing a new selector syntax

Implication:

- the product can keep the word `hint` as long as the docs and prompts make the layer boundary explicit

### 5. Analyzer hints should be group-oriented and human-readable, not regex-by-another-name

The first partial-cleanup scope design should avoid turning Codex hints into free-form pattern syntax.

Preferred shape:

- short, readable hint values tied to analyzer-visible filename families
- values that can be shown back to the user in prompts and summaries

Example directions:

- `timestamp`
- `date`
- `serial`
- `uid`

Recommended first-pass value boundary:

- these values should describe analyzer focus, not expose raw regex power
- these values should not be treated as direct deterministic cleanup settings by themselves
- the first minimal value set should stay aligned with existing cleanup families:
  - `date`
  - `timestamp`
  - `serial`
  - `uid`
- analyzer-specific labels such as `screenshot` should stay out of scope in the first follow-up

Recommended translation rule:

- analyzer-family labels narrow or select groups for review
- deterministic cleanup settings are still chosen explicitly after grouped review
- existing cleanup families such as `timestamp`, `date`, `serial`, and `uid` should be reused directly in the first follow-up

Implication:

- Codex scope hints should remain human-readable labels at the review layer
- the handoff into deterministic cleanup should stay explicit rather than implicit

### 6. Grouped analysis should remain visible even when include/exclude hints are present

The user still benefits from seeing grouped analyzer output because it answers:

- what families exist in this directory
- how many files are in each family
- which examples represent each family

That grouped view remains useful even if include/exclude hints are added.

Recommended rule:

- include/exclude hints should narrow or prioritize analyzer scope
- grouped analyzer review should still show the resulting families before deterministic cleanup runs
- selected groups should not silently prefill or auto-run deterministic cleanup without a visible confirmation step
- if no include/exclude selection is provided, analyzer review should scan all eligible families in scope

Implication:

- hints should not replace grouped review; they should shape it

### 7. Prompt wording must teach the layer order

The hard UX problem is not only the flags; it is how to explain them without making the flow noisy.

Recommended order:

1. optional Codex analyzer step
2. optional Codex include/exclude hints
3. grouped analyzer results
4. final selected cleanup scope
5. explicit deterministic cleanup settings
6. deterministic preview/apply

Prompt-note direction:

- analyzer step:
  - `Codex groups repeated filename families and suggests cleanup direction.`
- Codex scope hint step:
  - `These hints narrow which filename families Codex focuses on.`
- grouped review step:
  - `Only selected groups will continue into cleanup review.`
- deterministic cleanup step:
  - `Choose the cleanup hints and style to apply to the selected groups.`

Implication:

- prompts should explain the stage purpose briefly instead of trying to encode the whole contract in one screen

### 8. `{uid}` template support reduces the need for old two-step workaround framing

With `{uid}` now supported in general rename templates, the product no longer needs to lean on a workaround mindset such as:

- cleanup first
- then separate rename only because `{uid}` was missing

That means the analyzer-assisted cleanup follow-up can focus on:

- partial cleanup scope
- grouped review
- selective execution

instead of compensating for the old template gap.

Implication:

- this research should treat partial analyzer-assisted cleanup as a standalone UX problem, not as a workaround for missing template capability

### 9. Artifact lifecycle needs a clearer contract between dry-run plan CSV and analyzer report CSV

Current interactive analyzer-assisted cleanup behavior now has two distinct CSV artifacts:

- dry-run plan CSV from deterministic `rename cleanup` planning
- optional grouped analyzer report CSV from Codex-assisted analysis

Observed workflow risk:

- artifact retention can feel coupled because apply-time auto-clean messaging can govern both artifact types
- the user intent to keep plan artifacts versus keep analyzer evidence is not always expressed as two explicit decisions
- this can make it harder to preserve grouped analyzer evidence for post-run review while still cleaning temporary execution artifacts

Expected contract direction:

- keep dry-run plan CSV and analyzer report CSV as separate artifact classes
- make retention decisions explicit per artifact class
- avoid silently deleting analyzer report artifacts unless the user explicitly opts into cleaning them

ASCII workflow sketch (target direction):

```text
[Start interactive cleanup]
          |
          v
[Optional Codex analysis]
          |
          +--> write analysis report CSV? ----no----> (no analysis CSV)
          |                |
          |               yes
          |                v
          |       [analysis CSV created]
          v
[Choose cleanup settings]
          |
          v
[Run deterministic cleanup dry-run]
          |
          v
[plan CSV created if changes]
          |
          v
Apply now?
  | no
  |--> [retention step]
  |      - keep/remove plan CSV?
  |      - keep/remove analysis CSV? (if present)
  |
  | yes
  v
[Apply from plan CSV]
          |
          v
[post-apply retention step]
  - keep/remove plan CSV?
  - keep/remove analysis CSV? (if present)
```

Implication:

- artifact-retention prompts should model two files with different intent, not one generic cleanup switch
- grouped analyzer evidence should remain accessible by default when users intend to inspect analysis outcomes after the run

### 10. Example prompt copy and retention decision matrix

Proposed prompt copy:

```text
Apply these renames now?
```

Default:

- No

If the user chooses No and a dry-run plan CSV exists:

```text
Keep dry-run plan CSV for later `rename apply`?
```

Default:

- Yes

If an analyzer report CSV exists:

```text
Keep cleanup analysis report CSV?
```

Default:

- Yes

If the user chooses Yes to apply, run apply first.
If apply succeeds:

```text
Keep applied plan CSV?
```

Default:

- No

If an analyzer report CSV exists:

```text
Keep cleanup analysis report CSV?
```

Default:

- Yes

Failure rule:

- if apply fails, skip deletion prompts and keep all existing CSV artifacts

Decision matrix:

| Scenario | Analysis CSV exists | Keep plan CSV? | Keep analysis CSV? | Final result |
| --- | --- | --- | --- | --- |
| Dry-run only (no apply) | No | Yes | N/A | Keep plan CSV |
| Dry-run only (no apply) | No | No | N/A | Delete plan CSV |
| Dry-run only (no apply) | Yes | Yes | Yes | Keep both |
| Dry-run only (no apply) | Yes | Yes | No | Keep plan, delete analysis |
| Dry-run only (no apply) | Yes | No | Yes | Delete plan, keep analysis |
| Dry-run only (no apply) | Yes | No | No | Delete both |
| Apply now (success) | No | Yes | N/A | Keep applied plan CSV |
| Apply now (success) | No | No | N/A | Delete applied plan CSV |
| Apply now (success) | Yes | Yes | Yes | Keep both |
| Apply now (success) | Yes | Yes | No | Keep plan, delete analysis |
| Apply now (success) | Yes | No | Yes | Delete plan, keep analysis |
| Apply now (success) | Yes | No | No | Delete both |
| Apply now (failed) | Any | N/A | N/A | Keep all existing CSV artifacts |

## Implications or Recommendations

Recommended first follow-up direction:

- keep analyzer-assisted cleanup interactive-only
- keep grouped analyzer output visible
- add analyzer-side scoping through interactive include/exclude family selection first
- treat an empty include/exclude selection as the default full-scope fallback:
  - scan all eligible analyzer-visible families in the chosen cleanup scope
- treat `--codex-include-hint` / `--codex-exclude-hint` as candidate names for a later CLI surface, not as first-pass scope commitments
- if that later CLI surface lands, keep its value syntax aligned with `--hint`: repeatable or comma-separated multi-family selection
- treat these as cleanup-local analyzer scope hints, not deterministic cleanup hints
- require an explicit deterministic cleanup configuration step after scope selection
- apply one global deterministic cleanup hint/style selection to the selected groups rather than introducing per-group cleanup settings in the first follow-up
- prefer interactive multi-select choices for include/exclude family selection
- keep deterministic cleanup planning and conflict handling unchanged after scope selection
- define explicit artifact-lifecycle prompts for plan CSV and analysis report CSV as separate retention decisions

Recommended first-pass non-goals:

- no raw regex include/exclude in the first partial-cleanup design
- no silent whole-directory analyzer inference
- no automatic execution from Codex-selected groups
- no merging of analyzer hints and deterministic cleanup hints into one option surface
- no analyzer-specific family taxonomy such as `screenshot` in the first follow-up
- no per-group deterministic cleanup settings in the first follow-up

Interactive follow-up note:

- once analyzer-family selection settles on a multi-select interaction model, the normal interactive `rename cleanup` hint picker should likely converge on the same multi-select choice UI instead of using a different selection pattern
- that convergence should be tracked as a follow-up UX change rather than folded into the first partial-cleanup scope implementation

## Recommended Decisions

### 1. Delay any CLI include/exclude surface until the interactive contract settles

Recommended decision:

- do not add a CLI include/exclude surface in the first follow-up
- keep the first partial-scope design interactive-only until the family-selection contract is stable in real usage

Rationale:

- the interactive flow still owns the core UX questions around default state, family selection, and grouped review
- adding CLI flags too early would lock naming and semantics before the interaction model is proven

### 2. Use implicit full-scope analysis as the default later CLI empty state

If a later CLI surface is added, recommended decision:

- an empty include/exclude state should mean full-scope analysis
- do not add an explicit `all` selector in the first CLI version

Rationale:

- `all` would be redundant if the null/default state already means scan all eligible families
- avoiding `all` keeps the contract smaller and easier to document

### 3. Start interactive family selection with one combined multi-select

Recommended decision:

- use one combined multi-select for analyzer families in the first follow-up
- default all eligible families to selected
- narrowing scope should happen by deselecting families rather than managing separate include and exclude steps

Rationale:

- one multi-select fits naturally with the null-means-all default
- separate include and exclude steps would introduce overlap and conflict rules too early
- the simpler interaction is more likely to keep grouped review understandable

### 4. Separate artifact-retention decisions for plan CSV and analysis report CSV

Recommended decision:

- treat plan CSV and analysis report CSV as separate retention decisions in interactive mode
- do not let a single generic auto-clean decision implicitly delete analyzer report artifacts
- when both files exist, present retention choices that can keep one and remove the other

Rationale:

- the plan CSV is an execution/replay artifact, while the analysis report CSV is evidence/review output
- users may want opposite retention outcomes for these two artifact types in the same run
- separating retention controls makes dry-run and apply-time behavior easier to reason about

## Residual Open Questions

- after the interactive family-selection flow is validated, is there enough scripting value to justify adding a later CLI include/exclude surface?
- if separate exclude behavior becomes necessary later, should it be introduced as a second step in interactive mode or as a more advanced interaction within the same family picker?

Recommended resolution path:

### 1. Later CLI include/exclude surface

Default decision:

- do not add a CLI include/exclude surface until an explicit readiness gate is met

Readiness gate:

- interactive family-selection semantics are stable for at least one release cycle
- no major contract churn in include/exclude defaults or selected-family meaning
- clear scripting demand is observed from real usage

If the gate is met, first CLI slice should stay narrow:

- use `--codex-include-hint` / `--codex-exclude-hint`
- keep value input aligned with `--hint`: repeatable or comma-separated
- keep empty include/exclude as implicit full-scope analysis

### 2. Future explicit exclude behavior

Default decision:

- keep one combined family picker in the first follow-up
- do not split include/exclude into separate steps unless a concrete UX gap appears

Escalation rule:

- if users need explicit negative targeting beyond simple deselect behavior, add an advanced mode later
- if both include and exclude controls exist, use explicit precedence:
  - effective families = include set minus exclude set

## Related Plans

- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Related Research

- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-03-rename-cleanup-analyzer-report-artifact.md`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`

## References

- `src/cli/actions/rename/cleanup.ts`
- `src/cli/actions/rename/cleanup-codex.ts`
- `src/cli/actions/rename/cleanup-analyzer.ts`
- `src/cli/interactive/rename-cleanup.ts`
