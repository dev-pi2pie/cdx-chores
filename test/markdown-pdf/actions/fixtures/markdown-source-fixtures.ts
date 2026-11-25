const visible = [
  "# Visible heading",
  "",
  "| Item | Count |",
  "| ---- | ----: |",
  "| Live | 1 |",
].join("\n");
const example = ["~~~js", "", "# Example heading", "", "~~~"].join("\n");
const literal = [
  '<textarea title="literal > closer">',
  "",
  "~~~python",
  "# Literal code",
  "| Hidden | Code |",
  "~~~",
  "",
  "# Literal heading",
  "| Hidden | Row |",
  "</textarea>",
].join("\n");
const summary = "<summary>Notes</summary>";
const literalAfterProse = "Text before <textarea>\n\n# Literal\n\n| Literal | Pipe |\n</textarea>";

function beforeFence(
  name: string,
  prefix: string,
  acceptsFence = true,
  leadingHeadings: string[] = [],
) {
  return {
    name,
    markdown: [prefix, example, "", visible].join("\n"),
    headings: [...leadingHeadings, ...(acceptsFence ? [] : ["Example heading"]), "Visible heading"],
    languages: acceptsFence ? ["js"] : [],
  };
}

export const markdownSourceFixtures = [
  beforeFence("closed-textarea", literal),
  beforeFence("closed-pre", literal.replaceAll("textarea", "pre")),
  beforeFence("textarea-after-prose", literalAfterProse),
  beforeFence("pre-after-prose", literalAfterProse.replaceAll("textarea", "pre")),
  beforeFence(
    "wrapped-textarea-after-prose",
    "Text before " + literal.replace(" title", "\n title"),
  ),
  beforeFence(
    "textarea-opener-inside-inline-code",
    "Text before `<textarea>`\n\n# Visible before close\n\n</textarea>",
    true,
    ["Visible before close"],
  ),
  beforeFence(
    "pre-opener-inside-quoted-attribute",
    'Text before <span title="<pre>">note</span>\n\n# Visible before close\n\n</pre>',
    true,
    ["Visible before close"],
  ),
  beforeFence("unclosed-textarea", "<textarea>\n\n# Recovered heading\n", true, [
    "Recovered heading",
  ]),
  beforeFence("summary-adjacent", summary, false),
  beforeFence("summary-blank-line", summary + "\n"),
  beforeFence("summary-wrapped-close", summary.replace("</summary>", "</summary\n>"), false),
  beforeFence("unclosed-div", '<div class="note">\n\n# Container heading\n', true, [
    "Container heading",
  ]),
  beforeFence("matched-fenced-div", "::: {.note}\nNotes\n:::"),
  beforeFence("fenced-div-namespaced-class", "::: ns:note\nNotes\n:::"),
  beforeFence("fenced-div-class-ending-colons", "::: note:::\nNotes\n:::"),
  beforeFence("fenced-div-braced-opener-with-adjacent-colons", "::: {.note}:::\nNotes\n:::"),
  beforeFence("fenced-div-split-class-is-not-an-opener", "::: . note\nNotes\n:::", false),
  beforeFence("matched-nested-fenced-divs", "::::: {.outer}\n::: inner\nNotes\n::::\n:::"),
  beforeFence("bare-unmatched-div-close", "Plain prose\n:::", false),
  beforeFence("div-opener-adjacent-to-prose", "Plain prose\n::: {.note}\nNotes\n:::", false),
  {
    ...beforeFence(
      "div-opener-inside-code-fence",
      "```text\n::: {.note}\n```\n\nPlain prose\n:::",
      false,
    ),
    languages: ["text"],
  },
  beforeFence(
    "div-opener-inside-verbatim",
    "<pre>\n::: {.note}\n</pre>\n\nPlain prose\n:::",
    false,
  ),
  beforeFence("block-close-after-prose", "Text before </div>"),
  beforeFence(
    "wrapped-block-close-after-prose",
    "Text before <section\n class=note>Notes</section>",
  ),
  beforeFence("block-close-inside-inline-code", "Text before `</div>`", false),
  beforeFence(
    "block-close-inside-quoted-attribute",
    'Text before <span title="</div>">Notes</span>',
    false,
  ),
  beforeFence("block-close-with-prose-after", "Text before </div> and after.", false),
  beforeFence("matched-p-adjacent-comment", "<p>Notes</p><!-- note\nends -->"),
  beforeFence("matched-p-spaced-comment", "<p>Notes</p> <!-- note\nends -->", false),
  beforeFence("bare-p-spaced-comment", "</p> <!-- note\nends -->"),
  beforeFence(
    "wrapped-and-quoted-tag",
    '<p\n title="literal </p> > delimiter">Notes</p> <!-- note\nends -->',
    false,
  ),
  beforeFence(
    "quoted-fake-opener",
    '<span title="literal <p> > delimiter">Notes</span>\n</p> <!-- note\nends -->',
  ),
  beforeFence("inline-fake-opener", "`<p>`\n</p> <!-- note\nends -->"),
  beforeFence(
    "real-tag-after-inline-code",
    "``fake ` </p>`` <p>Notes</p> <!-- note\nends -->",
    false,
  ),
  beforeFence(
    "different-code-delimiters",
    "``intro `\n# Literal inline heading\n| Hidden | Inline |\nends``\n",
  ),
  beforeFence("closed-comment-then-real-tag", "<!-- boundary -->" + literal),
  beforeFence(
    "verbatim-then-comment",
    literal + "<!--\n# Hidden comment\n| Hidden | Comment |\n-->",
  ),
  {
    ...beforeFence(
      "fence-before-comment",
      "```text\n<!--\n<textarea>\n```\n<!-- distinct comment -->",
    ),
    languages: ["text", "js"],
  },
  beforeFence(
    "indented-code-before-actual-markdown",
    "    <!--\n    <textarea>\n\n<!-- distinct comment -->",
  ),
  beforeFence("unclosed-apparent-fence", "~~~~md\n# Recovered heading\n", true, [
    "Recovered heading",
  ]),
  beforeFence("closed-comment-with-inner-opener", "<!-- outer\n<!-- inner\n# Literal\n-->"),
  {
    name: "abandoned-comment-before-table",
    markdown:
      "<!-- abandoned\n\n" +
      visible.slice(visible.indexOf("|")) +
      "\n\n<!-- distinct comment -->\n\n# Visible heading",
    headings: ["Visible heading"],
    languages: [],
  },
  beforeFence(
    "abandoned-comment",
    "<!-- unclosed\n# Recovered heading\n\n<!-- distinct comment -->",
    true,
    ["Recovered heading"],
  ),
  beforeFence(
    "incomplete-quoted-tag-before-heading",
    '<div title="abandoned\n# Recovered heading\n<span title="other">text</span>\n',
    true,
    ["Recovered heading"],
  ),
  beforeFence(
    "markdown-looking-lines-in-wrapped-attribute",
    '<div title="wrapped\n# Literal heading\n| Hidden | Attribute |\n">\n',
  ),
  {
    ...beforeFence(
      "apparent-comment-close-inside-fence",
      "<!-- abandoned\n\n# Recovered heading\n\n~~~sh\n-->\n~~~\n",
      true,
      ["Recovered heading"],
    ),
    languages: ["sh", "js"],
  },
  {
    ...beforeFence(
      "apparent-textarea-close-inside-fence",
      "<textarea>\n\n# Recovered heading\n\n~~~sh\n</textarea>\n~~~\n",
      true,
      ["Recovered heading"],
    ),
    languages: ["sh", "js"],
  },
  beforeFence(
    "real-close-after-fenced-textarea-delimiter",
    literal.replace(
      "~~~python\n# Literal code",
      "# Literal heading before apparent fence\n\n~~~python\n</textarea>",
    ),
  ),
  {
    name: "closed-textarea-with-apparent-fence",
    markdown: ["<textarea>", "", "~~~text", "</textarea>", "~~~", "", visible].join("\n"),
    headings: ["Visible heading"],
    languages: [],
  },
  {
    name: "incomplete-tag-before-pipe-table",
    markdown: visible
      .replace("| Item | Count |", '<div title="unfinished\n| Item | Count |')
      .replace("| Live | 1 |", '| Live | 1 |\n<span title="other">text</span>'),
    headings: ["Visible heading"],
    languages: [],
  },
  {
    name: "summary-rejected-closer-then-valid-fence",
    markdown: [summary, example, "", visible, "", "~~~sh", "echo ok", "~~~"].join("\n"),
    headings: ["Example heading", "Visible heading"],
    languages: ["sh"],
  },
];
