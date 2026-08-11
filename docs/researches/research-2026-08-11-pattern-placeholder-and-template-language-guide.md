---
title: "Pattern, Placeholder, and Template Language Guide"
created-date: 2026-08-11
status: draft
agent: codex
---

## Goal

Define one user-facing guide that helps readers identify and use the different
pattern, regex, placeholder, and template languages exposed by `cdx-chores`
without implying that they share one grammar, evaluator, or execution scope.

The guide should cover the visibly similar surfaces used by rename, data stack,
and Markdown PDF while preserving each feature's existing source of truth and
advanced guide ownership.

## Research At A Glance

The CLI exposes five visibly similar but behaviorally different language
surfaces: rename filename templates, rename candidate regexes, data stack input
globs, Markdown PDF Profile placeholders, and Pandoc HTML templates. One
task-oriented guide should help readers choose among them, understand their
evaluation and failure boundaries, quote them safely, and reach the canonical
feature guide.

The result is shared documentation, not a shared template engine. Current
Markdown PDF placeholder behavior can be documented from shipped evidence;
new page-number controls and diagnostics remain gated on their implementation
handoff.

## Scope

This research covers:

- all current CLI and Profile surfaces named pattern, regex, placeholder, or
  template
- the user-facing purpose, syntax, evaluation scope, and failure behavior of
  each surface
- shell and YAML quoting guidance
- literal text, reserved terms, escaping, and unknown-token behavior
- canonical ownership between one cross-feature guide and existing guides
- concise examples that can be checked against current implementation and tests
- link updates needed to make the new guide discoverable
- terminology improvements to CLI help where “pattern” is ambiguous

This research does not:

- replace rename, glob, Markdown PDF, or Pandoc parsing with one engine
- teach SQL, CSS, Markdown, regular expressions, or Pandoc templates in full
- treat generated names such as `column_1` as brace placeholders
- document proposed Markdown PDF fields as shipped before implementation
- own the renderer and migration decisions for Markdown PDF page numbers

Those PDF decisions belong to
[Markdown PDF Page-Number Configuration][page-number-research].

## Current State

### Current Language Map

The guide should begin with “What are you trying to do?” because similar option
names do not imply similar behavior:

| Surface                      | User task                 | Representative input     | Evaluates over                                  | Failure or non-match behavior                              |
| ---------------------------- | ------------------------- | ------------------------ | ----------------------------------------------- | ---------------------------------------------------------- |
| rename filename template     | generate output filenames | `{date}-{stem}-{serial}` | each rename candidate                           | malformed or unknown placeholder is an error               |
| rename candidate regex       | select or exclude files   | `--match-regex '^IMG_'`  | each candidate basename                         | invalid regex is an error; non-match is filtered           |
| data stack input glob        | select discovered inputs  | `--pattern '*.csv'`      | directory discoveries by relative path/basename | non-match is filtered; explicit files bypass glob          |
| Markdown PDF Profile text    | generate document text    | `Page {page}`            | cover or page-chrome resolver context           | missing metadata is empty; page terms are context-reserved |
| Pandoc Markdown PDF template | define document HTML      | `$if(title)$...$endif$`  | whole document                                  | Pandoc-defined                                             |

These are observable user contracts, not parser abstractions. Rename templates
also own parameterized serial rules, timestamp variants, and filename safety;
data stack globs operate within recursion, depth, and hidden-file discovery
rules; Profile text values do not include style fields; and Pandoc templates
must preserve the structural hooks required by `md to-pdf`.

### Current Documentation Gaps

| Surface      | Current documentation gap                                                             |
| ------------ | ------------------------------------------------------------------------------------- |
| rename       | complete details exist, but token and timestamp inventories are duplicated            |
| data stack   | path-versus-basename matching and explicit-file bypass are not prominent              |
| Markdown PDF | brace grammar, resolver scopes, missing values, and Pandoc distinction are incomplete |
| repository   | no task-oriented guide compares selection, text substitution, and document templating |

### Current Evidence Map

| Language surface      | Implementation evidence                 | Canonical current guide                            |
| --------------------- | --------------------------------------- | -------------------------------------------------- |
| rename brace template | strict parser and token validation      | rename common and timestamp guides[^rename-source] |
| rename regex filters  | option registration and basename filter | rename scope guide[^rename-regex-source]           |
| data stack glob       | input-router path/basename matcher      | data stack guide[^data-source]                     |
| PDF Profile text      | Profile normalization and two resolvers | Markdown PDF guide[^pdf-source]                    |
| Pandoc HTML template  | built-in recipe and required hooks      | Template helper[^pandoc-source]                    |

These sources establish shipped behavior. Proposed page-number configuration
must pass the separate handoff below before the new guide presents it as
available.

## Proposed Guide Contract

### Terminology

The guide should distinguish four reader-facing nouns:

