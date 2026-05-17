import { describe, expect, test } from "bun:test";
import { join } from "node:path";

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
      "const removed = false; // [!code --]",
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
    expect(result).not.toContain("[!code");
    expect(result).not.toContain("has-highlighted");
    expect(result).not.toContain("has-diff");
    expect(result).toContain("kept");
    expect(result).toContain("added");
    expect(result).toContain("removed");
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
      "const deletedTwo = false;",
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
    expect(result).not.toContain("[!code");
  });

  test("leaves transformer notation markers inert when the feature is disabled", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const removed = false; // [!code --]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("[!code highlight]");
    expect(result).toContain("[!code ++]");
    expect(result).toContain("[!code --]");
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
  });

  test("combines transformer notation with line number markup", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]",
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
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g"))).toHaveLength(2);
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
        fileName: "code-transformer-line-numbers-combined.md",
        options: { ...CODE_OPTIONS, lineNumbers: true, transformerNotation: true },
        expectedHighlighted: 1,
        expectedPlain: 0,
        expectedTheme: "github-light",
        expectedLineNumbers: 3,
        expectedClasses: [
          MARKDOWN_PDF_CODE_CLASSES.lineHighlighted,
          MARKDOWN_PDF_CODE_CLASSES.lineInserted,
          MARKDOWN_PDF_CODE_CLASSES.lineDeleted,
        ],
        rejectedContent: ["[!code", "has-highlighted", "has-diff"],
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
    }
  });
});
