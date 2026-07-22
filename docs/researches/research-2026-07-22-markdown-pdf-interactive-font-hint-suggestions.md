---
title: "Markdown PDF Interactive Font Hint Suggestions"
created-date: 2026-07-22
modified-date: 2026-07-22
status: completed
agent: codex
---

## Goal

Define an optional installed-font suggestion experience for repeatable Markdown
PDF Codex font hints without weakening custom input, inferring language needs,
or creating a new direct CLI or persisted schema.

The direct helper contract remains authoritative:

```text
--font-hint <text>  # repeatable; all values enter one Codex request
```

Interactive mode may help a user build each text value, but it must ultimately
produce the same ordered `fontHints: string[]` payload.

This research is `completed` because Phase 6.6 implemented the selected
direction and recorded focused, repository, real-prompt, fallback, privacy,
cancellation, and exact-range review evidence.

## Problem

The baseline Interactive editor can add and remove repeatable text values, but
one plain `Font family hint` prompt leaves three concerns mixed together:

1. which family or font preference the user means
2. where that preference should apply
3. whether the user wants a fully custom instruction

Hard-coded language examples can also make the flow appear to prescribe a
particular language set. At the same time, requiring users to type exact
installed family names wastes the read-only font inventory already available
through the shared font discovery module.

Installed-font suggestions are useful input assistance, but they do not prove:

- glyph coverage for a selected language
- renderer availability or final PDF output
- shaping quality, fallback behavior, or emoji presentation
- that the user wants a discovered family for any specific role

The flow therefore needs separate preference and usage decisions with a full
custom escape path.

## Current Contracts

### Repeatable direct input

Profile, Template, and Project Codex helpers accept repeated `--font-hint`
values. Whitespace-only values are removed and all remaining values are sent in
one request. One hint should represent one distinct preference; it does not
start a separate Codex request.

### Shared local discovery

`src/fonts/discovery.ts` already exposes platform-aware, read-only discovery:

| Platform                          | `auto` discovery behavior                        |
| --------------------------------- | ------------------------------------------------ |
| macOS                             | prefer fontconfig, then use `system_profiler`    |
| Linux                             | use fontconfig through `fc-list`                 |
| Windows                           | use native registry discovery through PowerShell |
| unsupported or failed environment | return no usable inventory and warnings          |

The direct `font` commands may continue to use this broader `auto` behavior.
Phase 6.6 has a narrower latency contract: it should reuse the shared service
with explicit `fontconfig` discovery and must not fall back to
`system_profiler`, PowerShell, or another platform-native inventory when
`fc-list` is unavailable.

### Accepted font assignments

The durable Profile contract distinguishes body, heading, code, and page-chrome
roles. Body may also carry validated language keys, and code may carry a symbol
key. Template-level decisions cover body, heading, and code roles.

A pre-Codex font hint does not assign one of these roles directly. It expresses
a preference and optional intended use. Codex may then propose a supported
role/key assignment, which validation either accepts or reports as unmatched.
Interactive wording must preserve that distinction.

## Scope

This research covers:

- an Interactive font-hint builder and full-custom path
- optional installed-family suggestions while typing
- optional intended uses for general body text, language-specific body text,
  headings, code text, code symbols, and Profile/Project page chrome
- discovery loading, caching, failure, timeout, and cancellation behavior
- editing, removal, ordering, and exact-duplicate handling
- consent and privacy boundaries
- deterministic tests with injected discovery results

It does not cover:

- changes to direct `--font-hint` options
- a persisted Interactive font-hint schema
- automatic language detection or language-list suggestions
- automatic font selection or hint insertion
- structured writing-system or arbitrary document-area targeting
- font installation or environment mutation
- glyph-coverage validation inside the input prompt
- a guarantee that a discovered family will render identically in a PDF

## Interaction Principles

- Custom text remains the primary contract; discovery only assists it.
- A user chooses a preference and may add one supported intended use.
- No language is preselected or inferred.
- Exact installed family names are suggestions, not validation requirements.
- Intended use is advisory until Codex returns a validated role/key assignment.
- The final compiled hint is visible before consent; the actual accepted font
  decision is visible in recipe review.
- Only accepted hint text enters the Codex request or report.
- The complete local family inventory and font-file paths remain local.
- Missing discovery never blocks authoring.

## Proposed Interaction

### 1. Edit the ordered hint collection

```text
Font hints:
- Prefer Source Serif 4 for body text
- Prefer JetBrains Mono for code text

? Edit font hints
❯ Add font hint
  Edit font hint
  Remove font hint
  Done
```

`Edit` and `Remove` appear only when at least one hint exists. Summaries render
one hint per line rather than joining values with commas.

