import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterTypes as Html } from "parse5";

import { shouldSuppressMarkdownPdfMetadataTitle } from "../../../src/cli/markdown-pdf/ast-title";
import { collectMarkdownPdfTitleSignals } from "../../../src/cli/markdown-pdf/profile/signals";
import { createMarkdownPdfTemplate } from "../../../src/cli/markdown-pdf/recipe";
import { parseMarkdown } from "../../../src/markdown";

const quickstart = "https://example.com/quickstart";
const reference = "https://example.com/reference";
const linkTitle = `[Read the guide](${quickstart})`;

interface ExpectedHtml {
  headingId: string;
  metadataLinks: string[];
  headingLinks: string[];
}

interface AstTitleFixture {
  name: string;
  title: string | number;
  body: string;
  suppress: boolean;
  nestedHeadings?: string[];
  html?: ExpectedHtml;
}

export const astTitleFixtures: AstTitleFixture[] = [
  {
    name: "atx",
    title: "Build Guide",
    body: "## Preface\n\n# build   guide",
    suppress: true,
  },
  {
    name: "nested-div-setext",
    title: "Build guide",
    body: '<div class="outer">\n\n<div class="inner">\n\nBuild guide\n===========\n\n</div>\n\n</div>',
    suppress: true,
  },
  {
    name: "raw-and-verbatim-before-div",
    title: "Nested title",
    body: [
      "<pre>",
      "# Hidden heading",
      "</pre>",
      "",
      "<h1>Raw HTML heading</h1>",
      "",
      '<div class="note">',
      "",
      "# Nested title",
      "",
      "</div>",
      "",
      "# Later heading",
    ].join("\n"),
    suppress: true,
    html: { headingId: "nested-title", metadataLinks: [], headingLinks: [] },
  },
  {
    name: "ignored-heading-containers",
    title: "Body heading",
    body: [
      "> # Quote heading",
      "",
      "- Preface",
      "",
      "  # List heading",
      "",
      "+-------------------+-------+",
      "| # Table heading   | Cell  |",
      "+-------------------+-------+",
      "",
      "A reference.[^later]",
      "",
      "[^later]:",
      "",
      "    # Footnote heading",
      "",
      "# Body heading",
    ].join("\n"),
    suppress: true,
    nestedHeadings: ["quote-heading", "list-heading", "table-heading", "footnote-heading"],
  },
  {
    name: "earlier-h1",
    title: "Build guide",
    body: '# Earlier\n\n<div class="note">\n\n# Build guide\n\n</div>',
    suppress: false,
  },
  {
    name: "formatted-text",
    title: "*Build* **guide** “A”",
    body: '# Build guide "A"',
    suppress: true,
  },
  {
    name: "code-same",
    title: "Run `build_task()`",
    body: "# Run build_task()",
    suppress: true,
  },
  {
    name: "code-punctuation-differs",
    title: "Run `build_task()`",
    body: "# Run buildtask",
    suppress: false,
  },
  {
    name: "unsupported-metadata",
    title: "Plan $x$",
    body: "# Plan $x$",
    suppress: false,
  },
  {
    name: "unsupported-earlier-h1",
    title: "Build guide",
    body: "# [Build guide]{.qualified}\n\n# Build guide",
    suppress: false,
  },
  {
    name: "blank-metadata",
    title: " ",
    body: "# Build guide",
    suppress: false,
  },
  {
    name: "numeric-metadata",
    title: 15,
    body: "# 15",
    suppress: false,
  },
  {
    name: "links-same-destination",
    title: linkTitle,
    body: `# [Read the guide](${quickstart}) {#guide-heading}`,
    suppress: true,
    html: { headingId: "guide-heading", metadataLinks: [], headingLinks: [quickstart] },
  },
  {
    name: "links-distinct-destinations",
    title: linkTitle,
    body: `# [Read the guide](${reference}) {#guide-heading}`,
    suppress: false,
    html: { headingId: "guide-heading", metadataLinks: [quickstart], headingLinks: [reference] },
  },
  {
    name: "link-missing-in-heading",
    title: linkTitle,
    body: "# Read the guide",
    suppress: false,
  },
  {
    name: "link-label-differs",
    title: linkTitle,
    body: `# [Read the](${quickstart}) guide`,
    suppress: false,
  },
];

