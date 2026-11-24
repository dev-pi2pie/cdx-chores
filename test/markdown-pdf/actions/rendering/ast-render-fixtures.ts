import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, parseFragment, type DefaultTreeAdapterTypes as Html } from "parse5";

import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  prepareMarkdownPdfRender,
} from "../../../../src/cli/actions/markdown/to-pdf-service";
import type { ExecCommandResult } from "../../../../src/cli/process";
import { createCapturedRuntime } from "../../../helpers/cli-test-utils";
import { htmlBoundaryCases, listBoundaryCases, pipeBody } from "../fixtures/list-block-boundaries";
import { ok } from "./render-support";
import { attribute, boundaryStructure, elements, text } from "./rendered-html";

const quickstart = "https://example.com/quickstart";
const reference = "https://example.com/reference";
const linkTitle = `---\ntitle: "[Read the guide](${quickstart})"\n---\n\n`;
const customTemplate = [
  "<!doctype html><html><head><title>$pagetitle$</title></head><body>",
  '<ul id="sourcefiles">$for(sourcefile)$<li>$sourcefile$</li>$endfor$</ul>',
  '<main class="document-body">$body$</main>',
  "</body></html>",
].join("\n");

const boundaryTitle = "Boundary report";
const boundaryRenderFixtures = [
  "definition-continuation",
  "compact-mixed-list",
  "quote-in-item",
  "numbered",
  "document-literal",
  "comment-item-early-close",
  "textarea-item",
].flatMap((boundary) => {
  const body = [...listBoundaryCases, ...htmlBoundaryCases].find(({ name }) => name === boundary);
  assert(body, boundary);
  return [false, true].map((split) => ({
    name: boundary + (split ? " via JSON" : " direct"),
    boundary,
    split,
    markdown: (split ? `---\ntitle: ${boundaryTitle}\n---\n\n` : "") + body.markdown,
  }));
});

interface RenderFixture {
  name: string;
  split: boolean;
  markdown: string;
  template?: string;
  boundary?: string;
}

export const astRenderFixtures: RenderFixture[] = [
  {
    name: "matching-link-and-render-assets",
    split: true,
    markdown:
      linkTitle +
      [
        "<pre>",
        "# Hidden heading",
        "</pre>",
        "",
        '<div class="note">',
        "",
        `# [Read the guide](${quickstart}) {#guide}`,
        "",
        "</div>",
        "",
        "# Visible",
        "",
        "## Included",
        "",
        "### Excluded",
        "",
        "![Diagram](assets/figure.svg)",
        "",
        "```js",
        "const message = 'hello';",
        "```",
        "",
        "| Example | Value |",
        "| --- | --- |",
        "| A | B |",
        "",
      ].join("\n"),
  },
  {
    name: "distinct-links",
    split: true,
    markdown: linkTitle + `# [Read the guide](${reference}) {#guide}\n`,
  },
  {
    name: "unsupported-math",
    split: true,
    markdown: "---\ntitle: Plan $x$\n---\n\n# Plan $x$\n",
  },
  {
    name: "untitled-built-in",
    split: false,
    markdown: "# Visible\n\n![Diagram](assets/figure.svg)\n",
  },
  {
    name: "custom-template-context",
    split: false,
    markdown: "# Visible\n",
    template: customTemplate,
  },
  ...boundaryRenderFixtures,
];

function links(node: Html.Node) {
  return elements(node, "a").map((link) => attribute(link, "href"));
}

function checkBoundaryHtml(
  fixture: RenderFixture,
  main: Html.Element,
  reference: { html: string; version: string },
) {
  const expected = boundaryStructure(parseFragment(reference.html));
  if (fixture.split) expected.headings.unshift(boundaryTitle);
  const actual = boundaryStructure(main);
  assert.deepEqual(actual, expected, fixture.name + " on " + reference.version);

  const old = reference.version === "pandoc 2.0";
  if (!old && reference.version !== "pandoc 3.9") return;
  const headings =
    fixture.boundary === "comment-item-early-close"
      ? ["Recovered heading", "Visible heading"]
      : ["Visible heading"];
  if (fixture.split) headings.unshift(boundaryTitle);
  assert.deepEqual(actual.headings, headings);
  const js = { text: "\n# Example heading", languages: ["js"], lists: [] };
  if (fixture.boundary === "numbered") {
    assert.equal(actual.items.length, 1);
    assert.deepEqual(actual.items[0]!.lists, ["ol"]);
    assert(actual.items[0]!.text.includes(pipeBody));
    assert.deepEqual(
      actual.blocks,
      old ? [] : [{ text: pipeBody, languages: ["python"], lists: ["ol", "li"] }],
    );
  }
  if (fixture.boundary === "document-literal") {
    assert.deepEqual(actual.blocks, [
      { text: "```python\n" + pipeBody + "\n```", languages: [], lists: [] },
    ]);
  }
  if (fixture.boundary === "comment-item-early-close") {
    assert.deepEqual(
      actual.blocks,
      old ? [js] : [{ text: "-->", languages: ["sh"], lists: ["ol", "li"] }, js],
    );
  }
  if (fixture.boundary === "textarea-item") {
    // 2.0 emits its recovered AST heading inside the textarea, where HTML treats it as text.
    assert.equal(actual.textareas.length, 1);
    assert(
      actual.textareas[0]!.includes(
        old ? '<h1 id="recovered-heading">Recovered heading</h1>' : "# Recovered heading",
      ),
    );
    assert.deepEqual(actual.blocks, old ? [js] : [{ text: "~~~", languages: [], lists: [] }, js]);
  }
}