| Term          | Meaning in the guide                                                        |
| ------------- | --------------------------------------------------------------------------- |
| pattern       | a value used to match or select inputs                                      |
| template      | a value or artifact used to generate output                                 |
| placeholder   | a named field substituted inside a text template                            |
| document hook | a required Pandoc construct or HTML marker preserved by a document template |

Feature names may retain backward-compatible CLI options, but prose should add
the language family on first use:

- “rename filename template (`--pattern`)”
- “data stack input glob (`--pattern`)”
- “Markdown PDF Profile text placeholder”
- “Pandoc HTML template (`--template`)”

This avoids treating the overloaded option name as the definition.

CLI help, Interactive prompts, guide headings, and diagnostics should use these
semantic names consistently while preserving the established option names.
`--pattern` remains the public option for both rename and data stack; this docs
work does not introduce aliases, deprecations, or flag migration.

### Guide Structure

Recommended path and title:

```text
docs/guides/patterns-placeholders-and-templates.md
Patterns, Placeholders, and Templates
```

1. **Choose the right language**
   - task-oriented subset of the current language map
2. **Rename filename templates**
   - brace syntax, strict validation, evaluation scope, and links
3. **Rename candidate filters**
   - selection versus generation, basename scope, invalid regex, and links
4. **Data stack input globs**
   - directory-only scope, relative path/basename matching, traversal, and links
5. **Markdown PDF Profile placeholders**
   - metadata source, reserved values, missing values, text-only boundary, and links
6. **Pandoc Markdown PDF templates**
   - `$...$` structural syntax, required hooks, and links
7. **Quoting, validation, and references**
   - shell/YAML quoting, literal syntax, failure comparison, and canonical guides

The guide remains representative rather than exhaustive. Rename regex receives
both a comparison row and a compact subsection, but the guide does not teach
regular expressions generally.

### Shared Documentation Rules

Every language section should:

- state whether the value selects input or generates output
- state the exact evaluation scope
- identify reserved characters and terms
- state invalid, unknown, missing, and non-match behavior as applicable
- provide one safely quoted shell example
- provide one configuration example when applicable
- document escaping or explicitly state that it is unavailable
- distinguish defaults, embedded parameters, and CLI precedence
- link to the authoritative advanced contract

Literal-brace behavior must be documented as each implementation behaves now.
Rename templates reject malformed, empty, or unknown placeholders. Markdown
PDF Profile text retains its context-specific resolver behavior and has no
first-slice escape for a literal reserved token. Pandoc retains its own rules.
Any shared escape proposal belongs in separate compatibility research.

These are shared documentation rules, not a shared engine. Rename needs strict
filename tokens, data stack needs glob matching, Markdown PDF needs metadata
and renderer state, and Pandoc owns its template language.

### Canonical Ownership And Duplication

The central guide should be comprehensive in coverage without copying each
feature's detailed contract:

| Information                                       | Canonical owner                                  |
| ------------------------------------------------- | ------------------------------------------------ |
| language choice and cross-feature comparison      | new cross-feature guide                          |
| shared shell/YAML quoting guidance                | new cross-feature guide                          |
| concise current vocabulary and validation summary | new cross-feature guide                          |
| rename serial and timestamp details               | rename guides and timestamp matrix               |
| data traversal, schema, and output behavior       | data stack guide                                 |
| PDF renderer, page scope, and page-chrome details | Markdown PDF usage and page-number research/plan |
| Pandoc bundle and managed-asset details           | Markdown PDF Template helper guide               |

The central guide may show representative tokens, but it should link instead of
copying exhaustive timestamp, serial, renderer, or hook tables. Existing feature
guides keep one discoverable example and their canonical details. The first
guide pass should:

- shorten the duplicated `Pattern/Template Coverage` inventory in
  `rename-scope-and-codex-capability-guide.md` to one representative example,
  scope/analyzer-relevant facts, and links to the two canonical rename guides
- replace the README's exhaustive placeholder enumeration with representative
  token families, one quick example, and a link to `rename-common-usage.md`
- keep the complete token/serial contract in `rename-common-usage.md`, exact
  timestamp variants in `rename-timestamp-format-matrix.md`, and only
  representative rename tokens in the cross-feature guide

This preserves distinct reader jobs: the README provides discovery, the
cross-feature guide selects a language, and feature guides define exact
behavior.

## Delivery And Validation

### Documentation And Help Audit

Audit:

- every CLI option containing `pattern`, `template`, `regex`, or placeholder
  wording
- Interactive prompt wording and inline completion help
- all current guide placeholder inventories
- CLI examples for shell-safe quoting
- generated Profile examples and Markdown PDF helper patch paths
- links among rename common usage, rename capability, timestamp matrix, data
  stack usage, Markdown PDF usage, and Template helper docs
- README or command-index locations where the new guide should be discoverable

Classify each occurrence as:

- keep as the canonical detailed definition
- shorten and link to the central guide
- update terminology for clarity
- remove as stale duplication