function containsHeading(value: unknown, id: string): boolean {
  if (Array.isArray(value)) return value.some((child) => containsHeading(child, id));
  if (!value || typeof value !== "object" || !("c" in value)) return false;
  if ("t" in value && value.t === "Header" && Array.isArray(value.c)) {
    const [level, attributes] = value.c;
    return level === 1 && Array.isArray(attributes) && attributes[0] === id;
  }
  return containsHeading(value.c, id);
}

function elements(root: Html.Node, tag: string): Html.Element[] {
  const own = "tagName" in root && root.tagName === tag ? [root] : [];
  return "childNodes" in root
    ? own.concat(root.childNodes.flatMap((node) => elements(node, tag)))
    : own;
}

function attribute(node: Html.Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function checkHtml(html: string, suppress: boolean, expected: ExpectedHtml) {
  const doc = parse(html);
  const [main] = elements(doc, "main");
  assert(main, "missing main document body");
  const headers = elements(main, "header").filter(
    (header) => attribute(header, "class") === "document-title",
  );
  assert.equal(headers.length, suppress ? 0 : 1, "unexpected document title block");
  const [metadataTitle] = headers;
  const section = elements(main, "section").find(
    (candidate) => attribute(candidate, "id") === expected.headingId,
  );
  const heading =
    elements(main, "h1").find((h1) => attribute(h1, "id") === expected.headingId) ??
    (section && elements(section, "h1")[0]);
  assert(heading, "missing eligible body heading");
  assert.deepEqual(
    metadataTitle ? elements(metadataTitle, "a").map((anchor) => attribute(anchor, "href")) : [],
    expected.metadataLinks,
    "metadata title link destinations",
  );
  assert.deepEqual(
    elements(heading, "a").map((anchor) => attribute(anchor, "href")),
    expected.headingLinks,
    "body heading link destinations",
  );
}

export async function verifyAstTitleFixture(
  fixtureDir: string,
  runPandoc: (args: readonly string[]) => Promise<{ stdout: string }>,
  fixture: AstTitleFixture,
): Promise<string | undefined> {
  const markdownFile = fixture.name + ".md";
  const checkpointFile = fixture.name + ".json";
  const source = `---\ntitle: ${JSON.stringify(fixture.title)}\n---\n\n${fixture.body}\n`;
  await writeFile(join(fixtureDir, markdownFile), source, "utf8");
  const { stdout } = await runPandoc([markdownFile, "--from", "markdown", "--to", "json"]);
  const document = JSON.parse(stdout);
  await writeFile(join(fixtureDir, checkpointFile), stdout, "utf8");

  for (const headingId of fixture.nestedHeadings ?? []) {
    assert(
      document.blocks.some(
        (block: { t: string }) => block.t !== "Header" && containsHeading(block, headingId),
      ),
      "missing nested H1: " + headingId,
    );
  }
  const parsed = parseMarkdown(source);
  const suppress = shouldSuppressMarkdownPdfMetadataTitle(document, parsed.data?.title);
  assert.equal(suppress, fixture.suppress, fixture.name);
  if (!fixture.html) return;

  const template = fixture.name + ".template.html";
  const output = fixture.name + ".html";
  const signals = collectMarkdownPdfTitleSignals(parsed.content, parsed.data);
  await writeFile(
    join(fixtureDir, template),
    createMarkdownPdfTemplate({
      titleSignals: { ...signals, duplicateVisibleTitleRisk: suppress },
    }),
    "utf8",
  );
  await runPandoc([
    checkpointFile,
    "--standalone",
    "--from",
    "json",
    "--to",
    "html",
    "--template",
    template,
    "--output",
    output,
  ]);
  const outputPath = join(fixtureDir, output);
  checkHtml(await readFile(outputPath, "utf8"), suppress, fixture.html);
  return outputPath;
}