function checkRenderedHtml(
  fixture: RenderFixture,
  html: string,
  sourcefile: string,
  readerOutput?: { html: string; version: string },
) {
  const doc = parse(html);
  const [main] = elements(doc, "main");
  assert(main, "missing rendered main body");
  if (readerOutput) {
    checkBoundaryHtml(fixture, main, readerOutput);
    return;
  }
  const titleBlocks = elements(main, "header").filter(
    (node) => attribute(node, "class") === "document-title",
  );
  switch (fixture.name) {
    case "matching-link-and-render-assets": {
      assert.equal(titleBlocks.length, 0);
      const bodyHeading = elements(main, "h1").find(
        (node) => text(node).replace(/\s+/g, " ") === "Read the guide",
      );
      assert(bodyHeading, "missing linked body H1");
      assert.deepEqual(links(bodyHeading), [quickstart]);
      assert(elements(main, "img").some((node) => attribute(node, "src") === "assets/figure.svg"));
      assert(
        elements(main, "pre").some((node) =>
          attribute(node, "class")?.includes("cdx-code--highlighted"),
        ),
      );
      assert.deepEqual(elements(main, "td").map(text), ["A", "B"]);
      const toc = elements(doc, "nav").find((node) => attribute(node, "id") === "TOC");
      assert(toc, "missing table of contents");
      const destinations = links(toc);
      assert(destinations.includes("#visible"));
      assert(destinations.includes("#included"));
      assert(!destinations.includes("#excluded"));
      break;
    }
    case "distinct-links": {
      assert.equal(titleBlocks.length, 1);
      const heading = elements(main, "h1").find((node) => attribute(node, "id") === "guide");
      assert(heading, "missing distinct body H1");
      assert.deepEqual(links(titleBlocks[0]!), [quickstart]);
      assert.deepEqual(links(heading), [reference]);
      break;
    }
    case "unsupported-math":
      assert.equal(titleBlocks.length, 1);
      assert.equal(elements(main, "h1").length, 2);
      break;
    case "untitled-built-in":
      assert.equal(titleBlocks.length, 0);
      assert.deepEqual(elements(doc, "title").map(text), ["Markdown PDF"]);
      assert(elements(main, "img").some((node) => attribute(node, "src") === "assets/figure.svg"));
      break;
    case "custom-template-context": {
      const sourceList = elements(doc, "ul").find(
        (node) => attribute(node, "id") === "sourcefiles",
      );
      assert(sourceList, "missing original sourcefile list");
      assert.deepEqual(elements(sourceList, "li").map(text), [sourcefile]);
      assert.deepEqual(elements(doc, "title").map(text), ["context"]);
      break;
    }
    default:
      assert.fail("unexpected fixture " + fixture.name);
  }
}

export async function verifyAstRenderFixture(
  dir: string,
  runPandoc: (args: readonly string[], cwd: string) => Promise<ExecCommandResult>,
  fixture: RenderFixture,
  sourceArgument = (path: string) => path,
) {
  const input = join(dir, "context.md");
  const template = join(dir, "custom-template.html");
  const publishedHtml = join(dir, "rendered.html");
  const output = join(dir, "rendered.pdf");
  const assets = join(dir, "assets");
  await mkdir(assets);
  await writeFile(
    join(assets, "figure.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>',
  );
  await writeFile(input, fixture.markdown);
  if (fixture.template) await writeFile(template, fixture.template);
  // Compare both routes to a standalone invocation of this reader and writer on the original input.
  let referenceHtml: { html: string; version: string } | undefined;
  if (fixture.boundary) {
    const version = await runPandoc(["--version"], dir);
    const fragment = await runPandoc([input, "--from", "markdown", "--to", "html"], dir);
    assert(version.ok, version.stderr);
    assert(fragment.ok, fragment.stderr);
    referenceHtml = { html: fragment.stdout, version: version.stdout.split(/\r?\n/)[0]! };
  }
  const { runtime } = createCapturedRuntime({ cwd: dir });
  const prepared = await prepareMarkdownPdfRender(runtime, {
    input,
    toc: true,
    tocDepth: 2,
    // Preserve Pandoc's original language classes in the boundary assertions.
    codeHighlight: !fixture.boundary,
    template: fixture.template ? template : undefined,
  });
  const plan = await planMarkdownPdfRender(runtime, prepared, {
    output,
    htmlOutput: publishedHtml,
  });

  const conversions: string[] = [];
  let rendererInput: string | undefined;
  await executePlannedMarkdownPdfRender(runtime, plan, {
    runner: async (command, args, options) => {
      if (command === "pandoc") {
        if (!args.includes("--version")) {
          assert.equal(options?.cwd, dir);
          const from = args[args.indexOf("--from") + 1];
          const to = args[args.indexOf("--to") + 1];
          conversions.push(`${from}:${to}`);
          if (fixture.template) assert.equal(args[0], input);
        }
        return await runPandoc(args, options?.cwd ?? dir);
      }
      assert.equal(command, "weasyprint");
      if (args.includes("--info")) return ok("WeasyPrint version 70.0\n");
      if (args.includes("--help")) return ok("--allowed-protocols ALLOWED_PROTOCOLS\n");
      assert.equal(args[args.indexOf("--base-url") + 1], dir);
      assert.equal(args[args.indexOf("--allowed-protocols") + 1], "file,data");
      rendererInput = await readFile(args.at(-2)!, "utf8");
      await writeFile(args.at(-1)!, "%PDF stub");
      return ok();
    },
  });
  assert.deepEqual(conversions, fixture.split ? ["markdown:json", "json:html"] : ["markdown:html"]);
  const html = await readFile(publishedHtml, "utf8");
  assert.equal(rendererInput, html);
  assert.equal(await readFile(output, "utf8"), "%PDF stub");
  checkRenderedHtml(fixture, html, sourceArgument(input), referenceHtml);
  return publishedHtml;
}