### 2. Choose builder or complete custom input

```text
? Add font hint
❯ Build a font hint
  Write a complete custom hint
  Back
```

`Write a complete custom hint` accepts one non-empty string unchanged after
trimming. It supports fallback stacks, nuanced directions, or instructions
that do not fit the builder.

### 3. Build preference and intended use separately

When fontconfig discovery succeeds, typing filters unique installed family
names while the typed value remains the first selectable custom choice:

```text
? Font preference
  Type freely, or select an installed font family.

> Source Ser

❯ Source Ser
  Source Serif 4
  Source Serif Pro

  Use the typed text as a custom font preference.
```

Selecting a discovered family uses its exact family name. Keeping custom text
does not require that it match the local inventory. The custom choice's visible
name and completed value must both remain the raw typed text; explanatory copy
belongs in its description because `@inquirer/search` uses the visible choice
name for Tab completion. If a discovered family exactly matches the typed text
case-insensitively, the result list collapses the duplicate-looking installed
choice.

The currently pinned `@inquirer/search` behavior supports this model: each
source refresh falls back to the first selectable result, and a newer search
term aborts the prior source callback. Phase 6.6 should still verify Enter,
arrow navigation, Tab completion, paste, input-method-editor input, and narrow
terminal output before treating the interaction as accessible evidence.

The preference picker reuses the path picker's typing and sibling-navigation
muscle memory, but presents a visible flat result list instead of path-style
ghost completion. Its keyboard contract is:

| Input     | Behavior                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Type      | Filter installed-family suggestions and restore the custom typed value as the active first choice              |
| Up / Down | Move the active choice without changing the typed query; stop at the first or last result rather than wrapping |
| Enter     | Accept the active custom or installed value                                                                    |
| Tab       | Copy the active value into the query and continue editing                                                      |
| Escape    | Cancel the prompt through the normal Interactive navigation path                                               |

Typing after arrow navigation refreshes the results and returns focus to the
custom choice. Left and Right retain ordinary prompt behavior; they do not
accept a font suggestion or navigate a font-specific hierarchy. This differs
intentionally from the path picker, where Tab or Right may accept inline ghost
completion and Enter submits the currently typed path.

The next prompt collects one optional, supported intended use:

```text
? Intended use
❯ Keep this preference general
  Body text
  Language-specific body text
  Headings and titles
  Code text
  Code symbols
  Page headers and footers
  Back
```

`Page headers and footers` appears only for Profile and Project preparation.
Template preparation omits that unsupported Profile-owned use.

`Language-specific body text` asks for exactly one user-owned value:

```text
? Language name or tag
  Enter one language for this font hint.

> <language name or tag>
```

The prompt does not provide, infer, or autocomplete a language list. Multiple
languages use separate structured hints so each later body-language assignment
remains independently reviewable.

Writing systems and arbitrary document areas do have real use cases, but they
do not map cleanly to dedicated current font slots. The structured builder does
not offer them. A user may still express an unusual need through `Write a
complete custom hint`, where it remains advisory rather than appearing to be a
guaranteed assignment.

### 4. Preview the compiled direct equivalent

```text
Font hint preview

Preference: <font preference>
Intended use: Body text — <language name or tag>

Compiled hint:
Prefer <font preference> for <language name or tag> body text

Direct option:
--font-hint = Prefer <font preference> for <language name or tag> body text

Assignment: determined during Codex preparation

? Font hint next step
❯ Add this font hint
  Revise font preference
  Revise intended use
  Write a complete custom hint
  Back
```

Compilation remains deterministic:

| Intended use                 | Compiled text                                      |
| ---------------------------- | -------------------------------------------------- |
| Keep this preference general | `Prefer <preference>`                              |
| Body text                    | `Prefer <preference> for body text`                |
| Language-specific body text  | `Prefer <preference> for <language> body text`     |
| Headings and titles          | `Prefer <preference> for headings and titles`      |
| Code text                    | `Prefer <preference> for code text`                |
| Code symbols                 | `Prefer <preference> for code symbols`             |
| Page headers and footers     | `Prefer <preference> for page headers and footers` |

A general preview omits the `Intended use` line. A complete custom hint bypasses
the builder compiler, keeps the user's trimmed text, and labels its input mode
instead of trying to extract a preference or intended use.

```text
Font hint preview

Input mode: complete custom

Compiled hint:
<complete custom font direction>

Direct option:
--font-hint = <complete custom font direction>

Assignment: determined during Codex preparation
```

`Direct option` uses an option/value presentation instead of shell quoting. It
remains exact across shells even when custom input contains quote characters or
other shell-sensitive text.

