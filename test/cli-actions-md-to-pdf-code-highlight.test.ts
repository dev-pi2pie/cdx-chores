import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { MARKDOWN_PDF_CODE_CLASSES } from "../src/cli/markdown-pdf/code-style";
import { highlightMarkdownPdfCodeBlocks } from "../src/cli/markdown-pdf/code-highlight";
import type { EffectiveMarkdownPdfCodeOptions } from "../src/cli/markdown-pdf";
import { pandocTest } from "./cli-actions-md-to-pdf.helpers";

const CODE_OPTIONS: EffectiveMarkdownPdfCodeOptions = {
  highlight: true,
  theme: "github-light",
  lineNumbers: false,
  transformerNotation: false,
};

const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "docs", "markdown-pdf-code");

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;

function pandocHtmlFixture(fileName: string): string {
  const fixturePath = join(FIXTURE_DIR, fileName);
  const proc = Bun.spawnSync({
    cmd: ["pandoc", fixturePath, "--standalone", "--from", "markdown", "--to", "html"],
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(proc.exitCode).toBe(0);
  return Buffer.from(proc.stdout).toString("utf8");
}

function countClass(html: string, className: string): number {
  return html.match(new RegExp(className, "g"))?.length ?? 0;
}

function isElement(node: Parse5Node): node is Parse5Element {
  return "tagName" in node;
}

function attrValue(node: Parse5Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function classList(node: Parse5Element): string[] {
  return attrValue(node, "class")?.split(/\s+/).filter(Boolean) ?? [];
}

function collectText(node: Parse5Node): string {
  if (node.nodeName === "#text" && "value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("childNodes" in node) {
    return node.childNodes.map(collectText).join("");
  }
  return "";
}

function collectElements(node: Parse5Node, elements: Parse5Element[] = []): Parse5Element[] {
  if (isElement(node)) {
    elements.push(node);
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      collectElements(child, elements);
    }
  }
  return elements;
}

function lineElements(html: string): Parse5Element[] {
  return collectElements(parse(html)).filter((node) =>
    classList(node).includes(MARKDOWN_PDF_CODE_CLASSES.shikiLine),
  );
}

function expectLineTextState(html: string, text: string, className: string): void {
  const line = lineElements(html).find((node) => collectText(node).includes(text));
  expect(line).toBeDefined();
  expect(classList(line as Parse5Element)).toContain(className);
}

function expectLineTextWithoutState(html: string, text: string, className: string): void {
  const line = lineElements(html).find((node) => collectText(node).includes(text));
  expect(line).toBeDefined();
  expect(classList(line as Parse5Element)).not.toContain(className);
}

function expectNumberedLineState(html: string, lineNumber: number, className: string): void {
  const line = lineElements(html).find((node) => attrValue(node, "data-line") === String(lineNumber));
  expect(line).toBeDefined();
  expect(classList(line as Parse5Element)).toContain(className);
}

describe("markdown PDF Shiki code highlighting", () => {
  test("highlights supported language fences and adds stable hook classes", async () => {
    const html = [
      "<!DOCTYPE html>",
      '<html><body><pre id="sample"><code class="language-js">const x = 1;</code></pre></body></html>',
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain('id="sample"');
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.block);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.content);
    expect(result).toContain("shiki");
    expect(result).toContain("github-light");
  });

  test("strips code font-family styles from highlighted output", async () => {
    const html =
      '<html><body><pre style="font-family: Source Code Pro; background: #fff"><code class="language-js">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("background-color");
    expect(result).not.toContain("font-family");
  });

  test("marks no-language and non-bundled-language blocks as plain", async () => {
    const html = [
      "<html><body>",
      "<pre><code>plain text</code></pre>",
      '<pre><code class="language-not-real">x</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.plainBlock, "g"))).toHaveLength(2);
    expect(result).toContain("plain text");
    expect(result).toContain("language-not-real");
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
  });

  test("normalizes Pandoc sourceCode aliases before highlighting", async () => {
    const html =
      '<html><body><pre class="sourceCode bash"><code class="sourceCode bash">echo ok</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
    expect(result).toContain("shiki");
    expect(result).toContain("echo");
  });

  test("finds supported Pandoc sourceCode language after extra classes", async () => {
    const html =
      '<html><body><pre class="sourceCode numberLines javascript"><code class="sourceCode numberLines javascript">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
    expect(result).toContain("shiki");
  });

  test("highlights bundled Shiki languages beyond the smoke fixture set", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-json">{"ok":true}</code></pre>',
      '<pre><code class="language-rust">let ok = true;</code></pre>',
      '<pre><code class="language-c++">auto ok = true;</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(
      result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock, "g")) ?? [],
    ).toHaveLength(3);
    expect(result).toContain("shiki");
    expect(result).toContain("ok");
  });

  test("generates profile-controlled line number markup for highlighted blocks", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-py">print("one")\nprint("two")</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      lineNumbers: true,
    });

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.numberedBlock);
    expect(result.match(/class="line cdx-code-line"/g)).toHaveLength(2);
    expect(result).toContain('class="cdx-code-line-number" aria-hidden="true">1</span>');
    expect(result).toContain('class="cdx-code-line-number" aria-hidden="true">2</span>');
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineContent);
    expect(result).toContain('data-line="1"');
    expect(result).toContain('data-line="2"');
    expect(result).not.toContain("</span>\n<span");
  });

  test("keeps plain blocks unnumbered when line numbers are enabled", async () => {
    const html = [
      "<html><body>",
      "<pre><code>plain text</code></pre>",
      '<pre><code class="language-not-real">x</code></pre>',
      '<pre><code class="language-js">const x = 1;</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      lineNumbers: true,
    });

    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.plainBlock, "g"))).toHaveLength(2);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.numberedBlock, "g"))).toHaveLength(1);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g"))).toHaveLength(1);
  });

  test("applies opt-in transformer notation classes and removes marker comments", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const removed = false; // [!code --]\n",
      "const focused = true; // [!code focus]\n",
      "const failed = false; // [!code error]\n",
      "const maybe = true; // [!code warning]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      transformerNotation: true,
    });

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
    expect(result).not.toContain("[!code");
    expect(result).not.toContain("has-highlighted");
    expect(result).not.toContain("has-diff");
    expect(result).not.toContain("has-focused");
    expect(result).not.toContain("has-error");
    expect(result).toContain("kept");
    expect(result).toContain("added");
    expect(result).toContain("removed");
    expect(result).toContain("focused");
    expect(result).toContain("failed");
    expect(result).toContain("maybe");
  });

  test("applies opt-in transformer notation ranges", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const highlightedOne = true; // [!code highlight:2]\n",
      "const highlightedTwo = true;\n",
      "const insertedOne = true; // [!code ++:2]\n",
      "const insertedTwo = true;\n",
      "const deletedOne = false; // [!code --:2]\n",
      "const deletedTwo = false;\n",
      "const focusedOne = true; // [!code focus:2]\n",
      "const focusedTwo = true;\n",
      "const errorOne = false; // [!code error:2]\n",
      "const errorTwo = false;\n",
      "const warningOne = true; // [!code warning:2]\n",
      "const warningTwo = true;",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      transformerNotation: true,
    });

    expect(
      result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted, "g")) ?? [],
    ).toHaveLength(2);
    expect(
      result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineInserted, "g")) ?? [],
    ).toHaveLength(2);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineDeleted, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineFocused, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineError, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineWarning, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result).not.toContain("[!code");
  });

  test("leaves transformer notation markers inert when the feature is disabled", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const removed = false; // [!code --]\n",
      "const focused = true; // [!code focus]\n",
      "const failed = false; // [!code error]\n",
      "const maybe = true; // [!code warning]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("[!code highlight]");
    expect(result).toContain("[!code ++]");
    expect(result).toContain("[!code --]");
    expect(result).toContain("[!code focus]");
    expect(result).toContain("[!code error]");
    expect(result).toContain("[!code warning]");
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
  });

  test("combines transformer notation with line number markup", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const focused = true; // [!code focus]\n",
      "const failed = false; // [!code error]\n",
      "const maybe = true; // [!code warning]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      lineNumbers: true,
      transformerNotation: true,
    });

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.numberedBlock);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g"))).toHaveLength(5);
    expect(result).not.toContain("[!code");
  });

  test("preserves surrounding content while replacing multiple code blocks", async () => {
    const html = [
      "<html><body>",
      "<h1>Before</h1>",
      '<pre><code class="language-js">const x = 1;</code></pre>',
      "<p>Between</p>",
      '<pre><code class="language-yaml">enabled: true</code></pre>',
      "<footer>After</footer>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("<h1>Before</h1>");
    expect(result).toContain("<p>Between</p>");
    expect(result).toContain("<footer>After</footer>");
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock, "g"))).toHaveLength(
      2,
    );
  });

  test("returns original HTML when highlighting is disabled", async () => {
    const html =
      '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      highlight: false,
    });

    expect(result).toBe(html);
  });

  pandocTest("transforms required Pandoc fixture HTML with stable code hooks", async () => {
    const cases = [
      {
        fileName: "code-basic.md",
        options: CODE_OPTIONS,
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
      },
      {
        fileName: "code-plain-and-unsupported.md",
        options: CODE_OPTIONS,
        expectedHighlighted: 0,
        expectedPlain: 2,
        expectedTheme: undefined,
      },
      {
        fileName: "code-wrapping.md",
        options: { ...CODE_OPTIONS, theme: "light-plus" as const },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "light-plus",
      },
      {
        fileName: "code-mixed-content.md",
        options: CODE_OPTIONS,
        expectedHighlighted: 2,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedContent: ["Intro paragraph before code.", "<table>"],
      },
      {
        fileName: "code-line-numbers.md",
        options: { ...CODE_OPTIONS, lineNumbers: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedLineNumbers: 4,
      },
      {
        fileName: "code-transformer-highlight-line.md",
        options: { ...CODE_OPTIONS, transformerNotation: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedClasses: [MARKDOWN_PDF_CODE_CLASSES.lineHighlighted],
        rejectedContent: ["[!code", "has-highlighted", "has-diff"],
      },
      {
        fileName: "code-transformer-diff.md",
        options: { ...CODE_OPTIONS, transformerNotation: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedClasses: [
          MARKDOWN_PDF_CODE_CLASSES.lineInserted,
          MARKDOWN_PDF_CODE_CLASSES.lineDeleted,
        ],
        rejectedContent: ["[!code", "has-highlighted", "has-diff"],
      },
      {
        fileName: "code-transformer-focus.md",
        options: { ...CODE_OPTIONS, transformerNotation: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedClasses: [MARKDOWN_PDF_CODE_CLASSES.lineFocused],
        expectedClassCounts: [{ className: MARKDOWN_PDF_CODE_CLASSES.lineFocused, count: 3 }],
        expectedLineTextStates: [
          { text: "focused = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
          { text: "alsoFocused = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
          { text: "focusedByRange = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
        ],
        rejectedLineTextStates: [
          { text: "normal = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
        ],
        rejectedContent: ["[!code", "has-focused"],
      },
      {
        fileName: "code-transformer-error-warning.md",
        options: { ...CODE_OPTIONS, transformerNotation: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedClasses: [
          MARKDOWN_PDF_CODE_CLASSES.lineError,
          MARKDOWN_PDF_CODE_CLASSES.lineWarning,
        ],
        expectedClassCounts: [
          { className: MARKDOWN_PDF_CODE_CLASSES.lineError, count: 3 },
          { className: MARKDOWN_PDF_CODE_CLASSES.lineWarning, count: 3 },
        ],
        expectedLineTextStates: [
          { text: "failed = false", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
          { text: "errorRange = false", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
          { text: "stillError = false", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
          { text: "maybe = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
          { text: "warningRange = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
          { text: "stillWarning = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
        ],
        rejectedLineTextStates: [
          { text: "valid = true", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
          { text: "valid = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
        ],
        rejectedContent: ["[!code", "has-error-level"],
      },
      {
        fileName: "code-transformer-line-numbers-combined.md",
        options: { ...CODE_OPTIONS, lineNumbers: true, transformerNotation: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedLineNumbers: 6,
        expectedClasses: [
          MARKDOWN_PDF_CODE_CLASSES.lineHighlighted,
          MARKDOWN_PDF_CODE_CLASSES.lineInserted,
          MARKDOWN_PDF_CODE_CLASSES.lineDeleted,
          MARKDOWN_PDF_CODE_CLASSES.lineFocused,
          MARKDOWN_PDF_CODE_CLASSES.lineError,
          MARKDOWN_PDF_CODE_CLASSES.lineWarning,
        ],
        expectedClassCounts: [
          { className: MARKDOWN_PDF_CODE_CLASSES.lineHighlighted, count: 1 },
          { className: MARKDOWN_PDF_CODE_CLASSES.lineDeleted, count: 1 },
          { className: MARKDOWN_PDF_CODE_CLASSES.lineInserted, count: 1 },
          { className: MARKDOWN_PDF_CODE_CLASSES.lineFocused, count: 1 },
          { className: MARKDOWN_PDF_CODE_CLASSES.lineError, count: 1 },
          { className: MARKDOWN_PDF_CODE_CLASSES.lineWarning, count: 1 },
        ],
        expectedNumberedLineStates: [
          { lineNumber: 1, className: MARKDOWN_PDF_CODE_CLASSES.lineHighlighted },
          { lineNumber: 2, className: MARKDOWN_PDF_CODE_CLASSES.lineDeleted },
          { lineNumber: 3, className: MARKDOWN_PDF_CODE_CLASSES.lineInserted },
          { lineNumber: 4, className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
          { lineNumber: 5, className: MARKDOWN_PDF_CODE_CLASSES.lineError },
          { lineNumber: 6, className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
        ],
        rejectedContent: ["[!code", "has-highlighted", "has-diff", "has-focused"],
      },
    ];

    for (const fixtureCase of cases) {
      const result = await highlightMarkdownPdfCodeBlocks(
        pandocHtmlFixture(fixtureCase.fileName),
        fixtureCase.options,
      );

      expect(
        result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock, "g")) ?? [],
      ).toHaveLength(fixtureCase.expectedHighlighted);
      expect(
        result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.plainBlock, "g")) ?? [],
      ).toHaveLength(fixtureCase.expectedPlain);
      if (fixtureCase.expectedTheme) {
        expect(result).toContain(fixtureCase.expectedTheme);
      }
      for (const expectedContent of fixtureCase.expectedContent ?? []) {
        expect(result).toContain(expectedContent);
      }
      for (const expectedClass of fixtureCase.expectedClasses ?? []) {
        expect(result).toContain(expectedClass);
      }
      for (const expectedClassCount of fixtureCase.expectedClassCounts ?? []) {
        expect(countClass(result, expectedClassCount.className)).toBe(expectedClassCount.count);
      }
      for (const expectedLineState of fixtureCase.expectedLineTextStates ?? []) {
        expectLineTextState(result, expectedLineState.text, expectedLineState.className);
      }
      for (const rejectedLineState of fixtureCase.rejectedLineTextStates ?? []) {
        expectLineTextWithoutState(result, rejectedLineState.text, rejectedLineState.className);
      }
      for (const rejectedContent of fixtureCase.rejectedContent ?? []) {
        expect(result).not.toContain(rejectedContent);
      }
      if (fixtureCase.expectedLineNumbers) {
        expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.numberedBlock);
        expect(
          result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g")) ?? [],
        ).toHaveLength(fixtureCase.expectedLineNumbers);
        expect(result).toContain(`data-line="${fixtureCase.expectedLineNumbers}"`);
        expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineContent);
      }
      for (const expectedLineState of fixtureCase.expectedNumberedLineStates ?? []) {
        expectNumberedLineState(
          result,
          expectedLineState.lineNumber,
          expectedLineState.className,
        );
      }
    }
  });

  pandocTest("keeps transformer markers inert in Pandoc fixture HTML when disabled", async () => {
    const result = await highlightMarkdownPdfCodeBlocks(
      pandocHtmlFixture("code-transformer-line-numbers-combined.md"),
      CODE_OPTIONS,
    );

    expect(result).toContain("[!code highlight]");
    expect(result).toContain("[!code --]");
    expect(result).toContain("[!code ++]");
    expect(result).toContain("[!code focus]");
    expect(result).toContain("[!code error]");
    expect(result).toContain("[!code warning]");
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
  });
});
