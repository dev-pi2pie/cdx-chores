---
title: "Patterns, Placeholders, and Templates"
created-date: 2026-08-16
status: completed
agent: codex
---

## Goal

Help readers choose and use the pattern, regular-expression, placeholder, and
template languages exposed by `cdx-chores`.

These surfaces can look similar, but they do not share one grammar, evaluator,
or execution scope. Some select inputs, some generate filenames or document
text, and one defines the HTML structure of an entire document.

## Choose The Right Language

| If you want to...                             | Use                           | Representative value     | Evaluates over                                  |
| --------------------------------------------- | ----------------------------- | ------------------------ | ----------------------------------------------- |
| generate output filenames                     | rename filename template      | `{date}-{stem}-{serial}` | each rename candidate                           |
| include or exclude rename candidates          | rename regular expression     | `--match-regex '^IMG_'`  | each candidate basename                         |
| select files discovered from data directories | data stack input glob         | `--pattern '*.csv'`      | directory discoveries by relative path/basename |
| generate Markdown PDF text                    | PDF Profile text placeholders | `Page {page}`            | cover or repeating page-content context         |
| define Markdown PDF document HTML             | Pandoc HTML template          | `$if(title)$...$endif$`  | the whole document                              |

The overloaded option name `--pattern` does not identify one shared language:

- `rename ... --pattern` is a filename template that generates output.
- `data stack ... --pattern` is a glob that selects directory-discovered input.

## Rename Filename Templates

Use a rename filename template when the value should construct each output
basename:

```bash
cdx-chores rename batch ./photos \
  --pattern '{date}-{stem}-{serial}' \
  --dry-run
```

Rename templates use brace placeholders. Representative families include
`{prefix}`, `{stem}`, `{uid}`, date and timestamp variants, and parameterized
`{serial...}` placeholders. Placeholder values are resolved for each rename
candidate.

Malformed, empty, and unknown placeholders are errors. Serial placeholders
also have their own validation and precedence rules. Use at most one
`{serial...}` placeholder in a template.

For the complete token, serial, timestamp, and filename-safety contracts, see:

- [Rename Common Usage](rename-common-usage.md)
- [Rename Timestamp Format Matrix](rename-timestamp-format-matrix.md)
- [Rename Scope And Codex Capability Guide](rename-scope-and-codex-capability-guide.md)

## Rename Candidate Regular Expressions

Use rename regular-expression filters when the value should select candidates,
not generate names:

```bash
cdx-chores rename batch ./photos \
  --match-regex '^IMG_' \
  --skip-regex '-backup$' \
  --dry-run
```

`--match-regex` includes basenames that match. `--skip-regex` excludes
basenames that match. A valid expression that does not match simply filters the
candidate; an invalid expression is an error.

Regular-expression syntax is JavaScript `RegExp` syntax. Quote expressions in
the shell so characters such as `*`, `$`, parentheses, and backslashes reach
the CLI unchanged.

## Data Stack Input Globs

Use a data stack input glob when directory discovery should select matching
input files:

```bash
cdx-chores data stack ./exports \
  --pattern '*.csv' \
  --output ./combined.csv
```

The glob is tested against both the normalized path relative to each supplied
directory and that path's basename. This allows basename-oriented values such
as `*.csv` and path-oriented values such as `reports/*.csv`.

`--pattern` filters only candidates expanded from directory sources. A file
supplied explicitly is included directly and does not need to match the glob.
A non-match is filtered rather than treated as an error. Recursion, depth,
hidden-file, format, and schema rules remain part of the data stack contract.

Quote globs in the shell so the shell does not expand them before
`cdx-chores` receives the value.

For the complete discovery and stacking contract, see
[Data Stack Usage](data-stack-usage.md).

## Markdown PDF Profile Text Placeholders

Markdown PDF Profiles use brace placeholders in text-bearing cover, header,
footer, and page-number format fields:

```yaml
cover:
  enabled: true
  fields:
    title: "{title}"
    subtitle: "Prepared for {company}"

footer:
  left: "{author}"

pageNumbers:
  enabled: true
  format: "Page {page} of {pages}"
```

Metadata placeholders resolve after CLI metadata, Markdown frontmatter,
Profile metadata, and derived defaults are merged. Missing or unknown metadata
becomes empty text.

Page-number and repeating-content text also reserves four exact,
case-sensitive terms:

| Placeholder  | Meaning                                         |
| ------------ | ----------------------------------------------- |
| `{page}`     | current logical number                          |
| `{pages}`    | final logical number in the same sequence       |
| `{pdfPage}`  | one-based physical position in the rendered PDF |
| `{pdfPages}` | physical page count of the rendered PDF         |

Malformed brace text remains literal. There is currently no literal-brace
escape syntax or namespaced placeholder form. These placeholders apply only to
supported text values; CSS and other style fields are not placeholder text.

For metadata precedence, page roles, numbering domains, diagnostics, and
renderer requirements, see [Markdown PDF Usage](markdown-pdf-usage.md).

## Pandoc Markdown PDF Templates

A Pandoc HTML template defines whole-document HTML rather than substituting
Profile text or generating filenames. It uses Pandoc's `$...$` template
language:

```html
<main class="document-body">
  $if(title)$
  <h1>$title$</h1>
  $endif$ $body$
</main>
```

Pandoc defines variable, conditional, loop, and escaping behavior. The
Markdown PDF pipeline additionally requires compatible structural hooks.
Managed templates contain exactly one live `$body$` insertion point inside one
`.document-body` element so body-scoped rendering behavior can be applied
safely.

Use `md pdf-template init` for a deterministic editable template snapshot or
`md pdf-template codex` for a bounded generated template bundle. For the
managed hook, asset, stylesheet, and Profile-compatibility contract, see
[Markdown PDF Codex Template Helper](markdown-pdf-codex-template-helper.md).

## Quoting And Failure Boundaries

Prefer single quotes for shell values when the value should reach the CLI
literally:

```bash
cdx-chores rename file ./IMG_1024.JPG --pattern '{date}-{stem}' --dry-run
cdx-chores rename batch ./photos --match-regex '^IMG_\d+$' --dry-run
cdx-chores data stack ./exports --pattern '**/*.csv' --output ./combined.csv
```

Quote Profile text in YAML, especially when it includes braces, punctuation,
leading special characters, or values that YAML could interpret:

```yaml
header:
  center: "{title}"
pageNumbers:
  format: "Page {page} / {pages}"
```

The failure boundary depends on the language:

| Language                  | Invalid or unknown input                           | Valid non-match or missing value       |
| ------------------------- | -------------------------------------------------- | -------------------------------------- |
| rename filename template  | malformed or unknown placeholder is an error       | not applicable; the template generates |
| rename regular expression | invalid expression is an error                     | candidate is filtered                  |
| data stack input glob     | Node path glob-matching rules apply                | directory candidate is filtered        |
| PDF Profile placeholder   | malformed braces stay literal                      | missing metadata becomes empty text    |
| Pandoc HTML template      | Pandoc and Markdown PDF compatibility checks apply | Pandoc-defined                         |

Do not transfer escaping, missing-value, or failure assumptions from one row to
another. Follow the linked feature guide when exact behavior matters.