### 5. Review the actual post-Codex mapping

The hint preview shows request intent, not the output assignment. Recipe review
should separately show the accepted validated result:

```text
Accepted font decision

Role: body
Key: <validated language tag>
Family: <font family>
Source: font hint
```

If Codex cannot fit the direction into a supported role/key, recipe review
shows it as unmatched rather than pretending the requested use was assigned.

```text
Unmatched font direction

Direction: <compiled hint>
Assignment: not applied to a supported font role
```

## Discovery And Fallback

Installed-family suggestions use a fontconfig-only capability boundary:

```text
discoverSystemFonts(fontconfig)
        |
        +-- usable families -> searchable suggestions
        |
        `-- fc-list unavailable / failed / empty / timed out
                            -> ordinary preference input
```

The builder remains usable without suggestions:

```text
Installed font suggestions are unavailable; continuing with custom input.

? Font preference
  Enter a family name or custom preference.

> My Company Sans
```

The intended-use prompt still follows. The full-custom path also remains
available, so discovery never gates either form of hint authoring.

Discovery rules:

- start lazily when the user enters the builder
- use a `1,000 ms` hard deadline from command start through parsed inventory
- show one concise waiting status only when discovery exceeds approximately
  `150 ms`, and clear it before the preference prompt or fallback notice
- discover at most once per Interactive session
- cache either the usable inventory or the unavailable result
- filter cached families in memory; never run a command per keystroke
- deduplicate family names and sort them deterministically
- keep the typed custom value first and cap installed-family results at six
- expose family names only, never font-file paths
- do not prompt to install fontconfig or another system tool
- do not try a native platform fallback when `fc-list` is unavailable
- allow an explicit retry after an unavailable result without retrying
  automatically on every hint

The complete-custom path remains selectable before discovery begins. The built
path may wait only within the one-second deadline before it falls back to the
ordinary preference input. Direct `font` command strategies and timeouts must
not change implicitly as part of this work.

### Shared cancellation contract

Discovery cancellation belongs in the shared API because an Interactive-only
adapter cannot reliably stop the underlying system process. The additive input
and runner contracts should accept optional controls:

```ts
interface DiscoverFontsInput {
  discovery?: FontDiscoveryStrategy;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface FontDiscoveryRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}
```

Existing direct callers omit these values and preserve their current defaults.
Phase 6.6 supplies the session-owned abort signal and the one-second budget.
Back, Cancel, or Interactive exit aborts the active discovery and its child
process without showing a fallback warning. A timeout, missing `fc-list`, empty
inventory, or real discovery failure shows the one concise fallback notice.

Search-term cancellation remains a separate, narrower layer. The
`@inquirer/search` callback checks its per-refresh signal and silently discards
obsolete filtering work while the shared session signal owns the one system
discovery operation.

## Editing And Duplicates

Interactive session state may retain a narrow non-persisted draft union:

```ts
type InteractiveFontIntendedUse =
  | { kind: "body" }
  | { kind: "language-body"; language: string }
  | { kind: "heading" }
  | { kind: "code" }
  | { kind: "code-symbols" }
  | { kind: "page-chrome" };

type InteractiveFontHintDraft =
  | {
      kind: "built";
      preference: string;
      intendedUse?: InteractiveFontIntendedUse;
    }
  | { kind: "custom"; text: string };