The README guide index is the primary discovery target. The new guide also
needs inbound links from `rename-common-usage.md`, `data-stack-usage.md`,
`markdown-pdf-usage.md`, and the Markdown PDF Template helper. All five entry
points must resolve without broken relative links.

### Evidence Gates

| Guide row        | Required evidence before publication                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| rename template  | parser tests for braces, unknown tokens, and serial validation                           |
| rename regex     | command/planner tests proving selection rather than generation and invalid-regex failure |
| data stack glob  | input-router tests for directories, explicit files, and recursion                        |
| PDF Profile text | shipped schema/resolver tests for current behavior; handoff for new page-number behavior |
| Pandoc template  | Template-Codex hook validation and built-in recipe tests                                 |

### Page-Number Handoff

The cross-feature guide may publish the current Markdown PDF placeholder row
from shipped resolver evidence. It must not describe proposed `start`,
`increment`, `scope`, `countFrom`, styling, collision diagnostics, or new
renderer behavior as shipped until the page-number implementation supplies this
handoff:

| Contract area        | Required handoff                                                                     |
| -------------------- | ------------------------------------------------------------------------------------ |
| schema               | shipped field names, values, defaults, and invalid combinations                      |
| numbering model      | `scope` visibility, `countFrom` origin, arithmetic, and `{pages}` physical meaning   |
| placeholder language | reserved terms, metadata precedence, missing/unknown/braces, and unsupported escapes |
| diagnostics          | warning/error conditions, channel, status, frequency, and structured output          |
| Template behavior    | document-origin warning inference and body-origin missing-hook hard failure          |
| renderer gates       | capability baselines and unsupported-control failures                                |
| evidence             | linked schema, resolver, Template, diagnostic, and renderer tests                    |

The handoff must also confirm that `format` remains Profile-only, short
placeholders remain supported, and first-slice namespaces are not shipped. The
guide should link the stable handoff rather than copy exploratory research
prose.

### Completion Criteria

1. Complete the source, CLI-help, Interactive, and current-guide inventory.
2. Bind every language-map row to the evidence gates above.
3. Validate shell and YAML examples against shipped behavior.
4. Apply the ownership reductions without removing feature-level discovery.
5. Validate the README and four feature-guide inbound links.
6. Record incoherent implementation behavior as a separate code follow-up; do
   not silently standardize it in documentation.
7. Run formatter and link checks, `git diff --check`, and a focused docs review.

## Related Research

- [Markdown PDF Page-Number Configuration][page-number-research]
- [Rename Pattern Router And Docs UX V1][rename-pattern-research]

## References

[data-stack-guide]: ../guides/data-stack-usage.md
[markdown-pdf-guide]: ../guides/markdown-pdf-usage.md
[markdown-pdf-template-guide]: ../guides/markdown-pdf-codex-template-helper.md
[page-number-research]: research-2026-08-11-markdown-pdf-page-number-configuration.md
[rename-common-guide]: ../guides/rename-common-usage.md
[rename-pattern-research]: archive/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md
[rename-scope-guide]: ../guides/rename-scope-and-codex-capability-guide.md
[rename-timestamp-guide]: ../guides/rename-timestamp-format-matrix.md

Current guide evidence:

- [Rename Common Usage][rename-common-guide]
- [Rename Scope And Codex Capability Guide][rename-scope-guide]
- [Rename Timestamp Format Matrix][rename-timestamp-guide]
- [Data Stack Usage][data-stack-guide]
- [Markdown PDF Usage][markdown-pdf-guide]
- [Markdown PDF Template Helper][markdown-pdf-template-guide]

[^rename-source]: [Rename template parser](../../src/cli/rename/planner/pattern.ts), [rename template tests](../../test/cli-rename-template.test.ts), and [rename planner tests](../../test/cli-fs-utils-rename-template.test.ts)

[^rename-regex-source]: [Rename filter implementation](../../src/cli/actions/rename/filters.ts), [rename command options](../../src/cli/commands/rename.ts), and [rename filter tests](../../test/cli-actions-rename-batch-filters.test.ts)

[^data-source]: [Data stack input router](../../src/cli/data-stack/input-router.ts) and [input-router tests](../../test/data-stack-input-router.test.ts)

[^pdf-source]: [Markdown PDF page-chrome resolver](../../src/cli/markdown-pdf/profile/page-chrome.ts), [cover placeholder resolver](../../src/cli/markdown-pdf/profile/placeholders.ts), and [recipe tests](../../test/cli-actions-md-to-pdf-recipe.test.ts)

[^pandoc-source]: [Built-in Pandoc recipe](../../src/cli/markdown-pdf/recipe.ts), [Template-Codex hook contract](../../src/cli/markdown-pdf/template-codex/families.ts), and [Template-Codex family tests](../../test/cli-actions-md-to-pdf-template-codex/families.test.ts)
