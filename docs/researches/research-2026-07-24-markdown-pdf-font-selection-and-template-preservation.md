---
title: "Markdown PDF Font Selection and Template Preservation"
created-date: 2026-07-24
status: draft
agent: codex
---

## Goal

Determine whether a Markdown PDF font preference is discoverable, preserved,
and effective from user input through generated Profile and Template artifacts
to the rendered PDF.

This research joins two related findings without treating Interactive mode as
the only command path:

- [Issue #60: Preserve profile fonts in generated Markdown PDF template CSS][issue-60]
- [Issue #61: Enhance Interactive Markdown PDF font-family search][issue-61]

The shared lifecycle is:

```text
installed-font inventory
  -> Interactive search and selection
  -> repeatable fontHints[]
  -> Profile Codex font patches
  -> final profile.yml
  -> Template synthesis
  -> generated style.css
  -> md to-pdf stylesheet cascade
  -> rendered PDF
```

Issue #61 concerns how font intent enters this lifecycle. Issue #60 concerns
whether accepted intent remains effective at the artifact and render boundary.

## Research Questions

1. Does direct `md pdf-profile codex` treat `--base-profile` as the
   authoritative starting Profile for the new output Profile?
2. Does direct `md pdf-template codex` preserve fonts from `--base-profile` in
   its generated `style.css` and rendered output?
3. Does direct `md pdf-project codex` pass the final Profile font decisions into
   Template synthesis without replacing them with Template defaults?
4. Does Interactive authoring explain the starting-Profile to final-artifact
   lifecycle for Profile, Template, and Project preparation?
5. Which stylesheet wins when `md to-pdf` renders a Profile with generated
   Template CSS, and how should generated Project policy differ from deliberate
   user CSS overrides?
6. What font inventory does the Interactive picker search, which aliases are
   retained, and which installed fonts can the renderer actually use?
7. What matching and ranking behavior would provide useful fuzzy search while
   preserving predictable custom input?

## Scope

This research covers:

- direct `md pdf-profile codex` refinement from `--base-profile`
- direct `md pdf-template codex` usage with `--base-profile` and repeated
  `--font-hint`
- direct `md pdf-project codex` usage with Profile and font inputs
- Interactive Markdown PDF Profile, Template, and Project authoring through
  Codex Assistant
- generated `profile.yml`, `template.html`, and `style.css`
- `md to-pdf` Profile, Template, and CSS resolution and stylesheet ordering
- direct and Interactive terminology for starting, compatibility, and final
  Profiles
- Interactive installed-font discovery, alias retention, matching, ranking,
  result limits, caching, and timeout behavior
- renderer availability checks for fonts reported by different discovery
  sources

This research does not:

- change the existing repeatable `fontHints: string[]` contract
- infer language coverage or choose fonts automatically
- redesign Profile font roles or valid role/key combinations
- make implementation changes
- assume that every font reported by a platform-native inventory is usable by
  WeasyPrint

## Existing Contracts

The completed font-patch research assigns reusable font policy to the Profile:

| Profile role | Accepted keys |
| --- | --- |
| `body` | `default` and validated language tags |
| `heading` | `default` |
| `code` | `default` and `symbols` |
| `pageChrome` | `default` |

The completed Template and Project research establishes the broader ownership
split:

```text
Profile owns reusable render policy, including fonts.
Template owns reviewable HTML/CSS, layout, and managed assets.
Project coordinates the final Profile and Template artifacts.
md to-pdf renders accepted artifacts deterministically.
```

Template CSS is intentionally applied after Profile-derived default CSS so it
can own Template styling. That ordering should not cause Template preset
defaults to replace Profile-owned font choices accidentally.

The completed Interactive font-hint research keeps the direct helper contract
authoritative:

```text
--font-hint <text>  # repeatable
```

Interactive mode builds the same ordered `fontHints: string[]` payload. Its
installed-font picker is input assistance, not proof of glyph coverage,
renderer availability, or the final accepted Profile role.

This research does not reopen those ownership decisions. It investigates
whether the implementation preserves them and how the picker can expose its
font source more effectively.

## Settled Font-Preservation Decision

The Profile remains the authoritative original font configuration.

A Template generated with `--base-profile` must preserve the Profile's
effective font configuration. Template defaults must not replace it.

Project owns coordination between the final Profile and Template artifacts.
When Project invokes Template generation, it must ensure the generated CSS
preserves the final Profile's effective fonts. Direct Template generation
follows the same preservation rule when `--base-profile` is supplied.

`md to-pdf` remains a deterministic consumer of those accepted artifacts. It
does not own reconciliation between conflicting Profile and Template generation
decisions.

For helper-generated artifacts, font priority is:

```text
Profile-owned font
  -> Template font decision for an unowned role/key
  -> Template preset default
```

Template font decisions may fill role/key pairs that the Profile does not own.
They must not replace Profile-owned role/key pairs. The current direct-Template
`template_level` escape hatch is not part of this settled generated-artifact
contract.

This research does not add a requirement for the generated Template to preserve
the same typography when rendered without its base Profile. The exact technical
mechanism remains part of the solution comparison, but it must satisfy the same
observable contract:

```text
Profile font configuration
  -> Template generation
  -> unchanged effective fonts in the rendered PDF
```

## Settled Base-Profile Lifecycle

`--base-profile` is a read-only lifecycle input, not an additional final render
artifact.

The settled three-helper contract is:

| Helper | Meaning of `--base-profile` | Generated Profile output |
| --- | --- | --- |
| `md pdf-profile codex` | authoritative starting Profile to refine | one new output Profile |
| `md pdf-template codex` | compatibility Profile whose render policy must be preserved | none |
| `md pdf-project codex` | authoritative starting Profile for the Project Profile phase | final Project `profile.yml` |

When Project receives a base Profile, its lifecycle is:

```text
external base Profile
  -> Project Profile phase
  -> final project/profile.yml
  -> Project Template phase
  -> template.html and style.css compatible with final project/profile.yml
```

The external base file is not a second Project render input. Project writes the
final `profile.yml` so the bundle remains self-contained and replayable. A
base-only run may produce a near-copy with new identity and lineage metadata;
that snapshot is intentional rather than an external-file dependency.

When `--base-profile` is supplied to Profile or Project generation, it should
not be treated as merely one optional candidate that Codex may silently replace
with a built-in candidate. It is the starting Profile. When no base Profile is
supplied, built-in candidate selection remains available.

## Current Render Priority

The current renderer resolves recipe settings and files before applying the CSS
cascade:

```text
explicit recipe CLI settings
  -> Profile-derived recipe settings
  -> renderer defaults

explicit --profile/--template/--css for each role
  -> bundle-discovered file for that role
```

For stylesheets, `md to-pdf` generates default CSS from the effective Profile,
then passes custom or bundle `style.css` to WeasyPrint afterward:

```text
Profile-derived generated CSS
  -> custom or bundle style.css
  -> normal CSS cascade
```

For equal-specificity declarations, the later `style.css` wins. Selector
specificity, inheritance, and `!important` still apply normally.

This mechanical order should remain available for deliberate user-authored or
edited CSS. Generated Template and Project artifacts have a stronger policy:
their `style.css` must not contain accidental preset declarations that replace
Profile-owned fonts.

## Settled Interactive Base-Profile Shape

Interactive mode reuses the direct helper services and should not invent a
separate base-Profile contract. It should use artifact-specific language:

| Artifact | Setup label |
| --- | --- |
| Profile | `Starting profile` |
| Template bundle | `Compatibility profile` |
| Project bundle | `Starting profile for the generated Project` |

For Project preparation, the setup and review should make the transition
visible:

```text
Starting profile: ./base.yml
Generated project profile: profile.yml
Template compatibility source: generated profile.yml
```

After preparation, the review should report the actual Profile lineage and make
clear that `profile.yml` is the final replayable artifact. Without a selected
base Profile, it should identify built-in candidate selection as the starting
source.

## Command Paths Under Review

### Direct Profile CLI

Representative path:

```bash
cdx-chores md pdf-profile codex ./sample.md \
  --base-profile ./profile.yml \
  --font-hint "Prefer Example Serif for body text" \
  --output ./refined-profile.yml
```

This path should prove that the supplied Profile is the starting Profile and
the output is a new derivative rather than an unrelated candidate result.

### Direct Template CLI

Representative path:

```bash
cdx-chores md pdf-template codex ./sample.md \
  --base-profile ./profile.yml \
  --font-hint "Prefer Example Serif for body text" \
  --output ./template-bundle

cdx-chores md to-pdf \
  --input ./sample.md \
  --profile ./profile.yml \
  --template ./template-bundle/template.html \
  --css ./template-bundle/style.css \
  --output ./sample.pdf
```

This path isolates the Template helper. It should establish whether the
behavior is already present before Project or Interactive orchestration. The
example deliberately repeats an owned body-font preference: the resulting
Template must preserve the Profile-owned value rather than reinterpret the hint
as a Template override.

### Direct Project CLI

Representative path:

```bash
cdx-chores md pdf-project codex ./sample.md \
  --base-profile ./profile.yml \
  --font-hint "Prefer Example Serif for body text" \
  --output ./project-bundle

cdx-chores md to-pdf \
  --input ./sample.md \
  --bundle ./project-bundle \
  --output ./sample.pdf
```

This path should verify that the final Project Profile enters the Template
phase, and that the generated Template does not fall back to conflicting preset
fonts.

### Interactive Project Authoring

Representative path:

```text
Interactive Markdown PDF
  -> Project bundle
  -> starting-Profile setup
  -> font-hint setup
  -> Codex Assistant
  -> prepared review
       -> final project/profile.yml
       -> Template compatibility source: final project/profile.yml
  -> save Project bundle
  -> render
```

This path should be compared with the direct Project CLI at the normalized
command-state and prepared-artifact boundaries. Interactive mode should not
have a separate font ownership contract.

### Deterministic Render

All rendered Template and Project authoring paths eventually depend on:

```text
Profile-derived default CSS
  -> generated or supplied Template style.css
  -> WeasyPrint
```

The investigation must therefore inspect the generated files and the computed
render result. Correct `profile.yml` alone is insufficient evidence.

## Initial Finding A: Profile Fonts Can Be Replaced by Template Defaults

The initial source review shows:

1. Project orchestration completes the Profile phase before the Template phase.
2. The Template phase normalizes the final project Profile and collects its
   font signals.
3. Template font decisions matching Profile-owned role/key pairs are blocked
   when they come from ordinary font hints.
4. Direct Template synthesis currently includes a `template_level` escape hatch
   for overriding a Profile-owned font, while Project compatibility validation
   rejects the same override.
5. Template theme tokens still start with fixed body, heading, and monospace
   stacks.
6. Blocked Profile-owned decisions do not populate those tokens.
7. Generated `style.css` declares the resulting Template font variables and
   applies them to `body`, headings, and `code`.
8. `md to-pdf` passes Profile-derived default CSS to WeasyPrint before the
   custom or bundle `style.css`.
9. Project validation detects reported Template font decisions that override
   Profile-owned fonts, but fixed Template preset declarations are not reported
   as font decisions and can bypass that check.

This creates a likely ownership mismatch:

```text
Profile font is accepted
  -> Template correctly refuses to override it as a decision
  -> Template CSS still emits its preset/default family
  -> later Template CSS can win the cascade
```

The direct Template helper and the Project helper share the same Template
synthesis. The issue should therefore be reproduced first through direct
`md pdf-template codex`, then through direct Project CLI and Interactive Project
authoring. Interactive mode may expose the problem, but it is not yet the
suspected owner.

Direct Template font-hint behavior is role/key-aware:

- without a base Profile, an accepted hint may populate a supported Template
  font role/key
- with a base Profile, a hint may populate only a role/key that the Profile
  does not own
- when the Profile already owns the role/key, the generated Template CSS must
  preserve that Profile font rather than fall back to a Template preset

Template font decisions currently cover body, heading, and code. Page-chrome
fonts remain Profile-only and should be checked separately to distinguish
affected and unaffected roles.

### Version Boundary

The shared Template synthesis exists in released `v0.1.5`, and the Project path
also shipped in that stable release. The behavior remains relevant to the
latest released canary, `v0.1.6-canary.3`.

The exact first affected commit or canary for each direct path should be
recorded only after tag-based reproduction confirms it.

## Candidate Solutions for Finding A

### Option A: Seed Template Font Tokens from the Final Profile

Resolve Profile-owned body, heading, and code stacks from the full normalized
Profile and use them as the starting Template theme tokens.

Advantages:

- preserves the existing stylesheet order
- makes `style.css` visibly reflect the effective Profile fonts
- keeps a generated Template bundle more understandable when reviewed
- supports direct Template and Project paths through one shared synthesis fix

Risks:

- Profile-to-CSS serialization could be duplicated and drift
- language and symbol fallback ordering must remain consistent with renderer
  behavior
- an implementation must use the full normalized Profile, not only a bounded
  or truncated Codex prompt summary

This is the leading near-term candidate if the generated Template tokens can be
derived directly from the authoritative normalized Profile without introducing
a second font policy.

### Option B: Omit Profile-Owned Font Families from Template CSS

When a role is Profile-owned, generate Template CSS without a competing
`font-family` declaration for that role.

Advantages:

- expresses ownership cleanly through the cascade
- avoids duplicating Profile font stacks

Risks:

- existing `font` shorthands may need to be split into size, line-height, and
  family declarations
- Template components that consume Template font variables need an inheritance
  contract

This option is valid only if rendering with the base Profile preserves the same
effective fonts. Standalone typography without that Profile is not a requirement
introduced by this research.

### Option C: Add Shared Profile Font CSS Variables

Have Profile-derived CSS define canonical font variables and have generated
Template CSS consume those variables with safe fallbacks.

Advantages:

- creates one CSS source of truth
- keeps Template styling composable without copying Profile stacks
- provides a durable contract for future Template families

Risks:

- requires coordinated renderer, Profile CSS, Template synthesis, and
  compatibility changes
- is broader than the immediate preservation fix

This is a possible longer-term direction rather than the default scoped fix.

### Non-Solutions

- Reversing stylesheet order would weaken intentional Template and custom CSS
  overrides.
- Adding `!important` would make explicit user overrides harder and obscure the
  ownership contract.
- Fixing only Interactive option forwarding would leave direct Template and
  Project CLI behavior inconsistent.

## Finding A.1: Base-Profile Lifecycle Is Unclear

The initial source review shows that:

- Profile and Project generation load `--base-profile` into the Profile
  candidate set and always write a new final Profile artifact
- with additional signals, Codex may currently select a built-in candidate
  instead of the supplied base Profile
- Template generation uses `--base-profile` only as compatibility and synthesis
  context and writes no Profile artifact
- Project writes its final Profile into the bundle as `profile.yml`; the
  external base file is not used by the final `--bundle` render
- Interactive mode forwards `baseProfile` correctly to the shared helper
  service, but uses the generic labels `Set base profile`, `Base profile file`,
  and `Base profile` for all three artifacts
- Interactive Project review lists the planned `profile.yml`, `template.html`,
  and `style.css` files without showing the starting-Profile to final-Profile
  transition

This is partly a shared helper-contract issue and partly an Interactive
presentation issue. It is not an Interactive-only option-forwarding bug.

The settled enhancement keeps Project self-contained, makes a supplied base
Profile authoritative for Profile and Project refinement, and makes the
starting, compatibility, and final Profile roles visible in Interactive setup
and review.

## Initial Finding B: Interactive Search Uses a Narrow Inventory and Matcher

The current Interactive picker deliberately:

- requests fontconfig discovery only
- gives discovery a one-second hard deadline
- does not fall back to the platform-native source
- caches the session result
- keeps custom typed input available when discovery fails

The current fontconfig adapter keeps the first comma-separated family value
from each row. The Interactive picker then:

- deduplicates those family names case-insensitively
- sorts them alphabetically
- performs a case-insensitive contiguous substring match
- returns at most six installed-family matches
- preserves the typed custom value as the first choice

This is deterministic and bounded, but it is not fuzzy matching. Queries with
missing spaces, initials, separated tokens, or alternate family aliases may not
find an otherwise relevant installed family.

The reported "not all system fonts" behavior may have more than one cause:

1. the intentional fontconfig-only discovery boundary
2. the one-second deadline
3. discarded fontconfig family aliases
4. family-level deduplication
5. search terms that fail the contiguous-substring matcher
6. a difference between platform-visible fonts and renderer-visible fonts

These causes should be measured separately. A larger inventory is not
automatically better if it offers fonts that WeasyPrint cannot resolve.

### Version Boundary

The installed-family picker first shipped in released `v0.1.6-canary.3`.

## Candidate Solutions for Finding B

### Option A: Alias-Aware Deterministic Fuzzy Ranking

Build a searchable record for each canonical family that retains useful family
aliases and full names, then rank matches locally:

```text
exact
  -> prefix
  -> token prefix
  -> contiguous substring
  -> ordered subsequence
```

The selected value should remain a canonical family name even when an alias
matched.

Advantages:

- improves expected fuzzy-search behavior without changing discovery latency
- remains deterministic and easy to fixture-test
- needs no new runtime dependency for an inventory of this size
- preserves custom input and the current result cap

Risks:

- normalization and scoring rules need explicit tests
- localized or duplicate aliases need stable canonicalization
- loose subsequence matches can become noisy without ranking thresholds

This is the leading first enhancement candidate.

### Option B: Use a Fuzzy-Search Dependency

Index the same canonical and alias data through a dedicated fuzzy-search
library.

Advantages:

- provides mature scoring behavior
- reduces bespoke matching code

Risks:

- adds a runtime dependency and dependency-review surface
- still requires alias modeling and canonical result selection
- library defaults may be less predictable than the small desired ranking
  contract

This option should be considered only if the desired scorer grows beyond a
small testable implementation.

### Option C: Enrich the Inventory with Native Discovery

Merge or background-load the platform-native inventory after the fast
fontconfig result.

Advantages:

- may expose platform fonts absent from fontconfig
- can more closely match operating-system font tools

Risks:

- native discovery may exceed the Interactive latency budget
- native-only results may not be available to the renderer
- merging aliases and duplicate faces becomes more complex
- background updates must not reorder or invalidate an active prompt

Native enrichment should not become the default until representative
native-only fonts are proven usable through the actual render stack.

## Required Evidence

### Font-Preservation Matrix

Use a controlled Profile with visibly distinct families for:

- `body.default`
- at least one `body.<language-tag>`
- `heading.default`
- `code.default`
- `code.symbols`
- `pageChrome.default`

Record the following for each path:

| Path | Profile artifact | Template input | Generated CSS | Render result |
| --- | --- | --- | --- | --- |
| Direct Profile CLI | new derivative Profile | not applicable | Profile-derived CSS at render time | render the new Profile |
| Direct Template CLI | supplied compatibility Profile | full base-Profile signals | inspect font variables and selectors | inspect effective PDF fonts |
| Direct Project CLI | generated final Project Profile | final Profile signals | inspect project `style.css` | render with `--bundle` |
| Interactive Project | prepared final Project Profile | final prepared Profile | inspect saved `style.css` | render saved Project bundle |

Also cover:

- a Profile font without a Template font hint
- the same font supplied through `--font-hint`
- a Template font hint for a role/key not owned by the Profile
- a Template font hint for a role/key already owned by the Profile
- a Template preset default that conflicts with a Profile-owned font
- deterministic fallback without a Codex response
- render with default CSS enabled
- the documented advanced `--no-default-css` boundary, if applicable
- Project compatibility validation against effective generated CSS, not only
  reported font-decision metadata

### Base-Profile Lifecycle Matrix

Verify:

- `md pdf-profile codex --base-profile` uses the supplied Profile as the
  starting Profile and writes a new derivative
- `md pdf-template codex --base-profile` writes no Profile and preserves the
  supplied compatibility Profile
- `md pdf-project codex --base-profile` writes a final self-contained
  `profile.yml` and passes that final Profile into Template synthesis
- a base-only Project run records new identity and lineage without retaining an
  external render dependency
- built-in Profile candidate selection remains available only when no base
  Profile is supplied
- Interactive setup uses artifact-specific Profile labels
- Interactive Project review shows the starting Profile, generated
  `profile.yml`, and Template compatibility source
- direct CLI help and guide wording use the same lifecycle vocabulary

### Search and Inventory Matrix

Use injected fixtures to verify:

- exact, prefix, token-prefix, substring, and ordered-subsequence queries
- case and whitespace normalization
- alias matches returning a canonical family
- stable ranking and tie-breaking
- exact-duplicate collapse
- custom typed value remaining first
- the six-installed-result cap
- cancellation, timeout, caching, and unavailable-discovery fallback

Use live checks to compare:

- fontconfig-visible families
- platform-native-visible families
- families visible through both sources
- representative source-only families
- whether representative source-only fonts render successfully

Public evidence should record capabilities and aggregate outcomes without
publishing host font paths or a developer-specific inventory.

## Settled Enhancement Shape

### Issue #60

Resolve font preservation and base-Profile lifecycle together at their existing
ownership boundaries:

1. Profile generation treats a supplied base Profile as the authoritative
   starting Profile and writes a new derivative.
2. Template generation applies font hints only to Profile-unowned role/key
   pairs and preserves owned fonts in generated CSS.
3. Project writes a self-contained final `profile.yml`, passes that final
   Profile into Template synthesis, and validates the effective generated CSS.
4. Interactive mode reuses those shared services while showing artifact-specific
   starting, compatibility, and final Profile labels.
5. Helper-generated artifacts do not expose a special Template-level escape
   hatch for replacing Profile-owned fonts; reusable changes belong in the
   Profile.
6. `md to-pdf` keeps its current deterministic stylesheet order so deliberate
   user CSS remains a lower-level override.

Option A and Option B remain implementation candidates for making generated
Template CSS preserve Profile fonts. The chosen plan should prefer the narrower
mechanism that satisfies direct Template, direct Project, Interactive Project,
and rendered-output evidence without creating a second font policy.

### Issue #61

Retain useful fontconfig aliases and add deterministic local ranking in this
order:

```text
exact
  -> prefix
  -> token prefix
  -> contiguous substring
  -> ordered subsequence
```

Keep custom input first, keep the current installed-result cap, and preserve the
one-second Interactive discovery boundary. Native inventory enrichment remains
evidence-gated until representative native-only fonts are proven usable by the
renderer.

If the research becomes actionable, create separate implementation plans for
Issues #60 and #61 so either change can be validated and released
independently.

## Open Questions

1. Should alias search always return the canonical first family, or may a
   renderer-valid alias be preserved as the selected value?
2. Which native-only fonts, if any, can WeasyPrint resolve on each supported
   platform?
3. If native enrichment is useful, should it be an explicit source choice or a
   background enhancement after the first prompt is ready?

## Related Research

- [Markdown PDF Codex Font Patch Contract][font-patch-research]
- [Markdown PDF Template Codex Helper][template-helper-research]
- [Markdown PDF Project Codex Helper][project-helper-research]
- [Markdown PDF Interactive Font Hint Suggestions][interactive-font-research]
- [Font Command Discovery Options][font-discovery-research]
- [Markdown PDF Render Bundle Directory][render-bundle-research]

## References

- [Issue #60: Preserve profile fonts in generated Markdown PDF template CSS][issue-60]
- [Issue #61: Enhance Interactive Markdown PDF font-family search][issue-61]
- [Template font token and decision synthesis][template-font-source]
- [Project final-Profile forwarding into Template synthesis][project-template-source]
- [Project Profile and Template compatibility validation][project-validation-source]
- [Renderer stylesheet ordering][render-source]
- [Interactive Codex setup][interactive-setup-source]
- [Interactive helper-service reuse][interactive-service-source]
- [Interactive installed-family filtering][interactive-filter-source]
- [Interactive fontconfig discovery boundary][interactive-discovery-source]
- [Fontconfig family parsing][fontconfig-source]

[issue-60]: https://github.com/dev-pi2pie/cdx-chores/issues/60
[issue-61]: https://github.com/dev-pi2pie/cdx-chores/issues/61
[font-patch-research]: research-2026-06-16-markdown-pdf-codex-font-patch-contract.md
[template-helper-research]: research-2026-06-18-markdown-pdf-template-codex-helper.md
[project-helper-research]: research-2026-07-03-markdown-pdf-project-codex-helper.md
[interactive-font-research]: research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md
[font-discovery-research]: research-2026-05-07-font-command-discovery-options.md
[render-bundle-research]: research-2026-07-10-markdown-pdf-render-bundle-directory.md
[template-font-source]: ../../src/cli/markdown-pdf/template-codex/slots.ts
[project-template-source]: ../../src/cli/markdown-pdf/project-codex/template-phase.ts
[project-validation-source]: ../../src/cli/markdown-pdf/project-codex/validate-project.ts
[render-source]: ../../src/cli/markdown-pdf/render.ts
[interactive-setup-source]: ../../src/cli/interactive/markdown/codex-setup.ts
[interactive-service-source]: ../../src/cli/interactive/markdown/codex-service.ts
[interactive-filter-source]: ../../src/cli/interactive/markdown/font-hints/suggestions.ts
[interactive-discovery-source]: ../../src/cli/interactive/markdown/font-hints/service.ts
[fontconfig-source]: ../../src/fonts/adapters/fontconfig.ts
