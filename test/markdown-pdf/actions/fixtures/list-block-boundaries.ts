import assert from "node:assert/strict";

import { markdownSourceFixtures } from "./markdown-source-fixtures";

export const pipeBody = "| fenced | sample |";
const visible = "# Visible heading\n\n| Item | Count |\n| ---- | ----: |\n| Live | 1 |";

function listCase(name: string, prefix: string, margin: string, fence: string, fenced: boolean) {
  const block = [fence + "python", pipeBody, fence].map((line) => margin + line).join("\n");
  return { name, markdown: prefix + block + "\n\n" + visible, fenced };
}

export const listBoundaryCases = [
  listCase("numbered", "1. Item\n\n", "    ", "```", true),
  listCase("nested-verse", "- - | poem\n", " ", "~~~", true),
  listCase("document-verse", "| poem\n", " ", "~~~", false),
  listCase("empty-six", "- -\n", " ".repeat(6), "~~~", true),
  listCase("empty-seven", "- -\n", " ".repeat(7), "~~~", false),
  listCase("padded-seven", "- -" + " " + "\n", " ".repeat(7), "~~~", true),
  listCase("document-fence", "", "", "```", true),
  listCase("document-literal", "", "    ", "```", false),
];

function source(name: string) {
  const fixture = markdownSourceFixtures.find((candidate) => candidate.name === name);
  assert.ok(fixture, name);
  return fixture.markdown;
}

// Fail if an upstream fixture edit would silently erase the contrast between two variants.
function replaceOnce(markdown: string, original: string, replacement: string) {
  assert.ok(
    markdown.includes(original) && markdown.indexOf(original) === markdown.lastIndexOf(original),
  );
  return markdown.replace(original, replacement);
}

function inItem(block: string) {
  return (
    "1. Item\n\n" +
    block
      .split("\n")
      .map((line) => "    " + line)
      .join("\n")
  );
}

function recoveryPair(kind: "comment" | "textarea", delimiter: string) {
  const base = source("apparent-" + kind + "-close-inside-fence");
  const block = "~~~sh\n" + delimiter + "\n~~~";
  const opener = kind === "comment" ? "<!-- abandoned" : "<textarea>";
  return [
    { placement: "document", markdown: base },
    { placement: "item", markdown: replaceOnce(base, block, inItem(block)) },
  ].flatMap(({ placement, markdown }) => [
    { name: kind + "-" + placement, markdown, recovered: true },
    {
      name: kind + "-" + placement + "-early-close",
      markdown: replaceOnce(markdown, opener + "\n", opener + "\n" + delimiter + "\n"),
      recovered: true,
    },
  ]);
}

const textarea = source("apparent-textarea-close-inside-fence");
const shellFence = "~~~sh\n</textarea>\n~~~";
const sibling = "\n\n2. Sibling";
const laterClose = source("real-close-after-fenced-textarea-delimiter");
const pythonFence = "~~~python\n</textarea>\n| Hidden | Code |\n~~~";

export const htmlBoundaryCases = [
  ...recoveryPair("comment", "-->"),
  ...recoveryPair("textarea", "</textarea>"),
  {
    name: "closer-in-item",
    markdown: replaceOnce(textarea, shellFence, inItem(shellFence) + sibling),
    recovered: true,
  },
  {
    name: "closer-in-sibling",
    markdown: replaceOnce(
      textarea,
      shellFence,
      inItem("~~~sh\n</textarea>") + sibling + "\n\n    ~~~",
    ),
    recovered: false,
  },
  { name: "genuine-close-after-document", markdown: laterClose, recovered: false },
  {
    name: "genuine-close-after-item",
    markdown: replaceOnce(laterClose, pythonFence, inItem(pythonFence)),
    recovered: false,
  },
  {
    name: "closed-textarea",
    markdown: source("closed-textarea-with-apparent-fence"),
    recovered: false,
  },
];
