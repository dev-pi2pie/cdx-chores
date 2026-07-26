---
title: "Markdown PDF Font Selection and Template Preservation"
created-date: 2026-07-24
modified-date: 2026-07-26
status: in-progress
agent: codex
---

## Goal

Define how a Markdown PDF font preference enters the helper lifecycle and
remains effective through a partial Template bundle or a coordinated Project
bundle to the rendered PDF.

This research joins two related findings without treating Interactive mode as
the only command path:

- [Issue #60: Preserve profile fonts in generated Markdown PDF template CSS][issue-60]
- [Issue #61: Enhance Interactive Markdown PDF font-family search][issue-61]

Issue #61 owns local preference discovery and search. Issue #60 owns
preservation after a font has reached the effective compatibility Profile used
by Template synthesis.

## Research At A Glance

Issue #61 gets a font preference into the authoring lifecycle. Issue #60 keeps
that preference effective through shared Template synthesis and rendering.

```text
[Issue #61 - discovery and selection]

local fontconfig inventory
          |
          v
family + aliases + full names
          |
          v
deterministic local ranking
          |
          v
    selected family
          |
          v
      fontHints[]
          |
          +-----------------+------------------+
          |                                    |
          v                                    v
Direct Template path                    Project path
--base-profile                          Profile phase
+ fontHints[]                           + fontHints[]
          |                                    |
          |                                    v
          |                            final profile.yml
          |                                    |
          | compatibility Profile              | compatibility Profile
          | = normalized base                  | = normalized final
          +-----------------+------------------+
                            |
                            v
               shared Template synthesis
                            |
                            v
[Issue #60 - Profile font preservation]

current: Template preset font-family may be emitted
         for a Profile-owned CSS font slot

target:  omit competing generated font-family
                                      |
                          +-----------+-----------+
                          |                       |
                          v                       v
                  Template bundle          Project bundle
                  partial, no Profile       complete, with Profile
                          |                       |
                          +-----------+-----------+
                                      |
                                      v
                         md to-pdf CSS cascade
                                      |
                                      v
                                 rendered PDF
```

| Issue | Lifecycle boundary                      | Current conclusion                                          | Remaining proof                                                    |
| ----- | --------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| #60   | shared Template synthesis and rendering | use ownership-aware CSS emission                            | reproduce and render partial Template and complete Project bundles |
| #61   | local discovery and selection           | keep fontconfig, retain aliases, and rank deterministically | record cold/warm responsiveness and settle the bounded wait        |

The two issues share data but not implementation ownership. They should produce
separate plans and may proceed independently.

## Shared Artifact Model

Template and Project both produce directories that `md to-pdf --bundle` can
inspect, but they are not the same artifact:

```text
Template bundle                  Project bundle
partial render bundle            complete coordinated bundle

template.html                    profile.yml
style.css                        template.html
assets/...                       style.css
                                assets/...

no Profile artifact              includes the final Project Profile
```

“Partial” does not mean invalid. A Template bundle can render with renderer
defaults or with a Profile supplied separately; it simply does not contain the
Profile role itself.

The Project bundle contains a Template artifact set, but Project is not another
styling owner. Optional diagnostic reports may be written beside either
artifact set, but they are not render inputs.

| Concern                 | Ownership                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Profile                 | reusable render policy, including font roles                                                             |
| Template                | reviewable HTML/CSS presentation and managed assets                                                      |
| Project                 | orchestration, compatibility validation, and atomic assembly of the final Profile and Template artifacts |
| Render bundle directory | packaging and bounded input discovery; not a policy owner                                                |
| `md to-pdf`             | deterministic artifact resolution and PDF rendering                                                      |

Project reuses shared Profile and Template services instead of replacing their
ownership contracts.

## Scope And Fixed Contracts

This research covers:

- direct `md pdf-profile codex` refinement from `--base-profile`
- direct `md pdf-template codex` usage with `--base-profile` and repeated
  `--font-hint`
- direct `md pdf-project codex` usage with Profile and font inputs
- Interactive Markdown PDF Profile, Template, and Project authoring through
  Codex Assistant
- the partial Template-bundle and complete Project-bundle output contracts
- the shared Template synthesis service used by both bundle-producing helpers
- generated `profile.yml`, `template.html`, and `style.css`
- `md to-pdf` Profile, Template, and CSS resolution and stylesheet ordering
- direct and Interactive terminology for base candidates, compatibility
  Profiles, selected sources, and final Profiles
- Interactive fontconfig discovery, alias retention, matching, ranking, result
  limits, caching, cancellation, and timeout behavior

This research does not:

- change the existing repeatable `fontHints: string[]` contract
- infer language coverage or choose fonts automatically
- redesign Profile font roles or valid role/key combinations
- make implementation changes
- assume that every font reported by fontconfig is usable by WeasyPrint

### Fixed Contracts

- `md to-pdf` consumes accepted artifacts deterministically and loads
  Profile-derived CSS before custom or bundle `style.css`.
- Interactive compiles input assistance into the same ordered
  `fontHints: string[]` used by direct helpers.
- Interactive installed-font suggestions use the local fontconfig inventory.
  Native operating-system discovery is outside Issue #61.
- Direct Template retains the bounded explicit `template_level` override.
- Project rejects an explicit Template decision that overrides a Profile-owned
  font.
- User-authored CSS remains a deliberate lower-level override through the
  normal cascade.

The accepted Profile role/key boundary also remains unchanged:

| Profile role | Accepted keys                         |
| ------------ | ------------------------------------- |
| `body`       | `default` and validated language tags |
| `heading`    | `default`                             |
| `code`       | `default` and `symbols`               |
| `pageChrome` | `default`                             |

Installed-font suggestions remain input assistance. They do not prove glyph
coverage, renderer availability, or the final accepted Profile role.

## Issue #60: Profile Font Preservation Across Template And Project Bundles

### Affected Authoring Paths

The two affected bundle paths create their compatibility Profile differently,
then converge on shared Template synthesis:

```text
Direct Template                         Project
--base-profile                          optional base candidate
       |                                      |
       |                                      v
       |                              Project Profile phase
       |                                      |
       |                                      v
       |                              final profile.yml
       |                                      |
       +------------------+-------------------+
                          |
                          v
             effective compatibility Profile
             direct:  normalized --base-profile
             project: normalized final profile.yml
                          |
                          v
                shared Template synthesis
```

Direct Template generates no Profile. Its `--base-profile` is compatibility
input only and is not copied into the partial bundle. A preservation render
must supply that same Profile separately. Project writes its final Profile into
the complete bundle before passing it to the Template phase.

| Path                                     | Issue #60 posture                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Direct Profile                           | not affected directly; it may produce a later compatibility Profile                                   |
| Direct Template with `--base-profile`    | affected when generated CSS emits a family for a Profile-owned slot                                   |
| Direct Template without `--base-profile` | no Profile-preservation conflict; Template defaults may own the slot                                  |
| Project                                  | affected because the final Project Profile is always the compatibility Profile for its Template phase |
| Interactive Template and Project         | inherit the corresponding direct-helper behavior through shared services                              |
| User-authored or edited CSS              | deliberate cascade override, not the generation defect                                                |
| Render with `--no-default-css`           | outside the preservation guarantee because Profile-derived CSS is intentionally disabled              |

### Source-Supported Conflict

Evidence status: source-supported hypothesis; direct reproduction and rendered
output evidence are still pending.

Source review establishes the likely causal chain:

1. Direct Template normalizes its supplied `--base-profile`, while Project
   forwards its final normalized Profile into the same Template synthesis
   service.
2. That Profile becomes the effective compatibility Profile for the respective
   synthesis path.
3. Ordinary Template font decisions are blocked when the compatibility Profile
   owns the same role/key.
4. Fixed Template preset tokens are still emitted even when that decision is
   blocked.
5. `md to-pdf` loads Profile-derived CSS before generated `style.css`.
6. Project validation checks reported font decisions, not competing preset
   declarations in the generated CSS.

The resulting conflict is:

```text
Direct Template                         Project
--base-profile                          final profile.yml
       |                                      |
       +------------------+-------------------+
                          |
                          v
             effective compatibility Profile
                          |
              +-----------+-----------+
              |                       |
              v                       v
      render-time Profile CSS    shared Template synthesis
      body {                     ordinary override is blocked
        font-family:             because the Profile owns
          Profile Font;          body.default
      }                                |
                                       v
                                  preset CSS still emits
                                  body {
                                    font-family: Preset Font;
                                  }
              |                       |
              +-----------+-----------+
                          |
                          v
                  WeasyPrint CSS order
                  1. Profile-derived CSS
                  2. generated style.css
                          |
                          v
                  Preset Font wins accidentally
```

The direct Template helper and Project share the faulty synthesis boundary even
though their output bundles differ. Reproduction should start with direct
`md pdf-template codex --base-profile`, then prove that the Project Template
phase and both Interactive wrappers inherit the same behavior. Direct Template
render evidence must supply the same compatibility Profile explicitly; Project
render evidence obtains its final Profile from the complete bundle.

### Version Boundary

The shared Template synthesis exists in released `v0.1.5`, and the Project path
also shipped in that stable release. The behavior remains relevant to the
latest released canary, `v0.1.6-canary.3`.

The exact first affected commit or canary for each direct path should be
recorded only after tag-based reproduction confirms it.

### Selected Fix: Ownership-Aware Font CSS Emission

Generated Template CSS should omit `font-family` declarations for CSS font
slots owned by the effective compatibility Profile. That Profile is the
normalized `--base-profile` for direct Template and the normalized final
Project Profile for Project. The ownership mask must come from the full
normalized Profile, not the bounded font summary exposed to Codex.

```text
effective compatibility Profile
  direct Template: normalized --base-profile
  Project:         normalized final profile.yml
             |
             v
derive CSS font-slot ownership
             |
             v
Template CSS synthesis
             |
             +-- explicit direct-Template template_level decision?
             |        |
             |        `-- yes -> emit the deliberate override family
             |
             +-- Profile owns this CSS font slot?
             |        |
             |        `-- yes -> omit Template font-family
             |
             `-- no -> emit accepted Template decision
                      or Template preset family
```

The rendered result keeps non-font Template styling without fighting the
Profile:

```text
Profile-derived CSS             generated style.css
body {                          body {
  font-family: Profile Font;      font-size: 10.5pt;
}                                 line-height: 1.5;
                                  /* no font-family */
                                }
             \                   /
              \                 /
               v               v
              normal CSS cascade
                       |
                       v
             Profile Font remains effective
```

This direction does not reverse stylesheet order, add `!important`, or copy
Profile font stacks into a second policy implementation. If the focused
synthesis spike shows that omission cannot preserve a supported CSS slot, keep
the research open and reconsider the direction rather than silently duplicating
Profile serialization.

### CSS Font Ownership Slots

Profile role/keys do not always map one-to-one to CSS declarations:

| CSS slot      | Profile ownership source         | Generated Template behavior                               |
| ------------- | -------------------------------- | --------------------------------------------------------- |
| Body default  | `body.default`                   | omit the Template body family                             |
| Body language | matching `body.<language-tag>`   | do not emit a competing family for that language selector |
| Headings      | `heading.default`                | omit the Template heading family                          |
| Code stack    | `code.default` or `code.symbols` | treat the combined code declaration as Profile-owned      |
| Page chrome   | `pageChrome.default`             | Profile-only; Template emits no competing family          |

The combined code slot is deliberately conservative because `code.default` and
`code.symbols` become one rendered fallback stack. A Template default cannot
replace only one key without affecting the other.

### Direct Template, Project, And Render Rules

| Path                                                                  | Artifact result                   | Profile-owned slot behavior                                                     |
| --------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Direct Template with compatibility Profile, ordinary hint or preset   | partial Template bundle           | omit the generated Template family                                              |
| Direct Template with compatibility Profile, explicit `template_level` | partial Template bundle           | emit the deliberate bounded override                                            |
| Direct Template without compatibility Profile                         | partial Template bundle           | emit the accepted Template decision or preset family                            |
| Project Template phase                                                | complete Project bundle           | omit ordinary/preset families and reject explicit Profile-owned overrides       |
| User-edited CSS                                                       | edited partial or complete bundle | may override through the existing normal cascade                                |
| `--no-default-css` render                                             | either bundle shape               | intentionally removes Profile CSS, so Profile-font preservation is not expected |

A generated Template is not required to preserve the same typography when
rendered without its compatibility Profile.

### Investigation And Validation Path

```text
1. Reproduce direct Template conflict with --base-profile
             |
             v
2. Map Profile role/keys to CSS ownership slots
             |
             v
3. Spike conditional font-family emission
             |
             +-- supported selectors and typography remain correct?
             |        |
             |        +-- yes -> confirm the selected direction
             |        |
             |        `-- no  -> keep research open and reconsider
             |
             v
4. Apply the shared Template synthesis fix
             |
             v
5. Validate partial Template and complete Project bundles
             |
             v
6. Inspect generated CSS and both rendered PDF paths
```

Use visibly distinct Profile and preset families for `body.default`, one
`body.<language-tag>`, `heading.default`, `code.default`, `code.symbols`, and
`pageChrome.default`. Cover direct Template with and without a compatibility
Profile, ordinary hints, explicit direct overrides, Project rejection,
deterministic fallback, default CSS, and the `--no-default-css` negative
boundary. Validation must inspect generated selectors and the rendered result
for both bundle shapes, not only font-decision metadata or `profile.yml`.

### Non-Blocking Base-Profile Presentation Follow-Up

The helper contract is already distinct:

| Helper                  | `--base-profile` role                                | Generated Profile           |
| ----------------------- | ---------------------------------------------------- | --------------------------- |
| `md pdf-profile codex`  | validated candidate available for refinement         | one new output Profile      |
| `md pdf-template codex` | compatibility Profile whose policy must be preserved | none                        |
| `md pdf-project codex`  | validated candidate for the Project Profile phase    | final Project `profile.yml` |

Codex-assisted Profile and Project runs may select the supplied candidate or a
built-in candidate. Project then passes its final selected Profile into Template
synthesis and writes that Profile into the bundle.

Interactive should expose that transition with artifact-specific language:

```text
Base profile candidate: ./base.yml
Selected profile source: ./base.yml or <built-in candidate>
Generated project profile: profile.yml
Template compatibility source: generated profile.yml
```

This is presentation work only. It must not block Issue #60 reproduction,
synthesis changes, or rendered evidence, and it must not change candidate
selection semantics.

## Issue #61: Installed-Font Discovery And Search

### Shipped Behavior

Evidence status: current behavior is source-confirmed; alias retention, ranking,
and the relaxed timeout contract remain proposed and unvalidated.

The current Interactive picker deliberately:

- requests fontconfig discovery only
- gives discovery a one-second hard deadline
- does not fall back to native discovery
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

The fontconfig inventory source is intentional. The current gaps are:

1. the one-second discovery boundary
2. discarded fontconfig family aliases
3. family-level deduplication before alias/full-name grouping
4. search terms that fail the contiguous-substring matcher

These causes should be measured separately. Installed-font suggestions are
local input assistance; they do not claim renderer availability or glyph
coverage.

### Version Boundary

The installed-family picker first shipped in released `v0.1.6-canary.3`.

### Selected Discovery And Search Pipeline

```text
local fontconfig inventory
                |
                v
family + aliases + full names
                |
                v
deterministic local ranking
                |
       +--------+---------+
       |                  |
       v                  v
installed family    explicit custom input
       |             preserves typed text
       +--------+---------+
                |
                v
            fontHints[]
                |
                v
          Profile decision
```

Interactive installed-font suggestions are local and fontconfig-bound. They
must not use a network catalogue.

The completed Interactive font-hint research deliberately chose fontconfig-only
discovery, a one-second hard deadline, and no native fallback. Issue #61 keeps
fontconfig as the intentional inventory source. It reopens alias retention,
search quality, and the overly strict discovery boundary.

Interactive should continue to call shared discovery with
`discovery: "fontconfig"`. It should not switch to `auto` or `native`, and it
does not add a discovery-source prompt. Direct `font list`, `font inspect`, and
`font check` retain their explicit `auto`, `native`, and `fontconfig` choices for
diagnostics and advanced use.

Fontconfig discovery must remain read-only, session-cached, cancellable, and
bounded so the preference flow cannot wait indefinitely. Custom input remains
available when discovery is slow, unavailable, or empty. The evidence must
establish a concrete responsiveness budget; “bounded” alone is not an
implementation oracle.

### Shared Search Record And Alias Direction

The existing `font inspect --family <name>` contract distinguishes the user's
query from the discovered family:

- the query is normalized and matched against a face's family or full name
- matching faces retain their discovered `family` value
- text output groups faces by that discovered family
- JSON output reports the query separately from each matching face's family
- `font check` resolves an unambiguous query to an actual discovered face and
  rejects ambiguous loose family matches

The fontconfig adapter currently keeps only the first comma-separated family
value and discards the remaining aliases. Issue #61 should retain those aliases
in the shared font-discovery and matching model rather than create
Interactive-only alias behavior. The searchable record has this contract:

| Field         | Meaning                                                       | Selection behavior   |
| ------------- | ------------------------------------------------------------- | -------------------- |
| `family`      | adapter-reported family suitable for a font-family preference | selected value       |
| `aliases[]`   | alternate family labels for the same family                   | search metadata only |
| `fullNames[]` | face/full names such as styled typefaces                      | search metadata only |

Aliases and full names are lookup metadata. When one of them matches, the
installed suggestion value remains the adapter-reported `family`. This keeps
Interactive selection aligned with `font inspect` without claiming that the
label is globally canonical.

For each fontconfig face, the first reported family remains the primary
`family`, remaining reported families become `aliases[]`, and all reported full
names become `fullNames[]` lookup metadata. Interactive groups faces by
normalized primary family and merges their aliases and full names into one
search record.

An alias should not replace the adapter-reported family merely because it is
assumed to be renderer-valid. Discovery and `font inspect` do not prove
renderer availability; that remains separate render or coverage evidence.

### Deterministic Ranking

The proposed search direction is a small local scorer over the shared search
record:

```text
normalized query
      |
      v
exact family / alias / full-name match
      |
      v
prefix match
      |
      v
token-prefix match
      |
      v
contiguous substring match
      |
      v
ordered-subsequence match
      |
      v
stable score, stable tie-break, six installed results
```

This is the selected research direction for Issue #61. A fuzzy-search
dependency would not solve the adapter or family-identity problem and is not
justified by the current ranking contract. Reconsider a dependency only if the
accepted implementation contract grows beyond a small, fixture-tested scorer.

Alias and full-name matches return the adapter-reported family. Explicit custom
input preserves the typed value, remains first, and is never displaced by an
installed suggestion. The implementation plan must define score thresholds and
stable tie-breaking from fixtures rather than leave library defaults or
iteration order to decide the result.

### Responsiveness Reopen Gate

Before superseding the shipped search and one-second timeout behavior, use a
repository-local evidence spike following the existing [`scripts/spikes/` timing
pattern][evidence-spike-source]. The investigation should add
`scripts/spikes/markdown-pdf-font-discovery-evidence-spike.ts` with validated
`--runs <count>` and `--timeout-ms <ms>` options. The default run count should
be 30.

The spike should:

- execute at least 30 fontconfig discovery calls serially through
  `discoverSystemFonts({ discovery: "fontconfig", includeAttempts: true })`
- record the first run separately from later warm runs
- use a monotonic clock to measure the full discovery call
- retain the fontconfig adapter attempt duration separately
- use a generous measurement ceiling rather than the proposed Interactive
  blocking budget
- record successful, failed, and timed-out attempts
- emit structured JSON to standard output so local evidence can be redirected
  under `examples/playground/.tmp-tests/`
- omit font names, font paths, raw command errors, and other host-specific
  inventory details

Report the first-run duration plus successful-call p50, p95, and maximum values
for both total discovery time and fontconfig adapter time. Also report the
attempt counts, platform, architecture, runtime, and aggregate face-count range.
Use a documented nearest-rank percentile calculation. Keep failed and timed-out
attempts in the outcome counts rather than silently removing them; calculate
latency percentiles over successful calls only.

The current discovery attempt status collapses command timeouts into ordinary
failures. The spike or shared discovery result must expose timeout explicitly;
do not infer it only from elapsed duration.

These measurements are environment evidence, not a cross-machine performance
guarantee. Validate three seconds as the initial hard-deadline candidate, then
settle the numeric maximum for user-visible blocking from cold- and warm-run
evidence. The measurements inform that budget; they do not determine it
automatically.

The one-second boundary currently appears in the subprocess timeout, an outer
deadline race, and a post-completion elapsed-time check. The implementation
should keep one effective hard safety budget, enforced by subprocess
cancellation and an outer deadline. When discovery completes successfully
before the deadline wins, accept the result; do not discard it afterward solely
because elapsed time crossed the nominal boundary.

After the timeout contract is implemented, validation must separately prove:

- the first font prompt respects the selected blocking budget
- later font prompts reuse one session-cached result without another
  fontconfig discovery call
- timeout, cancellation, empty-result, and command-failure paths keep custom
  input reachable
- an unavailable notice is not repeated within the same session

A fontconfig-reported font does not need separate WeasyPrint proof before it
appears as an installed suggestion. The picker labels local discovery, not glyph
coverage or guaranteed PDF rendering. Those remain separate validation
boundaries.

### Fontconfig Availability Boundary

Fontconfig availability differs by environment. Interactive does not fall back
to native adapters in Issue #61. When fontconfig is unavailable, empty, or
exceeds the bounded wait, the existing custom-input path remains the supported
fallback.

### Investigation And Validation Path

```text
fontconfig fixtures
  family + aliases + full names
            |
            v
ranking fixtures
  match quality + stable tie-breaks
            |
            v
live fontconfig inventory
  selectable primary families
            |
            v
repository evidence spike
  first run + total/adapter p50/p95/max
  success + failure + timeout counts
            |
            v
numeric blocking budget
            |
            v
             Issue #61 implementation plan
```

Injected fixtures must verify:

- exact, prefix, token-prefix, substring, and ordered-subsequence queries
- case and whitespace normalization
- alias and full-name matches returning the adapter-reported family
- fontconfig population of `family`, `aliases[]`, and `fullNames[]`
- grouping faces by normalized primary family and merging lookup metadata
- stable ranking, explicit tie-breaking, and exact-duplicate collapse
- custom typed input first and no more than six installed results
- one read-only discovery attempt per Interactive session
- cancellation, caching, measured timeout behavior, and empty or failed
  discovery fallback
- no network catalogue or Interactive discovery-source prompt

Live checks on the current development operating system must verify that
Interactive uses the same source as `font list --discovery fontconfig` and
produces primary-family values that can become `fontHints[]`. Custom input must
remain usable when discovery is slow, unavailable, or empty. Public evidence
records capabilities, timings, and aggregate outcomes without publishing host
font paths or a developer-specific inventory.

## Plan Handoff

| Issue | Selected direction                                                                                                                                                  | First implementation gate                                                                                                                      | Non-blocking follow-up                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| #60   | omit Template `font-family` output for slots owned by the effective compatibility Profile; preserve bounded direct-Template overrides and existing stylesheet order | reproduce direct partial-bundle and Project complete-bundle conflicts, classify ownership slots, and confirm the source-supported causal model | Interactive base-candidate and lineage wording               |
| #61   | keep fontconfig, retain aliases and full names for lookup, rank deterministically, and preserve custom input first                                                  | record cold/warm fontconfig evidence, select an explicit blocking budget, and define the Continue/Constrain/Stop decision                      | presentation refinements that do not change selection values |

The separate draft implementation plans own these evidence gates. The preferred
execution order is Issue #61 followed by Issue #60, but neither implementation
depends on the other.

## Research Exit Criteria

Keep this document `in-progress` while the direction is selected but the
reproduction, measurement, and rendered evidence needed for closure is not yet
recorded.

The research can become `completed` when:

- Issue #60 has failing direct Template and Project reproductions with distinct
  compatibility-Profile and Template preset families
- the affected body, language, heading, code, symbol, and page-chrome boundaries
  are classified
- ownership-aware omission is proven for Profile-owned slots without suppressing
  valid direct-Template `template_level` decisions
- generated CSS and rendered partial Template and complete Project bundles
  prove the selected preservation mechanism
- Issue #61 fontconfig fixtures prove primary-family, alias, and full-name
  retention plus deterministic ranking and tie-breaking
- alias and full-name matches return the primary adapter-reported family
- the fontconfig evidence spike records public-safe first-run, total, and
  adapter latency evidence plus failure and timeout counts
- the evidence produces an explicit blocking budget and an implementation
  validation contract for near-boundary success, timeout, cancellation,
  fallback, and caching
- public evidence avoids host font paths and developer-specific inventories

The linked plans are execution contracts, not completion evidence. Keep this
research `in-progress` until their required evidence is recorded.

## Related Plans

- [Interactive Markdown PDF installed-font search implementation](../plans/plan-2026-07-26-interactive-markdown-pdf-installed-font-search.md)
- [Markdown PDF Profile font preservation implementation](../plans/plan-2026-07-26-markdown-pdf-profile-font-preservation.md)

## Related Research

- [Markdown PDF Codex Font Patch Contract][font-patch-research]
- [Markdown PDF Template Codex Helper][template-helper-research]
- [Markdown PDF Project Codex Helper][project-helper-research]
- [Markdown PDF Interactive Font Hint Suggestions][interactive-font-research]
  — completed fontconfig baseline whose search and timeout boundaries this draft
  proposes to refine after responsiveness evidence is accepted
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
- [Shared platform-aware font discovery][font-discovery-source]
- [Shared font family matching][font-matching-source]
- [`font inspect` action and output][font-inspect-source]
- [Fontconfig family parsing][fontconfig-source]
- [Existing evidence-spike timing pattern][evidence-spike-source]

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
[font-discovery-source]: ../../src/fonts/discovery.ts
[font-matching-source]: ../../src/fonts/matching.ts
[font-inspect-source]: ../../src/cli/actions/font.ts
[fontconfig-source]: ../../src/fonts/adapters/fontconfig.ts
[evidence-spike-source]: ../../scripts/spikes/docx-pdf-title-evidence-spike.ts