```

Before consent, every draft compiles to one ordered string. The prepared Codex
setup continues to expose only `fontHints: string[]`.

Editing a built hint can revise its preference, intended use, or both. Editing
a custom hint edits its whole text. Exact duplicate compiled strings are
rejected with a visible message instead of being ignored silently.

The editor must not treat repeated intended uses as automatic conflicts. Two
hints may express primary and fallback preferences for the same use. Codex and
the validated candidate review own semantic resolution; Interactive collection
owns only exact-duplicate prevention and clear ordered review.

Changing accepted font hints invalidates the prepared Codex candidate. The flow
returns through consent and regenerates only through an explicit preparation or
regeneration action. Output-path changes still do not regenerate.

## Privacy And Consent

The consent review shows only compiled accepted hints:

```text
Font hints:
- Prefer Source Serif 4 for body text
- Prefer JetBrains Mono for code text
```

It must not include:

- the complete discovered family inventory
- font file paths
- discovery commands or raw stderr
- machine-specific adapter diagnostics
- discarded search terms or suggestions

Diagnostic reports follow the same boundary and retain only the selected hint
strings already present in the direct helper request contract.

## Verification Direction

Automated tests should use injected discovery results and cover:

- custom text with and without available suggestions
- raw custom-choice naming, first-choice stability, Enter, arrow, and Tab
  behavior
- exact family selection, exact-match collapsing, and deterministic filtering
- family deduplication, stable ordering, and bounded result pages
- builder compilation for every artifact-supported intended use
- one user-entered language name or tag without inference or language lists
- complete custom hints
- add, edit, remove, ordering, and exact duplicates
- discovery called once and filtered in memory
- available, missing, failed, empty, timed-out, cancelled, and retried
  fontconfig discovery
- shared signal propagation to the command runner and child-process
  cancellation on Back, Cancel, and Interactive exit
- no native-platform fallback when `fc-list` is unavailable
- consent and Codex payload exclusion of inventories and font paths
- prepared-candidate invalidation only when accepted hint inputs change

Manual evidence should cover one suggestion-capable environment and one forced
fallback path. Public records should state capability and outcome generically;
they should not list the developer machine's inventory, paths, or setup steps.

## Settled Direction

- Keep direct font hints repeatable, ordered, and free-text.
- Add a structured builder plus a complete-custom escape path.
- Separate font preference from optional intended use.
- Keep language-specific body text user-authored and singular per built hint.
- Exclude structured writing-system and arbitrary document-area uses from the
  first builder; keep unusual directions in the complete-custom path.
- Suggest installed families only in the preference field.
- Use the shared discovery service in explicit `fontconfig` mode; when
  `fc-list` is unavailable, provide no automatic suggestions and do not try a
  native platform fallback.
- Give Interactive discovery a one-second hard deadline, delayed waiting
  feedback, session caching, and one concise fallback notice.
- Keep raw custom text as the first search choice, put its explanation in the
  choice description, cap installed matches at six, and collapse an exact
  duplicate-looking family result.
- Preserve the builder with ordinary text input when discovery is unavailable.
- Add optional cancellation and timeout controls to the shared discovery and
  command-runner contracts; keep per-search cancellation separate from
  session-owned system discovery cancellation.
- Never infer coverage, language, renderer support, intended use, or the final
  accepted role/key assignment.
- Compile each Interactive draft to one existing `--font-hint` equivalent.
- Send only accepted compiled hints to Codex.
- Implement this follow-up in a separate Phase 6.6 after the Phase 6.5 base UX
  refinement.

## Required Verification Evidence

The design questions are settled. Closure evidence confirms that:

- the raw custom value remains the stable first selection across filtering and
  the documented non-wrapping Up/Down, Enter-to-accept, Tab-to-complete, and
  typing-to-reset behavior remains usable with paste and input-method-editor
  input
- a large injected inventory is filtered in memory and never renders more than
  the custom choice plus six installed-family suggestions
- the one-second fontconfig budget, delayed waiting status, caching, and
  no-native-fallback behavior avoid an unbounded Interactive pause
- the shared abort signal stops the underlying discovery process, while rapid
  search-term changes cancel only obsolete filtering work

These checks do not reopen the free-text, privacy, fallback, or direct-contract
decisions above. The linked Phase 6.6 record now supplies the required evidence.

## Implementation Evidence

- The real pinned search prompt preserved custom-first filtering,
  non-wrapping sibling navigation, Enter acceptance, Tab completion, and
  committed Unicode input in a narrow terminal.
- Controlled suggestion-capable and forced-fallback prompt runs completed
  without exposing the host font inventory or development setup.
- Shared cancellation reached the discovery runner and child process; an
  overall Interactive deadline race aborted late discovery and returned to
  ordinary input.
- Injected inventories proved deterministic deduplication, stable ordering,
  exact-match collapse, and the custom choice plus six installed suggestions.
- Consent, Codex preparation, and review tests retained only accepted compiled
  hint strings and validated mappings, without inventory or font-path leakage.
- The full repository suite passed with 1,679 tests and no failures; build,
  type, lint, formatting, and diff checks also passed.
- The exact Phase 6.6 range `95817df..ca84d63` was reviewed after the fixes
  landed, with no actionable findings remaining.

## Related Research

- [Markdown PDF Interactive Mode](research-2026-07-03-markdown-pdf-interactive-mode.md)
- [Font Command Discovery Options](research-2026-05-07-font-command-discovery-options.md)
- [Font Inspect And Check Commands](research-2026-05-07-font-inspect-and-check-commands.md)
- [Markdown PDF Codex Font Patch Contract](research-2026-06-16-markdown-pdf-codex-font-patch-contract.md)

## Related Plans

- [Markdown PDF Interactive Mode implementation](../plans/plan-2026-07-21-markdown-pdf-interactive-mode.md)
- [Phase 6.6 font hint suggestions](../plans/jobs/2026-07-22-markdown-pdf-interactive-phase-6-6-font-hint-suggestions.md)
