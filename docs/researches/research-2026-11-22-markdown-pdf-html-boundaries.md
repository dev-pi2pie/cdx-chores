---
title: "Markdown PDF AST-based rendering"
created-date: 2026-11-22
status: completed
agent: codex
---

## Research question

How should Markdown PDF use Pandoc’s parsed document for rendering decisions while preserving source-based authoring signals and custom-template behavior?

## Parsing direction

| Area | Direction |
| --- | --- |
| Built-in automatic title | Use Pandoc’s AST when the mode is `auto`, front matter supplies a nonempty string title, and the cover is disabled. |
| Source signals | Use a shared source scanner for fence-only counts, source table metrics, and Profile, Template, and Project authoring. Keep the existing bounded signal schema and count limits. |
| Custom templates | Keep the direct Markdown-to-HTML path. An AST handoff must preserve the original `$sourcefile$` and fallback `$pagetitle$` before it can replace that path. |

## Built-in renderer

For the eligible built-in path, use `Markdown → Pandoc JSON → standalone HTML` with the installed Pandoc’s `--from=markdown` reader. Parse once, build the template from the title decision, and write HTML from the same AST. Use the direct path for explicit `show` and `hide`, cover-driven titles, and renders without a nonempty string title. Keep document preparation independent of Pandoc and run the two invocations during render execution. [Title recipe](../../src/cli/markdown-pdf/recipe.ts#L77-L97) · [Render preparation](../../src/cli/actions/markdown/to-pdf-service.ts#L137) · [Render execution](../../src/cli/actions/markdown/to-pdf-service.ts#L320)

Keep the Markdown working directory, writer options, TOC settings, and asset handling aligned with direct rendering. Report which stage failed, preserve warnings from both stages, and stop before producing a PDF on failure. With Pandoc 3.9, the JSON handoff added 24–29 ms to Pandoc time in representative one- and 21-page renders. Full PDF wall time varied within the observed run-to-run spread. On 2.0 and 3.9, the two paths preserved page counts and extracted text with the same template. The title correction reduced the visible title from two copies to one and preserved PDF title metadata. [Current render arguments](../../src/cli/markdown-pdf/render.ts#L201-L220)

### Heading and title comparison

Select the first level-one Markdown `Header` in document order at the top level or inside native Divs. Both ATX and Setext headings qualify. Skip raw HTML and verbatim bodies. Descend through Divs only, so headings in quotes, lists, tables, and footnotes stay outside the comparison.

Project the parsed metadata title and the selected H1 to displayed text using the same rules. Compare without regard to case and collapse whitespace. Preserve punctuation, including in inline code. Support plain text, emphasis, strong text, smart quotes, inline code, and link labels. Keep the metadata block if either side has unsupported formatting such as math, images, or spans. Stop at the first eligible H1 even if its formatting prevents comparison.

Keep the metadata block if suppressing it would drop a distinct link target. A metadata link must have a matching label and destination in the eligible heading. For the regression case below, retain the metadata title and both destinations. When both links use the same destination, the metadata title can be suppressed.

```markdown
---
title: "[Read the guide](https://example.com/quickstart)"
---

# [Read the guide](https://example.com/reference)
```

In the example below, both Pandoc 2.0 and 3.9 recognize the H1 inside the Div as the first Markdown H1. The source selector at `0428193a` picks `Hidden heading` and repeats the metadata title. Using the parsed H1 suppresses that duplicate and leaves the body headings intact. A raw HTML `<h1>` remains visible in HTML and does not enter Markdown H1 selection.

```markdown
---
title: Nested title
---

<pre>
# Hidden heading
</pre>

<h1>Raw HTML heading</h1>

<div class="note">

# Nested title

</div>

# Later heading
```

## Source scanning

| Signal | Why it needs source text |
| --- | --- |
| Fence-only counts | An unlabeled tilde fence and an indented code block can produce identical `CodeBlock` nodes. |
| Source table metrics | Pipe tables with source widths of 16 and 36 characters can produce identical `Table` nodes. The existing row count also includes the divider and can count pipe prose. |
| Offline authoring | Profile, Template, and Project use a common collector that runs with or without Pandoc. The Pandoc Markdown reader rejects `markdown+sourcepos` in both 2.0 and 3.9. |

Refine the [source scanner](../../src/cli/markdown-pdf/profile/fence-signals.ts) around a quote-aware cursor that returns the exact end of each tag, comment, verbatim body, or inline code span. Pair those offsets with block context. A quoted `>` can appear before a tag ends, and a real tag can start on the same line after a closing code span. Consumers should resume from the same offset so an apparent fence cannot hide a following heading or table. [Bounded document signals](../../src/cli/markdown-pdf/profile/signals.ts)

A matched `</p>` with an adjacent multiline comment admits the following tilde fence in both versions. A space before that comment can suppress the fence, while a bare `</p>` with the same space admits it. Keep these three cases together, with a visible H1 and pipe table after the apparent fence. Incomplete tags and comments should leave subsequent Markdown visible.

Use the same offline boundary rules regardless of which Pandoc version is available.

| Boundary | Source-scanner policy |
| --- | --- |
| Closed `textarea` | Treat the body as literal and resume after the close. Pandoc 2.0 can parse Markdown inside the body. |
| Tilde fence after `</summary>` | Require a blank line before the fence, including after a wrapped closing tag. Pandoc 3.9 can start the fence without that blank line. |
| Unclosed `div` | Continue scanning Markdown through the body. Pandoc 2.0 can leave that content at the top level and 3.9 can nest it in the Div. Offline counts include it either way. |

## Custom-template compatibility

Pandoc populates `$sourcefile$` from the input to the HTML writer. A JSON file with the original basename preserves the fallback `$pagetitle$` but still changes the source entry. For an untitled `context.md`, the behavior is:

| HTML writer input | `$sourcefile$` | Fallback `$pagetitle$` |
| --- | --- | --- |
| `context.md` read as Markdown | `context.md` | `context` |
| `ast/context.md` read as JSON | `ast/context.md` | `context` |
| `ast/checkpoint.json` read as JSON | `ast/checkpoint.json` | `checkpoint` |

Passing `--variable sourcefile:context.md` inserts another entry alongside the JSON path. Pandoc 2.0 lists the JSON path first and 3.9 lists the Markdown path first. A compatible custom-template path must expose the same single original source entry and fallback page title as direct rendering.

## Related Plans

- [Markdown PDF AST rendering implementation](../plans/plan-2026-11-22-markdown-pdf-ast-rendering.md)
